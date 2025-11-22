import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Upload, X } from "lucide-react";

interface ReportProblemProps {
  onClose: () => void;
  onSuccess: () => void;
}

const categories = [
  { value: "roads", label: "Roads & Infrastructure" },
  { value: "water", label: "Water Supply" },
  { value: "electricity", label: "Electricity" },
  { value: "sanitation", label: "Sanitation & Waste" },
  { value: "education", label: "Education" },
  { value: "healthcare", label: "Healthcare" },
  { value: "pollution", label: "Pollution" },
  { value: "safety", label: "Public Safety" },
  { value: "other", label: "Other" },
];

type FormData = {
  title: string;
  description: string;
  category: string;
  pincode: string;
  latitude: number;
  longitude: number;
};

const ReportProblem = ({ onClose, onSuccess }: ReportProblemProps) => {
  const BUCKET_NAME = import.meta.env.VITE_PROBLEM_BUCKET ?? "problem-attachments";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    category: "",
    pincode: "",
    latitude: 0,
    longitude: 0,
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [areaName, setAreaName] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const getLocation = () => {
    setLocationLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
          setLocationLoading(false);
          toast({
            title: "Location detected",
            description: "Your current location has been added to the report.",
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationLoading(false);
          toast({
            title: "Location unavailable",
            description: "Could not get your location. Please ensure you've granted location permissions and are on a secure (https) connection. You can also enter coordinates manually.",
            variant: "destructive",
            duration: 7000,
          });
        }
      );
    } else {
      setLocationLoading(false);
      toast({
        title: "Location unavailable",
        description: "Geolocation is not supported by your browser. Please enter coordinates manually.",
        variant: "destructive",
        duration: 7000,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to report a problem");
      }

      if (!attachment) {
        throw new Error("Please attach at least one file. Attachments are required.");
      }

      // Upload attachment to Supabase Storage
      const filePath = `${session.user.id}/${Date.now()}_${attachment.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, attachment as File);

      if (uploadError) {
        // Provide clearer guidance when the bucket doesn't exist or permission denied
        const lower = String(uploadError.message || "").toLowerCase();
        if (lower.includes("not found") || lower.includes("does not exist") || lower.includes("bucket")) {
          throw new Error(`Storage bucket '${BUCKET_NAME}' not found. Create it in your Supabase project dashboard or set VITE_PROBLEM_BUCKET to an existing bucket name.`);
        }
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      const mediaUrl = publicUrlData.publicUrl;

      // Append pincode/area info to description (DB doesn't currently have dedicated columns for them)
      const fullDescription = `${formData.description}${formData.pincode ? `\n\nPincode: ${formData.pincode}` : ""}${areaName ? `\nArea: ${areaName}` : ""}`;

      const { error } = await supabase.from("problems").insert([{ 
        user_id: session.user.id,
        title: formData.title,
        description: fullDescription,
        category: formData.category,
        latitude: formData.latitude,
        longitude: formData.longitude,
        media_url: mediaUrl,
      }]);

      if (error) throw error;

      toast({
        title: "Problem reported!",
        description: "Your report has been submitted successfully. You earned 10 points!",
      });

      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Problem</DialogTitle>
          <DialogDescription>
            Help improve your community by reporting issues that need attention.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Problem Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of the problem"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed information about the problem..."
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="0.000001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="0.000001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={getLocation}
            disabled={locationLoading}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {locationLoading ? "Detecting location..." : "Use Current Location"}
          </Button>

          <div className="space-y-2">
            <Label htmlFor="pincode">Pincode (Postal Code)</Label>
            <Input
              id="pincode"
              placeholder="Enter 6-digit pincode"
              maxLength={6}
              value={formData.pincode}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                setFormData({ ...formData, pincode: val });
                setAreaName(null);
              }}
              onBlur={async () => {
                const pin = formData.pincode;
                if (pin && pin.length === 6) {
                  try {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                    const json = await res.json();
                    if (Array.isArray(json) && json[0].Status === "Success") {
                      const postOffices = json[0].PostOffice;
                      if (postOffices && postOffices.length > 0) {
                        setAreaName(postOffices[0].Name + ", " + postOffices[0].District);
                      } else {
                        setAreaName("Unknown area");
                      }
                    } else {
                      setAreaName("Unknown area");
                    }
                  } catch (err) {
                    console.error("Pincode lookup failed", err);
                    setAreaName("Lookup failed");
                  }
                }
              }}
            />
            {areaName && (
              <div className="text-sm text-muted-foreground">Area: {areaName}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="attachment">Attachment *</Label>
            <div className="flex items-center gap-3">
              <input
                id="attachment"
                type="file"
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  setAttachment(file || null);
                }}
                required
              />
              {attachment && (
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">{attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)} title="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportProblem;
