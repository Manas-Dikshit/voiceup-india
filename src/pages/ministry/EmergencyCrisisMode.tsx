import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, MapPin, Users, Zap, TrendingUp, Clock, Target, Radio } from "lucide-react";
import IncidentPrioritizer from "@/components/emergency/IncidentPrioritizer";
import ResourceDispatcher from "@/components/emergency/ResourceDispatcher";
import CrisisMap from "@/components/emergency/CrisisMap";
import AlertBroadcaster from "@/components/emergency/AlertBroadcaster";
import PredictedZonesViewer from "@/components/emergency/PredictedZonesViewer";

interface EmergencyIncident {
  id: string;
  title: string;
  incident_type: string;
  severity: string;
  latitude: number;
  longitude: number;
  affected_population: number;
  life_threatening: boolean;
  created_at: string;
}

interface CrisisZone {
  id: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  risk_level: number;
  forecast_confidence: number;
  affected_area_description?: string;
  affected_population_estimate?: number;
  predicted_severity?: string;
  forecast_updated_at?: string;
}

interface ResourceDeployment {
  id: string;
  resource_id: string;
  resource_name: string;
  resource_type: string;
  incident_id: string;
  status: string;
  distance_km: number;
  eta_minutes: number;
  assigned_at: string;
  current_latitude?: number;
  current_longitude?: number;
}

interface Alert {
  id: string;
  incident_id: string;
  alert_type: string;
  message: string;
  broadcast_status: string;
  recipients_count: number;
  sent_at?: string;
  created_at: string;
}

const EmergencyCrisisMode = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("incidents");
  const [selectedIncident, setSelectedIncident] = useState<EmergencyIncident | null>(null);

  const fetchIncidents = async () => {
    try {
      const { data, error } = await (supabase
        .from("emergency_incidents" as any)
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Fetch incidents error:", err);
      return [];
    }
  };

  const fetchCrisisZones = async () => {
    try {
      const { data, error } = await (supabase
        .from("crisis_zones" as any)
        .select("*")
        .eq("active", true)
        .order("risk_level", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Fetch zones error:", err);
      return [];
    }
  };

  const fetchStats = async () => {
    try {
      const { data: incidents } = await (supabase
        .from("emergency_incidents" as any)
        .select("id, severity, life_threatening")
        .eq("status", "active") as any);

      const { data: deployments } = await (supabase
        .from("resource_deployments" as any)
        .select("id, status")
        .eq("status", "en_route") as any);

      const critical = incidents?.filter((i: any) => i.severity === "critical").length || 0;
      const deployed = deployments?.length || 0;

      return { critical, deployed, total: incidents?.length || 0 };
    } catch (err) {
      console.error("Fetch stats error:", err);
      return { critical: 0, deployed: 0, total: 0 };
    }
  };

  const fetchResourceDeployments = async () => {
    try {
      const { data, error } = await (supabase
        .from("resource_deployments" as any)
        .select("*")
        .order("assigned_at", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Fetch deployments error:", err);
      return [];
    }
  };

  const fetchAlerts = async () => {
    try {
      const { data, error } = await (supabase
        .from("emergency_alerts" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10) as any);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Fetch alerts error:", err);
      return [];
    }
  };

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery({
    queryKey: ["emergencyIncidents"],
    queryFn: fetchIncidents,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["crisisZones"],
    queryFn: fetchCrisisZones,
    refetchInterval: 30000,
  });

  const { data: stats = { critical: 0, deployed: 0, total: 0 } } = useQuery({
    queryKey: ["emergencyStats"],
    queryFn: fetchStats,
    refetchInterval: 10000,
  });

  const { data: deployments = [] } = useQuery({
    queryKey: ["resourceDeployments"],
    queryFn: fetchResourceDeployments,
    refetchInterval: 5000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["emergencyAlerts"],
    queryFn: fetchAlerts,
    refetchInterval: 10000,
  });

  const handleAutoAssignResources = async () => {
    if (!selectedIncident) return;
    try {
      const response = await supabase.functions.invoke("emergency-assign-resources", {
        body: { incidentId: selectedIncident.id },
      });
      if (response.error) throw response.error;
      toast({
        title: "Resources assigned",
        description: `${response.data?.totalAssigned} resources dispatched to incident`,
      });
      queryClient.invalidateQueries({ queryKey: ["emergencyIncidents"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign resources",
        variant: "destructive",
      });
    }
  };

  const handleBroadcastAlert = async (alertType: string, message: string, radiusKm: number) => {
    if (!selectedIncident) return;
    try {
      const response = await supabase.functions.invoke("emergency-send-alerts", {
        body: {
          incidentId: selectedIncident.id,
          alertType,
          message,
          radiusKm,
        },
      });
      if (response.error) throw response.error;
      toast({
        title: "Alert broadcast successful",
        description: `Alert sent to ${response.data?.recipients_count || 0} citizens in the area`,
      });
      queryClient.invalidateQueries({ queryKey: ["emergencyAlerts"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to broadcast alert",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-destructive/20 via-background to-background/80 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
              <div className="absolute inset-0 animate-ping opacity-75">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Emergency Crisis Mode</h1>
              <p className="text-sm text-muted-foreground">Real-time disaster response system</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30">
            <Radio className="h-4 w-4 text-destructive animate-pulse" />
            <span className="text-sm font-medium text-destructive">LIVE</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Critical Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{stats.critical}</div>
            <p className="text-xs text-muted-foreground mt-1">Requiring immediate action</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Total Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Active emergencies</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              Deployed Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{stats.deployed}</div>
            <p className="text-xs text-muted-foreground mt-1">En route or arrived</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-yellow-500" />
              Risk Zones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{zones.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Predicted high-risk areas</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 gap-2">
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Incidents
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Map
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="zones" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Risk Zones
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Alerts
            </TabsTrigger>
          </TabsList>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="mt-6">
            <IncidentPrioritizer
              incidents={incidents}
              selectedIncident={selectedIncident}
              onSelectIncident={setSelectedIncident}
              onAssignResources={handleAutoAssignResources}
            />
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map" className="mt-6">
            <CrisisMap incidents={incidents} zones={zones} selectedIncident={selectedIncident} />
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="mt-6">
            <ResourceDispatcher deployments={deployments} isLoading={incidentsLoading} />
          </TabsContent>

          {/* Risk Zones Tab */}
          <TabsContent value="zones" className="mt-6">
            <PredictedZonesViewer zones={zones} />
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-6">
            <AlertBroadcaster
              incidentId={selectedIncident?.id || null}
              onBroadcast={handleBroadcastAlert}
              recentAlerts={alerts}
              isLoading={incidentsLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EmergencyCrisisMode;
