import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Calendar,
  MessageSquare,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useVote } from "@/hooks/useVote";
import { Problem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProblemCardProps {
  problem: Problem;
  currentUserId?: string | null;
  onShowOnMap?: (problem: Problem) => void;
}

interface AISolution {
  text: string;
}

interface AISolutionsResponse {
  suggestions: AISolution[];
  cached: boolean;
}

interface UseAISolutionsReturn {
  loading: boolean;
  suggestions: AISolution[];
  cached: boolean;
  error: string | null;
  regenerate: () => void;
}

const useAISolutions = (problemId: string): UseAISolutionsReturn => {
  const [loading, setLoading] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<AISolution[]>([]);
  const [cached, setCached] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolutions = async (ignoreCache: boolean = false): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "https://wfpxknccdypiwpsoyisx.supabase.co/functions/v1/generate_solutions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId,
            ignoreCache,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: AISolutionsResponse = await response.json();
      setSuggestions(data.suggestions ?? []);
      setCached(data.cached ?? false);
    } catch (err) {
      const message: string =
        err instanceof Error ? err.message : "Failed to fetch solutions";
      setError(message);
      console.warn(`[AI Solutions] Error for problem ${problemId}:`, message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (problemId) {
      fetchSolutions();
    }
  }, [problemId]);

  const regenerate = (): void => {
    fetchSolutions(true);
  };

  return { loading, suggestions, cached, error, regenerate };
};

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

const SkeletonLoader: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div
        key={i}
        className="h-3 rounded-full bg-gray-700 animate-pulse"
        style={{ width: `${75 + Math.random() * 25}%` }}
      />
    ))}
  </div>
);

interface AISolutionsSectionProps {
  loading: boolean;
  suggestions: AISolution[];
  cached: boolean;
  error: string | null;
  onRegenerate: () => void;
}

const AISolutionsSection: React.FC<AISolutionsSectionProps> = ({
  loading,
  suggestions,
  cached,
  error,
  onRegenerate,
}) => {
  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h4 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
          💡 AI Suggested Solutions
          {cached && (
            <Badge className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/40">
              Cached
            </Badge>
          )}
        </h4>
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="text-sm text-blue-400 hover:text-blue-300 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          title="Regenerate AI suggestions"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Regenerate</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && loading ? (
        <SkeletonLoader />
      ) : !error && suggestions.length > 0 ? (
        <div className="space-y-2">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-700 bg-gray-800 p-3 text-gray-200 text-sm leading-relaxed hover:bg-gray-800/80 hover:border-gray-600 transition"
            >
              {suggestion.text}
            </div>
          ))}
        </div>
      ) : !error && suggestions.length === 0 && !loading ? (
        <p className="text-sm text-gray-400 italic">No AI solutions available.</p>
      ) : null}
    </div>
  );
};

const ProblemCard: React.FC<ProblemCardProps> = ({
  problem,
  currentUserId,
  onShowOnMap,
}) => {
  const { t } = useTranslation();
  const { mutate: vote, isPending: isVoting } = useVote();
  const { loading: aiLoading, suggestions, cached, error: aiError, regenerate } =
    useAISolutions(problem.id);
  const currentVote = problem.user_vote ?? null;
  const isUpvoted = currentVote === "upvote";
  const isDownvoted = currentVote === "downvote";

  const handleVote = (voteType: "upvote" | "downvote"): void => {
    vote({ problemId: problem.id, voteType, currentUserId, currentVote });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="relative flex h-full flex-col overflow-hidden border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:shadow-[0_20px_90px_-45px_rgba(99,102,241,0.65)]">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute -left-12 top-0 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {problem.title}
            </h3>
            {/* Moderation feedback for flagged problems */}
            {(problem as any).is_flagged && (
              <div className="mb-2 p-2 rounded bg-rose-100 border border-rose-300 text-rose-700 text-xs">
                <strong>{t('problemCard.flaggedForReview')}</strong>
                {(problem as any).moderation_reason && (
                  <span>: {(problem as any).moderation_reason}</span>
                )}
                {typeof (problem as any).quality_score === "number" && (
                  <span> (Score: {(problem as any).quality_score})</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className={
                  categoryColors[problem.category] || categoryColors.other
                }
              >
                {problem.category}
              </Badge>
              <Badge variant="outline" className={statusColors[problem.status]}>
                {problem.status.replace("_", " ")}
              </Badge>
              {/* show rating summary if present */}
              {typeof (problem as any).rating === "number" && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={`h-4 w-4 ${
                        i < ((problem as any).rating ?? 0)
                          ? "text-amber-400"
                          : "text-muted-foreground"
                      }`}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.172L12 18.896l-7.336 3.87 1.402-8.172L.132 9.21l8.2-1.192z" />
                    </svg>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('problemCard.netVotes')}</div>
            <div className="text-3xl font-black text-foreground drop-shadow-sm">
              {problem.votes_count ?? 0}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 flex-grow">
        <p className="text-muted-foreground text-sm line-clamp-3 mb-3">
          {problem.description}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>
              {typeof problem.latitude === "number" &&
              typeof problem.longitude === "number" ? (
                <>
                  {problem.latitude.toFixed(4)}, {problem.longitude.toFixed(4)}
                </>
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

        <AISolutionsSection
          loading={aiLoading}
          suggestions={suggestions}
          cached={cached}
          error={aiError}
          onRegenerate={regenerate}
        />
      </CardContent>

      <CardFooter className="relative z-10 border-t border-white/10 pt-4">
        <div className="flex w-full flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                "flex-1 rounded-2xl border border-white/15 bg-white/5 text-foreground shadow-inner",
                isUpvoted &&
                  "border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
              )}
              onClick={() => handleVote("upvote")}
              disabled={isVoting}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              {isUpvoted ? t('problemCard.upvoted') : t('problemCard.upvote')}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className={cn(
                "flex-1 rounded-2xl border border-white/15 bg-white/5 text-foreground shadow-inner",
                isDownvoted &&
                  "border-rose-400/60 bg-rose-500/15 text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.35)]"
              )}
              onClick={() => handleVote("downvote")}
              disabled={isVoting}
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              {isDownvoted ? t('problemCard.downvoted') : t('problemCard.downvote')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="lg"
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 text-foreground transition hover:border-primary/50 hover:bg-primary/10"
              asChild
            >
              <Link to={`/problem/${problem.id}`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {problem.comments_count
                  ? t('problemCard.commentsWithCount', { count: problem.comments_count })
                  : t('problemCard.comments')}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="flex-1 rounded-2xl border border-white/15 bg-white/5 text-foreground transition hover:border-primary/50 hover:bg-primary/10"
              onClick={() => onShowOnMap?.(problem)}
            >
              <MapPin className="mr-2 h-4 w-4" />
              {t('problemCard.map')}
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProblemCard;