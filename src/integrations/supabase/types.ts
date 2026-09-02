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
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          pillar: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          pillar?: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          pillar?: string
          slug?: string
        }
        Relationships: []
      }
      company_profile_videos: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          duration: number | null
          file_size: number | null
          id: string
          status: string
          storage_path: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          video_url: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration?: number | null
          file_size?: number | null
          id?: string
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          video_url: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration?: number | null
          file_size?: number | null
          id?: string
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          video_url?: string
        }
        Relationships: []
      }
      facilities: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string
          property_id: string
          reply: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone: string
          property_id: string
          reply?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string
          property_id?: string
          reply?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          id: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          agent_id: string | null
          agent_name: string
          agent_phone: string | null
          approval: Database["public"]["Enums"]["approval_status"]
          bathrooms: number
          bedrooms: number
          building_area: number
          carports: number
          category_id: string | null
          certificate: string | null
          city: string
          created_at: string
          description: string
          id: string
          is_featured: boolean
          land_area: number
          latitude: number | null
          longitude: number | null
          price: number
          province: string
          reject_reason: string | null
          slug: string
          status: Database["public"]["Enums"]["property_status"]
          title: string
          type: Database["public"]["Enums"]["listing_type"]
          updated_at: string
          views: number
        }
        Insert: {
          address?: string
          agent_id?: string | null
          agent_name?: string
          agent_phone?: string | null
          approval?: Database["public"]["Enums"]["approval_status"]
          bathrooms?: number
          bedrooms?: number
          building_area?: number
          carports?: number
          category_id?: string | null
          certificate?: string | null
          city?: string
          created_at?: string
          description?: string
          id?: string
          is_featured?: boolean
          land_area?: number
          latitude?: number | null
          longitude?: number | null
          price?: number
          province?: string
          reject_reason?: string | null
          slug: string
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          type?: Database["public"]["Enums"]["listing_type"]
          updated_at?: string
          views?: number
        }
        Update: {
          address?: string
          agent_id?: string | null
          agent_name?: string
          agent_phone?: string | null
          approval?: Database["public"]["Enums"]["approval_status"]
          bathrooms?: number
          bedrooms?: number
          building_area?: number
          carports?: number
          category_id?: string | null
          certificate?: string | null
          city?: string
          created_at?: string
          description?: string
          id?: string
          is_featured?: boolean
          land_area?: number
          latitude?: number | null
          longitude?: number | null
          price?: number
          province?: string
          reject_reason?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          type?: Database["public"]["Enums"]["listing_type"]
          updated_at?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "properties_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      property_facilities: {
        Row: {
          facility_id: string
          property_id: string
        }
        Insert: {
          facility_id: string
          property_id: string
        }
        Update: {
          facility_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_facilities_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_facilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          property_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          property_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          property_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          property_id: string
          reason: string
          status: Database["public"]["Enums"]["report_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          property_id: string
          reason: string
          status?: Database["public"]["Enums"]["report_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          property_id?: string
          reason?: string
          status?: Database["public"]["Enums"]["report_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string
          property_id: string
          scheduled_date: string
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone: string
          property_id: string
          scheduled_date: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string
          property_id?: string
          scheduled_date?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          assistance_mode: string | null
          category_id: string | null
          city: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          description: string
          duration_estimate: string | null
          id: string
          image_url: string | null
          is_active: boolean
          legal_basis: string | null
          min_area: number
          pillar: string
          price_from: number
          price_unit: string
          requirements: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
          warranty: string | null
          work_scope: string | null
        }
        Insert: {
          assistance_mode?: string | null
          category_id?: string | null
          city?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          description?: string
          duration_estimate?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          legal_basis?: string | null
          min_area?: number
          pillar: string
          price_from?: number
          price_unit?: string
          requirements?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          warranty?: string | null
          work_scope?: string | null
        }
        Update: {
          assistance_mode?: string | null
          category_id?: string | null
          city?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          description?: string
          duration_estimate?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          legal_basis?: string | null
          min_area?: number
          pillar?: string
          price_from?: number
          price_unit?: string
          requirements?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          warranty?: string | null
          work_scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
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
      increment_property_views: { Args: { _slug: string }; Returns: undefined }
    }
    Enums: {
      app_role: "buyer" | "agent" | "admin"
      approval_status: "pending" | "approved" | "rejected"
      inquiry_status: "baru" | "dibalas" | "ditutup"
      listing_type: "jual" | "sewa"
      property_status: "draft" | "aktif" | "terjual" | "tersewa" | "nonaktif"
      report_status: "terbuka" | "ditinjau" | "selesai"
      schedule_status: "menunggu" | "dikonfirmasi" | "selesai" | "dibatalkan"
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
      app_role: ["buyer", "agent", "admin"],
      approval_status: ["pending", "approved", "rejected"],
      inquiry_status: ["baru", "dibalas", "ditutup"],
      listing_type: ["jual", "sewa"],
      property_status: ["draft", "aktif", "terjual", "tersewa", "nonaktif"],
      report_status: ["terbuka", "ditinjau", "selesai"],
      schedule_status: ["menunggu", "dikonfirmasi", "selesai", "dibatalkan"],
    },
  },
} as const
