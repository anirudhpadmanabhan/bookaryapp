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
      book_suggestions: {
        Row: {
          author: string | null
          created_at: string
          id: string
          note: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string
          author_ml: string | null
          cover_color: string
          cover_url: string | null
          created_at: string
          description: string | null
          genre: string
          genre_ml: string | null
          id: string
          language: string | null
          library_id: string | null
          original_author: string | null
          pages: number | null
          published_year: number | null
          publisher: string | null
          rating: number
          rent_price: number
          shelf_code: string | null
          title: string
          title_ml: string | null
        }
        Insert: {
          author: string
          author_ml?: string | null
          cover_color?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genre: string
          genre_ml?: string | null
          id?: string
          language?: string | null
          library_id?: string | null
          original_author?: string | null
          pages?: number | null
          published_year?: number | null
          publisher?: string | null
          rating?: number
          rent_price?: number
          shelf_code?: string | null
          title: string
          title_ml?: string | null
        }
        Update: {
          author?: string
          author_ml?: string | null
          cover_color?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genre?: string
          genre_ml?: string | null
          id?: string
          language?: string | null
          library_id?: string | null
          original_author?: string | null
          pages?: number | null
          published_year?: number | null
          publisher?: string | null
          rating?: number
          rent_price?: number
          shelf_code?: string | null
          title?: string
          title_ml?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          book_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      libraries: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          location: string | null
          name: string
          name_ml: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          location?: string | null
          name: string
          name_ml?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          location?: string | null
          name?: string
          name_ml?: string | null
          slug?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          book_id: string | null
          created_at: string
          id: string
          kind: string
          link_url: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          book_id?: string | null
          created_at?: string
          id?: string
          kind: string
          link_url?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          book_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_url?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          tag: string | null
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          display_name?: string
          id: string
          phone?: string | null
          tag?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          tag?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      reading_diary: {
        Row: {
          book_id: string | null
          created_at: string
          id: string
          note: string
          progress_pct: number
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          id?: string
          note: string
          progress_pct?: number
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          created_at?: string
          id?: string
          note?: string
          progress_pct?: number
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_diary_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          book_id: string
          delivery_address: string | null
          due_at: string
          id: string
          price_paid: number
          rented_at: string
          returned_at: string | null
          tracking_status: string
          user_id: string
        }
        Insert: {
          book_id: string
          delivery_address?: string | null
          due_at?: string
          id?: string
          price_paid: number
          rented_at?: string
          returned_at?: string | null
          tracking_status?: string
          user_id: string
        }
        Update: {
          book_id?: string
          delivery_address?: string | null
          due_at?: string
          id?: string
          price_paid?: number
          rented_at?: string
          returned_at?: string | null
          tracking_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string
          book_id: string
          created_at: string
          favorite_quote: string | null
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          book_id: string
          created_at?: string
          favorite_quote?: string | null
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          book_id?: string
          created_at?: string
          favorite_quote?: string | null
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      waitlist: {
        Row: {
          book_id: string
          created_at: string
          delivery_address: string | null
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          delivery_address?: string | null
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          delivery_address?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_public: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string | null
          tag: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          tag?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          tag?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "librarian" | "reader"
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
      app_role: ["admin", "librarian", "reader"],
    },
  },
} as const
