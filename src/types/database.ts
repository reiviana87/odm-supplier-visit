/**
 * Supabase schema types — HAND-WRITTEN for Phase 1.
 *
 * No Supabase project exists yet, so this file mirrors, by hand, the shape
 * `supabase gen types typescript` produces for the migration in
 * `supabase/migrations/0001_initial_schema.sql`. Once a project is
 * provisioned, replace the whole file with the generated output:
 *
 *   supabase gen types typescript --project-id <ref> --schema public \
 *     > src/types/database.ts
 *
 * Column names are the snake_case form of the domain model in
 * `src/types/domain.ts`; the enums are the same value sets, so the mapping
 * between a database row and a domain object stays mechanical.
 *
 * Derived values are deliberately NOT columns: report completion (README §6.2)
 * and the relative "last updated" label are computed in the application.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      // ───────────────────────────────────────────────────────────────────
      // People
      // ───────────────────────────────────────────────────────────────────
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          job_title: string | null;
          role: Database["public"]["Enums"]["user_role"];
          initials: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          job_title?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          initials: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          job_title?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          initials?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // Supplier master data — README §8.1
      // ───────────────────────────────────────────────────────────────────
      suppliers: {
        Row: {
          id: string;
          short_name: string;
          legal_name: string;
          established_year: string | null;
          company_capital: string | null;
          employees: string | null;
          factory_size_m2: string | null;
          certifications: string | null;
          production_capacity: string | null;
          president_name: string | null;
          website_url: string | null;
          country: string;
          region: string | null;
          city: string | null;
          address: string | null;
          tel: string | null;
          product_categories: string | null;
          status: Database["public"]["Enums"]["supplier_status"];
          data_sheet_state: Database["public"]["Enums"]["data_sheet_state"];
          track_record_ebara: string | null;
          internal_notes: string | null;
          last_visit_date: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          short_name: string;
          legal_name: string;
          established_year?: string | null;
          company_capital?: string | null;
          employees?: string | null;
          factory_size_m2?: string | null;
          certifications?: string | null;
          production_capacity?: string | null;
          president_name?: string | null;
          website_url?: string | null;
          country: string;
          region?: string | null;
          city?: string | null;
          address?: string | null;
          tel?: string | null;
          product_categories?: string | null;
          status?: Database["public"]["Enums"]["supplier_status"];
          data_sheet_state?: Database["public"]["Enums"]["data_sheet_state"];
          track_record_ebara?: string | null;
          internal_notes?: string | null;
          last_visit_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          short_name?: string;
          legal_name?: string;
          established_year?: string | null;
          company_capital?: string | null;
          employees?: string | null;
          factory_size_m2?: string | null;
          certifications?: string | null;
          production_capacity?: string | null;
          president_name?: string | null;
          website_url?: string | null;
          country?: string;
          region?: string | null;
          city?: string | null;
          address?: string | null;
          tel?: string | null;
          product_categories?: string | null;
          status?: Database["public"]["Enums"]["supplier_status"];
          data_sheet_state?: Database["public"]["Enums"]["data_sheet_state"];
          track_record_ebara?: string | null;
          internal_notes?: string | null;
          last_visit_date?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      supplier_contacts: {
        Row: {
          id: string;
          supplier_id: string;
          name: string;
          role: string | null;
          email: string | null;
          phone: string | null;
          wechat: string | null;
          is_primary: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          name: string;
          role?: string | null;
          email?: string | null;
          phone?: string | null;
          wechat?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          name?: string;
          role?: string | null;
          email?: string | null;
          phone?: string | null;
          wechat?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };

      supplier_certificates: {
        Row: {
          id: string;
          supplier_id: string;
          name: string;
          number: string | null;
          issue_date: string | null;
          expiration_date: string | null;
          status: Database["public"]["Enums"]["certificate_status"];
          file_name: string | null;
          storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          name: string;
          number?: string | null;
          issue_date?: string | null;
          expiration_date?: string | null;
          status?: Database["public"]["Enums"]["certificate_status"];
          file_name?: string | null;
          storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          name?: string;
          number?: string | null;
          issue_date?: string | null;
          expiration_date?: string | null;
          status?: Database["public"]["Enums"]["certificate_status"];
          file_name?: string | null;
          storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_certificates_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };

      supplier_files: {
        Row: {
          id: string;
          supplier_id: string;
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          kind?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_files_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // Reports — README §6, §8.3
      // ───────────────────────────────────────────────────────────────────
      reports: {
        Row: {
          id: string;
          document_number: string;
          supplier_id: string;
          visit_date: string;
          location: string | null;
          employee: string | null;
          status: Database["public"]["Enums"]["report_status"];
          period: string | null;
          report_owner: string | null;
          start_time: string | null;
          end_time: string | null;
          project: string | null;
          business_unit: string | null;
          product_category: string | null;
          /** README §8.3 — frozen copy of the supplier row, taken at creation. */
          supplier_snapshot: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_number: string;
          supplier_id: string;
          visit_date: string;
          location?: string | null;
          employee?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          period?: string | null;
          report_owner?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          project?: string | null;
          business_unit?: string | null;
          product_category?: string | null;
          supplier_snapshot: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_number?: string;
          supplier_id?: string;
          visit_date?: string;
          location?: string | null;
          employee?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          period?: string | null;
          report_owner?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          project?: string | null;
          business_unit?: string | null;
          product_category?: string | null;
          supplier_snapshot?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      report_members: {
        Row: {
          id: string;
          report_id: string;
          profile_id: string | null;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          profile_id?: string | null;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          profile_id?: string | null;
          name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_members_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      report_sections: {
        Row: {
          id: string;
          report_id: string;
          /** A `SectionId` from `src/types/domain.ts`. */
          section_id: string;
          content: string;
          /** README §6 — §6's Q&A block, one bullet per array element. */
          qa_bullets: string[] | null;
          /** README §25 — the explicit exclude control on §4 and §6. */
          is_included: boolean;
          /** Bumped on every autosave patch (README §7). */
          version: number;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          section_id: string;
          content?: string;
          qa_bullets?: string[] | null;
          is_included?: boolean;
          version?: number;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          section_id?: string;
          content?: string;
          qa_bullets?: string[] | null;
          is_included?: boolean;
          version?: number;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_sections_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_sections_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      report_observations: {
        Row: {
          id: string;
          report_id: string;
          section_id: string | null;
          category: string;
          priority: string;
          text: string;
          /** Set when the observation came from a transcript finding (§12). */
          source_finding_id: string | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          section_id?: string | null;
          category: string;
          priority?: string;
          text: string;
          source_finding_id?: string | null;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          section_id?: string | null;
          category?: string;
          priority?: string;
          text?: string;
          source_finding_id?: string | null;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_observations_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_observations_source_finding_id_fkey";
            columns: ["source_finding_id"];
            isOneToOne: false;
            referencedRelation: "report_ai_generations";
            referencedColumns: ["id"];
          },
        ];
      };

      report_target_products: {
        Row: {
          id: string;
          report_id: string;
          model: string;
          description: string | null;
          photo_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          model: string;
          description?: string | null;
          photo_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          model?: string;
          description?: string | null;
          photo_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_target_products_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_target_products_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "report_images";
            referencedColumns: ["id"];
          },
        ];
      };

      report_product_rows: {
        Row: {
          id: string;
          report_id: string;
          type: string;
          standard: string | null;
          voltage: string | null;
          description: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          type: string;
          standard?: string | null;
          voltage?: string | null;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          type?: string;
          standard?: string | null;
          voltage?: string | null;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_product_rows_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // Photographs and files — README §10, §16
      // ───────────────────────────────────────────────────────────────────
      report_images: {
        Row: {
          id: string;
          report_id: string;
          region: Database["public"]["Enums"]["image_region"];
          storage_path: string;
          file_name: string;
          caption: string;
          /** The AI proposal, held until the user accepts it (README §11). */
          ai_caption: string | null;
          caption_source: Database["public"]["Enums"]["caption_source"];
          /** 0–100. Below 85 the card shows "· review required". */
          confidence: number | null;
          category: string | null;
          /** Print order inside the region (README §16). */
          sort_order: number;
          captured_at: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          region: Database["public"]["Enums"]["image_region"];
          storage_path: string;
          file_name: string;
          caption?: string;
          ai_caption?: string | null;
          caption_source?: Database["public"]["Enums"]["caption_source"];
          confidence?: number | null;
          category?: string | null;
          sort_order?: number;
          captured_at?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          region?: Database["public"]["Enums"]["image_region"];
          storage_path?: string;
          file_name?: string;
          caption?: string;
          ai_caption?: string | null;
          caption_source?: Database["public"]["Enums"]["caption_source"];
          confidence?: number | null;
          category?: string | null;
          sort_order?: number;
          captured_at?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_images_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_images_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      report_files: {
        Row: {
          id: string;
          report_id: string;
          /** e.g. "transcript", "attachment", "data_sheet". */
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          kind: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          kind?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_files_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // AI and exports — README §11, §12, §15
      // ───────────────────────────────────────────────────────────────────
      report_ai_generations: {
        Row: {
          id: string;
          report_id: string;
          section_id: string | null;
          /** e.g. "section_draft", "conclusion", "photo_caption", "transcript". */
          kind: string;
          /** "proposed" until the user accepts or discards it (README §11). */
          status: string;
          prompt: string | null;
          output: string | null;
          confidence: number | null;
          model: string | null;
          /** Structured payload — transcript findings, compare diffs, usage. */
          metadata: Json | null;
          created_by: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          section_id?: string | null;
          kind: string;
          status?: string;
          prompt?: string | null;
          output?: string | null;
          confidence?: number | null;
          model?: string | null;
          metadata?: Json | null;
          created_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          section_id?: string | null;
          kind?: string;
          status?: string;
          prompt?: string | null;
          output?: string | null;
          confidence?: number | null;
          model?: string | null;
          metadata?: Json | null;
          created_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_ai_generations_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_ai_generations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      report_exports: {
        Row: {
          id: string;
          report_id: string;
          template_id: string | null;
          /** "queued" | "running" | "ready" | "failed". */
          status: string;
          file_name: string | null;
          storage_path: string | null;
          size_bytes: number | null;
          error_message: string | null;
          created_by: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          template_id?: string | null;
          status?: string;
          file_name?: string | null;
          storage_path?: string | null;
          size_bytes?: number | null;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          template_id?: string | null;
          status?: string;
          file_name?: string | null;
          storage_path?: string | null;
          size_bytes?: number | null;
          error_message?: string | null;
          created_by?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_exports_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_exports_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "report_templates";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // Word templates — README §16
      // ───────────────────────────────────────────────────────────────────
      report_templates: {
        Row: {
          id: string;
          name: string;
          version: string;
          file_name: string;
          storage_path: string;
          is_active: boolean;
          is_archived: boolean;
          uploaded_by: string | null;
          uploaded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          version: string;
          file_name: string;
          storage_path: string;
          is_active?: boolean;
          is_archived?: boolean;
          uploaded_by?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          version?: string;
          file_name?: string;
          storage_path?: string;
          is_active?: boolean;
          is_archived?: boolean;
          uploaded_by?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_templates_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      template_placeholders: {
        Row: {
          id: string;
          template_id: string;
          /** "{{PURPOSE}}" or an image region name such as "APPENDIX_IMAGES". */
          placeholder: string;
          source: string | null;
          sample_value: string | null;
          is_mapped: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          placeholder: string;
          source?: string | null;
          sample_value?: string | null;
          is_mapped?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          placeholder?: string;
          source?: string | null;
          sample_value?: string | null;
          is_mapped?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_placeholders_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "report_templates";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      report_status: "draft" | "in_review" | "final" | "archived";
      supplier_status: "prospect" | "under_qualification" | "approved" | "on_hold";
      data_sheet_state: "received" | "partial" | "pending";
      certificate_status: "valid" | "not_evidenced" | "declared" | "expired";
      user_role: "admin" | "manager" | "editor" | "viewer";
      image_region: "MAIN_PRODUCT_IMAGES" | "PARTNER_IMAGES" | "APPENDIX_IMAGES";
      caption_source: "user" | "ai";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Convenience aliases — the same ones `supabase gen types` emits.
// ─────────────────────────────────────────────────────────────────────────────

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
