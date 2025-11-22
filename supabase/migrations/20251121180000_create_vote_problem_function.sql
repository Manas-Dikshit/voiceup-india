
create or replace function vote_problem(problem_id uuid, vote_type "vote_type")
returns void
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into votes (user_id, votable_id, votable_type, vote_type)
  values (auth.uid(), problem_id, 'problem', vote_type)
  on conflict (user_id, votable_id, votable_type)
  do update set vote_type = excluded.vote_type;
end;
$$;

-- drop existing trigger
drop trigger if exists a_votes_count on problems;

-- generic vote counting trigger
create or replace function count_votes_trigger()
returns trigger
language plpgsql
as $$
declare
  vote_diff int;
begin
  if TG_OP = 'INSERT' then
    vote_diff := case when NEW.vote_type = 'upvote' then 1 else -1 end;
  elseif TG_OP = 'UPDATE' then
    if OLD.vote_type = NEW.vote_type then
      return null; -- no change
    else
      -- Switching vote (e.g., upvote -> downvote)
      vote_diff := case when NEW.vote_type = 'upvote' then 2 when NEW.vote_type = 'downvote' then -2 else 0 end;
    end if;
  elseif TG_OP = 'DELETE' then
    vote_diff := case when OLD.vote_type = 'upvote' then -1 else 1 end;
  else
    return null;
  end if;

  update problems
  set votes_count = votes_count + vote_diff
  where id = coalesce(NEW.votable_id, OLD.votable_id);

  return null;
end;
$$;

create trigger count_votes
after insert or update or delete on votes
for each row
execute function count_votes_trigger();
