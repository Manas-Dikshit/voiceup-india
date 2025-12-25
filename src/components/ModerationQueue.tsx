import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle, XCircle, Search } from "lucide-react";
import type { Problem } from "@/lib/types";

const ModerationQueue = () => {
  const [flaggedProblems, setFlaggedProblems] = useState<Problem[]>([]);
  const [filtered, setFiltered] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch flagged problems ---
  useEffect(() => {
    const fetchFlagged = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("problems")
        .select("*")
        .eq("is_flagged", true)
        .order("moderated_at", { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        setError("Failed to load moderation queue.");
      } else {
        setFlaggedProblems((data as Problem[]) ?? []);
      }
      setLoading(false);
    };
    fetchFlagged();

    // --- Realtime subscription for updates ---
    const subscription = supabase
      .channel("moderation-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problems" },
        (payload) => {
          const newData = payload.new as Problem;
          if (newData?.is_flagged) {
            setFlaggedProblems((prev) => [
              newData,
              ...prev.filter((p) => p.id !== newData.id),
            ]);
          } else {
            setFlaggedProblems((prev) =>
              prev.filter((p) => p.id !== newData?.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // --- Filtering logic ---
  useEffect(() => {
    const filteredItems = flaggedProblems.filter((p) => {
      const matchesSearch =
        p.title?.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()) ||
        p.moderation_reason?.toLowerCase().includes(search.toLowerCase());
      const score = p.quality_score ?? 0;
      return matchesSearch && score >= minScore && score <= maxScore;
    });
    setFiltered(filteredItems);
  }, [search, minScore, maxScore, flaggedProblems]);

  // --- Approve / Remove handlers ---
  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("problems")
      .update({ is_flagged: false })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to approve content.", variant: "destructive" });
    } else {
      await supabase.from("moderation_audit").insert({
        table_name: "problems",
        row_id: id,
        action: "approved",
        reason: "Manual approval by moderator",
        moderated_at: new Date().toISOString(),
      });
      toast({ title: "Approved", description: "Content has been approved." });
      setFlaggedProblems(flaggedProblems.filter((p) => p.id !== id));
    }
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase
      .from("problems")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to remove content.", variant: "destructive" });
    } else {
      await supabase.from("moderation_audit").insert({
        table_name: "problems",
        row_id: id,
        action: "removed",
        reason: "Manual removal by moderator",
        moderated_at: new Date().toISOString(),
      });
      toast({ title: "Removed", description: "Content marked for deletion." });
      setFlaggedProblems(flaggedProblems.filter((p) => p.id !== id));
    }
  };

  return (
    <Card className="mt-8 shadow-lg border-2">
      <CardHeader className="bg-gradient-to-r from-warning/10 to-destructive/10">
        <CardTitle className="flex items-center gap-2">
          🧹 Moderation Queue
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {error && <div className="text-destructive mb-4 p-3 bg-destructive/10 rounded-lg">{error}</div>}

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <div className="relative w-full sm:w-1/2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title, description, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Score Range</span>
            <Slider
              defaultValue={[0]}
              max={1}
              step={0.1}
              value={[minScore]}
              onValueChange={(val) => setMinScore(val[0])}
              className="w-24"
            />
            <span className="text-xs">{minScore.toFixed(1)}</span>
            <span className="text-muted-foreground">-</span>
            <Slider
              defaultValue={[1]}
              max={1}
              step={0.1}
              value={[maxScore]}
              onValueChange={(val) => setMaxScore(val[0])}
              className="w-24"
            />
            <span className="text-xs">{maxScore.toFixed(1)}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
            <p>No flagged problems found. All clear!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((problem) => (
              <div key={problem.id} className="border p-4 rounded-xl bg-muted/40 hover:bg-muted/60 transition">
                <div className="font-bold text-lg mb-1">{problem.title}</div>
                <div className="text-sm text-muted-foreground mb-2 line-clamp-2">
                  {problem.description}
                </div>
                <div className="text-xs mb-3 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-primary/10 rounded-full">
                    Score: {problem.quality_score?.toFixed(2) ?? "N/A"}
                  </span>
                  {problem.moderation_reason && (
                    <span className="px-2 py-1 bg-warning/10 rounded-full">
                      {problem.moderation_reason}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApprove(problem.id)}
                    className="gap-1"
                  >
                    <CheckCircle className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(problem.id)}
                    className="gap-1"
                  >
                    <XCircle className="h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ModerationQueue;
