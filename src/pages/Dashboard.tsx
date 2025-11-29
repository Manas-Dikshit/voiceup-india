import { useEffect, useState, useRef } from "react";
import { useTranslation } from 'react-i18next';
import CivicGraphExplorer from "@/components/CivicGraphExplorer";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Award, TrendingUp, LogOut, MessageCircle } from "lucide-react";
import ProblemCard from "@/components/ProblemCard";
import ReportProblem from "@/components/ReportProblem";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import Chatbot, { Message } from "@/components/Chatbot";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import CorrelationMap from "@/components/maps/CorrelationMap";
import { Problem } from "@/lib/types";
import { Input } from "@/components/ui/input";
import type { ChatbotMetadata, SuggestionPublishResponse } from "@/lib/ai-suggestions";

// ==================== Types ====================

interface Profile {
  id: string;
  full_name: string;
  points?: number;
  badges?: string[];
  [key: string]: unknown;
}

interface Category {
  value: string;
  label: string;
}

interface ContributionMetrics {
  reportsCount: number;
  commentsCount: number;
  votesCount: number;
}

interface ImpactStats extends ContributionMetrics {
  points: number;
  badges: string[];
}

interface ImpactTrackerRow {
  id: string;
  category: string;
  location: string;
  resolved_count: number;
  pending_count: number;
  avg_response_time: number;
  engagement_score: number;
}

interface MapFocus {
  lat: number | null;
  lng: number | null;
  id?: string;
  pincode?: string;
}

interface LocationCoordinates {
  type?: string;
  coordinates?: number[];
}

interface RawProblem {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  votes_count?: number;
  comments_count?: number;
  status?: string;
  created_at?: string;
  latitude?: number | null;
  longitude?: number | null;
  pincode?: string;
  location?: string | LocationCoordinates | null;
  [key: string]: unknown;
}

// ==================== Constants ====================

const categories: Category[] = [
  { value: "roads", label: "Roads & Infra" },
  { value: "water", label: "Water Supply" },
  { value: "electricity", label: "Electricity" },
  { value: "sanitation", label: "Sanitation & Waste" },
  { value: "education", label: "Education" },
  { value: "healthcare", label: "Healthcare" },
  { value: "pollution", label: "Pollution" },
  { value: "safety", label: "Public Safety" },
  { value: "other", label: "Other" },
];

const DEFAULT_IMPACT_DATA: ImpactTrackerRow[] = [
  {
    id: "mock1",
    category: "Water",
    location: "Ward 12",
    resolved_count: 3,
    pending_count: 1,
    avg_response_time: 4.2,
    engagement_score: 7.5,
  },
  {
    id: "mock2",
    category: "Sanitation",
    location: "Ward 7",
    resolved_count: 2,
    pending_count: 2,
    avg_response_time: 6.1,
    engagement_score: 5.8,
  },
];

const BADGE_RULES = [
  {
    id: "first-action",
    label: "First Contribution",
    predicate: (stats: ImpactStats) =>
      stats.reportsCount + stats.commentsCount + stats.votesCount >= 1,
  },
  {
    id: "reporter",
    label: "Active Reporter",
    predicate: (stats: ImpactStats) => stats.reportsCount >= 3,
  },
  {
    id: "voter",
    label: "Community Voter",
    predicate: (stats: ImpactStats) => stats.votesCount >= 10,
  },
  {
    id: "conversation",
    label: "Conversation Starter",
    predicate: (stats: ImpactStats) => stats.commentsCount >= 5,
  },
  {
    id: "change-maker",
    label: "Change Maker",
    predicate: (stats: ImpactStats) => stats.points >= 50,
  },
];

// ==================== Helper Functions ====================

const deriveBadges = (stats: ImpactStats, existingBadges: string[] = []): string[] => {
  const earned = BADGE_RULES
    .filter((rule) => rule.predicate(stats))
    .map((rule) => rule.label);
  return Array.from(new Set([...(existingBadges ?? []), ...earned]));
};

const parseLocationString = (loc: string): { longitude: number; latitude: number } | null => {
  if (loc.startsWith('POINT')) {
    const inside = loc.replace(/POINT\(|\)/g, '').trim();
    const [lngStr, latStr] = inside.split(' ').filter(Boolean);
    return {
      longitude: Number(lngStr),
      latitude: Number(latStr),
    };
  }
  return null;
};

const parseLocationObject = (loc: LocationCoordinates): { longitude: number; latitude: number } | null => {
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    return {
      longitude: Number(loc.coordinates[0]),
      latitude: Number(loc.coordinates[1]),
    };
  }
  return null;
};

const normalizeProblem = (raw: RawProblem): Problem => {
  let latitude: number | null = raw?.latitude ?? null;
  let longitude: number | null = raw?.longitude ?? null;
  const locationField = raw?.location;

  if ((latitude === null || longitude === null) && locationField) {
    if (typeof locationField === "string") {
      const parsed = parseLocationString(locationField);
      if (parsed) {
        longitude = parsed.longitude;
        latitude = parsed.latitude;
      }
    } else if (typeof locationField === "object" && locationField !== null) {
      const parsed = parseLocationObject(locationField);
      if (parsed) {
        longitude = parsed.longitude;
        latitude = parsed.latitude;
      }
    }
  }

  return {
    id: raw?.id ?? `problem-${Date.now()}-${Math.random()}`,
    title: raw?.title ?? "Untitled problem",
    description: raw?.description ?? "",
    category: raw?.category ?? "other",
    votes_count: Number(raw?.votes_count ?? 0),
    comments_count: Number(raw?.comments_count ?? 0),
    status: raw?.status ?? "reported",
    created_at: raw?.created_at ?? new Date().toISOString(),
    latitude: Number.isFinite(latitude) ? Number(latitude) : null,
    longitude: Number.isFinite(longitude) ? Number(longitude) : null,
    pincode: raw?.pincode ?? undefined,
  };
};

// ==================== API Functions ====================

const fetchProblems = async (
  searchTerm: string,
  selectedCategory: string | null
): Promise<RawProblem[]> => {
  let query = supabase
    .from("problems")
    .select("*")
    .eq("is_flagged", false);

  if (searchTerm) {
    query = query.ilike("title", `%${searchTerm}%`);
  }

  if (selectedCategory) {
    query = query.eq("category", selectedCategory);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as RawProblem[];
};

const fetchNearbyProblems = async (
  latitude: number,
  longitude: number
): Promise<RawProblem[]> => {
  const { data, error } = await supabase.rpc('get_nearby_problems_for_map', {
    p_lat: latitude,
    p_lng: longitude,
    p_radius_meters: 50000
  });

  if (error) throw new Error(error.message);
  const rows = (data || []) as RawProblem[];

  return rows.map((r) => {
    const out: RawProblem = { ...r };
    out.votes_count = out.votes_count !== undefined && out.votes_count !== null
      ? Number(out.votes_count)
      : 0;

    if ((out.latitude === null || out.latitude === undefined) && out.location) {
      const loc = out.location;
      if (typeof loc === 'string') {
        const parsed = parseLocationString(loc);
        if (parsed) {
          out.longitude = parsed.longitude;
          out.latitude = parsed.latitude;
        }
      } else if (typeof loc === 'object' && loc !== null) {
        const parsed = parseLocationObject(loc);
        if (parsed) {
          out.longitude = parsed.longitude;
          out.latitude = parsed.latitude;
        }
      }
    }

    return out;
  });
};

// ==================== Component ====================

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const DEFAULT_MAP_CENTER_LAT = Number(import.meta.env.VITE_DEFAULT_MAP_LAT ?? 20.2960);
  const DEFAULT_MAP_CENTER_LNG = Number(import.meta.env.VITE_DEFAULT_MAP_LNG ?? 85.8246);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [impactStats, setImpactStats] = useState<ImpactStats | null>(null);
  const [impactTracker, setImpactTracker] = useState<ImpactTrackerRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Refs
  const insightsRef = useRef<HTMLDivElement | null>(null);

  // Hooks
  const { position, error: locationError } = useUserLocation();

  // Queries
  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ["problems", searchTerm, selectedCategory],
    queryFn: () => fetchProblems(searchTerm, selectedCategory),
  });

  const { data: nearbyProblems = [], isLoading: nearbyProblemsLoading } = useQuery({
    queryKey: ['nearbyProblems', position?.latitude, position?.longitude],
    queryFn: () => fetchNearbyProblems(position!.latitude, position!.longitude),
    enabled: !!position,
  });

  const { data: totalProblemsCount = 0 } = useQuery({
    queryKey: ['problemCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('problems')
        .select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

  const { data: userVotes = {} } = useQuery({
    queryKey: ['userVotes', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('votable_id, vote_type')
        .eq('user_id', profile!.id)
        .eq('votable_type', 'problem');
      if (error) throw new Error(error.message);
      return (data || []).reduce((acc, row) => {
        acc[row.votable_id as string] = row.vote_type as 'upvote' | 'downvote';
        return acc;
      }, {} as Record<string, 'upvote' | 'downvote'>);
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 30,
  });

  const { data: voteTotals = {} } = useQuery({
    queryKey: ['problemVoteTotals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('problem_vote_totals')
        .select('problem_id, net_votes');
      if (error) throw new Error(error.message);
      return (data || []).reduce((acc, row) => {
        if (row.problem_id) {
          acc[row.problem_id] = Number(row.net_votes ?? 0);
        }
        return acc;
      }, {} as Record<string, number>);
    },
    staleTime: 1000 * 15,
  });

  // Callbacks
  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error loading profile:", error);
      return null;
    }

    const profileData = data as Record<string, unknown>;
    const normalizedProfile: Profile = {
      id: (profileData.id ?? profileData.user_id ?? "") as string,
      full_name: (profileData.full_name ?? profileData.username ?? "Citizen") as string,
      points: (profileData.points as number) ?? 0,
      badges: Array.isArray(profileData.badges) ? profileData.badges as string[] : [],
      ...profileData,
    };
    setProfile(normalizedProfile);
    return normalizedProfile;
  }, []);

  const loadImpactStats = useCallback(async (userId: string, existingBadges: string[] = []) => {
    try {
      const [reported, commented, voted] = await Promise.all([
        supabase.from('problems').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      if (reported.error) throw reported.error;
      if (commented.error) throw commented.error;
      if (voted.error) throw voted.error;

      const reportsCount = reported.count ?? 0;
      const commentsCount = commented.count ?? 0;
      const votesCount = voted.count ?? 0;

      const points = reportsCount * 5 + commentsCount * 2 + votesCount;
      const badges = deriveBadges(
        { reportsCount, commentsCount, votesCount, points, badges: [] },
        existingBadges
      );

      setImpactStats({ reportsCount, commentsCount, votesCount, points, badges });
    } catch (error) {
      console.error('Error loading citizen impact stats:', error);
      setImpactStats((prev) => prev ?? {
        reportsCount: 0,
        commentsCount: 0,
        votesCount: 0,
        points: profile?.points ?? 0,
        badges: existingBadges,
      });
    }
  }, [profile?.points]);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    const loadedProfile = await loadProfile(session.user.id);
    if (loadedProfile) {
      await loadImpactStats(loadedProfile.id, loadedProfile.badges ?? []);
    }
    setLoading(false);
  }, [navigate, loadProfile, loadImpactStats]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: t('dashboard.signedOutTitle'),
      description: t('dashboard.signedOutDesc'),
    });
    navigate("/");
  };

  const handleSuccess = () => {
    setShowReportForm(false);
    queryClient.invalidateQueries({ queryKey: ['problems'] });
    queryClient.invalidateQueries({ queryKey: ['nearbyProblems'] });
    queryClient.invalidateQueries({ queryKey: ['problemCount'] });
    queryClient.invalidateQueries({ queryKey: ['problemVoteTotals'] });
    if (profile?.id) {
      queryClient.invalidateQueries({ queryKey: ['userVotes', profile.id] });
      loadImpactStats(profile.id, impactStats?.badges ?? profile.badges ?? []);
    }
  };

  const extractProblemId = (text: string): string | undefined => {
    const uuidMatch = text.match(
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/
    );
    return uuidMatch ? uuidMatch[0] : undefined;
  };

  const handleBotSendMessage = async (message: string, _currentHistory: Message[]) => {
    try {
      const problemId = extractProblemId(message);
      const { data, error } = await supabase.functions.invoke<{
        reply?: string;
        metadata?: ChatbotMetadata | null;
      }>("chatbot", {
        body: {
          message,
          problemId,
          requesterId: profile?.id ?? null,
        },
      });

      if (error) {
        throw error;
      }

      return {
        text: data?.reply || "Sorry, I couldn't process that. Please try again.",
        metadata: data?.metadata ?? null,
      };
    } catch (error) {
      console.error("Error invoking chatbot function:", error);
      return {
        text: "Failed to get a response from the AI assistant.",
        metadata: null,
      };
    }
  };

  const handlePublishSuggestion = async (problemId: string, suggestionIndex: number) => {
    if (!profile?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to publish AI suggestions.",
        variant: "destructive",
      });
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase.functions.invoke<SuggestionPublishResponse>(
      "suggestions-publish",
      {
        body: {
          problemId,
          suggestionIndex,
          publishedBy: profile.id,
        },
      }
    );

    if (error || !data?.success) {
      const message = error?.message || data?.error || "Unable to publish AI suggestion.";
      toast({ title: "Publish failed", description: message, variant: "destructive" });
      throw new Error(message);
    }

    toast({
      title: "Suggestion published",
      description: "The AI recommendation has been added to the issue suggestions queue.",
    });
  };

  const handleShowOnMap = useCallback((p: Problem) => {
    setMapFocus({
      lat: p.latitude ?? DEFAULT_MAP_CENTER_LAT,
      lng: p.longitude ?? DEFAULT_MAP_CENTER_LNG,
      id: p.id,
      pincode: p.pincode,
    });
    setActiveTab('insights');
  }, [DEFAULT_MAP_CENTER_LAT, DEFAULT_MAP_CENTER_LNG]);

  // Effects
  useEffect(() => {
    const fetchImpactTracker = async () => {
      try {
        // Replace with actual API call if available
        // const { data, error } = await supabase.from('impact_tracker').select('*');
        // if (error) throw error;
        // setImpactTracker(data ?? []);
        setImpactTracker(DEFAULT_IMPACT_DATA);
      } catch (error) {
        console.error("Error fetching impact tracker:", error);
        setImpactTracker([]);
      }
    };
    fetchImpactTracker();
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!profile?.id) return;

    const problemsChannel = supabase
      .channel("problems-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problems" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["problems"] });
          queryClient.invalidateQueries({ queryKey: ["nearbyProblems"] });
          queryClient.invalidateQueries({ queryKey: ['problemCount'] });
          if (profile?.id) {
            queryClient.invalidateQueries({ queryKey: ['userVotes', profile.id] });
          }
        }
      )
      .subscribe();

    const votesChannel = supabase
      .channel("votes-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["problems"] });
          queryClient.invalidateQueries({ queryKey: ["nearbyProblems"] });
          queryClient.invalidateQueries({ queryKey: ['problemCount'] });
          queryClient.invalidateQueries({ queryKey: ['problemVoteTotals'] });
          if (profile?.id) {
            queryClient.invalidateQueries({ queryKey: ['userVotes', profile.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(problemsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [queryClient, profile?.id]);

  useEffect(() => {
    if (activeTab !== 'insights' || !insightsRef.current) return;

    try {
      insightsRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
      window.setTimeout(() => {
        window.scrollBy({ top: -(window.innerHeight * 0.25), behavior: 'smooth' });
      }, 50);
    } catch {
      try {
        insightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        insightsRef.current?.scrollIntoView();
      }
    }
  }, [activeTab, mapFocus]);

  // Render helpers
  const renderProblemCard = (raw: RawProblem) => {
    const normalized = normalizeProblem(raw);
    const problem: Problem = {
      ...normalized,
      votes_count: voteTotals?.[normalized.id] ?? normalized.votes_count ?? 0,
      user_vote: userVotes?.[normalized.id] ?? null,
    };
    return (
      <ProblemCard
        key={problem.id}
        problem={problem}
        currentUserId={profile?.id}
        onShowOnMap={handleShowOnMap}
      />
    );
  };

  const renderImpactTrackerCard = (row: ImpactTrackerRow) => {
    const total = row.resolved_count + row.pending_count;
    const progressWidth = total > 0 ? (row.resolved_count / total) * 100 : 0;

    return (
      <div key={row.id} className="mb-4">
        <div className="font-semibold text-sm mb-1">
          {row.category} ({row.location})
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-success">Resolved: {row.resolved_count}</span>
          <span className="text-xs text-warning">Pending: {row.pending_count}</span>
        </div>
        <div className="w-full bg-muted rounded h-3 mb-1">
          <div
            className="bg-primary h-3 rounded"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground mb-1">
          Avg. Response Time: {row.avg_response_time?.toFixed(1) ?? "—"} hrs
        </div>
        <div className="text-xs text-info">
          Engagement Score: {row.engagement_score?.toFixed(2) ?? "—"}
        </div>
      </div>
    );
  };

  // Loading state
  if (loading || problemsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  // Computed values
  const pointsDisplay = impactStats?.points ?? profile?.points ?? 0;
  const badgesDisplay = (impactStats?.badges?.length ? impactStats.badges : profile?.badges) ?? [];
  const impactData = impactTracker.length > 0 ? impactTracker : DEFAULT_IMPACT_DATA;
  const resolvedProblems = impactData.filter((row) => row.resolved_count > 0);
  const problemsList = Array.isArray(problems) ? problems : [];

  const activeProblemsCount = position
    ? (nearbyProblemsLoading && !locationError ? null : nearbyProblems.length)
    : totalProblemsCount ?? problemsList.length;
  const activeProblemsLabel = position
    ? t('dashboard.inYourArea')
    : t('dashboard.acrossVoiceUp');

  const trendingProblems = problemsList
    .map((raw) => {
      const normalized = normalizeProblem(raw);
      return {
        ...normalized,
        votes_count: voteTotals?.[normalized.id] ?? normalized.votes_count ?? 0,
        user_vote: userVotes?.[normalized.id] ?? null,
      };
    })
    .sort((a, b) => (b.votes_count ?? 0) - (a.votes_count ?? 0))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        right={
          <>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Award className="h-3 w-3" />
                <span>{pointsDisplay} {t('dashboard.points')}</span>
              </div>
            </div>
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              {t('buttons.signOut')}
            </Button>
          </>
        }
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-8 pb-24">
        {/* Civic Impact Tracker */}
        <div className="mb-8">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Civic Impact Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {impactData.map(renderImpactTrackerCard)}
              </div>
            </CardContent>
          </Card>

          {/* Recent Resolved Problems */}
          <Card>
            <CardHeader>
              <CardTitle>Recently Resolved Problems</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-4">
                {resolvedProblems.length > 0 ? (
                  resolvedProblems.map((row) => (
                    <li key={row.id} className="text-sm mb-1">
                      {row.category} in {row.location} ({row.resolved_count} resolved)
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground text-sm">
                    No problems resolved yet.
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-background/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                {t('dashboard.yourImpact')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pointsDisplay}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('dashboard.pointsSubtitle')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/10 to-background/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-secondary" />
                {t('dashboard.badgesEarned')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{badgesDisplay.length}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {badgesDisplay.map((badge, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground border border-border"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('dashboard.unlockAchievements')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-info/10 to-background/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-info" />
                {t('dashboard.activeProblems')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeProblemsCount ?? '—'}</div>
              <p className="text-xs text-muted-foreground mt-1">{activeProblemsLabel}</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Problem Button */}
        <div className="mb-6">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setShowReportForm(true)}
            variant="glass-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('dashboard.reportProblem')}
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          <Input
            placeholder="Search by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Categories:</span>
            <Button
              variant={!selectedCategory ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category.value}
                variant={selectedCategory === category.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.value)}
              >
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Problems List */}
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v)} className="w-full">
          <TabsList>
            <TabsTrigger value="all">{t('dashboard.tabs.allProblems')}</TabsTrigger>
            <TabsTrigger value="nearby">{t('dashboard.tabs.nearby')}</TabsTrigger>
            <TabsTrigger value="trending">{t('dashboard.tabs.trending')}</TabsTrigger>
            <TabsTrigger value="insights">{t('dashboard.tabs.insights')}</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="space-y-4">
              {problemsList.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {t('dashboard.noProblemsYet')}
                  </CardContent>
                </Card>
              ) : (
                (Array.isArray(problems) ? problems : []).map((raw: any) => {
                  const normalized = normalizeProblem(raw);
                  const problem: Problem = {
                    ...normalized,
                    votes_count: voteTotals?.[normalized.id] ?? normalized.votes_count ?? 0,
                    user_vote: userVotes?.[normalized.id] ?? null,
                  };
                  return (
                    <ProblemCard
                      key={problem.id}
                      problem={problem}
                      currentUserId={profile?.id}
                      onShowOnMap={(p: Problem) => {
                          setMapFocus({ lat: DEFAULT_MAP_CENTER_LAT, lng: DEFAULT_MAP_CENTER_LNG, id: p.id, pincode: (p as any).pincode });
                          setActiveTab('insights');
                        }}
                    />
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="nearby" className="mt-6">
            {locationError && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('dashboard.locationError')}
                </CardContent>
              </Card>
            )}
            {!position && !locationError && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('dashboard.gettingLocation')}
                </CardContent>
              </Card>
            )}
            {position && nearbyProblems.length === 0 && !nearbyProblemsLoading && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('dashboard.noNearbyProblems')}
                </CardContent>
              </Card>
            )}
            {nearbyProblemsLoading && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {t('dashboard.loadingNearby')}
                </CardContent>
              </Card>
            )}
            {position && nearbyProblems.length > 0 && (
              <div className="space-y-4">
                {nearbyProblems.map(renderProblemCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending" className="mt-6">
            <div className="space-y-4">
              {trendingProblems.map((problem) => (
                <ProblemCard
                  key={problem.id}
                  problem={problem}
                  currentUserId={profile?.id}
                  onShowOnMap={handleShowOnMap}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <div
              ref={insightsRef}
              style={
                activeTab === 'insights'
                  ? { minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'stretch' }
                  : undefined
              }
            >
              <Card className={activeTab === 'insights' ? 'w-full flex flex-col' : ''}>
                <CardHeader>
                  <CardTitle>Geospatial Problem Correlations</CardTitle>
                </CardHeader>
                <CardContent
                  className="p-0"
                  style={
                    activeTab === 'insights'
                      ? { height: 'calc(100vh - 200px)', padding: 0 }
                      : undefined
                  }
                >
                  <CorrelationMap
                    focus={
                      mapFocus
                        ? {
                            lat: mapFocus.lat,
                            lng: mapFocus.lng,
                            zoom: 14,
                            id: mapFocus.id,
                            pincode: mapFocus.pincode,
                          }
                        : null
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="graph" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Civic Knowledge Graph</CardTitle>
              </CardHeader>
              <CardContent>
                <CivicGraphExplorer />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Report Problem Dialog */}
      {showReportForm && (
        <ReportProblem
          onClose={() => setShowReportForm(false)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Chatbot FAB */}
      <Drawer>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg"
            size="icon"
          >
            <MessageCircle className="h-8 w-8" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[70vh] sm:h-[85vh] max-h-[85vh]">
          <div className="p-2 sm:p-4 h-full">
            <Chatbot
              onSendMessage={handleBotSendMessage}
              history={chatHistory}
              setHistory={setChatHistory}
              onPublishSuggestion={handlePublishSuggestion}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Dashboard;