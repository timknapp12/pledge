-- Goals (one-time tasks) get their own per-pledge completion array.
--
-- Before this migration, goal completion was stored as positional indices
-- in daily_progress.todos_completed (after the daily-task indices for that
-- date). That broke in three ways:
--   1. Per-date storage for a per-pledge concept — checking a goal on day N
--      didn't appear on day N+1.
--   2. Goals were filtered out of the "Yesterday" tab entirely.
--   3. Index drift across days (goal slot = dailyTasks(date).length + g),
--      so the same numeric index meant different things on different days.
--
-- Fix: one boolean[] per pledge, aligned to todos.goals.

ALTER TABLE pledges
  ADD COLUMN goals_completed boolean[] NOT NULL DEFAULT '{}';

-- Back-fill from existing daily_progress rows. For each pledge with goals,
-- a goal is "done" if any day's todos_completed array contains the index
-- (daily_task_count_for_that_day + goal_index).
DO $$
DECLARE
  pledge_row     RECORD;
  goal_count     INT;
  completed      BOOLEAN[];
  dp_row         RECORD;
  day_task_count INT;
  goal_index     INT;
BEGIN
  FOR pledge_row IN
    SELECT id, todos FROM pledges
  LOOP
    goal_count := jsonb_array_length(
      COALESCE(pledge_row.todos->'goals', '[]'::jsonb)
    );

    IF goal_count = 0 THEN
      CONTINUE; -- default '{}' is correct
    END IF;

    completed := array_fill(false, ARRAY[goal_count]);

    FOR dp_row IN
      SELECT date, todos_completed
      FROM daily_progress
      WHERE pledge_id = pledge_row.id
    LOOP
      day_task_count := jsonb_array_length(
        COALESCE(pledge_row.todos->'daily'->(dp_row.date::text), '[]'::jsonb)
      );

      FOR goal_index IN 0..(goal_count - 1) LOOP
        IF EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(dp_row.todos_completed) AS t(val)
          WHERE val::int = day_task_count + goal_index
        ) THEN
          -- PG arrays are 1-indexed
          completed[goal_index + 1] := TRUE;
        END IF;
      END LOOP;
    END LOOP;

    UPDATE pledges SET goals_completed = completed WHERE id = pledge_row.id;
  END LOOP;
END $$;

-- Strip stale goal-slot indices out of daily_progress so the new convention
-- is enforced (daily_progress holds only daily-task indices).
UPDATE daily_progress dp
SET todos_completed = (
  SELECT COALESCE(jsonb_agg(elem::int ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements_text(dp.todos_completed)
       WITH ORDINALITY AS x(elem, ord)
  WHERE elem::int < jsonb_array_length(
    COALESCE(
      (SELECT todos->'daily'->(dp.date::text) FROM pledges WHERE id = dp.pledge_id),
      '[]'::jsonb
    )
  )
);
