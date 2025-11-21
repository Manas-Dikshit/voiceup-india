import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, TrendingUp, Users, Vote, Award, ArrowRight, CheckCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProblems: 0,
    totalSolutions: 0,
    activeUsers: 0,
  });

  useEffect(() => {
    checkAuth();
    loadStats();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/dashboard");
    }
  };

  const loadStats = async () => {
    const { count: problemsCount } = await supabase
      .from("problems")
      .select("*", { count: "exact", head: true });

    const { count: solutionsCount } = await supabase
      .from("solutions")
      .select("*", { count: "exact", head: true });

    const { count: usersCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    setStats({
      totalProblems: problemsCount || 0,
      totalSolutions: solutionsCount || 0,
      activeUsers: usersCount || 0,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        right={
          <>
            <div className="hidden sm:block">
              <button
                className="text-sm font-medium text-foreground hover:underline"
                onClick={() => navigate("/auth")}
              >
                Get Started
              </button>
            </div>
          </>
        }
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-info to-accent py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="mb-6 flex justify-center">
            <MapPin className="h-16 w-16 text-white animate-bounce" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            VoiceUp
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Empowering Citizens Through Digital Participation
          </p>
          <p className="text-lg text-white/80 mb-8 max-w-3xl mx-auto">
            Report problems, propose solutions, vote on priorities, and track real-time progress 
            as we build a better India together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 text-lg px-8"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 text-lg px-8"
              onClick={() => navigate("/dashboard")}
            >
              View Problems
            </Button>
          </div>
        </div>

        {/* Decorative shapes */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 flex justify-center">
                  <TrendingUp className="h-12 w-12 text-primary" />
                </div>
                <div className="text-4xl font-bold text-foreground mb-2">{stats.totalProblems}</div>
                <div className="text-muted-foreground">Problems Reported</div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 flex justify-center">
                  <CheckCircle className="h-12 w-12 text-success" />
                </div>
                <div className="text-4xl font-bold text-foreground mb-2">{stats.totalSolutions}</div>
                <div className="text-muted-foreground">Solutions Proposed</div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 flex justify-center">
                  <Users className="h-12 w-12 text-secondary" />
                </div>
                <div className="text-4xl font-bold text-foreground mb-2">{stats.activeUsers}</div>
                <div className="text-muted-foreground">Active Citizens</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              How VoiceUp Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A simple, transparent platform connecting citizens with solutions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 flex justify-center">
                  <MapPin className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Report Problems</h3>
                <p className="text-muted-foreground">
                  Easily report local issues with photos, location, and detailed descriptions
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 flex justify-center">
                  <Vote className="h-12 w-12 text-success" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Vote & Discuss</h3>
                <p className="text-muted-foreground">
                  Vote on solutions and engage in community discussions to prioritize actions
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 flex justify-center">
                  <TrendingUp className="h-12 w-12 text-info" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
                <p className="text-muted-foreground">
                  Follow real-time updates as problems move from report to resolution
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center">
                <div className="mb-4 flex justify-center">
                  <Award className="h-12 w-12 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Earn Rewards</h3>
                <p className="text-muted-foreground">
                  Gain points and badges for contributing to your community's improvement
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary to-accent">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of citizens already making their voices heard
          </p>
          <Button 
            size="lg" 
            className="bg-white text-primary hover:bg-white/90 text-lg px-8"
            onClick={() => navigate("/auth")}
          >
            Join VoiceUp Today
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-card border-t">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2024 VoiceUp. Empowering citizens through digital participation.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
