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
      attendance: {
        Row: {
          check_in_latitude: number
          check_in_longitude: number
          check_in_photo_url: string | null
          check_in_time: string
          check_out_latitude: number | null
          check_out_longitude: number | null
          check_out_photo_url: string | null
          check_out_time: string | null
          created_at: string
          duration_minutes: number | null
          face_recognition_validated: boolean | null
          gps_validated: boolean | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Insert: {
          check_in_latitude: number
          check_in_longitude: number
          check_in_photo_url?: string | null
          check_in_time: string
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string
          duration_minutes?: number | null
          face_recognition_validated?: boolean | null
          gps_validated?: boolean | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Update: {
          check_in_latitude?: number
          check_in_longitude?: number
          check_in_photo_url?: string | null
          check_in_time?: string
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          check_out_photo_url?: string | null
          check_out_time?: string | null
          created_at?: string
          duration_minutes?: number | null
          face_recognition_validated?: boolean | null
          gps_validated?: boolean | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string
          rejection_reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string
          rejection_reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          hours: number
          id: string
          overtime_date: string
          reason: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          hours: number
          id?: string
          overtime_date: string
          reason: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          hours?: number
          id?: string
          overtime_date?: string
          reason?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          annual_leave_quota: number | null
          created_at: string
          departemen: string
          email: string
          full_name: string
          id: string
          jabatan: string
          join_date: string
          nik: string
          phone: string | null
          photo_url: string | null
          remaining_leave: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          annual_leave_quota?: number | null
          created_at?: string
          departemen: string
          email: string
          full_name: string
          id: string
          jabatan: string
          join_date?: string
          nik: string
          phone?: string | null
          photo_url?: string | null
          remaining_leave?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          annual_leave_quota?: number | null
          created_at?: string
          departemen?: string
          email?: string
          full_name?: string
          id?: string
          jabatan?: string
          join_date?: string
          nik?: string
          phone?: string | null
          photo_url?: string | null
          remaining_leave?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
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
          role?: Database["public"]["Enums"]["app_role"]
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
      get_office_locations: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
      attendance_status: "hadir" | "terlambat" | "pulang_cepat" | "tidak_hadir"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "cuti_tahunan" | "izin" | "sakit" | "lupa_absen"
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
      app_role: ["admin", "employee"],
      attendance_status: ["hadir", "terlambat", "pulang_cepat", "tidak_hadir"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["cuti_tahunan", "izin", "sakit", "lupa_absen"],
    },
  },
} as const
