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
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const EarthBG = "/earth-bg.jpeg";

const EarthShape = () => (
  <div
    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
               w-[140vmax] h-[140vmax] rounded-full 
               bg-[radial-gradient(circle_at_center,rgba(0,110,255,0.35),transparent_70%)]
               blur-[80px] z-0 animate-pulse-slow"
  />
);

// Subtle slow glowing pulse
const styles = `
@keyframes pulse-slow {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
.animate-pulse-slow { animation: pulse-slow 10s ease-in-out infinite; }
`;

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
    if (session) navigate("/dashboard");
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
    <div className="min-h-screen text-foreground relative overflow-hidden">
      <style>{styles}</style>

      {/* 🌌 HERO SECTION */}
      <div
        className="relative w-full min-h-[95vh] bg-cover bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(10,10,30,0.85)), url(${EarthBG})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <EarthShape />

        {/* HEADER */}
        <div className="relative z-20 pt-6 pb-10">
          <Header
            right={
              <Button
                variant="ghost"
                className="px-8 rounded-full text-sm font-medium bg-sky-300/90 text-sky-900 hover:bg-sky-200 transition-all shadow-lg hover:scale-105"
                onClick={() => navigate("/auth")}
              >
                Get Started
              </Button>
            }
          />
        </div>

        {/* HERO CONTENT */}
        <section className="relative py-24 px-6 text-center text-white z-10">
          <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
            <MapPin className="h-16 w-16 text-sky-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(56,189,248,0.7)] animate-bounce" />
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            custom={1}
            className="text-5xl md:text-7xl font-extrabold mb-4 bg-clip-text text-transparent 
                       bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-500 
                       animate-text-gradient"
          >
            VoiceUp
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            custom={2}
            className="text-xl md:text-2xl text-sky-200 max-w-2xl mx-auto mb-6"
          >
            Empowering Citizens Through Digital Participation
          </motion.p>

          <motion.p
            variants={fadeInUp}
            custom={3}
            className="text-lg text-sky-300 max-w-3xl mx-auto mb-10"
          >
            Report problems, propose solutions, vote on priorities, and track progress.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            custom={4}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-sky-300 via-blue-400 to-indigo-400 
                         text-sky-950 font-semibold px-8 rounded-full shadow-2xl
                         hover:from-sky-200 hover:to-blue-300 hover:scale-110 transition-transform"
              onClick={() => navigate("/auth")}
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="border-2 border-sky-300/60 text-sky-200 hover:bg-sky-300/10 px-8 rounded-full hover:scale-105 transition-all"
              onClick={() => navigate("/dashboard")}
            >
              View Problems
            </Button>
          </motion.div>
        </section>
      </div>

      {/* 📊 STATS SECTION */}
      <section className="py-20 bg-gradient-to-b from-blue-900/20 to-blue-950/80 backdrop-blur-md relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.15),transparent)]" />
        <div className="container relative mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl z-10">
          {[
            {
              icon: <TrendingUp className="h-12 w-12 text-sky-300" />,
              value: stats.totalProblems,
              label: "Problems Reported",
            },
            {
              icon: <CheckCircle className="h-12 w-12 text-green-300" />,
              value: stats.totalSolutions,
              label: "Solutions Proposed",
            },
            {
              icon: <Users className="h-12 w-12 text-blue-300" />,
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
              <Card
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center 
                           shadow-xl hover:-translate-y-2 transition-transform hover:shadow-sky-400/20"
              >
                <CardContent>
                  <div className="mb-4 flex justify-center">{item.icon}</div>
                  <div className="text-4xl font-bold text-sky-100 mb-2 tracking-tight">
                    {item.value.toLocaleString()}
                  </div>
                  <div className="text-sky-300 font-medium">{item.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ⭐ FEATURES SECTION */}
      <section className="py-24 px-6 bg-gradient-to-t from-blue-950 to-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(0,110,255,0.25),transparent_70%)] blur-3xl" />

        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            variants={fadeInUp}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-sky-100 mb-4">
              How VoiceUp Works
            </h2>
            <p className="text-lg text-sky-300 max-w-2xl mx-auto">
              A transparent platform connecting citizens with real solutions
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 justify-items-center mx-auto">
            {[
              {
                icon: <MapPin className="h-12 w-12 text-sky-300" />,
                title: "Report Problems",
                desc: "Easily report local issues with photos, location, and descriptions.",
              },
              {
                icon: <Vote className="h-12 w-12 text-green-300" />,
                title: "Vote & Discuss",
                desc: "Vote on solutions and engage in meaningful community discussions.",
              },
              {
                icon: <TrendingUp className="h-12 w-12 text-indigo-300" />,
                title: "Track Progress",
                desc: "See real-time updates as issues go from report to resolution.",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Card
                  className="bg-white/10 backdrop-blur-lg border border-sky-400/10 rounded-3xl p-8 
                             text-center shadow-xl hover:shadow-sky-400/30 transition-all"
                >
                  <CardContent>
                    <div className="flex justify-center mb-4">{item.icon}</div>
                    <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-300">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
