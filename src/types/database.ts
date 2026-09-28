/**
 * Supabase schema types — HAND-WRITTEN.
 *
 * No Supabase project exists yet, so this file mirrors, by hand, the shape
 * `supabase gen types typescript` produces for the migrations in
 * `supabase/migrations`. Once a project is provisioned, replace the whole file
 * with the generated output:
 *
 *   supabase gen types typescript --project-id <ref> --schema public \
 *     > src/types/database.ts
 *
 * It tracks 0001_initial_schema.sql as amended by 0003_phase2_schema.sql, and
 * the two RPCs from 0005_report_creation_rpc.sql. 0005's third function,
 * `supplier_snapshot_jsonb`, is deliberately absent: it takes a whole
 * `public.suppliers` row as a composite argument, which makes it unusable over
 * PostgREST, and it exists only so the two RPCs cannot drift in what they
 * freeze. Typing it here would advertise a call nobody should make. The
 * generator WILL emit it once a project is provisioned — that is the
 * generator being exhaustive, not this file being wrong.
 *
 * The rules the generator follows, and this file follows with it:
 *
 *   • a NOT NULL column is non-optional in Row;
 *   • a column with a default is optional in Insert — NOT NULL without one
 *     (reports.company_information, report_images.sort_order) is required;
 *   • every column is optional in Update.
 *
 * Column names are the snake_case form of the domain model in
 * `src/types/domain.ts`, so the mapping between a row and a domain object
 * stays mechanical. Two places where it is not, and must not be flattened:
 * `reports.company_information` is the frozen `SupplierSnapshot` jsonb of
 * README §8.3, with camelCase keys of its own, and `report_sections.version`
 * is the optimistic-concurrency token the database owns (Phase 2 §18).
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
          full_name: string;
          email: string;
          job_title: string | null;
          department: string | null;
          initials: string | null;
          role: Database["public"]["Enums"]["user_role"];
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          /** Not generated: it IS the auth.users id. */
          id: string;
          full_name?: string;
          email?: string;
          job_title?: string | null;
          department?: string | null;
          initials?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          job_title?: string | null;
          department?: string | null;
          initials?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // Supplier master data — README §8.1, Phase 2 §4
      // ───────────────────────────────────────────────────────────────────
      suppliers: {
        Row: {
          id: string;
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
          contact_name: string | null;
          contact_title: string | null;
          contact_wechat: string | null;
          contact_email: string | null;
          track_record_ebara: string | null;
          chinese_name: string | null;
          /** Unique when set — partial unique index, nulls do not collide. */
          supplier_code: string | null;
          annual_revenue: string | null;
          ownership_type: string | null;
          main_markets: string | null;
          main_products: string | null;
          production_capabilities: string | null;
          short_name: string;
          status: Database["public"]["Enums"]["supplier_status"];
          data_sheet_state: Database["public"]["Enums"]["data_sheet_state"];
          product_categories: string | null;
          internal_notes: string | null;
          last_visit_date: string | null;
          /** Phase 2 §33 — the soft-delete marker. Null means active. */
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
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
          contact_name?: string | null;
          contact_title?: string | null;
          contact_wechat?: string | null;
          contact_email?: string | null;
          track_record_ebara?: string | null;
          chinese_name?: string | null;
          supplier_code?: string | null;
          annual_revenue?: string | null;
          ownership_type?: string | null;
          main_markets?: string | null;
          main_products?: string | null;
          production_capabilities?: string | null;
          short_name: string;
          status?: Database["public"]["Enums"]["supplier_status"];
          data_sheet_state?: Database["public"]["Enums"]["data_sheet_state"];
          product_categories?: string | null;
          internal_notes?: string | null;
          last_visit_date?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
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
          contact_name?: string | null;
          contact_title?: string | null;
          contact_wechat?: string | null;
          contact_email?: string | null;
          track_record_ebara?: string | null;
          chinese_name?: string | null;
          supplier_code?: string | null;
          annual_revenue?: string | null;
          ownership_type?: string | null;
          main_markets?: string | null;
          main_products?: string | null;
          production_capabilities?: string | null;
          short_name?: string;
          status?: Database["public"]["Enums"]["supplier_status"];
          data_sheet_state?: Database["public"]["Enums"]["data_sheet_state"];
          product_categories?: string | null;
          internal_notes?: string | null;
          last_visit_date?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suppliers_updated_by_fkey";
            columns: ["updated_by"];
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
          role: string;
          email: string;
          phone: string;
          wechat: string;
          /** At most one per supplier — partial unique index in 0003. */
          is_primary: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          name: string;
          role?: string;
          email?: string;
          phone?: string;
          wechat?: string;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          name?: string;
          role?: string;
          email?: string;
          phone?: string;
          wechat?: string;
          is_primary?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_contacts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          /** Why the certificate is in this state (0003). */
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
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
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_certificates_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_certificates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      supplier_files: {
        Row: {
          id: string;
          supplier_id: string;
          /** 'data_sheet' | 'certificate' | 'catalog' | 'document' (CHECK). */
          kind: string;
          file_name: string;
          /** Object path inside the 'supplier-files' bucket. */
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          kind?: string;
          file_name: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          kind?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
            foreignKeyName: "supplier_files_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // Reports — README §6, §8.3, §9
      // ───────────────────────────────────────────────────────────────────
      reports: {
        Row: {
          id: string;
          document_number: string;
          supplier_id: string;
          status: Database["public"]["Enums"]["report_status"];
          visit_date: string;
          period: string;
          employee_id: string | null;
          owner_id: string | null;
          location: string;
          start_time: string | null;
          end_time: string | null;
          project: string | null;
          business_unit: string | null;
          product_category: string | null;
          /**
           * README §8.3 — the frozen supplier snapshot taken at creation. Its
           * keys are the camelCase `SupplierSnapshot` of src/types/domain.ts,
           * not the snake_case of the columns it was copied from.
           */
          company_information: Json;
          snapshot_taken_at: string;
          /** Phase 2 §33 — the soft-delete marker. A report is never dropped. */
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          document_number: string;
          supplier_id: string;
          status?: Database["public"]["Enums"]["report_status"];
          visit_date: string;
          period?: string;
          employee_id?: string | null;
          owner_id?: string | null;
          location?: string;
          start_time?: string | null;
          end_time?: string | null;
          project?: string | null;
          business_unit?: string | null;
          product_category?: string | null;
          /** NOT NULL with no default: a report without a snapshot is invalid. */
          company_information: Json;
          snapshot_taken_at?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          document_number?: string;
          supplier_id?: string;
          status?: Database["public"]["Enums"]["report_status"];
          visit_date?: string;
          period?: string;
          employee_id?: string | null;
          owner_id?: string | null;
          location?: string;
          start_time?: string | null;
          end_time?: string | null;
          project?: string | null;
          business_unit?: string | null;
          product_category?: string | null;
          company_information?: Json;
          snapshot_taken_at?: string;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
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
            foreignKeyName: "reports_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_updated_by_fkey";
            columns: ["updated_by"];
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
          /** Null for an attendee who is not an application user. */
          profile_id: string | null;
          display_name: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          profile_id?: string | null;
          display_name: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          profile_id?: string | null;
          display_name?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
          {
            foreignKeyName: "report_members_created_by_fkey";
            columns: ["created_by"];
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
          /** A `SectionId` from src/types/domain.ts — CHECK-constrained. */
          section_id: string;
          body: string;
          /** README §25 — the §4 table and §6 Q&A block can be excluded. */
          excluded: boolean;
          sort_order: number;
          /**
           * Phase 2 §18 — optimistic concurrency. Incremented by a database
           * trigger on every UPDATE, so a client cannot fail to advance it.
           * Save with `.eq("id", id).eq("version", version)`: zero rows
           * updated means someone else saved first.
           */
          version: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          section_id: string;
          body?: string;
          excluded?: boolean;
          sort_order?: number;
          version?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          section_id?: string;
          body?: string;
          excluded?: boolean;
          sort_order?: number;
          /** Writing this is pointless — the trigger overwrites it. */
          version?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
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
            foreignKeyName: "report_sections_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          category: string;
          /** 'Normal' | 'High' | 'Critical' (CHECK, not an enum). */
          priority: string;
          text: string;
          /** Free text, not an FK: findings live inside an AI generation's jsonb. */
          source_finding_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          category?: string;
          priority?: string;
          text?: string;
          source_finding_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          category?: string;
          priority?: string;
          text?: string;
          source_finding_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
            foreignKeyName: "report_observations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      report_target_products: {
        Row: {
          id: string;
          report_id: string;
          name: string;
          model: string;
          application: string;
          expected_market: string;
          technical_requirements: string;
          /** 0001's `description`, renamed by 0003. Free notes, not a spec. */
          comments: string;
          photo_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          name?: string;
          model?: string;
          application?: string;
          expected_market?: string;
          technical_requirements?: string;
          comments?: string;
          photo_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          name?: string;
          model?: string;
          application?: string;
          expected_market?: string;
          technical_requirements?: string;
          comments?: string;
          photo_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
          {
            foreignKeyName: "report_target_products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      report_product_rows: {
        Row: {
          id: string;
          report_id: string;
          type: string;
          standard: string;
          voltage: string;
          description: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          type?: string;
          standard?: string;
          voltage?: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          type?: string;
          standard?: string;
          voltage?: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_product_rows_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_product_rows_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      // ───────────────────────────────────────────────────────────────────
      // Photographs and files — README §10, §12
      // ───────────────────────────────────────────────────────────────────
      report_images: {
        Row: {
          id: string;
          report_id: string;
          region: Database["public"]["Enums"]["image_region"];
          file_name: string;
          /** Null while the upload is still in flight. */
          storage_path: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          /** 0006 — natural pixel size, measured in the browser at upload. */
          width: number | null;
          height: number | null;
          caption: string;
          /** The AI proposal, held until the user accepts it (README §11). */
          ai_caption: string;
          caption_source: Database["public"]["Enums"]["caption_source"];
          /** 0–100. Below 85 the card shows "· review required". */
          confidence: number | null;
          /** 'none' | 'suggested' | 'accepted' (CHECK). */
          caption_state: string;
          /** 'uploading' | 'ready' | 'failed' (CHECK). */
          upload_state: string;
          category: string;
          /** Print order inside the region (README §10). */
          sort_order: number;
          captured_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          region: Database["public"]["Enums"]["image_region"];
          file_name?: string;
          storage_path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          width?: number | null;
          height?: number | null;
          caption?: string;
          ai_caption?: string;
          caption_source?: Database["public"]["Enums"]["caption_source"];
          confidence?: number | null;
          caption_state?: string;
          upload_state?: string;
          category?: string;
          /** NOT NULL with no default — the caller decides the print order. */
          sort_order: number;
          captured_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          region?: Database["public"]["Enums"]["image_region"];
          file_name?: string;
          storage_path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          width?: number | null;
          height?: number | null;
          caption?: string;
          ai_caption?: string;
          caption_source?: Database["public"]["Enums"]["caption_source"];
          confidence?: number | null;
          caption_state?: string;
          upload_state?: string;
          category?: string;
          sort_order?: number;
          captured_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
            foreignKeyName: "report_images_created_by_fkey";
            columns: ["created_by"];
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
          /** 'transcript' | 'audio' | 'note' | 'document' (CHECK). */
          kind: string;
          file_name: string;
          /** 0006 — null when the source is pasted text with no file. */
          storage_path: string | null;
          /** 0006 — extracted plain text, for kind = 'transcript'. */
          content: string;
          mime_type: string | null;
          size_bytes: number | null;
          /** Shown in the Sources rail; null when not applicable. */
          word_count: number | null;
          page_count: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          kind?: string;
          file_name: string;
          storage_path?: string | null;
          content?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          word_count?: number | null;
          page_count?: number | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          kind?: string;
          file_name?: string;
          storage_path?: string | null;
          content?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          word_count?: number | null;
          page_count?: number | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
            foreignKeyName: "report_files_created_by_fkey";
            columns: ["created_by"];
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
          /**
           * 'improve_text' | 'transcript_analysis' | 'photo_caption' |
           * 'conclusion' | 'assistant_answer' (CHECK).
           */
          kind: string;
          section_id: string | null;
          image_id: string | null;
          prompt: string | null;
          /** Free-shaped: a string, an array of findings, or headed blocks. */
          output: Json;
          confidence: number | null;
          model: string | null;
          /** 'proposed' | 'accepted' | 'discarded' (CHECK). */
          status: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          kind: string;
          section_id?: string | null;
          image_id?: string | null;
          prompt?: string | null;
          output?: Json;
          confidence?: number | null;
          model?: string | null;
          status?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          kind?: string;
          section_id?: string | null;
          image_id?: string | null;
          prompt?: string | null;
          output?: Json;
          confidence?: number | null;
          model?: string | null;
          status?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
            foreignKeyName: "report_ai_generations_image_id_fkey";
            columns: ["image_id"];
            isOneToOne: false;
            referencedRelation: "report_images";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_ai_generations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          file_name: string;
          storage_path: string | null;
          /** 'original' | 'optimised' (CHECK). */
          image_quality: string;
          /** 'queued' | 'processing' | 'ready' | 'failed' (CHECK). */
          status: string;
          page_count: number | null;
          appendix_page_count: number | null;
          size_bytes: number | null;
          /** Blocking issues the user chose to export anyway (README §15). */
          warnings: Json;
          error_message: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          template_id?: string | null;
          file_name: string;
          storage_path?: string | null;
          image_quality?: string;
          status?: string;
          page_count?: number | null;
          appendix_page_count?: number | null;
          size_bytes?: number | null;
          warnings?: Json;
          error_message?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          template_id?: string | null;
          file_name?: string;
          storage_path?: string | null;
          image_quality?: string;
          status?: string;
          page_count?: number | null;
          appendix_page_count?: number | null;
          size_bytes?: number | null;
          warnings?: Json;
          error_message?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
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
          {
            foreignKeyName: "report_exports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          storage_path: string | null;
          /** Exactly one active template — partial unique index in 0001. */
          is_active: boolean;
          is_archived: boolean;
          change_note: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          version: string;
          file_name: string;
          storage_path?: string | null;
          is_active?: boolean;
          is_archived?: boolean;
          change_note?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          version?: string;
          file_name?: string;
          storage_path?: string | null;
          is_active?: boolean;
          is_archived?: boolean;
          change_note?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_templates_created_by_fkey";
            columns: ["created_by"];
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
          source: string;
          sample_value: string | null;
          is_mapped: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          placeholder: string;
          source?: string;
          sample_value?: string | null;
          is_mapped?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          placeholder?: string;
          source?: string;
          sample_value?: string | null;
          is_mapped?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "template_placeholders_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "report_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "template_placeholders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      /**
       * README §9 — creates a report, its frozen supplier snapshot, its
       * attendees and its thirteen empty sections in one transaction, and
       * returns the new report id (0005).
       *
       * Every argument is required: the caller passes an explicit null for a
       * field the user left blank, so "not recorded" and "not sent" cannot be
       * confused. It raises 23505 on a duplicate document number, P0002 when
       * the supplier does not exist and 23514 when it is archived.
       */
      create_report_with_snapshot: {
        Args: {
          p_document_number: string;
          p_supplier_id: string;
          p_status: Database["public"]["Enums"]["report_status"];
          p_visit_date: string;
          p_period: string;
          p_employee_id: string | null;
          p_owner_id: string | null;
          p_location: string;
          /** "09:30:00" — a bare `time`, no zone. */
          p_start_time: string | null;
          p_end_time: string | null;
          p_project: string | null;
          p_business_unit: string | null;
          p_product_category: string | null;
          p_members: string[];
        };
        Returns: string;
      };

      /**
       * README §8.3 — re-copies the live supplier record into
       * `reports.company_information` and restamps `snapshot_taken_at`,
       * returning the new timestamp (0005).
       *
       * An explicit, confirmed user action only. It overwrites what a finished
       * report says about the supplier, so it must never be called on a
       * schedule, from a loop, or as a side effect of saving a supplier.
       */
      refresh_report_snapshot: {
        Args: {
          p_report_id: string;
        };
        Returns: string;
      };
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
