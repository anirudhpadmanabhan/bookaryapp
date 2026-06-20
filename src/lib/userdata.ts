import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./auth";
import { toast } from "sonner";

// PROFILE
export function useProfile() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// FAVORITES
export function useFavorites() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("book_id, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ bookId, currentlyFav }: { bookId: string; currentlyFav: boolean }) => {
      if (!user) throw new Error("Not signed in");
      if (currentlyFav) {
        const { error } = await supabase.from("favorites").delete().eq("book_id", bookId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").insert({ book_id: bookId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(vars.currentlyFav ? "Removed from Loved" : "Added to Loved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// RENTALS
export function useRentals() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["rentals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*, books(*)")
        .order("rented_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRentBook() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ bookId, price }: { bookId: string; price: number }) => {
      if (!user) throw new Error("Sign in to rent");
      // Get profile to check balance
      const { data: prof, error: pErr } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).single();
      if (pErr) throw pErr;
      const balance = Number(prof.wallet_balance);
      if (balance < price) throw new Error(`Need ₹${price - balance} more in wallet`);
      const { error: rErr } = await supabase.from("rentals").insert({ user_id: user.id, book_id: bookId, price_paid: price });
      if (rErr) throw rErr;
      const { error: uErr } = await supabase.from("profiles").update({ wallet_balance: balance - price }).eq("id", user.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Rented — happy reading!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// DIARY
export function useDiary() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["diary", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_diary")
        .select("*, books(title, author, cover_color, title_ml, author_ml, genre_ml, genre)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddDiary() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ bookId, note, progress }: { bookId: string; note: string; progress: number }) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("reading_diary").insert({ user_id: user.id, book_id: bookId, note, progress_pct: progress });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success("Diary entry saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTopUpWallet() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (amount: number) => {
      if (!user) throw new Error("Sign in");
      const { data: prof, error } = await supabase.from("profiles").select("wallet_balance").eq("id", user.id).single();
      if (error) throw error;
      const { error: uErr } = await supabase.from("profiles").update({ wallet_balance: Number(prof.wallet_balance) + amount }).eq("id", user.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Wallet topped up");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// BOOK SUGGESTIONS
export function useSuggestions() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["suggestions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_suggestions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSuggestBook() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ title, author, note }: { title: string; author?: string; note?: string }) => {
      if (!user) throw new Error("Sign in to suggest a book");
      const { error } = await supabase.from("book_suggestions").insert({
        user_id: user.id,
        title: title.trim(),
        author: author?.trim() || null,
        note: note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast.success("Thanks! Suggestion sent to the library.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
