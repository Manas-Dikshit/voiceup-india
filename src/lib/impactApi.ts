// lib/impactApi.ts
import { supabase } from "@/integrations/supabase/client";
import type { ImpactRow } from "./types";

/**
 * Fetches civic impact data for a single citizen.
 * Filters by their location (if available).
 */
export async function fetchCitizenImpact(userId: string): Promise<{ data: ImpactRow[]; error: any }> {
  try {
    const userLocation = await getUserLocation(userId);

    // Query problems directly and aggregate
    const { data, error } = await supabase
      .from("problems")
      .select("category, city, status, votes_count, created_at, updated_at")
      .eq("is_deleted", false);

    if (error) {
      console.error("❌ Error fetching citizen impact:", error.message);
      return { data: [], error };
    }

    if (!data || !Array.isArray(data)) {
      console.warn("⚠️ No citizen impact data found.");
      return { data: [], error: null };
    }

    // Aggregate data by category and location
    const aggregated = aggregateImpactData(data, userLocation);

    return { data: aggregated, error: null };
  } catch (e: any) {
    console.error("🚨 Unexpected error in fetchCitizenImpact:", e);
    return { data: [], error: e };
  }
}

/**
 * Fetches overall civic impact metrics for ministry users.
 * Returns aggregated or all-impact view data.
 */
export async function fetchMinistryImpact(): Promise<ImpactRow[]> {
  try {
    const { data, error } = await supabase
      .from("problems")
      .select("category, city, status, votes_count, created_at, updated_at")
      .eq("is_deleted", false);

    if (error) {
      console.error("❌ Error fetching ministry impact:", error.message);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      console.warn("⚠️ No valid ministry impact data returned.");
      return [];
    }

    // Aggregate all data
    return aggregateImpactData(data, null);
  } catch (e: any) {
    console.error("🚨 Unexpected error in fetchMinistryImpact:", e);
    return [];
  }
}

/**
 * Aggregates raw problem data into impact metrics
 */
function aggregateImpactData(
  data: any[],
  filterLocation: string | null
): ImpactRow[] {
  const grouped: Record<string, {
    category: string;
    location: string;
    resolved: number;
    pending: number;
    totalResponseTime: number;
    completedCount: number;
    engagement: number;
  }> = {};

  for (const row of data) {
    // Apply location filter if provided
    if (filterLocation && row.city !== filterLocation) continue;

    const key = `${row.category ?? 'other'}-${row.city ?? 'unknown'}`;
    
    if (!grouped[key]) {
      grouped[key] = {
        category: row.category ?? 'Unknown',
        location: row.city ?? '—',
        resolved: 0,
        pending: 0,
        totalResponseTime: 0,
        completedCount: 0,
        engagement: 0,
      };
    }

    const g = grouped[key];
    
    if (row.status === 'completed') {
      g.resolved++;
      // Calculate response time in hours
      if (row.created_at && row.updated_at) {
        const created = new Date(row.created_at).getTime();
        const updated = new Date(row.updated_at).getTime();
        g.totalResponseTime += (updated - created) / (1000 * 60 * 60);
        g.completedCount++;
      }
    } else if (['reported', 'under_review', 'approved', 'in_progress'].includes(row.status)) {
      g.pending++;
    }

    g.engagement += row.votes_count ?? 0;
  }

  return Object.entries(grouped).map(([key, g]) => ({
    id: key,
    category: g.category,
    location: g.location,
    resolved_count: g.resolved,
    pending_count: g.pending,
    avg_response_time: g.completedCount > 0 
      ? Math.round(g.totalResponseTime / g.completedCount) 
      : 0,
    engagement_score: g.engagement,
  }));
}

/**
 * Helper to get the user's city from their profile
 * (Used by fetchCitizenImpact)
 */
async function getUserLocation(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("city")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("⚠️ Failed to get user city:", error.message);
      return "";
    }

    return (data as any)?.city || "";
  } catch (e: any) {
    console.error("🚨 Unexpected error in getUserLocation:", e);
    return "";
  }
}
