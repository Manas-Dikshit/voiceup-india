import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
const EarthBG = "/earth-bg.jpeg";

import {
  MapPin,
  TrendingUp,
  Users,
  Vote,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const earthShape = (
  <div
    style={{
      position: "absolute",
      top: "40%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "140vh",
      height: "140vh",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(147, 71, 255, 0.35), transparent 70%)",
      filter: "blur(45px)",
      zIndex: 0,
    }}
  />
);

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
    <div
      className="min-h-screen text-foreground relative"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(10,0,40,0.7), rgba(20,0,60,0.85)), url(${EarthBG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/40"></div>
      {earthShape}

      <div className="relative z-10">

        {/* HEADER WITH BACKGROUND IMAGE */}
        <div
          className="relative w-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(10,0,40,0.5), rgba(20,0,60,0.8)), url(${EarthBG})`,
            paddingTop: "1.5rem",
            paddingBottom: "2.5rem",
          }}
        >
          <div className="absolute inset-0 bg-black/30"></div>

          <div className="relative z-10">
            <Header
              right={
                <div className="hidden sm:block">
                  <Button
                    variant="ghost"
                    className="text-sm font-medium hover:bg-purple-500/20 text-purple-200"
                    onClick={() => navigate("/auth")}
                  >
                    Get Started
                  </Button>
                </div>
              }
            />
          </div>
        </div>

        {/* HERO SECTION */}
        <section className="relative py-24 px-6 text-white text-center transition-all duration-300 hover:scale-[1.01] hover:brightness-110">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex justify-center mb-6"
          >
            <MapPin className="h-16 w-16 text-purple-300 drop-shadow-2xl" />
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            custom={1}
            className="text-5xl md:text-7xl font-extrabold mb-4 text-purple-100"
          >
            VoiceUp
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            custom={2}
            className="text-xl md:text-2xl text-purple-200 max-w-2xl mx-auto mb-6"
          >
            Empowering Citizens Through Digital Participation
          </motion.p>

          <motion.p
            variants={fadeInUp}
            custom={3}
            className="text-lg text-purple-300 mb-8 max-w-3xl mx-auto"
          >
            Report problems, propose solutions, vote on priorities, and track real-time
            progress as we build a better India together.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            custom={4}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              size="lg"
              className="bg-purple-200 text-purple-900 hover:bg-purple-100 px-8 rounded-full shadow-lg hover:scale-110 hover:shadow-purple-400/40 transition-all duration-300"
              onClick={() => navigate("/auth")}
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="border-2 border-purple-300 text-purple-200 hover:bg-purple-300/10 px-8 rounded-full hover:scale-105 transition"
              onClick={() => navigate("/dashboard")}
            >
              View Problems
            </Button>
          </motion.div>
        </section>

        {/* STATS SECTION */}
        <section className="py-20 bg-purple-200/10 backdrop-blur-md transition-all duration-300 hover:scale-[1.01] hover:brightness-110">
          <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <TrendingUp className="h-12 w-12 text-purple-300" />,
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-purple-500/30 hover:-translate-y-2 hover:border-purple-300/30">
                  <CardContent className="pt-6 text-center">
                    <div className="mb-4 flex justify-center">{item.icon}</div>
                    <div className="text-4xl font-bold text-purple-100 mb-2">
                      {item.value.toLocaleString()}
                    </div>
                    <div className="text-purple-300 font-medium">{item.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* FEATURES SECTION */}
        <section className="py-24 px-6 bg-gradient-to-t from-purple-950 to-purple-900/60 transition-all duration-300 hover:scale-[1.01] hover:brightness-110">
          <div className="container mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              variants={fadeInUp}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-purple-100 mb-4">
                How VoiceUp Works
              </h2>
              <p className="text-lg text-purple-300 max-w-2xl mx-auto">
                A transparent platform connecting citizens with real solutions
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center mx-auto max-w-6xl">
  {[
    {
      icon: <MapPin className="h-12 w-12 text-purple-300" />,
      title: "Report Problems",
      desc: "Easily report local issues with photos, location, and detailed descriptions.",
    },
    {
      icon: <Vote className="h-12 w-12 text-green-300" />,
      title: "Vote & Discuss",
      desc: "Vote on solutions and join discussions to prioritize community action.",
    },
    {
      icon: <TrendingUp className="h-12 w-12 text-blue-300" />,
      title: "Track Progress",
      desc: "Follow real-time updates as problems move from report to resolution.",
    },
  ].map((item, index) => (
    <Card
      key={index}
      className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl"
    >
      <CardContent>
        {item.icon}
        <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
        <p className="text-gray-300 mt-2">{item.desc}</p>
      </CardContent>
    </Card>
  ))}
</div>

          </div>
        </section>

      </div>
    </div>
  );
};

export default Index;
