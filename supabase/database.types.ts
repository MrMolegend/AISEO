/**
 * Generated from the live database. Do not edit by hand.
 *
 * Regenerate after any migration:
 *   npx supabase gen types typescript --project-id <ref> > supabase/database.types.ts
 *
 * EXCEPT, currently, for the product-depth tables added by migrations
 * 0011–0016 (business_profiles, research_drafts, report_scenarios,
 * report_feedback, action_items, share_links, share_events, and the
 * profile_id / attempt_count / heartbeat_at columns on research_jobs). Those
 * migrations have deliberately not been applied to the live project yet —
 * applying schema for unmerged code puts the database ahead of the
 * application for no benefit — so their types below were written by hand from
 * the migration files. Regenerate this file from the live database
 * immediately after 0011–0016 are applied, and this note goes with it.
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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          evidence: Json
          id: string
          job_id: string | null
          notes: string | null
          owner_label: string | null
          phase: string
          priority: string
          profile_id: string | null
          rationale: string | null
          sort_order: number
          source_action_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          evidence?: Json
          id?: string
          job_id?: string | null
          notes?: string | null
          owner_label?: string | null
          phase?: string
          priority?: string
          profile_id?: string | null
          rationale?: string | null
          sort_order?: number
          source_action_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          evidence?: Json
          id?: string
          job_id?: string | null
          notes?: string | null
          owner_label?: string | null
          phase?: string
          priority?: string
          profile_id?: string | null
          rationale?: string | null
          sort_order?: number
          source_action_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      business_profiles: {
        Row: {
          archived_at: string | null
          business_model: string | null
          buyer_roles: string[]
          constraints_notes: string | null
          created_at: string
          customer_evidence: string | null
          description: string | null
          differentiators: string[]
          goals: string[]
          home_country: string | null
          id: string
          industry: string | null
          known_competitors: string[]
          name: string
          offerings: string[]
          price_positioning: string | null
          sales_channels: string[]
          target_customers: string[]
          team_capacity: string | null
          traction_stage: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          archived_at?: string | null
          business_model?: string | null
          buyer_roles?: string[]
          constraints_notes?: string | null
          created_at?: string
          customer_evidence?: string | null
          description?: string | null
          differentiators?: string[]
          goals?: string[]
          home_country?: string | null
          id?: string
          industry?: string | null
          known_competitors?: string[]
          name: string
          offerings?: string[]
          price_positioning?: string | null
          sales_channels?: string[]
          target_customers?: string[]
          team_capacity?: string | null
          traction_stage?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          archived_at?: string | null
          business_model?: string | null
          buyer_roles?: string[]
          constraints_notes?: string | null
          created_at?: string
          customer_evidence?: string | null
          description?: string | null
          differentiators?: string[]
          goals?: string[]
          home_country?: string | null
          id?: string
          industry?: string | null
          known_competitors?: string[]
          name?: string
          offerings?: string[]
          price_positioning?: string | null
          sales_channels?: string[]
          target_customers?: string[]
          team_capacity?: string | null
          traction_stage?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
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
      report_feedback: {
        Row: {
          category: string | null
          comment: string | null
          created_at: string
          job_id: string
          updated_at: string
          useful: boolean
          user_id: string
        }
        Insert: {
          category?: string | null
          comment?: string | null
          created_at?: string
          job_id: string
          updated_at?: string
          useful: boolean
          user_id: string
        }
        Update: {
          category?: string | null
          comment?: string | null
          created_at?: string
          job_id?: string
          updated_at?: string
          useful?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      report_scenarios: {
        Row: {
          assumptions: Json
          created_at: string
          id: string
          job_id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          id?: string
          job_id: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_scenarios_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_drafts: {
        Row: {
          autosaved_at: string
          created_at: string
          id: string
          payload: Json
          profile_id: string | null
          revision: number
          status: string
          submitted_job_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          autosaved_at?: string
          created_at?: string
          id?: string
          payload?: Json
          profile_id?: string | null
          revision?: number
          status?: string
          submitted_job_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          autosaved_at?: string
          created_at?: string
          id?: string
          payload?: Json
          profile_id?: string | null
          revision?: number
          status?: string
          submitted_job_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_drafts_submitted_job_id_fkey"
            columns: ["submitted_job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_jobs: {
        Row: {
          attempt_count: number
          cached_from_job_id: string | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          heartbeat_at: string | null
          id: string
          input: Json
          input_hash: string
          package_id: string
          profile_id: string | null
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
          attempt_count?: number
          cached_from_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          heartbeat_at?: string | null
          id?: string
          input: Json
          input_hash: string
          package_id: string
          profile_id?: string | null
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
          attempt_count?: number
          cached_from_job_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          heartbeat_at?: string | null
          id?: string
          input?: Json
          input_hash?: string
          package_id?: string
          profile_id?: string | null
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
          {
            foreignKeyName: "research_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
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
          http_status: number | null
          id: number
          job_id: string
          position: number
          published_at: string | null
          publisher_domain: string | null
          retrieval_mode: string | null
          retrieved_at: string
          source_category: string | null
          source_confidence: string | null
          source_type: string
          title: string | null
        }
        Insert: {
          canonical_url: string
          content_hash?: string | null
          excerpt?: string | null
          geographic_relevance?: string | null
          http_status?: number | null
          id?: number
          job_id: string
          position: number
          published_at?: string | null
          publisher_domain?: string | null
          retrieval_mode?: string | null
          retrieved_at?: string
          source_category?: string | null
          source_confidence?: string | null
          source_type?: string
          title?: string | null
        }
        Update: {
          canonical_url?: string
          content_hash?: string | null
          excerpt?: string | null
          geographic_relevance?: string | null
          http_status?: number | null
          id?: number
          job_id?: string
          position?: number
          published_at?: string | null
          publisher_domain?: string | null
          retrieval_mode?: string | null
          retrieved_at?: string
          source_category?: string | null
          source_confidence?: string | null
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
      share_events: {
        Row: {
          created_at: string
          event: string
          id: number
          ip_hash: string | null
          share_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          ip_hash?: string | null
          share_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          ip_hash?: string | null
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_events_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          allow_download: boolean
          created_at: string
          expires_at: string | null
          id: string
          job_id: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          use_count: number
          user_id: string
        }
        Insert: {
          allow_download?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          job_id: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          use_count?: number
          user_id: string
        }
        Update: {
          allow_download?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          job_id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_job_id_fkey"
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
