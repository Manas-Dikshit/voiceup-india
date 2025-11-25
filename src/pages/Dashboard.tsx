import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, Award, TrendingUp, LogOut } from "lucide-react";
import ProblemCard from "@/components/ProblemCard";
import ReportProblem from "@/components/ReportProblem";
import { useUserLocation } from "@/hooks/useUserLocation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import Chatbot, { Message } from "@/components/Chatbot";
import { MessageCircle } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import CorrelationMap from "@/components/maps/CorrelationMap";

interface Profile {
  id: string;
  full_name: string;
  points?: number;
  badges?: string[];
  [key: string]: any;
}

interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  votes_count: number;
  status: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  pincode?: string;
}

const fetchProblems = async () => {
  const { data, error } = await supabase
    .from("problems")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchNearbyProblems = async (latitude: number, longitude: number) => {
  const { data, error } = await (supabase as any).rpc('nearby_problems', {
    lat: latitude,
    lng: longitude
  });
  if (error) throw new Error(error.message);
  const rows = (data || []) as any[];

  // Normalize latitude/longitude and votes_count on returned rows in case the DB returns a 'location' geography column
  return rows.map((r) => {
    const out: any = { ...r };
    // ensure numeric votes_count
    out.votes_count = out.votes_count !== undefined && out.votes_count !== null ? Number(out.votes_count) : 0;

    if ((out.latitude === null || out.latitude === undefined) && out.location) {
      const loc = out.location;
      if (loc && typeof loc === 'object' && Array.isArray(loc.coordinates)) {
        // GeoJSON-like: { type: 'Point', coordinates: [long, lat] }
        out.longitude = Number(loc.coordinates[0]);
        out.latitude = Number(loc.coordinates[1]);
      } else if (typeof loc === 'string' && loc.startsWith('POINT')) {
        // WKT: POINT(long lat)
        const inside = loc.replace(/POINT\(|\)/g, '').trim();
        const [lngStr, latStr] = inside.split(' ').filter(Boolean);
        out.longitude = Number(lngStr);
        out.latitude = Number(latStr);
      }
    }

    return out;
  });
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);
  const { position, error: locationError, loading: locationLoading } = useUserLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [mapFocus, setMapFocus] = useState<{ lat: number | null, lng: number | null, id?: string, pincode?: string } | null>(null);

  const queryClient = useQueryClient();

  const normalizeProblem = (raw: any): Problem => {
    let latitude: number | null = raw?.latitude ?? null;
    let longitude: number | null = raw?.longitude ?? null;
    const locationField = raw?.location;
    if ((latitude === null || longitude === null) && locationField) {
      if (typeof locationField === "string" && locationField.startsWith("POINT")) {
        const inside = locationField.replace(/POINT\(|\)/g, "").trim();
        const [lngStr, latStr] = inside.split(" ").filter(Boolean);
        longitude = Number(lngStr);
        latitude = Number(latStr);
      } else if (typeof locationField === "object" && Array.isArray(locationField.coordinates)) {
        longitude = Number(locationField.coordinates[0]);
        latitude = Number(locationField.coordinates[1]);
      }
    }

    return {
      id: raw?.id ?? `problem-${Date.now()}-${Math.random()}`,
      title: raw?.title ?? "Untitled problem",
      description: raw?.description ?? "",
      category: raw?.category ?? "other",
      votes_count: Number(raw?.votes_count ?? 0),
      status: raw?.status ?? "reported",
      created_at: raw?.created_at ?? new Date().toISOString(),
      latitude: Number.isFinite(latitude) ? Number(latitude) : null,
      longitude: Number.isFinite(longitude) ? Number(longitude) : null,
      pincode: raw?.pincode ?? undefined,
    };
  };

  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ["problems"],
    queryFn: fetchProblems,
  });

  const { data: nearbyProblems = [], isLoading: nearbyProblemsLoading } = useQuery({
    queryKey: ['nearbyProblems', position?.latitude, position?.longitude],
    queryFn: () => fetchNearbyProblems(position!.latitude, position!.longitude),
    enabled: !!position,
  });

  useEffect(() => {
    checkAuth();

    const problemsChannel = supabase
      .channel("problems-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problems" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["problems"] });
          queryClient.invalidateQueries({ queryKey: ["nearbyProblems"] });
        }
      )
      .subscribe();

    const votesChannel = supabase
      .channel("votes-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["problems"] });
          queryClient.invalidateQueries({ queryKey: ["nearbyProblems"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(problemsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [queryClient]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await loadProfile(session.user.id);
    setLoading(false);
  };

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error loading profile:", error);
      return;
    }

    const profileData = data as Partial<Profile> & Record<string, any>;
    const normalizedProfile: Profile = {
      id: (profileData.id ?? profileData.user_id ?? "") as string,
      full_name: (profileData.full_name ?? profileData.username ?? "Citizen") as string,
      points: profileData.points ?? 0,
      badges: Array.isArray(profileData.badges) ? profileData.badges : [],
      ...profileData,
    };
    setProfile(normalizedProfile);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  const handleSuccess = () => {
    setShowReportForm(false);
    queryClient.invalidateQueries({ queryKey: ['problems'] });
    queryClient.invalidateQueries({ queryKey: ['nearbyProblems'] });
  };

  const handleBotSendMessage = async (message: string, currentHistory: Message[]) => {
    // Optimistically update UI
    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      text: message,
      sender: "user",
    };
    setChatHistory([...currentHistory, newUserMessage]);

    const { data, error } = await supabase.functions.invoke("chatbot", {
      body: { message },
    });

    if (error) {
      console.error("Error invoking chatbot function:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: "Failed to get a response from the AI assistant.",
        sender: "bot",
      };
      setChatHistory((prev: Message[]) => [...prev, errorMessage]);
      throw new Error("Failed to get a response from the AI assistant.");
    }
    
    const botMessage: Message = {
      id: `bot-${Date.now()}`,
      text: data.reply || "Sorry, I couldn't process that. Please try again.",
      sender: "bot",
    };

    setChatHistory((prev: Message[]) => [...prev, botMessage]);
    return botMessage.text;
  };

  if (loading || problemsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        right={
          <>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Award className="h-3 w-3" />
                <span>{profile?.points} points</span>
              </div>
            </div>
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </>
        }
      />

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-background/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Your Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.points ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Points earned by voting, reporting, and commenting.</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-secondary/10 to-background/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-secondary" />
                Badges Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.badges?.length ?? 0}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(profile?.badges ?? []).map((badge: string, i: number) => (
                  <span key={i} className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground border border-border">{badge}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Unlock more achievements by contributing.</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-info/10 to-background/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-info" />
                Active Problems
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(Array.isArray(problems) ? problems.length : 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">In your area</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Problem Button */}
        <div className="mb-6">
          <Button
            size="lg"
            className="w-full md:w-auto"
            onClick={() => setShowReportForm(true)}
            variant="glass-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            Report a Problem
          </Button>
        </div>
        {/* Problems List */}
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v)} className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Problems</TabsTrigger>
            <TabsTrigger value="nearby">Nearby</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="insights">🗺️ Local Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="space-y-4">
              {(Array.isArray(problems) ? problems : []).length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No problems reported yet. Be the first to report one!
                  </CardContent>
                </Card>
              ) : (
                (Array.isArray(problems) ? problems : []).map((raw: any) => {
                  const problem = normalizeProblem(raw);
                  return (
                    <ProblemCard
                      key={problem.id}
                      problem={problem}
                      onShowOnMap={(p: Problem) => {
                        setMapFocus({ lat: p.latitude ?? null, lng: p.longitude ?? null, id: p.id, pincode: (p as any).pincode });
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
                  Could not get your location. Please enable location services in your browser.
                </CardContent>
              </Card>
            )}
            {!position && !locationError && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Getting your location...
                </CardContent>
              </Card>
            )}
            {position && nearbyProblems.length === 0 && !nearbyProblemsLoading && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No problems found nearby.
                </CardContent>
              </Card>
            )}
             {nearbyProblemsLoading && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Loading nearby problems...
                </CardContent>
              </Card>
            )}
            {position && nearbyProblems.length > 0 && (
              <div className="space-y-4">
                {nearbyProblems.map((raw: any) => {
                  const problem = normalizeProblem(raw);
                  return (
                    <ProblemCard
                      key={problem.id}
                      problem={problem}
                      onShowOnMap={(p: Problem) => {
                        setMapFocus({ lat: p.latitude ?? null, lng: p.longitude ?? null, id: p.id, pincode: (p as any).pincode });
                        setActiveTab('insights');
                      }}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending" className="mt-6">
            <div className="space-y-4">
              {(Array.isArray(problems) ? problems : [])
                .map(normalizeProblem)
                .sort((a, b) => (b.votes_count ?? 0) - (a.votes_count ?? 0))
                .slice(0, 5)
                .map((problem) => (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    onShowOnMap={(p: Problem) => {
                      setMapFocus({ lat: p.latitude ?? null, lng: p.longitude ?? null, id: p.id, pincode: (p as any).pincode });
                      setActiveTab('insights');
                    }}
                  />
                ))}
              </div>
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Geospatial Problem Correlations</CardTitle>
              </CardHeader>
              <CardContent className="h-[500px] p-0">
                <CorrelationMap focus={mapFocus ? { lat: mapFocus.lat, lng: mapFocus.lng, zoom: 14, id: mapFocus.id, pincode: mapFocus.pincode } : null} />
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
            className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg"
            size="icon"
          >
            <MessageCircle className="h-8 w-8" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[85vh] max-h-[85vh]">
          <div className="p-4 h-full">
            <Chatbot 
              onSendMessage={handleBotSendMessage} 
              history={chatHistory}
              setHistory={setChatHistory}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Dashboard;