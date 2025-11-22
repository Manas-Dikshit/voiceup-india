export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          commentable_id: string
          commentable_type: Database["public"]["Enums"]["commentable_type"]
          content: string
          created_at: string | null
          id: string
          sentiment: string | null
          user_id: string
        }
        Insert: {
          commentable_id: string
          commentable_type: Database["public"]["Enums"]["commentable_type"]
          content: string
          created_at?: string | null
          id?: string
          sentiment?: string | null
          user_id: string
        }
        Update: {
          commentable_id?: string
          commentable_type?: Database["public"]["Enums"]["commentable_type"]
          content?: string
          created_at?: string | null
          id?: string
          sentiment?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      problems: {
        Row: {
          ai_summary: string | null
          ai_tags: string[] | null
          category: Database["public"]["Enums"]["problem_category"]
          created_at: string | null
          description: string
          id: string
          latitude: number
          longitude: number
          media_url: string | null
          status: Database["public"]["Enums"]["problem_status"] | null
          title: string
          updated_at: string | null
          user_id: string
          votes_count: number | null
        }
        Insert: {
          ai_summary?: string | null
          ai_tags?: string[] | null
          category: Database["public"]["Enums"]["problem_category"]
          created_at?: string | null
          description: string
          id?: string
          latitude: number
          longitude: number
          media_url?: string | null
          status?: Database["public"]["Enums"]["problem_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
          votes_count?: number | null
        }
        Update: {
          ai_summary?: string | null
          ai_tags?: string[] | null
          category?: Database["public"]["Enums"]["problem_category"]
          created_at?: string | null
          description?: string
          id?: string
          latitude?: number
          longitude?: number
          media_url?: string | null
          status?: Database["public"]["Enums"]["problem_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          votes_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "problems_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          badges: string[] | null
          created_at: string | null
          full_name: string
          id: string
          latitude: number | null
          longitude: number | null
          points: number | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          badges?: string[] | null
          created_at?: string | null
          full_name: string
          id: string
          latitude?: number | null
          longitude?: number | null
          points?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          badges?: string[] | null
          created_at?: string | null
          full_name?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          points?: number | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      solutions: {
        Row: {
          created_at: string | null
          description: string
          id: string
          media_url: string | null
          problem_id: string
          updated_at: string | null
          user_id: string
          votes_count: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          media_url?: string | null
          problem_id: string
          updated_at?: string | null
          user_id: string
          votes_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          media_url?: string | null
          problem_id?: string
          updated_at?: string | null
          user_id?: string
          votes_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solutions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solutions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          votable_id: string
          votable_type: Database["public"]["Enums"]["votable_type"]
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          votable_id: string
          votable_type: Database["public"]["Enums"]["votable_type"]
          vote_type: Database["public"]["Enums"]["vote_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          votable_id?: string
          votable_type?: Database["public"]["Enums"]["votable_type"]
          vote_type?: Database["public"]["Enums"]["vote_type"]
        }
        Relationships: [
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      nearby_problems: {
        Args: {
          lat: number
          long: number
        }
        Returns: {
          id: string
          title: string
          description: string
          category: Database["public"]["Enums"]["problem_category"]
          votes_count: number
          status: Database["public"]["Enums"]["problem_status"]
          created_at: string
          latitude: number
          longitude: number
        }[]
      }
      vote_problem: {
        Args: {
          problem_id: string
          vote_type: "upvote" | "downvote"
        }
        Returns: undefined
      }
    }
    Enums: {
      commentable_type: "problem" | "solution"
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
      problem_status:
        | "reported"
        | "under_review"
        | "approved"
        | "in_progress"
        | "completed"
        | "rejected"
      user_role: "citizen" | "ministry" | "admin"
      votable_type: "problem" | "solution"
      vote_type: "upvote" | "downvote"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      commentable_type: ["problem", "solution"],
      problem_category: [
        "roads",
        "water",
        "electricity",
        "sanitation",
        "education",
        "healthcare",
        "pollution",
        "safety",
        "other",
      ],
      problem_status: [
        "reported",
        "under_review",
        "approved",
        "in_progress",
        "completed",
        "rejected",
      ],
      user_role: ["citizen", "ministry", "admin"],
      votable_type: ["problem", "solution"],
      vote_type: ["upvote", "downvote"],
    },
  },
} as const
