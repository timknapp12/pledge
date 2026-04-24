-- Auto-schedule reminder notifications when a pledge is inserted or its
-- reminder_settings is edited.
-- Migration 00016 revoked EXECUTE on schedule_pledge_notifications from
-- the authenticated role, so the client-side RPC call was silently failing
-- (code 42501). Move the call to triggers: triggers run as supabase_admin,
-- which bypasses the revoke without re-granting to clients.

CREATE OR REPLACE FUNCTION trigger_schedule_pledge_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM schedule_pledge_notifications(NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION trigger_schedule_pledge_notifications FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trigger_schedule_pledge_notifications FROM authenticated;
REVOKE EXECUTE ON FUNCTION trigger_schedule_pledge_notifications FROM anon;

-- Insert: fire only when reminder_settings.reminders is a non-empty array
-- (matches the guard previously enforced on the client).
DROP TRIGGER IF EXISTS schedule_notifications_after_pledge_insert ON pledges;

CREATE TRIGGER schedule_notifications_after_pledge_insert
AFTER INSERT ON pledges
FOR EACH ROW
WHEN (
  NEW.reminder_settings IS NOT NULL
  AND jsonb_typeof(NEW.reminder_settings -> 'reminders') = 'array'
  AND jsonb_array_length(NEW.reminder_settings -> 'reminders') > 0
)
EXECUTE FUNCTION trigger_schedule_pledge_notifications();

-- Update: fire on any change to reminder_settings. schedule_pledge_notifications
-- is idempotent — it cancels all pending rows for the pledge before re-inserting,
-- and returns early if reminder_settings is NULL. Behavior:
--   non-empty -> non-empty  : cancel + reschedule
--   non-empty -> null/empty : cancel + return (pendings cleared)
--   null/empty -> non-empty : cancel (no-op) + schedule
DROP TRIGGER IF EXISTS reschedule_notifications_after_pledge_update ON pledges;

CREATE TRIGGER reschedule_notifications_after_pledge_update
AFTER UPDATE OF reminder_settings ON pledges
FOR EACH ROW
WHEN (NEW.reminder_settings IS DISTINCT FROM OLD.reminder_settings)
EXECUTE FUNCTION trigger_schedule_pledge_notifications();
