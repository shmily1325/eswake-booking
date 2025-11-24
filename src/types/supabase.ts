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
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      allowed_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          details: string | null
          id: number
          record_id: string | null
          start_time: string | null
          table_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          details?: string | null
          id?: number
          record_id?: string | null
          start_time?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          details?: string | null
          id?: number
          record_id?: string | null
          start_time?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      board_storage: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: number
          member_id: string
          notes: string | null
          slot_number: number
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: number
          member_id: string
          notes?: string | null
          slot_number: number
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: number
          member_id?: string
          notes?: string | null
          slot_number?: number
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "board_storage_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      boat_unavailable_dates: {
        Row: {
          boat_id: number
          created_at: string | null
          created_by: string | null
          end_date: string
          end_time: string | null
          id: number
          is_active: boolean | null
          notes: string | null
          reason: string
          start_date: string
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          boat_id: number
          created_at?: string | null
          created_by?: string | null
          end_date: string
          end_time?: string | null
          id?: number
          is_active?: boolean | null
          notes?: string | null
          reason: string
          start_date: string
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          boat_id?: number
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          end_time?: string | null
          id?: number
          is_active?: boolean | null
          notes?: string | null
          reason?: string
          start_date?: string
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boat_unavailable_dates_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
        ]
      }
      boats: {
        Row: {
          color: string
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      booking_coaches: {
        Row: {
          booking_id: number
          coach_id: string
          created_at: string | null
          id: number
        }
        Insert: {
          booking_id: number
          coach_id: string
          created_at?: string | null
          id?: number
        }
        Update: {
          booking_id?: number
          coach_id?: string
          created_at?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_coaches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_drivers: {
        Row: {
          booking_id: number
          created_at: string | null
          driver_id: string
          id: number
        }
        Insert: {
          booking_id: number
          created_at?: string | null
          driver_id: string
          id?: number
        }
        Update: {
          booking_id?: number
          created_at?: string | null
          driver_id?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_drivers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_members: {
        Row: {
          booking_id: number
          created_at: string | null
          id: number
          member_id: string
        }
        Insert: {
          booking_id: number
          created_at?: string | null
          id?: number
          member_id: string
        }
        Update: {
          booking_id?: number
          created_at?: string | null
          id?: number
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_members_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_participants: {
        Row: {
          booking_id: number
          coach_id: string | null
          created_at: string | null
          deleted_at: string | null
          duration_min: number
          id: number
          is_deleted: boolean | null
          is_teaching: boolean | null
          lesson_type: string | null
          member_id: string | null
          notes: string | null
          participant_name: string
          payment_method: string
          replaced_by_id: number | null
          replaces_id: number | null
          reported_at: string | null
          status: string | null
          transaction_id: number | null
          updated_at: string | null
        }
        Insert: {
          booking_id: number
          coach_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_min: number
          id?: number
          is_deleted?: boolean | null
          is_teaching?: boolean | null
          lesson_type?: string | null
          member_id?: string | null
          notes?: string | null
          participant_name: string
          payment_method: string
          replaced_by_id?: number | null
          replaces_id?: number | null
          reported_at?: string | null
          status?: string | null
          transaction_id?: number | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: number
          coach_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          duration_min?: number
          id?: number
          is_deleted?: boolean | null
          is_teaching?: boolean | null
          lesson_type?: string | null
          member_id?: string | null
          notes?: string | null
          participant_name?: string
          payment_method?: string
          replaced_by_id?: number | null
          replaces_id?: number | null
          reported_at?: string | null
          status?: string | null
          transaction_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_participants_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_replaced_by_id_fkey"
            columns: ["replaced_by_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_participants_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          activity_types: string[] | null
          boat_id: number
          contact_name: string
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          duration_min: number
          filled_by: string | null
          id: number
          member_id: string | null
          notes: string | null
          requires_driver: boolean | null
          schedule_notes: string | null
          start_at: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          activity_types?: string[] | null
          boat_id: number
          contact_name: string
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_min: number
          filled_by?: string | null
          id?: number
          member_id?: string | null
          notes?: string | null
          requires_driver?: boolean | null
          schedule_notes?: string | null
          start_at: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_types?: string[] | null
          boat_id?: number
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_min?: number
          filled_by?: string | null
          id?: number
          member_id?: string | null
          notes?: string | null
          requires_driver?: boolean | null
          schedule_notes?: string | null
          start_at?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reports: {
        Row: {
          booking_id: number
          coach_id: string
          driver_duration_min: number | null
          fuel_amount: number | null
          id: number
          reported_at: string | null
        }
        Insert: {
          booking_id: number
          coach_id: string
          driver_duration_min?: number | null
          fuel_amount?: number | null
          id?: number
          reported_at?: string | null
        }
        Update: {
          booking_id?: number
          coach_id?: string
          driver_duration_min?: number | null
          fuel_amount?: number | null
          id?: number
          reported_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reports_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_time_off: {
        Row: {
          coach_id: string
          created_at: string | null
          end_date: string
          id: number
          notes: string | null
          reason: string | null
          start_date: string
          updated_at: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          end_date: string
          id?: number
          notes?: string | null
          reason?: string | null
          start_date: string
          updated_at?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          end_date?: string
          id?: number
          notes?: string | null
          reason?: string | null
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_time_off_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          created_at: string | null
          id: string
          name: string
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          display_date: string
          id: number
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          display_date: string
          id?: number
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          display_date?: string
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_tasks: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          is_completed: boolean | null
          task_content: string
          task_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          is_completed?: boolean | null
          task_content: string
          task_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          is_completed?: boolean | null
          task_content?: string
          task_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      line_bindings: {
        Row: {
          completed_at: string | null
          created_at: string | null
          expires_at: string | null
          id: number
          line_user_id: string
          member_id: string | null
          phone: string | null
          status: string | null
          verification_code: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          line_user_id: string
          member_id?: string | null
          phone?: string | null
          status?: string | null
          verification_code?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          line_user_id?: string
          member_id?: string | null
          phone?: string | null
          status?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_bindings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          balance: number | null
          birthday: string | null
          board_expiry_date: string | null
          board_slot_number: string | null
          boat_voucher_g21_minutes: number | null
          boat_voucher_g21_panther_minutes: number | null
          boat_voucher_g23_minutes: number | null
          created_at: string | null
          designated_lesson_minutes: number | null
          free_hours: number | null
          free_hours_notes: string | null
          free_hours_used: number | null
          gift_boat_hours: number | null
          id: string
          membership_end_date: string | null
          membership_partner_id: string | null
          membership_start_date: string | null
          membership_type: string | null
          name: string
          nickname: string | null
          notes: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
          vip_voucher_amount: number | null
        }
        Insert: {
          balance?: number | null
          birthday?: string | null
          board_expiry_date?: string | null
          board_slot_number?: string | null
          boat_voucher_g21_minutes?: number | null
          boat_voucher_g21_panther_minutes?: number | null
          boat_voucher_g23_minutes?: number | null
          created_at?: string | null
          designated_lesson_minutes?: number | null
          free_hours?: number | null
          free_hours_notes?: string | null
          free_hours_used?: number | null
          gift_boat_hours?: number | null
          id?: string
          membership_end_date?: string | null
          membership_partner_id?: string | null
          membership_start_date?: string | null
          membership_type?: string | null
          name: string
          nickname?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
          vip_voucher_amount?: number | null
        }
        Update: {
          balance?: number | null
          birthday?: string | null
          board_expiry_date?: string | null
          board_slot_number?: string | null
          boat_voucher_g21_minutes?: number | null
          boat_voucher_g21_panther_minutes?: number | null
          boat_voucher_g23_minutes?: number | null
          created_at?: string | null
          designated_lesson_minutes?: number | null
          free_hours?: number | null
          free_hours_notes?: string | null
          free_hours_used?: number | null
          gift_boat_hours?: number | null
          id?: string
          membership_end_date?: string | null
          membership_partner_id?: string | null
          membership_start_date?: string | null
          membership_type?: string | null
          name?: string
          nickname?: string | null
          notes?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
          vip_voucher_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "members_membership_partner_id_fkey"
            columns: ["membership_partner_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          id: number
          setting_key: string
          setting_value: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: number
          setting_key: string
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: number
          setting_key?: string
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          adjust_type: string | null
          amount: number | null
          balance_after: number | null
          boat_voucher_g21_panther_minutes_after: number | null
          boat_voucher_g23_minutes_after: number | null
          booking_participant_id: number | null
          category: string
          created_at: string | null
          description: string
          designated_lesson_minutes_after: number | null
          gift_boat_hours_after: number | null
          id: number
          member_id: string
          minutes: number | null
          notes: string | null
          operator_id: string | null
          payment_method: string | null
          related_booking_id: number | null
          transaction_date: string
          transaction_type: string
          vip_voucher_amount_after: number | null
        }
        Insert: {
          adjust_type?: string | null
          amount?: number | null
          balance_after?: number | null
          boat_voucher_g21_panther_minutes_after?: number | null
          boat_voucher_g23_minutes_after?: number | null
          booking_participant_id?: number | null
          category: string
          created_at?: string | null
          description: string
          designated_lesson_minutes_after?: number | null
          gift_boat_hours_after?: number | null
          id?: number
          member_id: string
          minutes?: number | null
          notes?: string | null
          operator_id?: string | null
          payment_method?: string | null
          related_booking_id?: number | null
          transaction_date: string
          transaction_type: string
          vip_voucher_amount_after?: number | null
        }
        Update: {
          adjust_type?: string | null
          amount?: number | null
          balance_after?: number | null
          boat_voucher_g21_panther_minutes_after?: number | null
          boat_voucher_g23_minutes_after?: number | null
          booking_participant_id?: number | null
          category?: string
          created_at?: string | null
          description?: string
          designated_lesson_minutes_after?: number | null
          gift_boat_hours_after?: number | null
          id?: number
          member_id?: string
          minutes?: number | null
          notes?: string | null
          operator_id?: string | null
          payment_method?: string | null
          related_booking_id?: number | null
          transaction_date?: string
          transaction_type?: string
          vip_voucher_amount_after?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_booking_participant_id_fkey"
            columns: ["booking_participant_id"]
            isOneToOne: false
            referencedRelation: "booking_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_related_booking_id_fkey"
            columns: ["related_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_boat_available: {
        Args: { p_boat_id: number; p_check_date: string }
        Returns: boolean
      }
      is_coach_available: {
        Args: { p_check_date: string; p_coach_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
