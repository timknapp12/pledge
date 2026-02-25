-- Add task_definitions column to templates for rehydrating the creation form.
-- The existing todos column stores the computed PledgeTodos output;
-- task_definitions stores the raw TaskDefinition[] input.
ALTER TABLE templates ADD COLUMN task_definitions jsonb;
