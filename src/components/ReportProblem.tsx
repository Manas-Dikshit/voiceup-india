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

const ReportProblem = ({ onClose, onSuccess }: ReportProblemProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    latitude: 0,
    longitude: 0,
  });
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    getLocation();
  }, []);

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
          // Default to New Delhi coordinates
          setFormData((prev) => ({
            ...prev,
            latitude: 28.6139,
            longitude: 77.209,
          }));
          setLocationLoading(false);
          toast({
            title: "Location unavailable",
            description: "Using default location. You can update coordinates manually.",
            variant: "destructive",
          });
        }
      );
    } else {
      setFormData((prev) => ({
        ...prev,
        latitude: 28.6139,
        longitude: 77.209,
      }));
      setLocationLoading(false);
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

      const { error } = await supabase.from("problems").insert([{
        user_id: session.user.id,
        title: formData.title,
        description: formData.description,
        category: formData.category as any,
        latitude: formData.latitude,
        longitude: formData.longitude,
      }]);

      if (error) throw error;

      toast({
        title: "Problem reported!",
        description: "Your report has been submitted successfully. You earned 10 points!",
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
