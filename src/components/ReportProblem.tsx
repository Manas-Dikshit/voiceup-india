import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Upload, X, Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            title: "Location detected ✅",
            description: "Your current location has been added.",
          });
        },
        () => {
          setLocationLoading(false);
          toast({
            title: "Location unavailable",
            description:
              "Could not get your location. Please ensure location permissions are granted or enter coordinates manually.",
            variant: "destructive",
            duration: 7000,
          });
        }
      );
    } else {
      setLocationLoading(false);
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support location access.",
        variant: "destructive",
        duration: 7000,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.latitude || !formData.longitude)
        throw new Error("Location is required.");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please log in to report a problem.");

      // Check profile
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", session.user.id).single();
      if (!profile) throw new Error("User profile missing. Try logging out and back in.");

      if (!attachment) throw new Error("Please attach a file (photo, video, or document).");

      // Upload
      const filePath = `${session.user.id}/${Date.now()}_${attachment.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, attachment, {
          onUploadProgress: (progress) => {
            if (progress.total)
              setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
          },
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      const mediaUrl = publicUrlData.publicUrl;

      const fullDescription = `${formData.description}${areaName ? `\nArea: ${areaName}` : ""}`;

      const { error } = await supabase.from("problems").insert([
        {
          user_id: session.user.id,
          title: formData.title,
          description: fullDescription,
          category: formData.category,
          pincode: formData.pincode,
          latitude: formData.latitude,
          longitude: formData.longitude,
          media_url: mediaUrl,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Problem reported 🎉",
        description: "Your report has been submitted successfully.",
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
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/40 bg-gradient-to-b from-card/70 to-background/60 backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-foreground">
            Report a Problem
          </DialogTitle>
          <DialogDescription>
            Help improve your community by reporting issues that need attention.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Problem Title *</Label>
            <Input
              id="title"
              placeholder="E.g. Broken streetlight on main road"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the problem clearly..."
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.000001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.000001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          {/* Detect Location */}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={getLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4 mr-2" />
            )}
            {locationLoading ? "Detecting..." : "Use Current Location"}
          </Button>

          {/* Pincode */}
          <div className="space-y-2">
            <Label>Pincode</Label>
            <Input
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
                if (pin.length === 6) {
                  try {
                    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
                    const json = await res.json();
                    if (json[0]?.Status === "Success") {
                      const office = json[0].PostOffice?.[0];
                      setAreaName(office ? `${office.Name}, ${office.District}` : "Unknown area");
                    }
                  } catch {
                    setAreaName("Lookup failed");
                  }
                }
              }}
            />
            {areaName && (
              <p className="text-sm text-muted-foreground">Area: {areaName}</p>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Attachment *</Label>
            <div
              className="relative flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-muted-foreground/40 rounded-xl cursor-pointer hover:bg-muted/10 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {attachment ? "File Selected" : "Click to upload or drag & drop"}
              </p>
              <input
                ref={fileInputRef}
                id="attachment"
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                required
              />
            </div>

            {attachment && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between bg-muted/30 rounded-lg p-2 border"
                >
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="text-sm truncate max-w-[200px]">{attachment.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              </AnimatePresence>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-muted/20 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-primary h-2"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {uploadProgress === 100 && (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircle className="h-4 w-4 mr-1" /> Upload complete
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportProblem;
