import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  Filter,
  Menu,
  MapPin,
  Layers,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import Header from "@/components/Header";
import MinistryMap, {
  MinistryMapFilters,
  Correlation,
} from "@/components/maps/MinistryMap";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { MultiSelect } from "@/components/ui/multi-select";
import { Input } from "@/components/ui/input";
import { problem_category } from "@/integrations/supabase/types";
import { DateRange } from "react-day-picker";
import { useDebounce } from "use-debounce";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { fetchMinistryImpact } from "@/lib/ministryImpactApi";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ---------------- CONSTANTS ----------------

type ImpactRow = {
  id: string;
  category: string;
  location: string;
  resolved_count: number;
  pending_count: number;
  avg_response_time?: number;
  engagement_score?: number;
};

const categoryOptions = Object.values(problem_category || {}).map((c) => ({
  value: c as string,
  label: (c as string).charAt(0).toUpperCase() + (c as string).slice(1),
}));

const mockImpactData: ImpactRow[] = [
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
  {
    id: "mock3",
    category: "Roads",
    location: "Ward 10",
    resolved_count: 8,
    pending_count: 3,
    avg_response_time: 2.5,
    engagement_score: 8.9,
  },
];

// ---------------- MAIN COMPONENT ----------------

const MinistryDashboard = () => {
  const [filters, setFilters] = useState<MinistryMapFilters>({});
  const [mapData, setMapData] = useState<Correlation[]>([]);
  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [debouncedCity] = useDebounce(cityInput, 500);

  // --------------- Fetch Impact Data ---------------
  const {
    data: impactResponse,
    refetch: refetchImpact,
    isLoading,
  } = useQuery({
    queryKey: ["ministryImpact"],
    queryFn: fetchMinistryImpact,
    retry: false,
    staleTime: 30000,
  });

  // --------------- Ensure Fallback if Empty ---------------
  const impactRows: ImpactRow[] = useMemo(() => {
    const rawData = (impactResponse as any)?.data || impactResponse;
      if (Array.isArray(rawData) && rawData.length > 0) return rawData; 
      const impactRows = Array.isArray(impactTracker) && impactTracker.length > 0
        ? impactTracker
        : impactTracker && impactTracker.data && Array.isArray(impactTracker.data) && impactTracker.data.length > 0
          ? impactTracker.data
          : [
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
    return mockImpactData; // Always fallback to mock
  }, [impactResponse]);

  // --------------- Filter Logic ---------------
  const handleFilterChange = useCallback(
    (key: keyof MinistryMapFilters, val: any) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (!val || (Array.isArray(val) && !val.length)) delete next[key];
        else next[key] = val;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    handleFilterChange(
      "dateRange",
      date ? { from: date.from, to: date.to } : undefined
    );
  }, [date, handleFilterChange]);

  useEffect(() => {
    handleFilterChange(
      "categories",
      selectedCategories.length ? selectedCategories : undefined
    );
  }, [selectedCategories, handleFilterChange]);

  useEffect(() => {
    handleFilterChange("city", debouncedCity);
  }, [debouncedCity, handleFilterChange]);

  // --------------- Correlation Stats ---------------
  const { topCorrelation, avgCorrelation } = useMemo(() => {
    if (!mapData?.length)
      return { topCorrelation: null, avgCorrelation: 0 };

    const sorted = [...mapData].sort(
      (a, b) => b.correlation_score - a.correlation_score
    );
    const avg =
      mapData.reduce((a, c) => a + c.correlation_score, 0) / mapData.length;
    return { topCorrelation: sorted[0], avgCorrelation: avg };
  }, [mapData]);

  // --------------- Real-time Updates ---------------
  useEffect(() => {
    const tables = ["problems", "solutions", "votes", "comments"];
    let timer: NodeJS.Timeout;

    const channels = tables.map((t) =>
      supabase
        .channel(`${t}-impact-feed`)
        .on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
          clearTimeout(timer);
          timer = setTimeout(() => refetchImpact(), 200);
        })
        .subscribe()
    );
    return () => {
      clearTimeout(timer);
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [refetchImpact]);

  // --------------- Export Handler ---------------
  const handleExport = () => {
    if (!mapData.length) return;
    const keys = Object.keys(mapData[0]);
    const escapeCsv = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvRows = mapData.map((r) =>
      keys.map((k) => escapeCsv((r as any)[k])).join(",")
    );
    const blob = new Blob([`\ufeff${keys.join(",")}\n${csvRows.join("\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "correlation_data.csv";
    link.click();
  };

  // --------------- UI Animation Config ---------------
  const fadeIn = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  // --------------- Filters Sidebar ---------------
  const FiltersPanel = (
    <aside className="w-full md:w-80 bg-gradient-to-b from-card/80 to-background backdrop-blur-xl border-r border-border/40 p-6 space-y-6">
      <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
        <Filter className="h-5 w-5" /> Filters
      </h2>

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <DateRangePicker date={date} onDateChange={setDate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <MultiSelect
            options={categoryOptions}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="Select categories..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>City</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Filter by city..."
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
          />
        </CardContent>
      </Card>
    </aside>
  );

  // --------------- Render ---------------
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/10 to-background">
      <Header
        left={
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80">
              {FiltersPanel}
            </SheetContent>
          </Sheet>
        }
        right={
          <div className="text-right">
            <p className="text-sm font-medium">Ministry Official</p>
            <p className="text-xs text-muted-foreground">Admin Access</p>
          </div>
        }
      />

      <div className="flex flex-col md:flex-row flex-grow overflow-hidden min-h-screen">
        <div className="hidden md:block">{FiltersPanel}</div>

        <main className="flex-1 flex flex-col overflow-y-auto h-full">
          {/* --- Stats --- */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-b border-border/20">
            {[
              {
                title: "Top Correlation Pair",
                value: topCorrelation
                  ? `${topCorrelation.category_a ?? "N/A"} & ${
                      topCorrelation.category_b ?? "N/A"
                    }`
                  : "N/A",
                subtitle: topCorrelation
                  ? `in ${topCorrelation.city ?? "—"}`
                  : "",
                icon: <Layers className="h-5 w-5 text-primary" />,
              },
              {
                title: "Highest Score",
                value:
                  topCorrelation?.correlation_score?.toFixed(2) ?? "N/A",
                subtitle: "Peak correlation score",
                icon: <BarChart3 className="h-5 w-5 text-primary" />,
              },
              {
                title: "Average Correlation",
                value: avgCorrelation.toFixed(2),
                subtitle: "Across all datasets",
                icon: <MapPin className="h-5 w-5 text-primary" />,
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-card/70 border border-border/40 rounded-2xl backdrop-blur-lg hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      {stat.icon} {stat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.subtitle}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* --- Impact Audit + Civic Impact Together --- */}
          <div className="p-6 space-y-8">
            {/* Impact Audit */}
            <Card className="bg-card/70 border border-border/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle>Impact Audit: Resolved vs Pending</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={impactRows}>
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="resolved_count" fill="#22c55e" />
                    <Bar dataKey="pending_count" fill="#facc15" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Civic Impact Tracker (Under Audit) */}
            <Card className="bg-card/70 border border-border/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  Civic Impact Tracker
                  {isLoading && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Loading...
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {impactRows.map((row) => (
                    <div
                      key={row.id}
                      className="p-4 rounded-xl bg-muted/30 border border-border/20 shadow-sm hover:shadow-md transition"
                    >
                      <div className="font-semibold text-sm mb-1 text-primary">
                        {row.category} ({row.location})
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-green-500">
                          Resolved: {row.resolved_count}
                        </span>
                        <span className="text-xs font-medium text-yellow-500">
                          Pending: {row.pending_count}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded h-3 mb-1 overflow-hidden">
                        <div
                          className="bg-green-500 h-3"
                          style={{
                            width: `${
                              row.resolved_count + row.pending_count > 0
                                ? (row.resolved_count /
                                    (row.resolved_count +
                                      row.pending_count)) *
                                  100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Avg. Response:{" "}
                        {row.avg_response_time
                          ? `${row.avg_response_time.toFixed(1)} hrs`
                          : "—"}
                      </div>
                      <div className="text-xs text-blue-400 font-medium">
                        Engagement:{" "}
                        {row.engagement_score
                          ? row.engagement_score.toFixed(2)
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* --- Map Section --- */}
          <div className="relative flex-grow p-6">
            <div className="absolute top-8 right-8 z-10">
              <Button
                onClick={handleExport}
                disabled={!mapData.length}
                className="shadow-lg bg-gradient-to-r from-primary to-primary/80 text-white hover:from-primary/90 hover:to-primary/90 transition-all rounded-full px-6 py-3"
              >
                <Download className="h-4 w-4 mr-2" /> Export Data
              </Button>
            </div>
            <div className="rounded-2xl overflow-hidden border border-border/30 bg-card/50 backdrop-blur-lg shadow-md h-full min-h-[400px]">
              <MinistryMap filters={filters} onDataLoad={setMapData} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MinistryDashboard;
