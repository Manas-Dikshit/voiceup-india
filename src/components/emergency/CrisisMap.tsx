import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, CheckCircle2, Circle } from "lucide-react";
import { useEffect, useRef } from "react";
import L from "leaflet";

export interface EmergencyIncident {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  severity: string;
  incident_type: string;
}

export interface CrisisZone {
  id: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  risk_level: number;
  forecast_confidence: number;
}

interface Props {
  incidents: EmergencyIncident[];
  zones: CrisisZone[];
  selectedIncident: EmergencyIncident | null;
}

const CrisisMap = ({ incidents, zones, selectedIncident }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }
    const center = incidents.length > 0
      ? [incidents[0].latitude, incidents[0].longitude]
      : zones.length > 0
        ? [zones[0].latitude, zones[0].longitude]
        : [20.5937, 78.9629]; // India
    const map = L.map(mapRef.current!).setView(center as [number, number], 7);
    leafletMapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    incidents.forEach((incident) => {
      const marker = L.marker([incident.latitude, incident.longitude], {
        title: incident.title,
      }).addTo(map);
      marker.bindPopup(`<b>${incident.incident_type.toUpperCase()}</b><br>${incident.title}<br>Severity: ${incident.severity}`);
      if (selectedIncident && incident.id === selectedIncident.id) {
        marker.openPopup();
      }
    });

    zones.forEach((zone) => {
      const circle = L.circle([zone.latitude, zone.longitude], {
        color: zone.risk_level >= 7 ? 'red' : zone.risk_level >= 4 ? 'orange' : 'yellow',
        fillColor: zone.risk_level >= 7 ? '#f87171' : zone.risk_level >= 4 ? '#fbbf24' : '#fef08a',
        fillOpacity: 0.3,
        radius: zone.radius_km * 1000,
      }).addTo(map);
      circle.bindPopup(`<b>Risk Level: ${zone.risk_level}/10</b><br>Confidence: ${Math.round(zone.forecast_confidence * 100)}%<br>Radius: ${zone.radius_km} km`);
    });

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [incidents, zones, selectedIncident]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" /> Emergency Response Map
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full h-96 rounded-lg border border-blue-200 overflow-hidden">
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        </div>
        {/* Map Legend */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="font-semibold text-red-900 mb-3">Active Incidents</p>
            <div className="space-y-2">
              {incidents.length === 0 ? (
                <p className="text-xs text-red-700">No active incidents</p>
              ) : (
                incidents.slice(0, 3).map((incident) => (
                  <div
                    key={incident.id}
                    className={`text-xs p-2 rounded ${selectedIncident?.id === incident.id ? "bg-red-200 text-red-900 font-semibold" : "bg-white text-red-700"}`}
                  >
                    <span className="font-semibold">{incident.incident_type.toUpperCase()}</span> - {incident.title}
                    <br />
                    <span className="text-muted-foreground text-xs">
                      ({incident.latitude.toFixed(2)}, {incident.longitude.toFixed(2)})
                    </span>
                  </div>
                ))
              )}
              {incidents.length > 3 && (
                <p className="text-xs text-red-600 italic">+{incidents.length - 3} more</p>
              )}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
            <p className="font-semibold text-yellow-900 mb-3">Predicted Risk Zones</p>
            <div className="space-y-2">
              {zones.length === 0 ? (
                <p className="text-xs text-yellow-700">No predicted zones</p>
              ) : (
                zones.slice(0, 3).map((zone) => (
                  <div key={zone.id} className="text-xs p-2 rounded bg-white text-yellow-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">Risk Level: {zone.risk_level}/10</span>
                      <span className="text-xs inline-flex items-center gap-1">
                        {zone.forecast_confidence > 0.7 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : zone.forecast_confidence > 0.4 ? (
                          <Circle className="h-3 w-3 text-yellow-500" />
                        ) : (
                          <Circle className="h-3 w-3 text-red-600" />
                        )}
                        <span>{Math.round(zone.forecast_confidence * 100)}%</span>
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      Radius: {zone.radius_km} km • ({zone.latitude.toFixed(2)}, {zone.longitude.toFixed(2)})
                    </span>
                  </div>
                ))
              )}
              {zones.length > 3 && (
                <p className="text-xs text-yellow-600 italic">+{zones.length - 3} more</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CrisisMap;