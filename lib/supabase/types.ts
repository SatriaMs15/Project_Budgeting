/**
 * Hand-written types for the Supabase Postgres schema (see
 * supabase/migrations/0001_init.sql). Keep in sync with the SQL.
 *
 * Amounts are whole rupiah (BIGINT) surfaced as `number`.
 */

export type Kind = "income" | "expense";
export type Frequency = "weekly" | "monthly";

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          kind: Kind;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          kind: Kind;
          color?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          kind: Kind;
          category_id: string | null;
          note: string | null;
          occurred_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          amount: number;
          kind: Kind;
          category_id?: string | null;
          note?: string | null;
          occurred_on?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          month: string;
          limit_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          category_id: string;
          month: string;
          limit_amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [];
      };
      savings_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          saved_amount: number;
          target_date: string | null;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          target_amount: number;
          saved_amount?: number;
          target_date?: string | null;
          color?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["savings_goals"]["Insert"]>;
        Relationships: [];
      };
      recurring_rules: {
        Row: {
          id: string;
          user_id: string;
          kind: Kind;
          amount: number;
          category_id: string | null;
          note: string | null;
          frequency: Frequency;
          next_run_on: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          kind: Kind;
          amount: number;
          category_id?: string | null;
          note?: string | null;
          frequency: Frequency;
          next_run_on: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurring_rules"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type SavingsGoal = Database["public"]["Tables"]["savings_goals"]["Row"];
export type RecurringRule =
  Database["public"]["Tables"]["recurring_rules"]["Row"];
