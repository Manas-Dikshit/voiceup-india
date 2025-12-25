import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Comment } from "./Comment";
import { CommentForm } from "./CommentForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Comment as CommentType } from "@/lib/types";

interface CommentThreadProps {
  topicId: string;
  topicType: "problem" | "solution";
}

const fetchComments = async (topicType: "problem" | "solution", topicId: string): Promise<CommentType[]> => {
  const { data, error } = await supabase
    .from("comments")
    .select(`*, profiles (full_name, role)`)
    .eq("commentable_id", topicId)
    .eq("commentable_type", topicType)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as CommentType[];
};

export const CommentThread = ({ topicId, topicType }: CommentThreadProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryKey = ["comments", topicType, topicId];

  const { data: comments, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchComments(topicType, topicId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`comments:${topicType}:${topicId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, topicId, topicType]);

  const addCommentMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const { error } = await supabase.from("comments").insert({
        user_id: user!.id,
        commentable_id: topicId,
        commentable_type: topicType,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const { error } = await supabase.from("comments").update({ content }).eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (error) return <div className="text-destructive">Error loading comments</div>;

  return (
    <div className="space-y-8">
      <h3 className="text-xl font-semibold">Community Discussion</h3>
      {user && (
        <CommentForm onSubmit={(content) => addCommentMutation.mutateAsync({ content })} submitLabel="Post Comment" />
      )}
      <div className="space-y-6">
        {comments && comments.length > 0 ? (
          comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              onReply={(_, content) => addCommentMutation.mutateAsync({ content })}
              onUpdate={(commentId, content) => updateCommentMutation.mutateAsync({ commentId, content })}
              onDelete={(commentId) => deleteCommentMutation.mutateAsync(commentId)}
            />
          ))
        ) : (
          <p className="text-muted-foreground">No comments yet.</p>
        )}
      </div>
    </div>
  );
};
