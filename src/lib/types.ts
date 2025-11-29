import { Database } from "@/integrations/supabase/types";

export type Comment = Database["public"]["Tables"]["comments"]["Row"] & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name" | "role">;
  replies?: Comment[];
};

export type Notification = Database["public"]["Tables"]["notifications"]["Row"] & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name">;
};

// PostGIS geometry type
export interface GeometryPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// Shape used in Dashboard; matches "problems" table plus optional geo helpers
export interface Problem {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  city?: string;
  votes_count: number; // Required for sorting
  latitude: number | null;
  longitude: number | null;
  pincode?: string | null;
  location?: GeometryPoint | string; // geo field from RPC - can be PostGIS geometry or WKT string
  comments_count?: number; // Optional comments count
  user_vote?: 'upvote' | 'downvote' | null;
  rating?: number | null;
  feedback?: string | null;
  user_id?: string | null;
  // Moderation fields
  is_flagged?: boolean;
  quality_score?: number;
  moderation_reason?: string;
  moderated_at?: string;
}

export type Rating = {
  id: string;
  problem_id: string;
  user_id: string;
  rating: number;
  feedback?: string | null;
  created_at: string;
};
