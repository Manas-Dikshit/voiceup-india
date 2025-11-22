import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CommentThread } from "@/components/comments/CommentThread";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Calendar } from "lucide-react";

const fetchProblem = async (problemId: string) => {
  const { data, error } = await supabase
    .from("problems")
    .select("*, profiles(full_name)")
    .eq("id", problemId)
    .single();

  if (error) throw error;
  return data;
};

const ProblemDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: problem, isLoading, error } = useQuery({
    queryKey: ["problem", id],
    queryFn: () => fetchProblem(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive text-center p-4">Error: {error.message}</div>;
  }

  if (!problem) {
    return <div className="text-center p-4">Problem not found.</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{problem.title}</CardTitle>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2">
            <Badge variant="secondary">{problem.category}</Badge>
            <Badge variant="outline">{problem.status.replace("_", " ")}</Badge>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{new Date(problem.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{problem.latitude.toFixed(4)}, {problem.longitude.toFixed(4)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-base">{problem.description}</p>
          {problem.media_url && (
            <div className="mt-4">
              <img src={problem.media_url} alt="Problem attachment" className="rounded-lg max-w-full h-auto" />
            </div>
          )}
        </CardContent>
      </Card>

      <CommentThread topicId={problem.id} topicType="problem" />
    </div>
  );
};

export default ProblemDetail;
