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

interface Profile {
  id: string;
  full_name: string;
  points: number;
  badges: string[];
}

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

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReportForm, setShowReportForm] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await loadProfile(session.user.id);
    await loadProblems();
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

    setProfile(data);
  };

  const loadProblems = async () => {
    const { data, error } = await supabase
      .from("problems")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error loading problems:", error);
      return;
    }

    setProblems(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  const handleVote = async (problemId: string, voteType: "upvote" | "downvote") => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from("votes")
        .upsert({
          user_id: profile.id,
          votable_type: "problem",
          votable_id: problemId,
          vote_type: voteType,
        });

      if (error) throw error;

      toast({
        title: "Vote recorded",
        description: `Your ${voteType} has been recorded.`,
      });

      await loadProblems();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                Your Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.points} Points</div>
              <p className="text-xs text-muted-foreground mt-1">Keep contributing to earn more!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4 text-secondary" />
                Badges Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.badges?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Unlock more achievements</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-info" />
                Active Problems
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{problems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">In your area</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Problem Button */}
        <div className="mb-6">
          <Button 
            size="lg" 
            className="w-full md:w-auto bg-secondary hover:bg-secondary/90"
            onClick={() => setShowReportForm(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Report a Problem
          </Button>
        </div>

        {/* Problems List */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Problems</TabsTrigger>
            <TabsTrigger value="nearby">Nearby</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="space-y-4">
              {problems.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No problems reported yet. Be the first to report one!
                  </CardContent>
                </Card>
              ) : (
                problems.map((problem) => (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    onVote={handleVote}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="nearby" className="mt-6">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Enable location services to see nearby problems
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trending" className="mt-6">
            <div className="space-y-4">
              {problems
                .sort((a, b) => b.votes_count - a.votes_count)
                .slice(0, 5)
                .map((problem) => (
                  <ProblemCard
                    key={problem.id}
                    problem={problem}
                    onVote={handleVote}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Report Problem Dialog */}
      {showReportForm && (
        <ReportProblem
          onClose={() => setShowReportForm(false)}
          onSuccess={() => {
            setShowReportForm(false);
            loadProblems();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
