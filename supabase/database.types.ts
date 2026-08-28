/**
 * Generated from the live database. Do not edit by hand.
 *
 * Regenerate after any migration:
 *   npx supabase gen types typescript --project-id <ref> > supabase/database.types.ts
 *
 * EXCEPT, currently, for the five market-entry evidence columns on
 * research_sources. Migration 0010 adds them and has deliberately not been
 * applied to the live project yet — applying a schema change for code that is
 * not merged puts the database ahead of the application for no benefit. The
 * columns below were therefore written by hand so the query that populates them
 * typechecks. Regenerate this file from the live database immediately after
 * 0010 is applied, and this note goes with it.
 *
 * These are wired into lib/storage/supabase-store.ts via createClient<Database>,
 * which is what makes them worth having: a column renamed in a migration but not
 * in the query becomes a typecheck failure rather than a runtime error nobody
 * sees until an audit fails to save.
 *
 * Prettier ignores this file — it is generated output, and reformatting it would
 * produce a diff on every regeneration.
 */

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          audit_id: string
          created_at: string
          detail: Json | null
          event: string
          id: number
        }
        Insert: {
          audit_id: string
          created_at?: string
          detail?: Json | null
          event: string
          id?: number
        }
        Update: {
          audit_id?: string
          created_at?: string
          detail?: Json | null
          event?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          analysis: Json | null
          completed_at: string | null
          created_at: string
          domain: string
          error_code: string | null
          facts: Json | null
          id: string
          ip_hash: string | null
          normalized_url: string
          overall_rating: string | null
          overall_score: number | null
          owner_id: string | null
          public_id: string
          report_meta: Json | null
          requested_url: string
          schema_version: number | null
          stage: string
          stage_index: number
          status: string
          url_hash: string
        }
        Insert: {
          analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          domain: string
          error_code?: string | null
          facts?: Json | null
          id?: string
          ip_hash?: string | null
          normalized_url: string
          overall_rating?: string | null
          overall_score?: number | null
          owner_id?: string | null
          public_id: string
          report_meta?: Json | null
          requested_url: string
          schema_version?: number | null
          stage?: string
          stage_index?: number
          status?: string
          url_hash: string
        }
        Update: {
          analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          domain?: string
          error_code?: string | null
          facts?: Json | null
          id?: string
          ip_hash?: string | null
          normalized_url?: string
          overall_rating?: string | null
          overall_score?: number | null
          owner_id?: string | null
          public_id?: string
          report_meta?: Json | null
          requested_url?: string
          schema_version?: number | null
          stage?: string
          stage_index?: number
          status?: string
          url_hash?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          audit_id: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          message: string | null
          name: string
          website: string | null
        }
        Insert: {
          audit_id?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          message?: string | null
          name: string
          website?: string | null
        }
        Update: {
          audit_id?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          message?: string | null
          name?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      research_jobs: {
        Row: {
          cached_from_job_id: string | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          input: Json
          input_hash: string
          package_id: string
          public_id: string
          result: Json | null
          schema_version: number | null
          stage: string
          stage_index: number
          started_at: string | null
          status: string
          subject_domain: string | null
          subject_name: string
          token_cost: number
          user_id: string
        }
        Insert: {
          cached_from_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          input: Json
          input_hash: string
          package_id: string
          public_id: string
          result?: Json | null
          schema_version?: number | null
          stage?: string
          stage_index?: number
          started_at?: string | null
          status?: string
          subject_domain?: string | null
          subject_name: string
          token_cost: number
          user_id: string
        }
        Update: {
          cached_from_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          input?: Json
          input_hash?: string
          package_id?: string
          public_id?: string
          result?: Json | null
          schema_version?: number | null
          stage?: string
          stage_index?: number
          started_at?: string | null
          status?: string
          subject_domain?: string | null
          subject_name?: string
          token_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_jobs_cached_from_job_id_fkey"
            columns: ["cached_from_job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          canonical_url: string
          content_hash: string | null
          excerpt: string | null
          geographic_relevance: string | null
          published_at: string | null
          retrieval_mode: string | null
          source_category: string | null
          source_confidence: string | null
          http_status: number | null
          id: number
          job_id: string
          position: number
          publisher_domain: string | null
          retrieved_at: string
          source_type: string
          title: string | null
        }
        Insert: {
          canonical_url: string
          content_hash?: string | null
          excerpt?: string | null
          geographic_relevance?: string | null
          published_at?: string | null
          retrieval_mode?: string | null
          source_category?: string | null
          source_confidence?: string | null
          http_status?: number | null
          id?: number
          job_id: string
          position: number
          publisher_domain?: string | null
          retrieved_at?: string
          source_type?: string
          title?: string | null
        }
        Update: {
          canonical_url?: string
          content_hash?: string | null
          excerpt?: string | null
          geographic_relevance?: string | null
          published_at?: string | null
          retrieval_mode?: string | null
          source_category?: string | null
          source_confidence?: string | null
          http_status?: number | null
          id?: number
          job_id?: string
          position?: number
          publisher_domain?: string | null
          retrieved_at?: string
          source_type?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      token_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          idempotency_key: string
          metadata: Json
          research_job_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description: string
          id?: string
          idempotency_key: string
          metadata?: Json
          research_job_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          research_job_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_ledger_research_job_id_fkey"
            columns: ["research_job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      token_wallets: {
        Row: {
          available_balance: number
          created_at: string
          reserved_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          reserved_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          reserved_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rs_bootstrap_account: {
        Args: {
          p_display_name?: string
          p_idempotency_key?: string
          p_user_id: string
          p_welcome_tokens?: number
        }
        Returns: {
          out_available: number
          out_reserved: number
        }[]
      }
      rs_finalize_tokens: {
        Args: { p_idempotency_key: string; p_job_id: string; p_user_id: string }
        Returns: {
          out_available: number
          out_ledger_id: string
          out_replayed: boolean
          out_reserved: number
        }[]
      }
      rs_grant_tokens: {
        Args: {
          p_amount: number
          p_description: string
          p_idempotency_key: string
          p_metadata?: Json
          p_transaction_type: string
          p_user_id: string
        }
        Returns: {
          out_available: number
          out_ledger_id: string
          out_replayed: boolean
          out_reserved: number
        }[]
      }
      rs_outstanding_reservation: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          idempotency_key: string
          metadata: Json
          research_job_id: string | null
          transaction_type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "token_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rs_refund_tokens: {
        Args: {
          p_idempotency_key: string
          p_job_id: string
          p_reason?: string
          p_user_id: string
        }
        Returns: {
          out_available: number
          out_ledger_id: string
          out_replayed: boolean
          out_reserved: number
        }[]
      }
      rs_reserve_tokens: {
        Args: {
          p_amount: number
          p_description: string
          p_idempotency_key: string
          p_job_id: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: {
          out_available: number
          out_ledger_id: string
          out_replayed: boolean
          out_reserved: number
        }[]
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
