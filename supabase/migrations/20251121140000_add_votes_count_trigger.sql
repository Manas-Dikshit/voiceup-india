-- Function to update the votes_count on the target table (problems or solutions)
CREATE OR REPLACE FUNCTION public.update_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_votable_id UUID;
  target_votable_type TEXT;
  upvotes_count INT;
  downvotes_count INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_votable_id := OLD.votable_id;
    target_votable_type := OLD.votable_type;
  ELSE
    target_votable_id := NEW.votable_id;
    target_votable_type := NEW.votable_type;
  END IF;

  SELECT
    COUNT(*) INTO upvotes_count
  FROM public.votes
  WHERE votable_id = target_votable_id
    AND votable_type = target_votable_type
    AND vote_type = 'upvote';

  SELECT
    COUNT(*) INTO downvotes_count
  FROM public.votes
  WHERE votable_id = target_votable_id
    AND votable_type = target_votable_type
    AND vote_type = 'downvote';

  IF target_votable_type = 'problem' THEN
    UPDATE public.problems
    SET votes_count = upvotes_count - downvotes_count
    WHERE id = target_votable_id;
  ELSIF target_votable_type = 'solution' THEN
    UPDATE public.solutions
    SET votes_count = upvotes_count - downvotes_count
    WHERE id = target_votable_id;
  END IF;

  RETURN NULL; -- result is ignored since this is an AFTER trigger
END;
$$;

-- Trigger to update votes_count on vote change
CREATE TRIGGER on_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.update_votes_count();
