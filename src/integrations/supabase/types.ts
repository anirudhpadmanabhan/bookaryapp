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
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          note: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          note?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          author?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
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
      profile_cards: {
        Row: {
          created_at: string
          display_name: string
          id: string
          tag: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          tag?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_cards_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
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
          avatar_url?: string | null
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
          avatar_url?: string | null
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
          delivered_notified_at: string | null
          delivery_address: string | null
          due_at: string
          fine_amount: number
          id: string
          last_reminder_days: number | null
          price_paid: number
          reminder_sent_at: string | null
          rented_at: string
          reserved_until: string | null
          returned_at: string | null
          tracking_status: string
          user_id: string
        }
        Insert: {
          book_id: string
          delivered_notified_at?: string | null
          delivery_address?: string | null
          due_at?: string
          fine_amount?: number
          id?: string
          last_reminder_days?: number | null
          price_paid: number
          reminder_sent_at?: string | null
          rented_at?: string
          reserved_until?: string | null
          returned_at?: string | null
          tracking_status?: string
          user_id: string
        }
        Update: {
          book_id?: string
          delivered_notified_at?: string | null
          delivery_address?: string | null
          due_at?: string
          fine_amount?: number
          id?: string
          last_reminder_days?: number | null
          price_paid?: number
          reminder_sent_at?: string | null
          rented_at?: string
          reserved_until?: string | null
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
      transaction_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          book_id: string | null
          book_title: string | null
          created_at: string
          id: string
          library_id: string | null
          metadata: Json
          subject_user_id: string | null
          subject_user_name: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          book_id?: string | null
          book_title?: string | null
          created_at?: string
          id?: string
          library_id?: string | null
          metadata?: Json
          subject_user_id?: string | null
          subject_user_name?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          book_id?: string | null
          book_title?: string | null
          created_at?: string
          id?: string
          library_id?: string | null
          metadata?: Json
          subject_user_id?: string | null
          subject_user_name?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          library_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          library_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          library_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "profile_cards_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _actor_name: { Args: { _uid: string }; Returns: string }
      _book_meta: {
        Args: { _book_id: string }
        Returns: {
          library_id: string
          title: string
        }[]
      }
      _fanout_staff_notify: {
        Args: {
          _body: string
          _book_id: string
          _kind: string
          _library_id: string
          _link: string
          _title: string
        }
        Returns: undefined
      }
      admin_grant_librarian: { Args: { _email: string }; Returns: Json }
      admin_grant_librarian_for_library: {
        Args: { _email: string; _library_id: string }
        Returns: Json
      }
      admin_list_librarians: {
        Args: never
        Returns: {
          display_name: string
          email: string
          granted_at: string
          user_id: string
        }[]
      }
      admin_list_staff_roles: {
        Args: never
        Returns: {
          display_name: string
          email: string
          granted_at: string
          library_id: string
          library_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          active_rentals: number
          created_at: string
          display_name: string
          email: string
          roles: Database["public"]["Enums"]["app_role"][]
          total_rentals: number
          user_id: string
          wallet_balance: number
        }[]
      }
      admin_revoke_librarian: { Args: { _email: string }; Returns: Json }
      admin_revoke_librarian_for_library: {
        Args: { _email: string; _library_id: string }
        Returns: Json
      }
      admin_set_user_role: {
        Args: {
          _email: string
          _enabled: boolean
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      claim_reservation: { Args: { _rental_id: string }; Returns: Json }
      decline_reservation: { Args: { _rental_id: string }; Returns: Json }
      enqueue_my_due_reminders: { Args: never; Returns: number }
      expire_stale_reservations: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_library: {
        Args: {
          _library_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      home_data: {
        Args: {
          _latest_limit?: number
          _library_id?: string
          _popular_limit?: number
        }
        Returns: Json
      }
      librarian_decide_suggestion: {
        Args: { _decision: string; _id: string; _note?: string }
        Returns: Json
      }
      librarian_mark_returned: { Args: { _rental_id: string }; Returns: Json }
      library_members: {
        Args: { _library_id: string }
        Returns: {
          display_name: string
          email: string
          last_rental: string
          phone: string
          rental_count: number
          user_id: string
        }[]
      }
      my_librarian_library_ids: {
        Args: { _user_id: string }
        Returns: {
          library_id: string
        }[]
      }
      reading_insights: { Args: { _user_id: string }; Returns: Json }
      rent_book: {
        Args: { _address?: string; _book_id: string; _phone?: string }
        Returns: Json
      }
      set_my_phone: { Args: { _phone: string }; Returns: undefined }
      staff_user_summary: { Args: { _user_id: string }; Returns: Json }
      top_up_wallet: { Args: { _amount: number }; Returns: number }
      waitlist_position: { Args: { _book_id: string }; Returns: number }
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
