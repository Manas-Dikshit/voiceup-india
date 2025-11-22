import { Database } from "./supabase/types";

export type Comment = Database["public"]["Tables"]["comments"]["Row"] & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name" | "role">;
  replies?: Comment[];
};

export type Notification = Database["public"]["Tables"]["notifications"]["Row"] & {
  profiles: Pick<Database["public"]["Tables"]["profiles"]["Row"], "full_name">;
};
