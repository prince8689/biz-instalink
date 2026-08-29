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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          currency: string
          id: boolean
          updated_at: string
          weekly_price_paise: number
        }
        Insert: {
          currency?: string
          id?: boolean
          updated_at?: string
          weekly_price_paise?: number
        }
        Update: {
          currency?: string
          id?: boolean
          updated_at?: string
          weekly_price_paise?: number
        }
        Relationships: []
      }
      lead_results: {
        Row: {
          address: string | null
          business_name: string
          category: string | null
          city: string | null
          created_at: string
          google_maps_url: string | null
          id: string
          instagram_handle: string | null
          instagram_url: string
          instagram_verified: boolean
          phone: string
          phone_line_type: string
          phone_valid: boolean
          place_id: string | null
          rating: number
          rating_count: number
          search_id: string
          status: string
        }
        Insert: {
          address?: string | null
          business_name: string
          category?: string | null
          city?: string | null
          created_at?: string
          google_maps_url?: string | null
          id?: string
          instagram_handle?: string | null
          instagram_url: string
          instagram_verified?: boolean
          phone: string
          phone_line_type?: string
          phone_valid?: boolean
          place_id?: string | null
          rating: number
          rating_count: number
          search_id: string
          status?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          category?: string | null
          city?: string | null
          created_at?: string
          google_maps_url?: string | null
          id?: string
          instagram_handle?: string | null
          instagram_url?: string
          instagram_verified?: boolean
          phone?: string
          phone_line_type?: string
          phone_valid?: boolean
          place_id?: string | null
          rating?: number
          rating_count?: number
          search_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "lead_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_searches: {
        Row: {
          businesses_found: number
          category: string
          city: string
          created_at: string
          id: string
          max_rating: number
          min_rating: number
          rating_matches: number
          status: string
          user_id: string | null
          verified_leads: number
        }
        Insert: {
          businesses_found?: number
          category: string
          city: string
          created_at?: string
          id?: string
          max_rating?: number
          min_rating?: number
          rating_matches?: number
          status?: string
          user_id?: string | null
          verified_leads?: number
        }
        Update: {
          businesses_found?: number
          category?: string
          city?: string
          created_at?: string
          id?: string
          max_rating?: number
          min_rating?: number
          rating_matches?: number
          status?: string
          user_id?: string | null
          verified_leads?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          id: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          id?: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          id?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          blocked: boolean
          current_period_end: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked?: boolean
          current_period_end?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked?: boolean
          current_period_end?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
