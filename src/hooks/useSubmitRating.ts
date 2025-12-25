import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

type Payload = {
  problemId: string;
  rating: number;
  feedback?: string;
};

export default function useSubmitRating() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ problemId, rating, feedback }: Payload) => {
      // Ensure authenticated
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error('Not authenticated');

      // Ensure profile exists (profiles table may be created by an auth trigger in some setups)
      try {
        const { data: existingProfile, error: profileErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        
        if (profileErr) throw profileErr;
        
        if (!existingProfile) {
          const fullName = (user.user_metadata && (user.user_metadata as any).full_name) || 'Anonymous User';
          const { error: insertProfileErr } = await supabase
            .from('profiles')
            .insert({ id: user.id, full_name: fullName });
          if (insertProfileErr) throw insertProfileErr;
        }
      } catch (err: any) {
        toast({ title: 'Failed to ensure profile', description: err?.message ?? String(err) });
        throw err;
      }

      const payload = {
        problem_id: problemId,
        user_id: user.id,
        rating,
        feedback: feedback ?? null,
      };

      try {
        const { error } = await supabase
          .from('ratings')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
      } catch (err: any) {
        toast({ title: 'Failed to submit review', description: err?.message ?? String(err) });
        throw err;
      }

      // Invalidate queries so UI refreshes after DB trigger updates problem.status
      queryClient.invalidateQueries({ queryKey: ['problem', problemId] });
      queryClient.invalidateQueries({ queryKey: ['nearbyProblemsMap'] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      queryClient.invalidateQueries({ queryKey: ['ratings', problemId] });

      toast({ title: 'Review submitted', description: 'Thank you for your feedback.' });

      return { problemId };
    },
  });
}
