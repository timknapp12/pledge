# Notification System

## Architecture Overview

Pledge uses a **pre-schedule** model: when a pledge is created with reminder settings, all notification rows are inserted upfront into the `notifications` table with exact UTC `scheduled_for` timestamps. A pg_cron job fires every 2 minutes, calling the `send-notification` Edge Function which queries for due pending rows and sends them via the Expo Push API.

```
Pledge Created (with reminders)
  -> schedule_pledge_notifications() inserts N rows
  -> pg_cron fires every 2 minutes
  -> send-notification Edge Function:
       1. SELECT * FROM notifications WHERE status='pending' AND scheduled_for <= now()
       2. Skip users with no push_token or notifications_enabled=false
       3. POST to Expo Push API
       4. UPDATE status='sent', sent_at=now()
  -> On pledge completion/deletion:
       UPDATE status='cancelled' WHERE pledge_id=X AND status='pending'
```

**Why pre-schedule over just-in-time:**
- The `notifications` table already has the right schema and partial index for this pattern
- Edge Function stays trivially simple (no date math at send time)
- Row count is manageable (~32 rows for a 30-day pledge with daily + 2 deadline reminders)
- Cancellation is a single UPDATE statement

---

## Database Schema

### Columns on `users`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `push_token` | text | null | Expo push token (e.g., `ExponentPushToken[...]`) |
| `notifications_enabled` | boolean | false | Master toggle for notifications |
| `timezone` | text | `'America/New_York'` | IANA timezone for scheduling (e.g., `'America/Chicago'`) |

### Columns on `pledges`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `reminder_settings` | jsonb | null | Per-pledge reminder config |

**`reminder_settings` structure:**
```json
{
  "reminders": [
    { "type": "daily", "time": "09:00" },
    { "type": "before_deadline", "hours": 24 },
    { "type": "before_deadline", "hours": 1 }
  ]
}
```

### `notifications` table

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | uuid | gen_random_uuid() | Primary key |
| `user_id` | uuid | | FK to users |
| `pledge_id` | uuid | | FK to pledges |
| `type` | text | | `'daily_reminder'`, `'deadline_24h'`, `'deadline_1h'`, etc. |
| `title` | text | | Push notification title |
| `body` | text | | Push notification body |
| `scheduled_for` | timestamptz | | When to send (UTC) |
| `sent_at` | timestamptz | null | When actually sent |
| `status` | text | `'pending'` | `'pending'`, `'sent'`, `'cancelled'`, `'failed'` |
| `error_message` | text | null | Error details if failed |
| `created_at` | timestamptz | now() | Row creation time |

**Indexes:**
- `idx_notifications_pending_scheduled` - Partial index on `(status, scheduled_for) WHERE status = 'pending'` (used by Edge Function query)
- `idx_notifications_user`, `idx_notifications_pledge` - For cancellation queries

---

## `schedule_pledge_notifications` Postgres Function

**Signature:** `schedule_pledge_notifications(p_pledge_id uuid, p_user_id uuid)`

**Behavior:**
1. Cancel any existing pending notifications for this pledge (safe to re-call on edits)
2. Load the pledge's `reminder_settings`, `name`, `start_date`, `end_date`, `deadline`
3. Load the user's `timezone`
4. For each `daily` reminder: insert one row per day from `start_date` to `end_date`, converting `HH:mm` in user's timezone to UTC via `(date + time) AT TIME ZONE tz`
5. For each `before_deadline` reminder: insert one row at `deadline - N hours`
6. Only insert rows where `scheduled_for` is in the future
7. Marked as `SECURITY DEFINER` to bypass RLS (called via `supabase.rpc()` from client)

**Example output for a 7-day pledge with daily 09:00 + 24h/1h before deadline:**
- 7 daily reminder rows (one per day at 09:00 user-local -> UTC)
- 1 row at deadline - 24 hours
- 1 row at deadline - 1 hour
- Total: 9 rows

---

## `send-notification` Edge Function

**Location:** `supabase/functions/send-notification/index.ts`

**Triggered by:** pg_cron every 2 minutes via `net.http_post`

**Flow:**
1. Query `notifications` joined with `users` for `push_token` where `status='pending' AND scheduled_for <= now()`
2. Skip notifications where user has no `push_token` or `notifications_enabled=false` - mark those as `cancelled`
3. Batch send remaining to Expo Push API (`https://exp.host/--/api/v2/push/send`)
4. Mark sent notifications as `sent` with `sent_at = now()`
5. Handle error responses:
   - `DeviceNotRegistered`: clear user's `push_token`, set `notifications_enabled=false`, cancel all their pending notifications
   - Other errors: mark notification as `failed` with `error_message`
6. Use `channelId: 'reminders'` to match the existing Android notification channel

**Authorization:** Called by pg_cron using the service role key in the Authorization header.

---

## pg_cron Setup

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job
SELECT cron.schedule(
  'send-pending-notifications',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Note:** `app.settings.supabase_url` and `app.settings.service_role_key` are set by Supabase automatically for hosted projects. For local dev, these need to be configured manually or the cron job can be tested by calling the Edge Function directly.

---

## Client-Side Flows

### 1. Timezone Storage (AuthContext)

On every successful auth (session restore or fresh connect):
```typescript
import * as Localization from 'expo-localization';
const tz = Localization.getCalendars()[0]?.timeZone ?? 'America/New_York';
await supabase.from('users').update({ timezone: tz }).eq('id', user.id);
```

### 2. Scheduling After Pledge Creation (useSupabase.ts)

In `useCreatePledgeInDb`, after successful insert:
```typescript
if (pledge.reminder_settings?.reminders?.length) {
  await supabase.rpc('schedule_pledge_notifications', {
    p_pledge_id: data.id,
    p_user_id: user.id,
  });
}
```

### 3. Cancellation on Status Change (useSupabase.ts)

In `useUpdatePledgeStatus`, when status becomes `Completed` or `Forfeited`:
```typescript
if (status === 'Completed' || status === 'Forfeited') {
  await supabase
    .from('notifications')
    .update({ status: 'cancelled' })
    .eq('pledge_id', pledgeId)
    .eq('status', 'pending');
}
```

### 4. Permission Revocation Sync (useNotifications.ts)

An `AppState` listener checks permission on foreground resume:
```typescript
AppState.addEventListener('change', async (nextState) => {
  if (nextState === 'active') {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && permissionStatus === 'granted') {
      // Permission was revoked in system settings
      await supabase.from('users').update({
        notifications_enabled: false,
      }).eq('id', user.id);
    }
    setPermissionStatus(status);
  }
});
```

### 5. Profile Screen Toggle

The Notifications row in Profile Settings renders a `Switch` instead of a chevron:

- **ON -> OFF:** Updates `users.notifications_enabled = false` and `push_token = null`, cancels all pending notifications for that user
- **OFF -> ON:** Calls `registerForPushNotifications()` which requests permission (if needed), gets token, stores token + `notifications_enabled = true`
- The Edge Function already skips users with `notifications_enabled = false`, so the toggle is the single source of truth

---

## Error Handling

### DeviceNotRegistered
When Expo Push API returns `DeviceNotRegistered` for a token:
1. Clear the user's `push_token`
2. Set `notifications_enabled = false`
3. Cancel all their pending notifications
4. User will need to re-enable notifications in the app (which re-requests permission and gets a fresh token)

### Stale Tokens
Tokens can become stale when:
- User uninstalls and reinstalls the app
- User clears app data
- Token rotation by Expo

The `DeviceNotRegistered` handler covers these cases. Additionally, `registerForPushNotifications()` always fetches a fresh token and updates the DB.

### Network Failures
If the Edge Function fails to reach Expo's API:
- Notifications remain in `pending` status
- Next cron run (2 minutes later) will retry them
- Natural retry without extra code

### Permission Revocation
If user revokes notification permission in Android settings:
- `AppState` listener detects this on next foreground
- Updates `notifications_enabled = false` in DB
- Edge Function skips this user on next run
- All pending notifications stay as-is (not cancelled) so they can resume if re-enabled
