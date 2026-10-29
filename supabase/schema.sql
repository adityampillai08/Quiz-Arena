-- Quiz Arena: Supabase global leaderboard schema.
-- This script is safe to run multiple times.

-- Create the table that stores quiz scores.
-- IF NOT EXISTS prevents errors when the table already exists.
CREATE TABLE IF NOT EXISTS public.high_scores (
  -- Generate a unique ID for each score automatically.
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Store a player name with surrounding spaces removed for validation.
  player_name text NOT NULL
    CHECK (char_length(trim(player_name)) BETWEEN 1 AND 20),

  -- Store the score and reject values outside the allowed range.
  score integer NOT NULL
    CHECK (score BETWEEN 0 AND 5000),

  -- Store the number of correct answers.
  correct_count integer NOT NULL,

  -- Store the total number of questions.
  total integer NOT NULL
    CHECK (total BETWEEN 1 AND 50),

  -- A category ID of 0 means any category.
  category_id integer NOT NULL DEFAULT 0,

  -- Keep category labels short enough for the interface.
  category_name text NOT NULL
    CHECK (char_length(category_name) <= 80),

  -- Only allow the three supported difficulty levels.
  difficulty text NOT NULL
    CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Record when the score was submitted.
  created_at timestamptz NOT NULL DEFAULT now(),

  -- A correct-answer count cannot be negative or exceed the total.
  CONSTRAINT high_scores_correct_count_check
    CHECK (correct_count BETWEEN 0 AND total)
);

-- Speed up leaderboard queries that sort by score and submission time.
CREATE INDEX IF NOT EXISTS high_scores_score_created_at_idx
  ON public.high_scores (score DESC, created_at ASC);

-- Speed up leaderboard queries filtered by difficulty.
CREATE INDEX IF NOT EXISTS high_scores_difficulty_score_idx
  ON public.high_scores (difficulty, score DESC);

-- Enable Row Level Security (RLS) on the table.
-- RLS requires requests to satisfy the policies defined below.
ALTER TABLE public.high_scores ENABLE ROW LEVEL SECURITY;

-- Remove the existing policies first so this script can be rerun.
DROP POLICY IF EXISTS "Anyone can read high scores"
  ON public.high_scores;

DROP POLICY IF EXISTS "Anyone can submit high scores"
  ON public.high_scores;

-- Allow visitors using the public anon key or authenticated users
-- to read leaderboard entries.
CREATE POLICY "Anyone can read high scores"
  ON public.high_scores
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow visitors using the public anon key or authenticated users
-- to submit new scores.
CREATE POLICY "Anyone can submit high scores"
  ON public.high_scores
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- There are intentionally no UPDATE or DELETE policies.
-- Browser clients can read and insert scores but cannot update or
-- delete existing rows through normal RLS-protected requests.

-- Add a table description for future maintainers.
COMMENT ON TABLE public.high_scores IS
  'Quiz Arena global leaderboard scores. Public read and insert; no update or delete policies.';
