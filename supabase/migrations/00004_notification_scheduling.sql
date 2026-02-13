-- Add timezone column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';

-- Drop unused legacy column (replaced by per-pledge reminder_settings on pledges table)
ALTER TABLE users DROP COLUMN IF EXISTS notification_preferences;

-- Create the scheduling function
CREATE OR REPLACE FUNCTION schedule_pledge_notifications(p_pledge_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pledge RECORD;
  v_user_tz text;
  v_current_date date;
  v_end date;
  v_daily_time time;
  v_scheduled_utc timestamptz;
  v_reminder RECORD;
BEGIN
  -- Cancel any existing pending notifications for this pledge (safe for re-calls on edit)
  UPDATE notifications
  SET status = 'cancelled'
  WHERE pledge_id = p_pledge_id
    AND status = 'pending';

  -- Load pledge data
  SELECT name, start_date, end_date, deadline, reminder_settings
  INTO v_pledge
  FROM pledges
  WHERE id = p_pledge_id;

  IF v_pledge IS NULL OR v_pledge.reminder_settings IS NULL THEN
    RETURN;
  END IF;

  -- Load user timezone
  SELECT COALESCE(timezone, 'America/New_York')
  INTO v_user_tz
  FROM users
  WHERE id = p_user_id;

  -- Iterate over each reminder config in reminder_settings.reminders
  FOR v_reminder IN
    SELECT * FROM jsonb_array_elements(v_pledge.reminder_settings -> 'reminders') AS r
  LOOP
    IF (v_reminder.value ->> 'type') = 'daily' THEN
      -- Daily reminders: one row per day from start_date to end_date
      v_daily_time := (v_reminder.value ->> 'time')::time;
      v_current_date := (v_pledge.start_date AT TIME ZONE v_user_tz)::date;
      v_end := (v_pledge.end_date AT TIME ZONE v_user_tz)::date;

      WHILE v_current_date <= v_end LOOP
        -- Convert local date + time to UTC
        v_scheduled_utc := (v_current_date + v_daily_time) AT TIME ZONE v_user_tz;

        -- Only schedule future notifications
        IF v_scheduled_utc > now() THEN
          INSERT INTO notifications (user_id, pledge_id, type, title, body, scheduled_for)
          VALUES (
            p_user_id,
            p_pledge_id,
            'daily_reminder',
            'Daily Reminder',
            'Time to work on "' || v_pledge.name || '"!',
            v_scheduled_utc
          );
        END IF;

        v_current_date := v_current_date + 1;
      END LOOP;

    ELSIF (v_reminder.value ->> 'type') = 'before_deadline' THEN
      -- Before-deadline reminders: one row at deadline - N hours
      v_scheduled_utc := v_pledge.deadline - ((v_reminder.value ->> 'hours')::int * interval '1 hour');

      IF v_scheduled_utc > now() THEN
        INSERT INTO notifications (user_id, pledge_id, type, title, body, scheduled_for)
        VALUES (
          p_user_id,
          p_pledge_id,
          'deadline_' || (v_reminder.value ->> 'hours') || 'h',
          'Deadline Approaching',
          '"' || v_pledge.name || '" is due in ' || (v_reminder.value ->> 'hours') || ' hour(s)!',
          v_scheduled_utc
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Enable pg_cron and pg_net extensions (required for scheduled Edge Function calls)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job to fire every 2 minutes
-- NOTE: app.settings.* are not available on all Supabase projects.
-- Replace YOUR_SUPABASE_URL and YOUR_SERVICE_ROLE_KEY with actual values
-- from Dashboard -> Settings -> API before running.
SELECT cron.schedule(
  'send-pending-notifications',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SUPABASE_URL/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
