-- Add merged_into column to problems and create an audit table for merges
BEGIN;

-- Ensure extension for random UUIDs exists (works on Supabase/Postgres)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.problems
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.problems(id);

CREATE TABLE IF NOT EXISTS public.problem_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  merged_problem_id uuid NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  merged_at timestamptz NOT NULL DEFAULT now(),
  merged_by text,
  reason text
);

CREATE INDEX IF NOT EXISTS idx_problem_merges_master ON public.problem_merges(master_problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_merges_merged ON public.problem_merges(merged_problem_id);

COMMIT;
