import React from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, MapPin, Calendar, MessageSquare } from "lucide-react";
import { useVote } from "@/hooks/useVote";
import { Problem } from "@/lib/types";

interface ProblemCardProps {
  problem: Problem;
  onShowOnMap?: (problem: Problem) => void;
}

const categoryColors: Record<string, string> = {
  roads: "bg-sky-500/10 text-sky-600",
  water: "bg-blue-500/10 text-blue-600",
  electricity: "bg-yellow-500/10 text-yellow-600",
  sanitation: "bg-green-500/10 text-green-600",
  education: "bg-purple-500/10 text-purple-600",
  healthcare: "bg-rose-500/10 text-rose-600",
  pollution: "bg-gray-500/10 text-gray-600",
  safety: "bg-orange-500/10 text-orange-600",
  other: "bg-muted text-muted-foreground",
};

const statusColors: Record<string, string> = {
  reported: "bg-amber-500/10 text-amber-600",
  under_review: "bg-blue-500/10 text-blue-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  in_progress: "bg-indigo-500/10 text-indigo-600",
  completed: "bg-teal-500/10 text-teal-600",
  rejected: "bg-rose-500/10 text-rose-600",
};

const ProblemCard = ({ problem, onShowOnMap }: ProblemCardProps) => {
  const { mutate: vote, isPending: isVoting } = useVote();

  const handleVote = (voteType: 'upvote' | 'downvote') => {
    vote({ problemId: problem.id, voteType });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="glass hover:shadow-lg transition-shadow flex flex-col h-full">
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
            <div className="text-2xl font-bold text-foreground">{problem.votes_count ?? 0}</div>
            <div className="text-xs text-muted-foreground">votes</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 flex-grow">
        <p className="text-muted-foreground text-sm line-clamp-3 mb-3">{problem.description}</p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>
              {typeof problem.latitude === 'number' && typeof problem.longitude === 'number' ? (
                <>{problem.latitude.toFixed(4)}, {problem.longitude.toFixed(4)}</>
              ) : (
                <>—</>
              )}
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
            variant="glass-success"
            size="sm"
            className="flex-1"
            onClick={() => handleVote("upvote")}
            disabled={isVoting}
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Upvote
          </Button>
          <Button
            variant="glass-destructive"
            size="sm"
            className="flex-1"
            onClick={() => handleVote("downvote")}
            disabled={isVoting}
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            Downvote
          </Button>
          <Button variant="glass-primary" size="sm" className="flex-1" asChild>
            <Link to={`/problem/${problem.id}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments {problem.comments_count ? `(${problem.comments_count})` : ''}
            </Link>
          </Button>
          <Button
            variant="glass-primary"
            size="sm"
            className="flex-1"
            onClick={() => onShowOnMap && onShowOnMap(problem)}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Map
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProblemCard;
