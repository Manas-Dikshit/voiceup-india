import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, MapPin, Calendar } from "lucide-react";

interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  votes_count: number;
  status: string;
  created_at: string;
  latitude: number;
  longitude: number;
}

interface ProblemCardProps {
  problem: Problem;
  onVote: (problemId: string, voteType: "upvote" | "downvote") => void;
}

const categoryColors: Record<string, string> = {
  roads: "bg-info/10 text-info",
  water: "bg-blue-500/10 text-blue-500",
  electricity: "bg-yellow-500/10 text-yellow-500",
  sanitation: "bg-green-500/10 text-green-500",
  education: "bg-purple-500/10 text-purple-500",
  healthcare: "bg-red-500/10 text-red-500",
  pollution: "bg-gray-500/10 text-gray-500",
  safety: "bg-orange-500/10 text-orange-500",
  other: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  reported: "bg-warning/10 text-warning",
  under_review: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-accent/10 text-accent",
  rejected: "bg-destructive/10 text-destructive",
};

const ProblemCard = ({ problem, onVote }: ProblemCardProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">{problem.title}</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className={categoryColors[problem.category] || categoryColors.other}>
                {problem.category}
              </Badge>
              <Badge variant="outline" className={statusColors[problem.status]}>
                {problem.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">{problem.votes_count}</div>
            <div className="text-xs text-muted-foreground">votes</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-muted-foreground text-sm line-clamp-3 mb-3">{problem.description}</p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>
              {problem.latitude.toFixed(4)}, {problem.longitude.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(problem.created_at)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onVote(problem.id, "upvote")}
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Upvote
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onVote(problem.id, "downvote")}
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            Downvote
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProblemCard;
