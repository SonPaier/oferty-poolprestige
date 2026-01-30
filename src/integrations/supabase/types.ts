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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      foil_optimization_results: {
        Row: {
          created_at: string
          cutting_plan: Json
          id: string
          is_recommended: boolean
          pool_configuration_id: string | null
          product_id: string | null
          roll_width: number
          score: number
          total_area_m2: number
          waste_percentage: number
          waste_pieces: Json
        }
        Insert: {
          created_at?: string
          cutting_plan?: Json
          id?: string
          is_recommended?: boolean
          pool_configuration_id?: string | null
          product_id?: string | null
          roll_width: number
          score?: number
          total_area_m2?: number
          waste_percentage?: number
          waste_pieces?: Json
        }
        Update: {
          created_at?: string
          cutting_plan?: Json
          id?: string
          is_recommended?: boolean
          pool_configuration_id?: string | null
          product_id?: string | null
          roll_width?: number
          score?: number
          total_area_m2?: number
          waste_percentage?: number
          waste_pieces?: Json
        }
        Relationships: [
          {
            foreignKeyName: "foil_optimization_results_pool_configuration_id_fkey"
            columns: ["pool_configuration_id"]
            isOneToOne: false
            referencedRelation: "pool_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foil_optimization_results_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_materials: {
        Row: {
          calculation_rule: Json
          created_at: string
          finishing_type: string
          id: string
          is_default: boolean
          is_optional: boolean
          material_category: string
          product_id: string
          sort_order: number
          updated_at: string
          variant_level: string
        }
        Insert: {
          calculation_rule?: Json
          created_at?: string
          finishing_type: string
          id?: string
          is_default?: boolean
          is_optional?: boolean
          material_category: string
          product_id: string
          sort_order?: number
          updated_at?: string
          variant_level?: string
        }
        Update: {
          calculation_rule?: Json
          created_at?: string
          finishing_type?: string
          id?: string
          is_default?: boolean
          is_optional?: boolean
          material_category?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
          variant_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_services: {
        Row: {
          applies_to: Json
          created_at: string
          description: string | null
          finishing_type: string
          id: string
          is_default: boolean
          is_optional: boolean
          name: string
          price_per_unit: number
          service_category: string
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          applies_to?: Json
          created_at?: string
          description?: string | null
          finishing_type: string
          id?: string
          is_default?: boolean
          is_optional?: boolean
          name: string
          price_per_unit?: number
          service_category: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          applies_to?: Json
          created_at?: string
          description?: string | null
          finishing_type?: string
          id?: string
          is_default?: boolean
          is_optional?: boolean
          name?: string
          price_per_unit?: number
          service_category?: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      offer_changes_log: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          field_name: string | null
          id: string
          new_value: Json | null
          offer_id: string | null
          old_value: Json | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          offer_id?: string | null
          old_value?: Json | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: Json | null
          offer_id?: string | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_changes_log_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_comments: {
        Row: {
          author: string | null
          comment_text: string
          created_at: string
          id: string
          is_internal: boolean
          offer_id: string | null
          updated_at: string
        }
        Insert: {
          author?: string | null
          comment_text: string
          created_at?: string
          id?: string
          is_internal?: boolean
          offer_id?: string | null
          updated_at?: string
        }
        Update: {
          author?: string | null
          comment_text?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          offer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_comments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_variants: {
        Row: {
          created_at: string
          foil_product_id: string | null
          id: string
          is_default: boolean
          materials: Json
          offer_id: string | null
          services: Json
          total_gross: number
          total_materials_net: number
          total_net: number
          total_services_net: number
          updated_at: string
          variant_level: string
        }
        Insert: {
          created_at?: string
          foil_product_id?: string | null
          id?: string
          is_default?: boolean
          materials?: Json
          offer_id?: string | null
          services?: Json
          total_gross?: number
          total_materials_net?: number
          total_net?: number
          total_services_net?: number
          updated_at?: string
          variant_level: string
        }
        Update: {
          created_at?: string
          foil_product_id?: string | null
          id?: string
          is_default?: boolean
          materials?: Json
          offer_id?: string | null
          services?: Json
          total_gross?: number
          total_materials_net?: number
          total_net?: number
          total_services_net?: number
          updated_at?: string
          variant_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_variants_foil_product_id_fkey"
            columns: ["foil_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_variants_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          calculations: Json | null
          created_at: string
          customer_data: Json
          dimensions: Json
          discount_per_module: Json | null
          discount_percentage: number | null
          excavation: Json
          finishing_variant: Json | null
          id: string
          is_draft: boolean
          margin_percentage: number | null
          notes_internal: string | null
          offer_number: string
          pool_type: string
          sections: Json
          share_uid: string
          status: string
          total_gross: number
          total_net: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          calculations?: Json | null
          created_at?: string
          customer_data: Json
          dimensions: Json
          discount_per_module?: Json | null
          discount_percentage?: number | null
          excavation: Json
          finishing_variant?: Json | null
          id?: string
          is_draft?: boolean
          margin_percentage?: number | null
          notes_internal?: string | null
          offer_number: string
          pool_type: string
          sections: Json
          share_uid: string
          status?: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          calculations?: Json | null
          created_at?: string
          customer_data?: Json
          dimensions?: Json
          discount_per_module?: Json | null
          discount_percentage?: number | null
          excavation?: Json
          finishing_variant?: Json | null
          id?: string
          is_draft?: boolean
          margin_percentage?: number | null
          notes_internal?: string | null
          offer_number?: string
          pool_type?: string
          sections?: Json
          share_uid?: string
          status?: string
          total_gross?: number
          total_net?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      pool_configurations: {
        Row: {
          calculated_areas: Json
          created_at: string
          dimensions: Json
          id: string
          offer_id: string | null
          paddling_pool_config: Json | null
          pool_type: string
          stairs_config: Json | null
          updated_at: string
        }
        Insert: {
          calculated_areas?: Json
          created_at?: string
          dimensions: Json
          id?: string
          offer_id?: string | null
          paddling_pool_config?: Json | null
          pool_type: string
          stairs_config?: Json | null
          updated_at?: string
        }
        Update: {
          calculated_areas?: Json
          created_at?: string
          dimensions?: Json
          id?: string
          offer_id?: string | null
          paddling_pool_config?: Json | null
          pool_type?: string
          stairs_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pool_configurations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      portfolio_images: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          image_url: string
          portfolio_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          image_url: string
          portfolio_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          image_url?: string
          portfolio_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_images_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolio"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          image_url: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          image_url: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_widths: Json | null
          category: string | null
          created_at: string
          currency: string
          description: string | null
          extracted_hex: string | null
          foil_category: string | null
          foil_width: number | null
          id: string
          image_id: string | null
          joint_type: string | null
          manufacturer: string | null
          name: string
          overlap_width: number | null
          price: number
          roll_length: number | null
          series: string | null
          shade: string | null
          stock_quantity: number | null
          subcategory: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          available_widths?: Json | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          extracted_hex?: string | null
          foil_category?: string | null
          foil_width?: number | null
          id?: string
          image_id?: string | null
          joint_type?: string | null
          manufacturer?: string | null
          name: string
          overlap_width?: number | null
          price?: number
          roll_length?: number | null
          series?: string | null
          shade?: string | null
          stock_quantity?: number | null
          subcategory?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          available_widths?: Json | null
          category?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          extracted_hex?: string | null
          foil_category?: string | null
          foil_width?: number | null
          id?: string
          image_id?: string | null
          joint_type?: string | null
          manufacturer?: string | null
          name?: string
          overlap_width?: number | null
          price?: number
          roll_length?: number | null
          series?: string | null
          shade?: string | null
          stock_quantity?: number | null
          subcategory?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          company_settings: Json
          created_at: string
          excavation_settings: Json
          id: string
          updated_at: string
        }
        Insert: {
          company_settings?: Json
          created_at?: string
          excavation_settings?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          company_settings?: Json
          created_at?: string
          excavation_settings?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subiekt_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          offer_id: string | null
          subiekt_document_id: string | null
          sync_completed_at: string | null
          sync_started_at: string | null
          sync_status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          offer_id?: string | null
          subiekt_document_id?: string | null
          sync_completed_at?: string | null
          sync_started_at?: string | null
          sync_status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          offer_id?: string | null
          subiekt_document_id?: string | null
          sync_completed_at?: string | null
          sync_started_at?: string | null
          sync_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subiekt_sync_log_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
