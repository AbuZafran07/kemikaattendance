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
      account_locks: {
        Row: {
          coaching_id: string | null
          created_at: string
          id: string
          locked_at: string
          reason: string
          status: string
          unlock_letter_id: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          user_id: string
          violation_count_at_lock: number
        }
        Insert: {
          coaching_id?: string | null
          created_at?: string
          id?: string
          locked_at?: string
          reason: string
          status?: string
          unlock_letter_id?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id: string
          violation_count_at_lock: number
        }
        Update: {
          coaching_id?: string | null
          created_at?: string
          id?: string
          locked_at?: string
          reason?: string
          status?: string
          unlock_letter_id?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id?: string
          violation_count_at_lock?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_locks_coaching_id_fkey"
            columns: ["coaching_id"]
            isOneToOne: false
            referencedRelation: "employee_coaching"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_locks_unlock_letter_fkey"
            columns: ["unlock_letter_id"]
            isOneToOne: false
            referencedRelation: "account_unlock_letters"
            referencedColumns: ["id"]
          },
        ]
      }
      account_unlock_letters: {
        Row: {
          created_at: string
          document_url: string | null
          employee_signature_data: string
          employee_signed_at: string
          hr_signature_data: string | null
          hr_signed_at: string | null
          hr_signed_by: string | null
          id: string
          letter_number: string
          lock_id: string
          rejection_reason: string | null
          statement_text: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          employee_signature_data: string
          employee_signed_at?: string
          hr_signature_data?: string | null
          hr_signed_at?: string | null
          hr_signed_by?: string | null
          id?: string
          letter_number: string
          lock_id: string
          rejection_reason?: string | null
          statement_text: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          employee_signature_data?: string
          employee_signed_at?: string
          hr_signature_data?: string | null
          hr_signed_at?: string | null
          hr_signed_by?: string | null
          id?: string
          letter_number?: string
          lock_id?: string
          rejection_reason?: string | null
          statement_text?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_unlock_letters_lock_id_fkey"
            columns: ["lock_id"]
            isOneToOne: false
            referencedRelation: "account_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          notes: string | null
          performed_by: string
          request_id: string
          request_type: string
          target_user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          notes?: string | null
          performed_by: string
          request_id: string
          request_type: string
          target_user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          notes?: string | null
          performed_by?: string
          request_id?: string
          request_type?: string
          target_user_id?: string
        }
        Relationships: []
      }
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_at: string
          assigned_by: string | null
          condition_in: string | null
          condition_out: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          returned_at: string | null
          returned_by: string | null
          updated_at: string
        }
        Insert: {
          asset_id: string
          assigned_at?: string
          assigned_by?: string | null
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          returned_at?: string | null
          returned_by?: string | null
          updated_at?: string
        }
        Update: {
          asset_id?: string
          assigned_at?: string
          assigned_by?: string | null
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          returned_at?: string | null
          returned_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_code: string
          brand: string | null
          category: string
          condition: string
          created_at: string
          id: string
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_code: string
          brand?: string | null
          category: string
          condition?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_code?: string
          brand?: string | null
          category?: string
          condition?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          late_minutes: number | null
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
          late_minutes?: number | null
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
          late_minutes?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
        }
        Relationships: []
      }
      attendance_audit_logs: {
        Row: {
          action_type: string
          attendance_id: string
          changed_by: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json
          reason: string | null
        }
        Insert: {
          action_type: string
          attendance_id: string
          changed_by: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data: Json
          reason?: string | null
        }
        Update: {
          action_type?: string
          attendance_id?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json
          reason?: string | null
        }
        Relationships: []
      }
      attendance_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          notif_type: string
          related_id: string | null
          target_role: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          notif_type: string
          related_id?: string | null
          target_role?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          notif_type?: string
          related_id?: string | null
          target_role?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance_violations: {
        Row: {
          attendance_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_counted: boolean
          late_reason_id: string | null
          source: string
          user_id: string
          violation_date: string
          violation_type: string
        }
        Insert: {
          attendance_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_counted?: boolean
          late_reason_id?: string | null
          source?: string
          user_id: string
          violation_date: string
          violation_type: string
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_counted?: boolean
          late_reason_id?: string | null
          source?: string
          user_id?: string
          violation_date?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_violations_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_violations_late_reason_id_fkey"
            columns: ["late_reason_id"]
            isOneToOne: false
            referencedRelation: "late_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          file_name: string
          id: string
          notes: string | null
          performed_by: string
          records: number
          tables_affected: string[] | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          file_name: string
          id?: string
          notes?: string | null
          performed_by?: string
          records?: number
          tables_affected?: string[] | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          file_name?: string
          id?: string
          notes?: string | null
          performed_by?: string
          records?: number
          tables_affected?: string[] | null
        }
        Relationships: []
      }
      biometric_consent_records: {
        Row: {
          action_type: string
          consent_given: boolean
          consent_timestamp: string
          created_at: string
          faceio_facial_id: string | null
          id: string
          ip_address: string | null
          notes: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          consent_given: boolean
          consent_timestamp?: string
          created_at?: string
          faceio_facial_id?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          consent_given?: boolean
          consent_timestamp?: string
          created_at?: string
          faceio_facial_id?: string | null
          id?: string
          ip_address?: string | null
          notes?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      business_travel_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          ca_document_url: string | null
          ca_number: string | null
          ca_uploaded_at: string | null
          created_at: string
          destination: string
          document_url: string | null
          end_date: string
          id: string
          notes: string | null
          purpose: string
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
          ca_document_url?: string | null
          ca_number?: string | null
          ca_uploaded_at?: string | null
          created_at?: string
          destination: string
          document_url?: string | null
          end_date: string
          id?: string
          notes?: string | null
          purpose: string
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
          ca_document_url?: string | null
          ca_number?: string | null
          ca_uploaded_at?: string | null
          created_at?: string
          destination?: string
          document_url?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          purpose?: string
          rejection_reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          expire_at: string | null
          id: string
          is_active: boolean
          priority: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          expire_at?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          expire_at?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_history: {
        Row: {
          changes: Json | null
          contract_number: string | null
          contract_type: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
        }
        Insert: {
          changes?: Json | null
          contract_number?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
        }
        Update: {
          changes?: Json | null
          contract_number?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_reminders_log: {
        Row: {
          channels: Json | null
          contract_end_date: string
          employee_id: string
          error_message: string | null
          id: string
          recipients: Json | null
          reminder_type: string
          sent_at: string
          status: string | null
        }
        Insert: {
          channels?: Json | null
          contract_end_date: string
          employee_id: string
          error_message?: string | null
          id?: string
          recipients?: Json | null
          reminder_type: string
          sent_at?: string
          status?: string | null
        }
        Update: {
          channels?: Json | null
          contract_end_date?: string
          employee_id?: string
          error_message?: string | null
          id?: string
          recipients?: Json | null
          reminder_type?: string
          sent_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_reminders_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_actions: {
        Row: {
          created_at: string
          document_url: string | null
          id: string
          issue_date: string
          period_month: string
          status: string
          user_id: string
          violation_count_at_issuance: number
          warning_type: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          id?: string
          issue_date?: string
          period_month: string
          status?: string
          user_id: string
          violation_count_at_issuance: number
          warning_type: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          id?: string
          issue_date?: string
          period_month?: string
          status?: string
          user_id?: string
          violation_count_at_issuance?: number
          warning_type?: string
        }
        Relationships: []
      }
      employee_coaching: {
        Row: {
          attachment_url: string | null
          coaching_date: string
          coaching_notes: string | null
          coaching_type: string | null
          created_at: string
          current_warning_level: string | null
          follow_up: string | null
          hr_pic: string
          id: string
          related_lock_id: string | null
          status: string
          updated_at: string
          user_id: string
          violation_count: number | null
        }
        Insert: {
          attachment_url?: string | null
          coaching_date?: string
          coaching_notes?: string | null
          coaching_type?: string | null
          created_at?: string
          current_warning_level?: string | null
          follow_up?: string | null
          hr_pic: string
          id?: string
          related_lock_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          violation_count?: number | null
        }
        Update: {
          attachment_url?: string | null
          coaching_date?: string
          coaching_notes?: string | null
          coaching_type?: string | null
          created_at?: string
          current_warning_level?: string | null
          follow_up?: string | null
          hr_pic?: string
          id?: string
          related_lock_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          violation_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_coaching_related_lock_fkey"
            columns: ["related_lock_id"]
            isOneToOne: false
            referencedRelation: "account_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string
          created_at: string
          expiry_date: string | null
          file_path: string
          file_size: number | null
          id: string
          issued_date: string | null
          mime_type: string | null
          notes: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          expiry_date?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          issued_date?: string | null
          mime_type?: string | null
          notes?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          issued_date?: string | null
          mime_type?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_loans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          loan_type: string
          monthly_installment: number
          paid_installments: number
          remaining_amount: number
          start_date: string
          status: string
          total_amount: number
          total_installments: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          loan_type?: string
          monthly_installment?: number
          paid_installments?: number
          remaining_amount?: number
          start_date?: string
          status?: string
          total_amount?: number
          total_installments?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          loan_type?: string
          monthly_installment?: number
          paid_installments?: number
          remaining_amount?: number
          start_date?: string
          status?: string
          total_amount?: number
          total_installments?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_trainings: {
        Row: {
          certificate_url: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          score: number | null
          start_date: string | null
          status: string
          training_id: string | null
          training_name: string
          updated_at: string
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          start_date?: string | null
          status?: string
          training_id?: string | null
          training_name: string
          updated_at?: string
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          start_date?: string | null
          status?: string
          training_id?: string | null
          training_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_trainings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_trainings_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_interviews: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          interview_date: string
          interviewer: string | null
          reason: string | null
          reason_detail: string | null
          satisfaction: Json | null
          suggestions: string | null
          updated_at: string
          would_recommend: boolean | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          interview_date?: string
          interviewer?: string | null
          reason?: string | null
          reason_detail?: string | null
          satisfaction?: Json | null
          suggestions?: string | null
          updated_at?: string
          would_recommend?: boolean | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          interview_date?: string
          interviewer?: string | null
          reason?: string | null
          reason_detail?: string | null
          satisfaction?: Json | null
          suggestions?: string | null
          updated_at?: string
          would_recommend?: boolean | null
        }
        Relationships: []
      }
      final_settlements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          loan_payoff: number
          net_amount: number
          notes: string | null
          paid_at: string | null
          period_month: number
          period_year: number
          pesangon_amount: number
          remaining_leave_days: number
          resign_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          loan_payoff?: number
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          period_month: number
          period_year: number
          pesangon_amount?: number
          remaining_leave_days?: number
          resign_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          loan_payoff?: number
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          period_month?: number
          period_year?: number
          pesangon_amount?: number
          remaining_leave_days?: number
          resign_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      geocoding_cache: {
        Row: {
          address: string
          created_at: string
          hit_count: number
          id: string
          last_used_at: string
          lat_rounded: number
          lng_rounded: number
        }
        Insert: {
          address: string
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          lat_rounded: number
          lng_rounded: number
        }
        Update: {
          address?: string
          created_at?: string
          hit_count?: number
          id?: string
          last_used_at?: string
          lat_rounded?: number
          lng_rounded?: number
        }
        Relationships: []
      }
      handover_checklists: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          items: Json
          notes: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          items?: Json
          notes?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          items?: Json
          notes?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      kpi_grade_settings: {
        Row: {
          bonus_percent: number
          created_at: string
          grade: string
          id: string
          min_score: number
          updated_at: string
        }
        Insert: {
          bonus_percent?: number
          created_at?: string
          grade: string
          id?: string
          min_score: number
          updated_at?: string
        }
        Update: {
          bonus_percent?: number
          created_at?: string
          grade?: string
          id?: string
          min_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      kpi_indicators: {
        Row: {
          created_at: string
          created_by: string | null
          custom_expr: string | null
          custom_vars: Json | null
          description: string | null
          formula_type: string
          id: string
          name: string
          sort_order: number | null
          target: string
          thresholds: Json | null
          unit: string
          updated_at: string
          user_id: string | null
          weight: number
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_expr?: string | null
          custom_vars?: Json | null
          description?: string | null
          formula_type?: string
          id?: string
          name: string
          sort_order?: number | null
          target?: string
          thresholds?: Json | null
          unit?: string
          updated_at?: string
          user_id?: string | null
          weight?: number
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_expr?: string | null
          custom_vars?: Json | null
          description?: string | null
          formula_type?: string
          id?: string
          name?: string
          sort_order?: number | null
          target?: string
          thresholds?: Json | null
          unit?: string
          updated_at?: string
          user_id?: string | null
          weight?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_indicators_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_monthly_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          month: number
          uploaded_by: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string
          month: number
          uploaded_by: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          month?: number
          uploaded_by?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      kpi_realizations: {
        Row: {
          created_at: string
          custom_values: Json | null
          id: string
          indicator_id: string | null
          month: number
          notes: string | null
          updated_at: string
          user_id: string | null
          value: number | null
          year: number
        }
        Insert: {
          created_at?: string
          custom_values?: Json | null
          id?: string
          indicator_id?: string | null
          month: number
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          value?: number | null
          year: number
        }
        Update: {
          created_at?: string
          custom_values?: Json | null
          id?: string
          indicator_id?: string | null
          month?: number
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          value?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_realizations_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "kpi_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_realizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      late_reasons: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          attendance_id: string
          created_at: string
          description: string | null
          id: string
          reason: string
          rejection_reason: string | null
          status: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          attendance_id: string
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          attendance_id?: string
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_reasons_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          delegated_to: string | null
          delegation_notes: string | null
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
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          delegated_to?: string | null
          delegation_notes?: string | null
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
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          delegated_to?: string | null
          delegation_notes?: string | null
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
      loan_installments: {
        Row: {
          amount: number
          created_at: string
          id: string
          installment_number: number
          loan_id: string
          notes: string | null
          payment_date: string | null
          payroll_period_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          installment_number: number
          loan_id: string
          notes?: string | null
          payment_date?: string | null
          payroll_period_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          installment_number?: number
          loan_id?: string
          notes?: string | null
          payment_date?: string | null
          payroll_period_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "employee_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_last_seen: {
        Row: {
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          hours: number
          id: string
          overtime_date: string
          reason: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          hours: number
          id?: string
          overtime_date: string
          reason: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          hours?: number
          id?: string
          overtime_date?: string
          reason?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll: {
        Row: {
          allowance: number
          basic_salary: number
          bonus_lainnya: number
          bonus_tahunan: number
          bpjs_jht_employer: number
          bpjs_jkk_employer: number
          bpjs_jkm_employer: number
          bpjs_jp_employer: number
          bpjs_kes_employer: number
          bpjs_kesehatan: number
          bpjs_ketenagakerjaan: number
          bruto_income: number
          created_at: string
          deduction_notes: string | null
          id: string
          insentif_kinerja: number
          insentif_penjualan: number
          loan_deduction: number
          netto_income: number
          other_deduction: number
          overtime_hours: number
          overtime_total: number
          pengembalian_employee: number
          period_id: string
          pkp: number
          pph21_mode: string
          pph21_monthly: number
          pph21_ter_rate: number | null
          ptkp_status: string
          ptkp_value: number
          take_home_pay: number
          thr: number
          tunjangan_jabatan: number
          tunjangan_kesehatan: number
          tunjangan_komunikasi: number
          tunjangan_operasional: number
          tunjangan_perjalanan_dinas: number
          user_id: string
        }
        Insert: {
          allowance?: number
          basic_salary?: number
          bonus_lainnya?: number
          bonus_tahunan?: number
          bpjs_jht_employer?: number
          bpjs_jkk_employer?: number
          bpjs_jkm_employer?: number
          bpjs_jp_employer?: number
          bpjs_kes_employer?: number
          bpjs_kesehatan?: number
          bpjs_ketenagakerjaan?: number
          bruto_income?: number
          created_at?: string
          deduction_notes?: string | null
          id?: string
          insentif_kinerja?: number
          insentif_penjualan?: number
          loan_deduction?: number
          netto_income?: number
          other_deduction?: number
          overtime_hours?: number
          overtime_total?: number
          pengembalian_employee?: number
          period_id: string
          pkp?: number
          pph21_mode?: string
          pph21_monthly?: number
          pph21_ter_rate?: number | null
          ptkp_status?: string
          ptkp_value?: number
          take_home_pay?: number
          thr?: number
          tunjangan_jabatan?: number
          tunjangan_kesehatan?: number
          tunjangan_komunikasi?: number
          tunjangan_operasional?: number
          tunjangan_perjalanan_dinas?: number
          user_id: string
        }
        Update: {
          allowance?: number
          basic_salary?: number
          bonus_lainnya?: number
          bonus_tahunan?: number
          bpjs_jht_employer?: number
          bpjs_jkk_employer?: number
          bpjs_jkm_employer?: number
          bpjs_jp_employer?: number
          bpjs_kes_employer?: number
          bpjs_kesehatan?: number
          bpjs_ketenagakerjaan?: number
          bruto_income?: number
          created_at?: string
          deduction_notes?: string | null
          id?: string
          insentif_kinerja?: number
          insentif_penjualan?: number
          loan_deduction?: number
          netto_income?: number
          other_deduction?: number
          overtime_hours?: number
          overtime_total?: number
          pengembalian_employee?: number
          period_id?: string
          pkp?: number
          pph21_mode?: string
          pph21_monthly?: number
          pph21_ter_rate?: number | null
          ptkp_status?: string
          ptkp_value?: number
          take_home_pay?: number
          thr?: number
          tunjangan_jabatan?: number
          tunjangan_kesehatan?: number
          tunjangan_komunikasi?: number
          tunjangan_operasional?: number
          tunjangan_perjalanan_dinas?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_audit_logs: {
        Row: {
          action_type: string
          affected_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          performed_by: string
          period_id: string
          period_month: number
          period_year: number
          reason: string
        }
        Insert: {
          action_type: string
          affected_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          performed_by: string
          period_id: string
          period_month: number
          period_year: number
          reason: string
        }
        Update: {
          action_type?: string
          affected_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          performed_by?: string
          period_id?: string
          period_month?: number
          period_year?: number
          reason?: string
        }
        Relationships: []
      }
      payroll_overrides: {
        Row: {
          bonus_lainnya: number
          bonus_tahunan: number
          created_at: string
          deduction_notes: string | null
          id: string
          insentif_kinerja: number
          insentif_penjualan: number
          loan_deduction: number
          other_deduction: number
          overtime_override: number
          pengembalian_employee: number
          period_month: number
          period_year: number
          thr: number
          tunjangan_kehadiran: number
          tunjangan_kesehatan: number
          tunjangan_komunikasi: number
          tunjangan_perjalanan_dinas: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_lainnya?: number
          bonus_tahunan?: number
          created_at?: string
          deduction_notes?: string | null
          id?: string
          insentif_kinerja?: number
          insentif_penjualan?: number
          loan_deduction?: number
          other_deduction?: number
          overtime_override?: number
          pengembalian_employee?: number
          period_month: number
          period_year: number
          thr?: number
          tunjangan_kehadiran?: number
          tunjangan_kesehatan?: number
          tunjangan_komunikasi?: number
          tunjangan_perjalanan_dinas?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_lainnya?: number
          bonus_tahunan?: number
          created_at?: string
          deduction_notes?: string | null
          id?: string
          insentif_kinerja?: number
          insentif_penjualan?: number
          loan_deduction?: number
          other_deduction?: number
          overtime_override?: number
          pengembalian_employee?: number
          period_month?: number
          period_year?: number
          thr?: number
          tunjangan_kehadiran?: number
          tunjangan_kesehatan?: number
          tunjangan_komunikasi?: number
          tunjangan_perjalanan_dinas?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payroll_periods: {
        Row: {
          created_at: string
          id: string
          month: number
          status: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          status?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          status?: string
          year?: number
        }
        Relationships: []
      }
      pph21_ter_rates: {
        Row: {
          bruto_max: number
          bruto_min: number
          created_at: string
          id: string
          kategori_ptkp: string
          tarif_efektif: number
          updated_at: string
        }
        Insert: {
          bruto_max?: number
          bruto_min?: number
          created_at?: string
          id?: string
          kategori_ptkp: string
          tarif_efektif?: number
          updated_at?: string
        }
        Update: {
          bruto_max?: number
          bruto_min?: number
          created_at?: string
          id?: string
          kategori_ptkp?: string
          tarif_efektif?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          address: string | null
          annual_leave_quota: number | null
          bank_account_number: string | null
          bank_name: string | null
          basic_salary: number | null
          bpjs_kesehatan_enabled: boolean
          bpjs_ketenagakerjaan_enabled: boolean
          contract_end_date: string | null
          contract_number: string | null
          contract_start_date: string | null
          contract_type: string
          created_at: string
          departemen: string
          email: string
          fcm_token: string | null
          full_name: string
          id: string
          jabatan: string
          join_date: string
          nik: string
          notes: string | null
          npwp: string | null
          phone: string | null
          photo_url: string | null
          ptkp_status: string | null
          remaining_leave: number | null
          reports_to: string | null
          resign_date: string | null
          resign_notes: string | null
          status: string | null
          tunjangan_jabatan: number | null
          tunjangan_komunikasi: number | null
          tunjangan_operasional: number | null
          updated_at: string
          work_type: string
        }
        Insert: {
          account_status?: string
          address?: string | null
          annual_leave_quota?: number | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          bpjs_kesehatan_enabled?: boolean
          bpjs_ketenagakerjaan_enabled?: boolean
          contract_end_date?: string | null
          contract_number?: string | null
          contract_start_date?: string | null
          contract_type?: string
          created_at?: string
          departemen: string
          email: string
          fcm_token?: string | null
          full_name: string
          id: string
          jabatan: string
          join_date?: string
          nik: string
          notes?: string | null
          npwp?: string | null
          phone?: string | null
          photo_url?: string | null
          ptkp_status?: string | null
          remaining_leave?: number | null
          reports_to?: string | null
          resign_date?: string | null
          resign_notes?: string | null
          status?: string | null
          tunjangan_jabatan?: number | null
          tunjangan_komunikasi?: number | null
          tunjangan_operasional?: number | null
          updated_at?: string
          work_type?: string
        }
        Update: {
          account_status?: string
          address?: string | null
          annual_leave_quota?: number | null
          bank_account_number?: string | null
          bank_name?: string | null
          basic_salary?: number | null
          bpjs_kesehatan_enabled?: boolean
          bpjs_ketenagakerjaan_enabled?: boolean
          contract_end_date?: string | null
          contract_number?: string | null
          contract_start_date?: string | null
          contract_type?: string
          created_at?: string
          departemen?: string
          email?: string
          fcm_token?: string | null
          full_name?: string
          id?: string
          jabatan?: string
          join_date?: string
          nik?: string
          notes?: string | null
          npwp?: string | null
          phone?: string | null
          photo_url?: string | null
          ptkp_status?: string | null
          remaining_leave?: number | null
          reports_to?: string | null
          resign_date?: string | null
          resign_notes?: string | null
          status?: string | null
          tunjangan_jabatan?: number | null
          tunjangan_komunikasi?: number | null
          tunjangan_operasional?: number | null
          updated_at?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_change_history: {
        Row: {
          changed_by: string
          changed_fields: string[]
          created_at: string
          effective_date: string
          id: string
          new_values: Json
          old_values: Json
          reason: string
          user_id: string
        }
        Insert: {
          changed_by: string
          changed_fields?: string[]
          created_at?: string
          effective_date?: string
          id?: string
          new_values?: Json
          old_values?: Json
          reason: string
          user_id: string
        }
        Update: {
          changed_by?: string
          changed_fields?: string[]
          created_at?: string
          effective_date?: string
          id?: string
          new_values?: Json
          old_values?: Json
          reason?: string
          user_id?: string
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
      training_programs: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean
          name: string
          provider: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          name: string
          provider?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          name?: string
          provider?: string | null
          updated_at?: string
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
      approve_business_travel_request: {
        Args: { document_url_param?: string; request_id: string }
        Returns: undefined
      }
      approve_late_reason: {
        Args: { notes?: string; reason_id: string }
        Returns: undefined
      }
      approve_leave_request: {
        Args: { notes?: string; request_id: string }
        Returns: undefined
      }
      approve_overtime_request: {
        Args: { notes?: string; request_id: string }
        Returns: undefined
      }
      approve_unlock_letter: {
        Args: { p_hr_signature_data?: string; p_letter_id: string }
        Returns: undefined
      }
      check_attendance_thresholds: {
        Args: { p_reference_date: string; p_user_id: string }
        Returns: undefined
      }
      create_attendance_violation: {
        Args: {
          p_attendance_id: string
          p_description?: string
          p_late_reason_id?: string
          p_source?: string
          p_user_id: string
          p_violation_date: string
          p_violation_type: string
        }
        Returns: string
      }
      get_attendance_discipline_config: { Args: never; Returns: Json }
      get_biaya_jabatan_config: { Args: never; Returns: Json }
      get_bpjs_config: { Args: never; Returns: Json }
      get_business_travel_allowance_config: { Args: never; Returns: Json }
      get_delegation_colleagues: {
        Args: never
        Returns: {
          full_name: string
          id: string
          jabatan: string
        }[]
      }
      get_effective_work_hours: { Args: never; Returns: Json }
      get_low_leave_quota_employees: {
        Args: { threshold?: number }
        Returns: {
          full_name: string
          remaining_leave: number
          user_id: string
        }[]
      }
      get_monthly_violation_count: {
        Args: { p_month: string; p_user_id: string }
        Returns: number
      }
      get_office_locations: { Args: never; Returns: Json }
      get_pph21_brackets_config: { Args: never; Returns: Json }
      get_ptkp_config: { Args: never; Returns: Json }
      get_rolling_3month_violation_count: {
        Args: { p_reference_date: string; p_user_id: string }
        Returns: number
      }
      get_work_hours: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_discipline_admin: { Args: never; Returns: boolean }
      mark_notifications_seen: { Args: never; Returns: string }
      reject_business_travel_request: {
        Args: { reason: string; request_id: string }
        Returns: undefined
      }
      reject_late_reason: {
        Args: { reason: string; reason_id: string }
        Returns: undefined
      }
      reject_leave_request: {
        Args: { reason: string; request_id: string }
        Returns: undefined
      }
      reject_overtime_request: {
        Args: { reason: string; request_id: string }
        Returns: undefined
      }
      reject_unlock_letter: {
        Args: { p_letter_id: string; p_reason: string }
        Returns: undefined
      }
      set_unlock_letter_document: {
        Args: { p_document_url: string; p_letter_id: string }
        Returns: undefined
      }
      submit_late_reason: {
        Args: {
          p_attachment_url?: string
          p_attendance_id: string
          p_description?: string
          p_reason: string
        }
        Returns: string
      }
      submit_unlock_letter: {
        Args: { p_lock_id: string; p_signature_data: string; p_statement_text: string }
        Returns: string
      }
      unlock_account: {
        Args: { p_coaching_id: string; p_lock_id: string; p_unlock_letter_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "employee" | "hr"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "employee", "hr"],
      attendance_status: ["hadir", "terlambat", "pulang_cepat", "tidak_hadir"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["cuti_tahunan", "izin", "sakit", "lupa_absen"],
    },
  },
} as const
