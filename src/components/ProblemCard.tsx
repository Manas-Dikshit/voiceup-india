import React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, MapPin, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { useVote } from "@/hooks/useVote";

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

const ProblemCard = ({ problem }: ProblemCardProps) => {
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
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group"
    >
      <Card
        className="
          hover:shadow-xl transition-all duration-300
          bg-gradient-to-br from-background via-background/95 to-background/80
          border border-border/60 backdrop-blur-sm
          rounded-2xl overflow-hidden
        "
      >
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                {problem.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="secondary"
                  className={categoryColors[problem.category] || categoryColors.other}
                >
                  {problem.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={statusColors[problem.status] || statusColors.reported}
                >
                  {problem.status.replace("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="text-right">
              <div className="text-3xl font-bold text-foreground">
                {problem.votes_count}
              </div>
              <div className="text-xs text-muted-foreground">votes</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <p className="text-muted-foreground text-sm line-clamp-3 mb-3">
            {problem.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary/70" />
              <span>
                {problem.latitude.toFixed(4)}, {problem.longitude.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary/70" />
              <span>{formatDate(problem.created_at)}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t border-border/60">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <motion.div whileTap={{ scale: 0.95 }} className="flex-1 w-full">
              <Button
                variant="outline"
                size="sm"
                className="
                  w-full bg-primary/5 hover:bg-primary/10
                  text-primary border-primary/20
                  transition-colors duration-200
                "
                onClick={() => handleVote("upvote")}
                disabled={isVoting}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Upvote
              </Button>
            </motion.div>

            <motion.div whileTap={{ scale: 0.95 }} className="flex-1 w-full">
              <Button
                variant="outline"
                size="sm"
                className="
                  w-full bg-destructive/5 hover:bg-destructive/10
                  text-destructive border-destructive/20
                  transition-colors duration-200
                "
                onClick={() => handleVote("downvote")}
                disabled={isVoting}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Downvote
              </Button>
            </motion.div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default ProblemCard;
