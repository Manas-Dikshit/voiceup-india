"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  city: string | null;
  region: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  votes_count: number;
  ai_summary: string | null;
  resolution_date: string | null;
  csi_rating: number | null;
  csi_comment: string | null;
  reopen_count: number;
  is_flagged: boolean;
  quality_score: number | null;
}

const MinistryReportsPage = () => {
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { toast } = useToast();

  const fetchProblems = async () => {
    try {
      const query = supabase
        .from("problems")
        .select(
          `
          id, title, description, category, status, created_at, updated_at,
          city, region, pincode, latitude, longitude, votes_count, ai_summary,
          resolution_date, csi_rating, csi_comment, reopen_count, is_flagged, quality_score
        `
        )
        .eq("is_deleted", false);

      if (cityFilter) query.eq("city", cityFilter);
      if (categoryFilter) query.eq("category", categoryFilter);
      if (statusFilter) query.eq("status", statusFilter);

      const { data, error } = await query;
      if (error) throw error;

      setProblems(data || []);
    } catch (error: any) {
      toast({
        title: "Fetch Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchProblems();
  }, [cityFilter, categoryFilter, statusFilter]);

  const convertToIST = (utcDate: string | null) => {
    if (!utcDate) return "—";
    const date = new Date(utcDate);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };
    return new Intl.DateTimeFormat("en-IN", options).format(date);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      if (!problems.length) {
        toast({
          title: "No Data",
          description: "There are no problems to export.",
          variant: "destructive",
        });
        return;
      }

      // CSV Metadata header
      const metadata = [
        ["VoiceUp India — Ministry Data Export"],
        [`Export Date: ${convertToIST(new Date().toISOString())}`],
        [`Total Records: ${problems.length}`],
        [""],
      ];

      // Map each problem with formatted fields
      const formattedData = problems.map((p) => ({
        "Problem ID": p.id,
        "Problem Title": p.title || "—",
        "Problem Description": p.description || "—",
        "Problem Category": p.category || "—",
        "Status": p.status || "—",
        "Reported On (IST)": convertToIST(p.created_at),
        "Last Updated (IST)": convertToIST(p.updated_at),
        "City": p.city || "—",
        "Region": p.region || "—",
        "Pincode": p.pincode || "—",
        "Latitude": p.latitude?.toFixed(6) || "—",
        "Longitude": p.longitude?.toFixed(6) || "—",
        "Resolution Date": convertToIST(p.resolution_date),
        "Total Votes": p.votes_count ?? 0,
        "Citizen Satisfaction Rating": p.csi_rating ?? "—",
        "Citizen Feedback": p.csi_comment || "—",
        "Reopened Count": p.reopen_count ?? 0,
        "Flagged for Review": p.is_flagged ? "Yes" : "No",
        "Quality Score": p.quality_score?.toFixed(2) || "—",
        "AI Summary": p.ai_summary || "—",
      }));

      const csvData = Papa.unparse(formattedData, { quotes: true });
      const csvWithMeta = Papa.unparse(metadata) + "\n" + csvData;

      const blob = new Blob(["\uFEFF" + csvWithMeta], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = `voiceup_ministry_report_${new Date()
        .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        .replace(/[\/, :]/g, "-")}.csv`;

      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `${problems.length} records have been exported successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Ministry Data Export & Reporting</h1>

      <Card className="shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle>Data Filters</CardTitle>
          <CardDescription>
            Apply filters to export only specific city, category, or status reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex flex-col">
            <Label>City</Label>
            <input
              type="text"
              placeholder="Enter city name"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <Label>Category</Label>
            <input
              type="text"
              placeholder="Enter category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1"
            />
          </div>
          <div className="flex flex-col">
            <Label>Status</Label>
            <input
              type="text"
              placeholder="e.g. Resolved / Pending"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1"
            />
          </div>
          <div className="flex flex-col justify-end">
            <Button variant="secondary" onClick={fetchProblems} disabled={loading}>
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg border border-gray-300">
        <CardHeader>
          <CardTitle>Export Problem Data</CardTitle>
          <CardDescription>
            Download a professional, ministry-compliant CSV of reported problems for analytics or
            official reporting. ({problems.length} records found)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExport}
            disabled={loading || !problems.length}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            {loading ? "Exporting..." : "Export Filtered Data to CSV"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MinistryReportsPage;
