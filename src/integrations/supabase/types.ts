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
      medicine_activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          medicine_id: string | null
          medicine_name: string
          pharmacy_id: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          medicine_id?: string | null
          medicine_name: string
          pharmacy_id: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          medicine_id?: string | null
          medicine_name?: string
          pharmacy_id?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicine_activity_log_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          barcode: string | null
          batch_number: string | null
          brand: string | null
          category: string | null
          cost_price: number
          created_at: string
          expiry_date: string | null
          id: string
          name: string
          pharmacy_id: string
          quantity: number
          reorder_level: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          batch_number?: string | null
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          name: string
          pharmacy_id: string
          quantity?: number
          reorder_level?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          batch_number?: string | null
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          name?: string
          pharmacy_id?: string
          quantity?: number
          reorder_level?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicines_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address: string | null
          admin_notes: string | null
          created_at: string
          id: string
          is_active: boolean
          monthly_fee: number
          name: string
          phone: string | null
          plan: string
          subscription_ends_at: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee?: number
          name: string
          phone?: string | null
          plan?: string
          subscription_ends_at?: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_fee?: number
          name?: string
          phone?: string | null
          plan?: string
          subscription_ends_at?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pharmacy_counters: {
        Row: {
          created_at: string
          last_sale_number: number
          pharmacy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_sale_number?: number
          pharmacy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_sale_number?: number
          pharmacy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_counters_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: true
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          medicine_id: string | null
          medicine_name: string
          pharmacy_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          medicine_id?: string | null
          medicine_name: string
          pharmacy_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          medicine_id?: string | null
          medicine_name?: string
          pharmacy_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_name: string | null
          created_at: string
          id: string
          payment_method: string
          pharmacy_id: string
          sale_number: string
          total_amount: number
        }
        Insert: {
          cashier_name?: string | null
          created_at?: string
          id?: string
          payment_method?: string
          pharmacy_id: string
          sale_number: string
          total_amount?: number
        }
        Update: {
          cashier_name?: string | null
          created_at?: string
          id?: string
          payment_method?: string
          pharmacy_id?: string
          sale_number?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          period_end: string | null
          period_start: string | null
          pharmacy_id: string
          recorded_by: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          period_end?: string | null
          period_start?: string | null
          pharmacy_id: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          period_end?: string | null
          period_start?: string | null
          pharmacy_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          pharmacy_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pharmacy_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pharmacy_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_pharmacies: { Args: never; Returns: Json }
      admin_record_payment: {
        Args: {
          _amount: number
          _method?: string
          _months?: number
          _note?: string
          _pharmacy_id: string
        }
        Returns: Json
      }
      admin_update_subscription: {
        Args: {
          _ends_at?: string
          _monthly_fee?: number
          _notes?: string
          _pharmacy_id: string
          _plan?: string
          _status?: string
        }
        Returns: undefined
      }
      create_pharmacy_for_current_user: {
        Args: { _name: string }
        Returns: string
      }
      current_pharmacy_id: { Args: never; Returns: string }
      dashboard_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pharmacy_owner: { Args: { _pharmacy_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      my_subscription: { Args: never; Returns: Json }
      process_sale: {
        Args: { _cashier_name?: string; _items: Json; _payment_method?: string }
        Returns: Json
      }
      subscription_active: { Args: { _pharmacy_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "pharmacist"
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
      app_role: ["owner", "pharmacist"],
    },
  },
} as const
