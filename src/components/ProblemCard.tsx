import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

const AI_FUNCTION_URL =
  "https://wfpxknccdypiwpsoyisx.supabase.co/functions/v1/generate_solutions";

interface ProblemCardProps {
  problem: Problem;
  currentUserId?: string | null;
  onShowOnMap?: (problem: Problem) => void;
}

interface AISolution {
  text: string;
}

interface AISolutionsResponse {
  suggestions?: AISolution[];
  cached?: boolean;
}

interface UseAISolutionsState {
  loading: boolean;
  suggestions: AISolution[];
  cached: boolean;
  regenerate: () => void;
  error: string | null;
}

const useAISolutions = (problemId: string): UseAISolutionsState => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISolution[]>([]);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolutions = useCallback(
    async ({ bustCache }: { bustCache: boolean }) => {
      if (!problemId) {
        setSuggestions([]);
        setCached(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(AI_FUNCTION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId,
            ignoreCache: bustCache,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as AISolutionsResponse;
        const safeSuggestions = Array.isArray(json?.suggestions)
          ? json.suggestions.filter(
              (entry): entry is AISolution =>
                entry !== null &&
                typeof entry === "object" &&
                typeof entry.text === "string" &&
                entry.text.trim().length > 0,
            )
          : [];

        setSuggestions(safeSuggestions);
        setCached(Boolean(json?.cached));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch solutions";
        setError(message);
        setSuggestions([]);
        setCached(false);
        console.warn(`[AI Solutions] problemId=${problemId} error:`, err);
      } finally {
        setLoading(false);
      }
    },
    [problemId],
  );

  const regenerate = useCallback(() => {
    fetchSolutions({ bustCache: true }).catch(() => {
      /* handled above */
    });
  }, [fetchSolutions]);

  useEffect(() => {
    fetchSolutions({ bustCache: false }).catch(() => {
      /* handled above */
    });
  }, [fetchSolutions]);

  return useMemo(
    () => ({
      loading,
      suggestions,
      cached,
      regenerate,
      error,
    }),
    [loading, suggestions, cached, regenerate, error],
  );
};

const SkeletonLoader: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: 3 }).map((_, idx) => (
      <div
        key={idx}
        className="h-3 rounded-xl bg-gray-700/70 animate-pulse"
        style={{ width: `${70 + idx * 8}%` }}
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
}) => (
  <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-3 text-gray-100">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h4 className="text-sm font-semibold tracking-wide">💡 AI Suggested Solutions</h4>
        {cached && (
          <Badge className="rounded-full border border-blue-500/40 bg-blue-500/20 text-xs text-blue-200">
            Cached
          </Badge>
        )}
      </div>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={loading}
        className="text-sm font-medium text-blue-400 transition hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
        title="Regenerate AI suggestions"
      >
        <span className="inline-flex items-center gap-1">
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </span>
      </button>
    </div>

    {error && (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>{error}</span>
      </div>
    )}

    {!error && loading && <SkeletonLoader />}

    {!error && !loading && suggestions.length === 0 && (
      <p className="text-sm text-gray-400 italic">No AI solutions available.</p>
    )}

    {!error && !loading && suggestions.length > 0 && (
      <div className="space-y-2">
        {suggestions.map((suggestion, idx) => (
          <div
            key={`${suggestion.text}-${idx}`}
            className="rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm leading-relaxed text-gray-200"
          >
            {suggestion.text}
          </div>
        ))}
      </div>
    )}
  </div>
);

const categoryColors: Record<string, string> = {
  roads: "bg-sky-500/10 text-sky-200",
  water: "bg-blue-500/10 text-blue-200",
  electricity: "bg-amber-500/10 text-amber-200",
  sanitation: "bg-green-500/10 text-green-200",
  education: "bg-purple-500/10 text-purple-200",
  healthcare: "bg-rose-500/10 text-rose-200",
  pollution: "bg-gray-500/10 text-gray-300",
  safety: "bg-orange-500/10 text-orange-200",
  other: "bg-slate-600/30 text-slate-100",
};

const statusColors: Record<string, string> = {
  reported: "bg-amber-500/10 text-amber-200",
  under_review: "bg-blue-500/10 text-blue-200",
  approved: "bg-emerald-500/10 text-emerald-200",
  in_progress: "bg-indigo-500/10 text-indigo-200",
  completed: "bg-teal-500/10 text-teal-200",
  rejected: "bg-rose-500/10 text-rose-200",
};

const ProblemCard: React.FC<ProblemCardProps> = ({
  problem,
  currentUserId,
  onShowOnMap,
}) => {
  const { t } = useTranslation();
  const { mutate: vote, isPending: isVoting } = useVote();
  const { loading, suggestions, cached, regenerate, error } = useAISolutions(
    problem.id,
  );

  const currentVote = problem.user_vote ?? null;
  const isUpvoted = currentVote === "upvote";
  const isDownvoted = currentVote === "downvote";

  const handleVote = (voteType: "upvote" | "downvote") => {
    vote({ problemId: problem.id, voteType, currentUserId, currentVote });
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <Card className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-gray-100 shadow-2xl backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{problem.title}</h3>
            {(problem as any).is_flagged && (
              <div className="rounded-md border border-amber-400/50 bg-amber-500/10 p-2 text-xs text-amber-200">
                <strong>{t("problemCard.flaggedForReview")}</strong>
                {(problem as any).moderation_reason && (
                  <span className="ml-1"> {(problem as any).moderation_reason}</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge
                variant="secondary"
                className={categoryColors[problem.category] ?? categoryColors.other}
              >
                {problem.category}
              </Badge>
              <Badge
                variant="outline"
                className={statusColors[problem.status] ?? statusColors.reported}
              >
                {problem.status.replace("_", " ")}
              </Badge>
              {typeof (problem as any).rating === "number" && (
                <div className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-amber-200">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <svg
                      key={idx}
                      className={cn(
                        "h-3.5 w-3.5",
                        idx < ((problem as any).rating ?? 0)
                          ? "text-amber-300"
                          : "text-amber-900",
                      )}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.402 8.172L12 18.896l-7.336 3.87 1.402-8.172L.132 9.21l8.2-1.192z" />
                    </svg>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-400">
              {t("problemCard.netVotes")}
            </div>
            <div className="text-3xl font-black text-white drop-shadow-sm">
              {problem.votes_count ?? 0}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow space-y-4 pb-4">
        <p className="text-sm text-muted-foreground">{problem.description}</p>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {typeof problem.latitude === "number" &&
            typeof problem.longitude === "number" ? (
              <span>
                {problem.latitude.toFixed(4)}, {problem.longitude.toFixed(4)}
              </span>
            ) : (
              <span>—</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(problem.created_at)}</span>
          </div>
        </div>

        <AISolutionsSection
          loading={loading}
          suggestions={suggestions}
          cached={cached}
          error={error}
          onRegenerate={regenerate}
        />
      </CardContent>

      <CardFooter className="border-t border-white/10 pt-4">
        <div className="w-full space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => handleVote("upvote")}
              disabled={isVoting}
              className={cn(
                "rounded-2xl border border-white/15 bg-white/5 text-foreground shadow-inner",
                isUpvoted &&
                  "border-emerald-400/60 bg-emerald-500/20 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.35)]",
              )}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              {isUpvoted ? t("problemCard.upvoted") : t("problemCard.upvote")}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => handleVote("downvote")}
              disabled={isVoting}
              className={cn(
                "rounded-2xl border border-white/15 bg-white/5 text-foreground shadow-inner",
                isDownvoted &&
                  "border-rose-400/60 bg-rose-500/20 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.35)]",
              )}
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              {isDownvoted ? t("problemCard.downvoted") : t("problemCard.downvote")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-2xl border border-white/15 bg-white/5 text-foreground transition hover:border-primary/50 hover:bg-primary/10"
            >
              <Link to={`/problem/${problem.id}`}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {problem.comments_count
                  ? t("problemCard.commentsWithCount", {
                      count: problem.comments_count,
                    })
                  : t("problemCard.comments")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => onShowOnMap?.(problem)}
              className="rounded-2xl border border-white/15 bg-white/5 text-foreground transition hover:border-primary/50 hover:bg-primary/10"
            >
              <MapPin className="mr-2 h-4 w-4" />
              {t("problemCard.map")}
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProblemCard;