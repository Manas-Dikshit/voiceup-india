import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Upload, X, Loader2, CheckCircle2, Sparkles, Compass, Navigation, Mic, MicOff } from "lucide-react";
import LocationPicker from "@/components/location/LocationPicker";
import { motion, AnimatePresence } from "framer-motion";
import { resolveLanguagePreference } from '@/lib/locale';

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
  latitude: number | null;
  longitude: number | null;
};

const ReportProblem = ({ onClose, onSuccess }: ReportProblemProps) => {
  const BUCKET_NAME = import.meta.env.VITE_PROBLEM_BUCKET ?? "problem-attachments";
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const languagePreference = useMemo(() => resolveLanguagePreference(i18n.language), [i18n.language]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    category: categories[0].value,
    pincode: "",
    latitude: null,
    longitude: null,
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [resolvedAreaHint, setResolvedAreaHint] = useState<string | null>(null);
  const [autoAreaDetails, setAutoAreaDetails] = useState<string>("");
  const [manualAreaDetails, setManualAreaDetails] = useState<string>("");
  const [manualState, setManualState] = useState<string | undefined>();
  const [manualDistrict, setManualDistrict] = useState<string | undefined>();
  const [manualSuggestionLabel, setManualSuggestionLabel] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [addressLookupState, setAddressLookupState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [locationStrategy, setLocationStrategy] = useState<"current" | "manual">("current");
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Speech recognition (Web Speech API) state and helpers
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [recognizing, setRecognizing] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  const startRecognition = useCallback(() => {
    try {
      if (recognitionRef.current) {
        setTranscript("");
        recognitionRef.current.start();
        setRecognizing(true);
      }
    } catch (e) {
      console.error("startRecognition error", e);
      setRecognizing(false);
    }
  }, []);

  const stopRecognition = useCallback(() => {
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
    } catch (e) {
      console.error("stopRecognition error", e);
    } finally {
      setRecognizing(false);
    }
  }, []);

  const clearTranscript = useCallback(() => setTranscript(""), []);

  const insertTranscriptIntoDescription = useCallback(() => {
    if (!transcript) return;
    setFormData((prev) => ({ ...prev, description: `${prev.description}${prev.description ? "\n" : ""}${transcript}` }));
    setTranscript("");
  }, [transcript]);

  const handleAttachmentChange = (file: File | null) => {
    setAttachment(file);
    setFileError(null);
  };

  const detectAddressFromCoords = useCallback(
    async (lat: number, lng: number, syncPincode = false) => {
      try {
        setAddressLookupState("loading");
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const res = await fetch(url, {
          headers: { "Accept-Language": languagePreference.acceptLanguage },
        });
        if (!res.ok) throw new Error("Unable to fetch address");
        const data = await res.json();
        const address = data.address ?? {};
        const locality = address.suburb || address.village || address.neighbourhood || address.town || address.city || null;
        const state = address.state;
        const derivedArea = locality ? `${locality}${state ? `, ${state}` : ""}` : data.display_name?.split(", ").slice(0, 2).join(", ") || null;
        setResolvedAreaHint(derivedArea);
        if (derivedArea) {
          setAutoAreaDetails((prev) => (prev ? prev : derivedArea));
        }
        if (syncPincode && address.postcode) {
          const sanitized = address.postcode.replace(/[^0-9]/g, "").slice(-6);
          if (sanitized) {
            setFormData((prev) => ({ ...prev, pincode: sanitized }));
          }
        }
        setAddressLookupState("success");
      } catch (error) {
        console.error("Reverse geocode error", error);
        setAddressLookupState("error");
      }
    },
    [languagePreference.acceptLanguage],
  );

  const applyLocation = useCallback(
    async (lat: number, lng: number, { autoDetect = true }: { autoDetect?: boolean } = {}) => {
      setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      if (autoDetect) {
        await detectAddressFromCoords(lat, lng, true);
      }
    },
    [detectAddressFromCoords],
  );

  const getLocation = () => {
    setLocationLoading(true);
    if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
        async (position) => {
          await applyLocation(position.coords.latitude, position.coords.longitude);
          setLocationLoading(false);
          toast({
            title: t('reportProblem.locationDetectedTitle'),
            description: t('reportProblem.locationDetectedDesc'),
          });
        },
        () => {
          setLocationLoading(false);
          toast({
            title: t('reportProblem.locationUnavailableTitle'),
            description: t('reportProblem.locationUnavailableDesc'),
            variant: "destructive",
            duration: 7000,
          });
        }
      );
      } else {
      setLocationLoading(false);
      toast({
        title: t('reportProblem.locationNotSupportedTitle'),
        description: t('reportProblem.locationNotSupportedDesc'),
        variant: "destructive",
        duration: 7000,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.latitude == null || formData.longitude == null)
        throw new Error("A precise location is required.");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please log in to report a problem.");

      // Check profile
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", session.user.id).single();
      if (!profile) throw new Error("User profile missing. Try logging out and back in.");

      if (!attachment) {
        setFileError(t('reportProblem.attachmentMissing'));
        throw new Error(t('reportProblem.attachmentMissing'));
      }

      // Upload
      const filePath = `${session.user.id}/${Date.now()}_${attachment.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, attachment);

      if (uploadError) throw uploadError;
      setUploadProgress(100);

      const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      const mediaUrl = publicUrlData.publicUrl;

      const locationNotes: string[] = [];
      if (locationStrategy === "current") {
        if (resolvedAreaHint) locationNotes.push(`Detected area: ${resolvedAreaHint}`);
        if (autoAreaDetails.trim()) locationNotes.push(`Area details: ${autoAreaDetails.trim()}`);
      } else {
        if (manualState) locationNotes.push(`Manual state: ${manualState}`);
        if (manualDistrict) locationNotes.push(`District: ${manualDistrict}`);
        if (manualSuggestionLabel) locationNotes.push(`Suggested place: ${manualSuggestionLabel}`);
        if (manualAreaDetails.trim()) locationNotes.push(`Area details: ${manualAreaDetails.trim()}`);
      }
      const fullDescription = locationNotes.length
        ? `${formData.description}\n\nLocation notes:\n- ${locationNotes.join("\n- ")}`
        : formData.description;

      const { error } = await supabase.from("problems").insert({
        user_id: session.user.id,
        title: formData.title,
        description: fullDescription,
        category: formData.category as 'roads' | 'water' | 'electricity' | 'sanitation' | 'education' | 'healthcare' | 'pollution' | 'safety' | 'other',
        pincode: formData.pincode,
        latitude: formData.latitude,
        longitude: formData.longitude,
        media_url: mediaUrl,
      });

      if (error) throw error;

      toast({
        title: t('reportProblem.problemReportedTitle'),
        description: t('reportProblem.problemReportedDesc'),
      });
      setAttachment(null);
      setFilePreview(null);
      setFormData({
        title: "",
        description: "",
        category: categories[0].value,
        pincode: "",
        latitude: null,
        longitude: null,
      });
      setResolvedAreaHint(null);
      setAutoAreaDetails("");
      setManualAreaDetails("");
      setManualState(undefined);
      setManualDistrict(undefined);
      setManualSuggestionLabel(null);
      setPendingLocation(null);
      setLocationStrategy("current");
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

  const tips = useMemo(
    () => [
      {
        title: "Priority routing",
        body: "Accurate pins & pincodes help ministries auto-route the request.",
      },
      {
        title: "Visual clarity",
        body: "Upload bright, in-focus media to fast-track field verification.",
      },
      {
        title: "Community impact",
        body: "Explain who is affected and since when to boost urgency.",
      },
    ],
    [],
  );

  const locateByPincode = async (pin: string) => {
    if (pin.length !== 6) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      const office = json?.[0]?.PostOffice?.[0];
      if (json?.[0]?.Status === "Success" && office) {
        const hint = `${office.Name}, ${office.District}`;
        setResolvedAreaHint(hint);
        setAutoAreaDetails((prev) => (prev ? prev : hint));
      }
    } catch (error) {
      console.error("Pincode lookup failed", error);
    }
  };

  const mapInitial =
    formData.latitude != null && formData.longitude != null
      ? { lat: formData.latitude, lng: formData.longitude }
      : pendingLocation ?? null;

  useEffect(() => {
    if (!attachment) {
      setFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    const objectUrl = URL.createObjectURL(attachment);
    setFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment]);

  useEffect(() => {
    if (!manualState || !manualDistrict) {
      setManualAreaDetails("");
    }
  }, [manualState, manualDistrict]);

  useEffect(() => {
    if (!manualState || !manualDistrict) {
      setManualSuggestionLabel(null);
    }
  }, [manualState, manualDistrict]);

  useEffect(() => {
    // Initialize Web Speech API recognition if available (client-side only)
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);
    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = "en-IN";
    recog.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript((prev) => (prev ? prev + " " + final : (final || interim)));
    };
    recog.onerror = (e: any) => {
      console.error("Speech recognition error", e);
      setRecognizing(false);
    };
    recog.onend = () => {
      setRecognizing(false);
    };
    recognitionRef.current = recog;
    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          try {
            recognitionRef.current.abort?.();
          } catch (e) {}
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-background to-background/80 backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-semibold text-foreground flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" /> {t('reportProblem.dialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-base">{t('reportProblem.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4 max-h-[80vh] overflow-y-auto pr-2 custom-scroll">
          <Card className="border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{t('reportProblem.problemDetailsTitle')}</CardTitle>
              <CardDescription>{t('reportProblem.problemDetailsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('reportProblem.titleLabel')}</Label>
                <Input
                  id="title"
                  placeholder={t('reportProblem.titlePlaceholder')}
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">{t('reportProblem.categoryLabel')}</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('reportProblem.selectCategory')} />
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
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Impact checklist</p>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Mention duration</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Describe current risk</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Share who is affected</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('reportProblem.descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('reportProblem.descriptionPlaceholder')}
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  required
                />

                {/* Speech-to-text toolbar */}
                <div className="flex flex-col gap-2">
                  {speechSupported ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={recognizing ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => (recognizing ? stopRecognition() : startRecognition())}
                        className="flex items-center gap-2"
                      >
                        {recognizing ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {recognizing ? "Stop" : "Record"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={clearTranscript} className="text-muted-foreground">Clear</Button>
                      <Button type="button" size="sm" variant="outline" onClick={insertTranscriptIntoDescription} disabled={!transcript} className="ml-auto">Insert</Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Voice input not supported in this browser.</p>
                  )}

                  {transcript && (
                    <div className="rounded-md border border-white/10 bg-white/[0.02] p-2 text-sm text-foreground">
                      <p className="font-medium">Transcript preview</p>
                      <p className="whitespace-pre-wrap text-sm mt-1">{transcript}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{t('reportProblem.locationTitle')}</CardTitle>
              <CardDescription>{t('reportProblem.locationDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Compass className="h-4 w-4 text-primary" />{t('reportProblem.autoLocationTitle')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('reportProblem.autoLocationDescription')}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-primary/30 bg-primary/5 text-primary"
                    onClick={() => {
                      setLocationStrategy("current");
                      getLocation();
                    }}
                    disabled={locationLoading}
                  >
                    {locationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                    {locationLoading ? t('reportProblem.detecting') : t('reportProblem.detectLocation')}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">{t('reportProblem.latitudeLabel')}</Label>
                    <Input
                      id="latitude"
                      inputMode="decimal"
                      value={formData.latitude ?? ""}
                      placeholder="12.9716"
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === "" ? null : Number(raw);
                        setFormData((prev) => ({ ...prev, latitude: parsed !== null && Number.isFinite(parsed) ? parsed : null }));
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">{t('reportProblem.longitudeLabel')}</Label>
                    <Input
                      id="longitude"
                      inputMode="decimal"
                      value={formData.longitude ?? ""}
                      placeholder="77.5946"
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === "" ? null : Number(raw);
                        setFormData((prev) => ({ ...prev, longitude: parsed !== null && Number.isFinite(parsed) ? parsed : null }));
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-area">{t('reportProblem.autoAreaLabel')}</Label>
                  <Textarea
                    id="auto-area"
                    placeholder={t('forms.placeholders.landmark')}
                    rows={3}
                    value={autoAreaDetails}
                    onChange={(e) => setAutoAreaDetails(e.target.value)}
                  />
                  {resolvedAreaHint && (
                    <p className="text-xs text-muted-foreground">{t('reportProblem.detectedArea', { area: resolvedAreaHint })}</p>
                  )}
                  {addressLookupState === "loading" && (
                    <p className="text-xs text-muted-foreground">{t('reportProblem.resolvingAddress')}</p>
                  )}
                  {addressLookupState === "error" && (
                    <p className="text-xs text-destructive">{t('reportProblem.resolveAddressFailed')}</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" /> {t('reportProblem.manualMapTitle')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('reportProblem.manualMapDescription')}</p>
                  </div>
                </div>

                <LocationPicker
                  initial={pendingLocation ?? mapInitial}
                  onLocationChange={(coords) => setPendingLocation(coords)}
                  onAdministrativeChange={({ state, district }) => {
                    setManualState(state);
                    setManualDistrict(district);
                  }}
                  onPlaceSelected={(info) => {
                    setManualSuggestionLabel(info.label);
                    if (info.pincode) {
                      const sanitized = info.pincode.replace(/[^0-9]/g, "").slice(-6);
                      if (sanitized) {
                        setFormData((prev) => ({ ...prev, pincode: sanitized }));
                      }
                    }
                  }}
                  onConfirm={async (payload) => {
                    setPendingLocation({ lat: payload.lat, lng: payload.lng });
                    await applyLocation(payload.lat, payload.lng, { autoDetect: false });
                    setLocationStrategy("manual");
                    setResolvedAreaHint(null);
                    if (payload.state) setManualState(payload.state);
                    if (payload.district) setManualDistrict(payload.district);
                    if (payload.areaLabel) setManualAreaDetails(payload.areaLabel);
                    toast({
                      title: "Manual location locked",
                      description: `Using ${payload.lat.toFixed(5)}, ${payload.lng.toFixed(5)}`,
                    });
                  }}
                  googlePlacesApiKey={import.meta.env.VITE_GOOGLE_API_KEY ?? import.meta.env.VITE_GOOGLE_PLACES_API_KEY ?? null}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs text-muted-foreground">{t('locationPicker.stateLabel')}</p>
                    <p className="text-sm font-medium text-foreground">{manualState ?? t('reportProblem.awaitingSelection')}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <p className="text-xs text-muted-foreground">{t('locationPicker.districtLabel')}</p>
                    <p className="text-sm font-medium text-foreground">{manualDistrict ?? t('reportProblem.chooseViaDropdown')}</p>
                  </div>
                </div>

                {manualSuggestionLabel && (
                  <p className="text-sm text-muted-foreground">{t('reportProblem.selectedAreaSuggestion', { suggestion: manualSuggestionLabel })}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="manual-area">{t('reportProblem.manualAreaLabel')}</Label>
                  <Textarea
                    id="manual-area"
                    placeholder={t('forms.placeholders.landmark')}
                    rows={3}
                    value={manualAreaDetails}
                    onChange={(e) => setManualAreaDetails(e.target.value)}
                    disabled={!manualState || !manualDistrict}
                  />
                  {(!manualState || !manualDistrict) && (
                    <p className="text-xs text-muted-foreground">{t('reportProblem.selectStateDistrictToEnable')}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                  <div className="flex items-center justify-between">
                  <Label htmlFor="pincode">{t('reportProblem.pincodeLabel')}</Label>
                  {formData.latitude != null && formData.longitude != null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      onClick={() =>
                        formData.latitude != null && formData.longitude != null &&
                        detectAddressFromCoords(formData.latitude, formData.longitude, true)
                      }
                    >
                      {t('buttons.refreshFromPin')}
                    </Button>
                  )}
                </div>
                <Input
                  id="pincode"
                  placeholder={t('reportProblem.pincodePlaceholder')}
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                    setFormData((prev) => ({ ...prev, pincode: val }));
                    setResolvedAreaHint(null);
                  }}
                  onBlur={() => locateByPincode(formData.pincode)}
                  required
                />
                {resolvedAreaHint && <p className="text-sm text-muted-foreground">{t('reportProblem.areaDetected', { area: resolvedAreaHint })}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">{t('reportProblem.evidenceTitle')}</CardTitle>
              <CardDescription>{t('reportProblem.evidenceDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="relative flex flex-col items-center justify-center w-full gap-2 rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] p-8 text-center transition hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                onClick={() => {
                  // Reset input value first to allow same file to be selected
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                    fileInputRef.current.click();
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files?.[0];
                  if (file) handleAttachmentChange(file);
                }}
                onDragOver={(event) => event.preventDefault()}
              >
                <Upload className="h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {attachment ? attachment.name : t('reportProblem.uploadClickOrDrag')}
                </p>
                <p className="text-xs text-muted-foreground">{t('reportProblem.uploadFormats')}</p>
                <input
                  ref={fileInputRef}
                  id="attachment"
                  type="file"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  accept="image/*,video/*,.pdf"
                  onChange={(e) => {
                    handleAttachmentChange(e.target.files?.[0] || null);
                  }}
                />
              </div>

              {fileError && <p className="text-xs text-destructive">{fileError}</p>}

              <AnimatePresence>
                {attachment && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">{(attachment.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleAttachmentChange(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {filePreview && attachment.type.startsWith("image/") && (
                      <img src={filePreview} alt="Attachment preview" className="h-40 w-full rounded-xl object-cover" />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {uploadProgress > 0 && uploadProgress < 100 && <Progress value={uploadProgress} className="h-2 rounded-full" />}
              {uploadProgress === 100 && (
                <p className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Upload complete
                </p>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                {tips.map((tip) => (
                  <div key={tip.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-primary">{tip.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{tip.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-white/20 bg-transparent px-6 text-sm"
            >
              {t('buttons.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-primary via-primary/80 to-primary/60 px-8 text-sm font-semibold text-white shadow-lg shadow-primary/30 hover:opacity-90"
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('reportProblem.submitting')}</> : t('buttons.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportProblem;
