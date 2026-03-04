-- =============================================
-- 1. Add personality + language columns to users
-- =============================================
ALTER TABLE users ADD COLUMN personality text DEFAULT 'carrot' CHECK (personality IN ('carrot', 'stick'));
ALTER TABLE users ADD COLUMN language text DEFAULT 'en';

-- =============================================
-- 2. Supported languages table (drives the UI picker)
-- =============================================
CREATE TABLE supported_languages (
  code text PRIMARY KEY,          -- 'en', 'es', 'fr', etc.
  label text NOT NULL,            -- 'English', 'Español', 'Français'
  sort_order int DEFAULT 0,       -- for display ordering in the picker
  created_at timestamptz DEFAULT now()
);

-- Seed the two languages we support today
INSERT INTO supported_languages (code, label, sort_order) VALUES
  ('en', 'English', 0),
  ('es', 'Español', 1);

-- Everyone can read (no auth needed — it's public reference data)
ALTER TABLE supported_languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read supported languages"
  ON supported_languages FOR SELECT
  USING (true);

-- =============================================
-- 3. Notification templates table
-- =============================================
-- Multiple rows per (key, personality, language) for variety.
-- The scheduling function picks one at random per notification.
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,               -- 'daily_reminder', 'deadline_approaching'
  personality text NOT NULL CHECK (personality IN ('carrot', 'stick')),
  language text NOT NULL,
  title text NOT NULL,
  body_template text NOT NULL,     -- supports {{pledge_name}}, {{hours}} placeholders
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notification_templates_lookup
  ON notification_templates (key, personality, language);

-- Everyone can read (templates are not user-specific)
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read notification templates"
  ON notification_templates FOR SELECT
  USING (true);

-- =============================================
-- 4. Seed notification templates
-- =============================================

-- === DAILY REMINDER — CARROT / EN ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('daily_reminder', 'carrot', 'en', 'You got this!', 'Time to crush "{{pledge_name}}" today!'),
  ('daily_reminder', 'carrot', 'en', 'Keep the streak alive!', 'Another day, another step toward "{{pledge_name}}"!'),
  ('daily_reminder', 'carrot', 'en', 'Believe in yourself!', 'Small wins add up — let''s work on "{{pledge_name}}"!'),
  ('daily_reminder', 'carrot', 'en', 'Your future self will thank you', '"{{pledge_name}}" is waiting for you. You''ve got this!'),
  ('daily_reminder', 'carrot', 'en', 'One step at a time', 'Progress beats perfection. Time for "{{pledge_name}}"!');

-- === DAILY REMINDER — STICK / EN ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('daily_reminder', 'stick', 'en', 'No excuses', '"{{pledge_name}}" won''t complete itself. Get to work.'),
  ('daily_reminder', 'stick', 'en', 'Your tokens are on the line', 'Skip "{{pledge_name}}" today and you''re throwing money away.'),
  ('daily_reminder', 'stick', 'en', 'Don''t be lazy', '"{{pledge_name}}" is waiting. Stop scrolling and start doing.'),
  ('daily_reminder', 'stick', 'en', 'Clock is ticking', 'Every day you slack on "{{pledge_name}}" costs you. Move.'),
  ('daily_reminder', 'stick', 'en', 'Quitters lose tokens', '"{{pledge_name}}" — are you going to do it or forfeit?');

-- === DAILY REMINDER — CARROT / ES ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('daily_reminder', 'carrot', 'es', '¡Tú puedes!', '¡Es hora de avanzar con "{{pledge_name}}" hoy!'),
  ('daily_reminder', 'carrot', 'es', '¡Mantén la racha!', 'Otro día, otro paso hacia "{{pledge_name}}"!'),
  ('daily_reminder', 'carrot', 'es', '¡Cree en ti!', 'Las pequeñas victorias suman — ¡trabaja en "{{pledge_name}}"!'),
  ('daily_reminder', 'carrot', 'es', 'Tu yo del futuro te lo agradecerá', '"{{pledge_name}}" te espera. ¡Tú puedes!'),
  ('daily_reminder', 'carrot', 'es', 'Paso a paso', 'El progreso supera la perfección. ¡Hora de "{{pledge_name}}"!');

-- === DAILY REMINDER — STICK / ES ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('daily_reminder', 'stick', 'es', 'Sin excusas', '"{{pledge_name}}" no se va a completar solo. Ponte a trabajar.'),
  ('daily_reminder', 'stick', 'es', 'Tus tokens están en juego', 'Si te saltas "{{pledge_name}}" hoy, estás tirando dinero.'),
  ('daily_reminder', 'stick', 'es', 'No seas perezoso', '"{{pledge_name}}" te espera. Deja de perder el tiempo.'),
  ('daily_reminder', 'stick', 'es', 'El reloj no para', 'Cada día que flojeas con "{{pledge_name}}" te cuesta. Muévete.'),
  ('daily_reminder', 'stick', 'es', 'Los que abandonan pierden', '"{{pledge_name}}" — ¿lo vas a hacer o vas a perder?');

-- === DEADLINE APPROACHING — CARROT / EN ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('deadline_approaching', 'carrot', 'en', 'Almost there!', '"{{pledge_name}}" is due in {{hours}} hour(s). You can finish this!'),
  ('deadline_approaching', 'carrot', 'en', 'Final stretch!', 'Only {{hours}} hour(s) left for "{{pledge_name}}". Keep pushing!'),
  ('deadline_approaching', 'carrot', 'en', 'You''re so close!', '"{{pledge_name}}" deadline is in {{hours}} hour(s). Finish strong!');

-- === DEADLINE APPROACHING — STICK / EN ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('deadline_approaching', 'stick', 'en', 'Time''s almost up', '"{{pledge_name}}" is due in {{hours}} hour(s). Don''t blow it.'),
  ('deadline_approaching', 'stick', 'en', 'Last chance', '{{hours}} hour(s) until "{{pledge_name}}" deadline. No more putting it off.'),
  ('deadline_approaching', 'stick', 'en', 'Deadline incoming', '"{{pledge_name}}" in {{hours}} hour(s). Fail now and lose your stake.');

-- === DEADLINE APPROACHING — CARROT / ES ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('deadline_approaching', 'carrot', 'es', '¡Ya casi!', '"{{pledge_name}}" vence en {{hours}} hora(s). ¡Puedes terminarlo!'),
  ('deadline_approaching', 'carrot', 'es', '¡Último tramo!', 'Solo {{hours}} hora(s) para "{{pledge_name}}". ¡Sigue adelante!'),
  ('deadline_approaching', 'carrot', 'es', '¡Estás muy cerca!', 'La fecha límite de "{{pledge_name}}" es en {{hours}} hora(s). ¡Termina fuerte!');

-- === DEADLINE APPROACHING — STICK / ES ===
INSERT INTO notification_templates (key, personality, language, title, body_template) VALUES
  ('deadline_approaching', 'stick', 'es', 'Se acaba el tiempo', '"{{pledge_name}}" vence en {{hours}} hora(s). No lo arruines.'),
  ('deadline_approaching', 'stick', 'es', 'Última oportunidad', '{{hours}} hora(s) para "{{pledge_name}}". Deja de posponerlo.'),
  ('deadline_approaching', 'stick', 'es', 'Fecha límite inminente', '"{{pledge_name}}" en {{hours}} hora(s). Falla ahora y pierde tu apuesta.');

-- =============================================
-- 5. Updated scheduling function (personality + language aware)
-- =============================================
CREATE OR REPLACE FUNCTION schedule_pledge_notifications(p_pledge_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pledge RECORD;
  v_user RECORD;
  v_current_date date;
  v_end date;
  v_daily_time time;
  v_scheduled_utc timestamptz;
  v_reminder RECORD;
  v_template RECORD;
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

  -- Load user preferences (timezone, personality, language)
  SELECT
    COALESCE(timezone, 'America/New_York') AS timezone,
    COALESCE(personality, 'carrot') AS personality,
    COALESCE(language, 'en') AS language
  INTO v_user
  FROM users
  WHERE id = p_user_id;

  -- Iterate over each reminder config in reminder_settings.reminders
  FOR v_reminder IN
    SELECT * FROM jsonb_array_elements(v_pledge.reminder_settings -> 'reminders') AS r
  LOOP
    IF (v_reminder.value ->> 'type') = 'daily' THEN
      -- Daily reminders: one row per day from start_date to end_date
      v_daily_time := (v_reminder.value ->> 'time')::time;
      v_current_date := (v_pledge.start_date AT TIME ZONE v_user.timezone)::date;
      v_end := (v_pledge.end_date AT TIME ZONE v_user.timezone)::date;

      WHILE v_current_date <= v_end LOOP
        -- Convert local date + time to UTC
        v_scheduled_utc := (v_current_date + v_daily_time) AT TIME ZONE v_user.timezone;

        -- Only schedule future notifications
        IF v_scheduled_utc > now() THEN
          -- Pick a random template for this day
          SELECT title, body_template
          INTO v_template
          FROM notification_templates
          WHERE key = 'daily_reminder'
            AND personality = v_user.personality
            AND language = v_user.language
          ORDER BY random()
          LIMIT 1;

          -- Fallback to carrot/en if no template found
          IF v_template IS NULL THEN
            SELECT title, body_template
            INTO v_template
            FROM notification_templates
            WHERE key = 'daily_reminder'
              AND personality = 'carrot'
              AND language = 'en'
            ORDER BY random()
            LIMIT 1;
          END IF;

          IF v_template IS NOT NULL THEN
            INSERT INTO notifications (user_id, pledge_id, type, title, body, scheduled_for)
            VALUES (
              p_user_id,
              p_pledge_id,
              'daily_reminder',
              v_template.title,
              REPLACE(v_template.body_template, '{{pledge_name}}', v_pledge.name),
              v_scheduled_utc
            );
          END IF;
        END IF;

        v_current_date := v_current_date + 1;
      END LOOP;

    ELSIF (v_reminder.value ->> 'type') = 'before_deadline' THEN
      -- Before-deadline reminders: one row at deadline - N hours
      v_scheduled_utc := v_pledge.deadline - ((v_reminder.value ->> 'hours')::int * interval '1 hour');

      IF v_scheduled_utc > now() THEN
        -- Pick a random deadline template
        SELECT title, body_template
        INTO v_template
        FROM notification_templates
        WHERE key = 'deadline_approaching'
          AND personality = v_user.personality
          AND language = v_user.language
        ORDER BY random()
        LIMIT 1;

        -- Fallback to carrot/en
        IF v_template IS NULL THEN
          SELECT title, body_template
          INTO v_template
          FROM notification_templates
          WHERE key = 'deadline_approaching'
            AND personality = 'carrot'
            AND language = 'en'
          ORDER BY random()
          LIMIT 1;
        END IF;

        IF v_template IS NOT NULL THEN
          INSERT INTO notifications (user_id, pledge_id, type, title, body, scheduled_for)
          VALUES (
            p_user_id,
            p_pledge_id,
            'deadline_' || (v_reminder.value ->> 'hours') || 'h',
            v_template.title,
            REPLACE(
              REPLACE(v_template.body_template, '{{pledge_name}}', v_pledge.name),
              '{{hours}}',
              (v_reminder.value ->> 'hours')
            ),
            v_scheduled_utc
          );
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;
