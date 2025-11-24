import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

type VoteVars = { problemId: string; voteType: 'upvote' | 'downvote' };

async function voteProblem({ problemId, voteType }: VoteVars) {
  const { error } = await supabase.rpc('vote_problem', {
    problem_id: problemId,
    vote_type: voteType,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export const useVote = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<void, Error, VoteVars, { previousProblems?: any[] }>({
    mutationFn: voteProblem,
    // optimistic update: increment/decrement votes_count locally
    onMutate: async ({ problemId, voteType }: VoteVars) => {
      await queryClient.cancelQueries({ queryKey: ['problems'] });
      await queryClient.cancelQueries({ queryKey: ['nearbyProblems'] });

      // snapshot previous data

      const previousProblems = queryClient.getQueryData<any[]>(['problems']);

      const delta = voteType === 'upvote' ? 1 : -1;

      // update 'problems' list if present
      if (previousProblems) {
        queryClient.setQueryData(['problems'], (old: any[] | undefined) =>
          old?.map(p => (p.id === problemId ? { ...p, votes_count: (p.votes_count || 0) + delta } : p))
        );
      }

      // update all matching 'nearbyProblems' queries (they have keys like ['nearbyProblems', lat, long])
      const allQueries = queryClient.getQueryCache().getAll();
      allQueries.forEach((q) => {
        const key = q.queryKey as any[];
        if (Array.isArray(key) && key[0] === 'nearbyProblems') {
          queryClient.setQueryData(key, (old: any[] | undefined) =>
            old?.map(p => (p.id === problemId ? { ...p, votes_count: (p.votes_count || 0) + delta } : p))
          );
        }
      });

      return { previousProblems };
    },
    onError: (err: unknown, _vars, context: any) => {
      // rollback
      if (context?.previousProblems) {
        queryClient.setQueryData(['problems'], context.previousProblems);
      }
      // NOTE: we only roll back the main 'problems' query snapshot here.

      const message = (err as any)?.message || 'An unknown error occurred.';
      toast({ title: 'Vote error', description: message, variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Vote recorded', description: 'Your vote has been recorded.' });

      // ensure all relevant lists refresh: match exact 'problems' and any 'nearbyProblems' queries with extra params
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'nearbyProblems' });
      // also refresh any votes summary used on maps or other views
      queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'votesForMap' });
    },
    onSettled: () => {
      // keep empty; invalidation done in onSuccess to avoid showing success on error
    },
  });
};

export default useVote;
