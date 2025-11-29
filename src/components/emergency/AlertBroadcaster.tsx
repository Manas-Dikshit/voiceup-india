import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Send, AlertTriangle, Users, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

interface Props {
  incidentId: string | null;
  onBroadcast: (alertType: string, message: string, radiusKm: number) => Promise<void>;
  recentAlerts: Alert[];
  isLoading?: boolean;
}

const alertTemplates: Record<string, Record<string, string>> = {
  flood: {
    evacuation: " FLOOD WARNING: Please evacuate to higher ground immediately. Seek shelter at designated evacuation centers.",
    shelter: " FLOOD ALERT: Safe shelters are now open. Please proceed to the nearest shelter center if you cannot evacuate.",
    warning: " FLOOD WATCH: Heavy flooding expected in your area. Prepare emergency supplies and stay alert.",
    medical: " FLOOD EMERGENCY: Medical assistance is available. Call emergency services if needed.",
  },
  cyclone: {
    evacuation: " CYCLONE WARNING: Immediate evacuation required. Move to cyclone shelters or higher ground NOW.",
    shelter: " CYCLONE ALERT: Emergency shelters are operational. Seek refuge immediately.",
    warning: " CYCLONE WATCH: Severe cyclone approaching. Secure your property and prepare to evacuate.",
    medical: " CYCLONE EMERGENCY: Medical teams deployed. Emergency services at your location.",
  },
  fire: {
    evacuation: " FIRE EMERGENCY: EVACUATE IMMEDIATELY. Move away from the affected area. Do not return.",
    shelter: " FIRE ALERT: Safe zones established. Move to designated safe areas immediately.",
    warning: " FIRE WARNING: Wildfire spreading in your area. Prepare to evacuate on short notice.",
    medical: " FIRE EMERGENCY: Ambulances and paramedics dispatched to your location.",
  },
  earthquake: {
    evacuation: " EARTHQUAKE: EVACUATE to open areas away from buildings. Aftershocks expected.",
    shelter: " EARTHQUAKE ALERT: Safe assembly points activated. Move to designated zones.",
    warning: " EARTHQUAKE WATCH: Minor tremors detected. Aftershocks possible. Stay alert.",
    medical: " EARTHQUAKE EMERGENCY: Medical teams responding. Help is on the way.",
  },
  medical_emergency: {
    evacuation: " MEDICAL EMERGENCY: Evacuate non-essential personnel from the area.",
    shelter: " MEDICAL ALERT: Medical facilities are being set up in your area.",
    warning: " HEALTH ALERT: Outbreak detected. Follow health authority guidelines.",
    medical: " MEDICAL EMERGENCY: Hospitals are treating patients. Medical teams in your area.",
  },
  accident: {
    evacuation: " ACCIDENT: Clear the area. Emergency vehicles responding.",
    shelter: "ACCIDENT ALERT: Temporary safe zones established.",
    warning: " ACCIDENT WARNING: Road hazard. Use alternate routes.",
    medical: " ACCIDENT: Ambulances dispatched. Medical assistance on the way.",
  },
};

export default function AlertBroadcaster({
  incidentId,
  onBroadcast,
  recentAlerts,
  isLoading = false,
}: Props) {
  const [alertType, setAlertType] = useState<string>("evacuation");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local state for realtime alerts
  const [alerts, setAlerts] = useState<Alert[]>(recentAlerts);

  useEffect(() => {
    setAlerts(recentAlerts);
  }, [recentAlerts]);

  useEffect(() => {
    // Subscribe to realtime changes in alerts table
    const channel = supabase
      .channel("alerts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts((prev) => [newAlert, ...prev]);

          // Sound feedback
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz
            oscillator.connect(ctx.destination);
            oscillator.start();
            setTimeout(() => {
              oscillator.stop();
              ctx.close();
            }, 350);
          } catch (e) {
            // Ignore sound errors
          }

          // Vibration feedback
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }

          // Browser notification
          if (window.Notification && Notification.permission === "granted") {
            new Notification("Emergency Alert", {
              body: newAlert.message,
              icon: "/favicon.ico"
            });
          } else if (window.Notification && Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const defaultMessage = alertTemplates["flood"]?.[alertType] || "";
  const messageToSend = customMessage || defaultMessage;

  const handleBroadcast = async () => {
    if (!incidentId) return;
    setIsSubmitting(true);
    try {
      // Call parent broadcast logic (if any)
      await onBroadcast(alertType, messageToSend, radiusKm);

      // Write new alert to Supabase alerts table
      const { error } = await supabase.from("alerts").insert([
        {
          incident_id: incidentId,
          alert_type: alertType,
          message: messageToSend,
          broadcast_status: "sent", // or "pending" if async delivery
          recipients_count: 0, // update with actual count if available
        },
      ]);
      if (error) {
        // Optionally show error toast/notification
        console.error("Failed to save alert:", error.message);
      }

      // Optionally trigger notification logic here (e.g., push, SMS, etc.)

      setCustomMessage("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Broadcast Form */}
      <Card className="border-l-4 border-l-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Broadcast Emergency Alert
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="alert-type">Alert Type</Label>
              <Select value={alertType} onValueChange={setAlertType}>
                <SelectTrigger id="alert-type">
                  <SelectValue placeholder="Select alert type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="evacuation">Evacuation Order</SelectItem>
                  <SelectItem value="shelter">Seek Shelter</SelectItem>
                  <SelectItem value="warning">General Warning</SelectItem>
                  <SelectItem value="medical">Medical Assistance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="radius">Broadcast Radius (km)</Label>
              <Input
                id="radius"
                type="number"
                min="1"
                max="50"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="message">Alert Message</Label>
            <div className="p-3 rounded bg-muted text-sm mb-2">
              <p className="font-semibold">Default Template:</p>
              <p className="text-muted-foreground">{defaultMessage}</p>
            </div>
            <Textarea
              id="message"
              placeholder="Leave empty to use default template, or enter a custom message..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={isSubmitting}
              className="min-h-24"
            />
          </div>

          <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30 flex gap-3">
            <Users className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900">Will alert citizens within {radiusKm} km</p>
              <p className="text-blue-700 text-xs">Approximately 500-2000 people depending on population density</p>
            </div>
          </div>

          <Button
            onClick={handleBroadcast}
            disabled={!incidentId || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Broadcasting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Broadcast Alert Now
              </>
            )}
          </Button>

          {!incidentId && (
            <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/30 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <p className="text-xs text-yellow-700">Select an incident first to broadcast alerts</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts History (Realtime) */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Recent Broadcasts</h3>
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No alerts broadcast yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold capitalize">{alert.alert_type.replace("_", " ")}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            alert.broadcast_status === "sent"
                              ? "bg-green-500/20 text-green-700"
                              : "bg-yellow-500/20 text-yellow-700"
                          }`}>
                            {alert.broadcast_status === "sent" ? (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Sent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-4 w-4 text-yellow-600" />
                                Pending
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{alert.message}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            <strong>Status:</strong> {alert.broadcast_status.charAt(0).toUpperCase() + alert.broadcast_status.slice(1)}
                          </span>
                          <span>
                            <strong>Recipients:</strong> {alert.recipients_count.toLocaleString()}
                          </span>
                          <span>
                            <strong>Time:</strong> {new Date(alert.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
