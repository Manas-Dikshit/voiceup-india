
// ...existing imports...
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
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
import AlertBroadcaster from "@/components/emergency/AlertBroadcaster";
import ResourceDispatcher from "@/components/emergency/ResourceDispatcher";
import IncidentPrioritizer from "@/components/emergency/IncidentPrioritizer";
import CrisisMap from "@/components/emergency/CrisisMap";
import PredictedZonesViewer from "@/components/emergency/PredictedZonesViewer";
// Place inside the main MinistryDashboard component:



    // Mock predicted zones for demo (replace with API data in production)
    const mockZones = [
      {
        id: "zone1",
        latitude: 20.30,
        longitude: 85.82,
        radius_km: 3,
        risk_level: 8,
        forecast_confidence: 0.85,
        affected_area_description: "Central Bhubaneswar",
        affected_population_estimate: 12000,
        predicted_severity: "critical",
        forecast_updated_at: new Date().toISOString(),
      },
      {
        id: "zone2",
        latitude: 20.32,
        longitude: 85.80,
        radius_km: 2,
        risk_level: 6,
        forecast_confidence: 0.65,
        affected_area_description: "Ward 7, North Bhubaneswar",
        affected_population_estimate: 8000,
        predicted_severity: "high",
        forecast_updated_at: new Date().toISOString(),
      },
    ];
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
    // Live crisis zones state
    const [zones, setZones] = useState([]);
    const [zonesLoading, setZonesLoading] = useState(true);

    useEffect(() => {
      let channel;
      const fetchZones = async () => {
        setZonesLoading(true);
        const { data, error } = await supabase
          .from("crisis_zones")
          .select("*")
          .order("risk_level", { ascending: false })
          .limit(10);
        setZones(data ?? []);
        setZonesLoading(false);
      };
      fetchZones();

      // Subscribe to real-time changes
      channel = supabase
        .channel("crisis-zones-feed")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "crisis_zones" },
          () => fetchZones()
        )
        .subscribe();
      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    }, []);
  // Emergency incidents state
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      setIncidentsLoading(true);
      const { data, error } = await supabase
        .from("emergency_incidents")
        .select("*")
        .order("reported_at", { ascending: false })
        .limit(10);
      setIncidents(data ?? []);
      setIncidentsLoading(false);
    };
    fetchIncidents();
  }, []);

  {/* Emergency Response Map Section */}
  <Card className="bg-card/70 border border-border/30 backdrop-blur-md">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        Emergency Response Map
      </CardTitle>
    </CardHeader>
    <CardContent>
      {zones.length > 0 ? (
        <CrisisMap
          incidents={incidents}
          zones={zones}
          selectedIncident={incidents.find(i => i.id === selectedIncidentId) || null}
        />
      ) : (
        <div className="text-center text-muted-foreground py-8">
          No crisis zones found. Please check your Supabase data.
        </div>
      )}
      {zonesLoading && (
        <div className="text-xs text-muted-foreground mt-2">Loading zones...</div>
      )}
    </CardContent>
  </Card>
  // Emergency system state (must be at the top for all usages)
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);


    // Resource deployments state
    const [deployments, setDeployments] = useState([]);
    const [deploymentsLoading, setDeploymentsLoading] = useState(false);

    // Fetch deployments for selected incident
    useEffect(() => {
      if (!selectedIncidentId) {
        setDeployments([]);
        return;
      }
      setDeploymentsLoading(true);
      const fetchDeployments = async () => {
        const { data, error } = await supabase
          .from("resource_deployments")
          .select("*")
          .eq("incident_id", selectedIncidentId)
          .order("assigned_at", { ascending: false });
        setDeployments(data ?? []);
        setDeploymentsLoading(false);
      };
      fetchDeployments();
    }, [selectedIncidentId]);
                {/* Emergency Resource Dispatcher Section */}
                <Card className="bg-card/70 border border-border/30 backdrop-blur-md mt-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Resource Dispatcher
                      {deploymentsLoading && (
                        <span className="text-xs text-muted-foreground ml-auto">Loading...</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResourceDispatcher
                      deployments={deployments}
                      isLoading={deploymentsLoading}
                    />
                  </CardContent>
                </Card>


    // Fetch recent alerts from Supabase
    useEffect(() => {
      const fetchAlerts = async () => {
        setAlertsLoading(true);
        const { data, error } = await supabase
          .from("alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        if (!error) setRecentAlerts(data ?? []);
        setAlertsLoading(false);
      };
      fetchAlerts();
    }, []);

    // Broadcast handler for AlertBroadcaster
    const handleBroadcast = async (alertType: string, message: string, radiusKm: number) => {
      // You can add incident selection logic here
      const incidentId = selectedIncidentId ?? "ministry-incident";
      await supabase.from("alerts").insert([
        {
          incident_id: incidentId,
          alert_type: alertType,
          message,
          broadcast_status: "sent",
          recipients_count: 0,
        },
      ]);
      // Optionally, refetch alerts
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentAlerts(data ?? []);
    };
  const { t } = useTranslation();
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
        <Filter className="h-5 w-5" /> {t('ministry.filters')}
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t('ministry.dateRange')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DateRangePicker date={date} onDateChange={setDate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t('ministry.categories')}</CardTitle>
        </CardHeader>
        <CardContent>
          <MultiSelect
            options={categoryOptions}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            placeholder={t('ministry.selectCategoriesPlaceholder')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">{t('ministry.city')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder={t('ministry.filterByCity')}
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
        nav={
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
            <p className="text-sm font-medium text-foreground">
              {t('ministry.ministryOfficial')}
            </p>
            <p className="text-xs text-muted-foreground">{t('ministry.adminAccess')}</p>
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
                title: t('ministry.topCorrelationPair'),
                value: topCorrelation
                  ? `${topCorrelation.category_a} & ${topCorrelation.category_b}`
                  : t('ministry.na'),
                subtitle: topCorrelation
                  ? t('ministry.inCity', { city: topCorrelation.city || t('ministry.na') })
                  : '',
                icon: <Layers className="h-5 w-5 text-primary" />,
              },
              {
                title: t('ministry.highestScore'),
                value: topCorrelation
                  ? topCorrelation.correlation_score.toFixed(2)
                  : t('ministry.na'),
                subtitle: t('ministry.peakDataCorrelation'),
                icon: <BarChart3 className="h-5 w-5 text-primary" />,
              },
              {
                title: t('ministry.averageCorrelation'),
                value: avgCorrelation.toFixed(2),
                subtitle: t('ministry.acrossAllCategories'),
                icon: <MapPin className="h-5 w-5 text-primary" />,
              },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                transition={{ delay: idx * 0.1 }}
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
                        Avg. Response: {" "}
                        {row.avg_response_time
                          ? `${row.avg_response_time.toFixed(1)} hrs`
                          : "—"}
                      </div>
                      <div className="text-xs text-blue-400 font-medium">
                        Engagement: {" "}
                        {row.engagement_score
                          ? row.engagement_score.toFixed(2)
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Emergency Incident Selection & Alert Broadcaster Section */}
            <Card className="bg-card/70 border border-border/30 backdrop-blur-md mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Emergency Incident Prioritizer
                  {incidentsLoading && (
                    <span className="text-xs text-muted-foreground ml-auto">Loading...</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <IncidentPrioritizer
                  incidents={incidents}
                  selectedIncident={incidents.find(i => i.id === selectedIncidentId) || null}
                  onSelectIncident={incident => setSelectedIncidentId(incident.id)}
                  onAssignResources={() => {}}
                />
              </CardContent>
            </Card>

            <Card className="bg-card/70 border border-border/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Emergency Alert Broadcaster
                  {alertsLoading && (
                    <span className="text-xs text-muted-foreground ml-auto">Loading...</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AlertBroadcaster
                  incidentId={selectedIncidentId}
                  onBroadcast={handleBroadcast}
                  recentAlerts={recentAlerts}
                  isLoading={alertsLoading}
                />
              </CardContent>
            </Card>

            {/* Emergency Map Section */}
            <Card className="bg-card/70 border border-border/30 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Emergency Response Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CrisisMap
                  incidents={incidents}
                  zones={mockZones}
                  selectedIncident={incidents.find(i => i.id === selectedIncidentId) || null}
                />
              </CardContent>
            </Card>

            {/* Predicted Risk Zones Viewer */}
            <PredictedZonesViewer zones={mockZones} />
          </div>

          {/* --- Map Section --- */}
          <div className="relative flex-grow p-6">
            <div className="absolute top-8 right-8 z-10">
              <Button
                onClick={handleExport}
                disabled={!mapData.length}
                className="shadow-lg bg-gradient-to-r from-primary to-primary/80 text-white hover:from-primary/90 hover:to-primary/90 transition-all rounded-full px-6 py-3"
              >
                <Download className="h-4 w-4 mr-2" /> {t('ministry.exportData')}
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
