-- Atomic function to increment user points
-- Used by both frontend (self-settle) and indexer (crank/fallback)
CREATE OR REPLACE FUNCTION increment_points(p_user_id uuid, p_points int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users
  SET points = points + p_points
  WHERE id = p_user_id;
$$;
