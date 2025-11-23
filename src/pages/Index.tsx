import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin,
  TrendingUp,
  Users,
  Vote,
  Award,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: "easeOut" },
  }),
};

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
    <div className="min-h-screen bg-background text-foreground">
      <Header
        right={
          <div className="hidden sm:block">
            <Button
              variant="ghost"
              className="text-sm font-medium hover:bg-primary/10"
              onClick={() => navigate("/auth")}
            >
              Get Started
            </Button>
          </div>
        }
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6 bg-gradient-to-br from-primary via-indigo-600 to-accent text-white">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-56 h-56 bg-white/10 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="container mx-auto relative z-10 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex justify-center mb-6"
          >
            <MapPin className="h-16 w-16 text-white animate-bounce" />
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            custom={1}
            className="text-5xl md:text-7xl font-extrabold mb-4 leading-tight"
          >
            VoiceUp
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            custom={2}
            className="text-xl md:text-2xl text-white/90 mb-6 max-w-2xl mx-auto"
          >
            Empowering Citizens Through Digital Participation
          </motion.p>

          <motion.p
            variants={fadeInUp}
            custom={3}
            className="text-lg text-white/80 mb-8 max-w-3xl mx-auto"
          >
            Report problems, propose solutions, vote on priorities, and track
            real-time progress as we build a better India together.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            custom={4}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 text-lg px-8 rounded-full shadow-lg transition-transform hover:scale-105"
              onClick={() => navigate("/auth")}
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 text-lg px-8 rounded-full transition-transform hover:scale-105"
              onClick={() => navigate("/dashboard")}
            >
              View Problems
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-muted/40 backdrop-blur-md">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <TrendingUp className="h-12 w-12 text-primary" />,
              value: stats.totalProblems,
              label: "Problems Reported",
            },
            {
              icon: <CheckCircle className="h-12 w-12 text-success" />,
              value: stats.totalSolutions,
              label: "Solutions Proposed",
            },
            {
              icon: <Users className="h-12 w-12 text-secondary" />,
              value: stats.activeUsers,
              label: "Active Citizens",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2, duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-white/80 backdrop-blur-md rounded-2xl">
                <CardContent className="pt-6 text-center">
                  <div className="mb-4 flex justify-center">{item.icon}</div>
                  <div className="text-4xl font-bold mb-2">
                    {item.value.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground font-medium">
                    {item.label}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-gradient-to-t from-background to-muted">
        <div className="container mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            variants={fadeInUp}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              How VoiceUp Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A transparent platform connecting citizens with real solutions
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <MapPin className="h-12 w-12 text-primary" />,
                title: "Report Problems",
                desc: "Easily report local issues with photos, location, and detailed descriptions.",
              },
              {
                icon: <Vote className="h-12 w-12 text-success" />,
                title: "Vote & Discuss",
                desc: "Vote on solutions and join discussions to prioritize community action.",
              },
              {
                icon: <TrendingUp className="h-12 w-12 text-info" />,
                title: "Track Progress",
                desc: "Follow real-time updates as problems move from report to resolution.",
              },
              {
                icon: <Award className="h-12 w-12 text-secondary" />,
                title: "Earn Rewards",
                desc: "Gain points and badges for contributing to your community’s improvement.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.2 }}
                viewport={{ once: true }}
              >
                <Card className="border-2 border-muted hover:border-primary/40 hover:shadow-xl transition-all rounded-2xl">
                  <CardContent className="pt-6 text-center space-y-3">
                    <div className="flex justify-center">{feature.icon}</div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.desc}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-r from-primary to-accent text-white text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          variants={fadeInUp}
          viewport={{ once: true }}
          className="container mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of citizens already making their voices heard
          </p>
          <Button
            size="lg"
            className="bg-white text-primary hover:bg-white/90 text-lg px-8 rounded-full shadow-lg hover:scale-105 transition-transform"
            onClick={() => navigate("/auth")}
          >
            Join VoiceUp Today
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 bg-card border-t mt-8">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 VoiceUp. Empowering citizens through digital participation.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
