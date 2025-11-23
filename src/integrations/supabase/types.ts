export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      problems: {
        Row: {
          category: Database["public"]["Enums"]["problem_category"]
          city: string | null
          created_at: string
          description: string
          id: number
          lat: number
          lng: number
          location: unknown | null
          pincode: string | null
          region: string | null
          title: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["problem_category"]
          city?: string | null
          created_at?: string
          description: string
          id?: number
          lat: number
          lng: number
          location?: unknown | null
          pincode?: string | null
          region?: string | null
          title: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["problem_category"]
          city?: string | null
          created_at?: string
          description?: string
          id?: number
          lat?: number
          lng?: number
          location?: unknown | null
          pincode?: string | null
          region?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problems_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      problem_correlations: {
        Row: {
          category_a: string | null
          category_b: string | null
          center_point: unknown | null
          city: string | null
          co_occurrence: number | null
          correlation_score: number | null
          latest_problem_date: string | null
          region: string | null
          region_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_problem_correlations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_filtered_correlations: {
        Args: {
          start_date?: string
          end_date?: string
          cat_filter?: string[]
          city_filter?: string
        }
        Returns: {
          region_id: string
          city: string
          region: string
          category_a: string
          category_b: string
          correlation_score: number
          co_occurrence: number
          latest_problem_date: string
        }[]
      }
      get_nearby_correlations: {
        Args: {
          lat: number
          lng: number
          radius: number
        }
        Returns: {
          region_id: string
          category_a: string
          category_b: string
          correlation_score: number
          co_occurrence: number
          center_point_wkt: string
        }[]
      }
    }
    Enums: {
      problem_category:
        | "roads"
        | "water"
        | "electricity"
        | "sanitation"
        | "education"
        | "healthcare"
        | "pollution"
        | "safety"
        | "other"
      user_role: "citizen" | "ministry"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

// Manually export the enum for direct import
export const problem_category = {
    Roads: "roads",
    Water: "water",
    Electricity: "electricity",
    Sanitation: "sanitation",
    Education: "education",
    Healthcare: "healthcare",
    Pollution: "pollution",
    Safety: "safety",
    Other: "other"
} as const;
