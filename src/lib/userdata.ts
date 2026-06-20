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

// FAVORITES — deduped at query level.
export function useFavorites() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("book_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const unique: { book_id: string; created_at: string }[] = [];
      for (const f of data ?? []) {
        if (seen.has(f.book_id)) continue;
        seen.add(f.book_id);
        unique.push(f);
      }
      return unique;
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
        if (error && !String(error.message).includes("duplicate")) throw error;
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
    mutationFn: async ({ bookId, price, address }: { bookId: string; price: number; address?: string }) => {
      if (!user) throw new Error("Sign in to rent");
      const { data: prof, error: pErr } = await supabase.from("profiles").select("wallet_balance, address").eq("id", user.id).single();
      if (pErr) throw pErr;
      const balance = Number(prof.wallet_balance);
      if (balance < price) throw new Error(`Need ₹${price - balance} more in wallet`);
      const deliveryAddress = (address ?? prof.address ?? "").trim() || null;
      const { error: rErr } = await supabase.from("rentals").insert({
        user_id: user.id, book_id: bookId, price_paid: price,
        delivery_address: deliveryAddress, tracking_status: "confirmed",
      } as any);
      if (rErr) throw rErr;
      const updates: any = { wallet_balance: balance - price };
      if (address && address.trim() && address.trim() !== (prof.address ?? "")) updates.address = address.trim();
      const { error: uErr } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Rented — tracking added to your profile");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}


// Notifications — rentals due within 20 days (and overdue).
export function useDueSoonRentals() {
  const { data: rentals = [] } = useRentals();
  const now = Date.now();
  const horizon = 20 * 24 * 60 * 60 * 1000;
  return (rentals as any[])
    .filter((r) => !r.returned_at)
    .map((r) => {
      const due = new Date(r.due_at).getTime();
      const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
      return { ...r, daysLeft, overdue: due < now };
    })
    .filter((r) => r.daysLeft <= 20)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// DIARY — book_id is nullable so users can log reading thoughts on any book.
export function useDiary() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["diary", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_diary")
        .select("*, books(id, title, author, cover_color, title_ml, author_ml, genre_ml, genre, shelf_code)")
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
    mutationFn: async ({ bookId, note, progress }: { bookId: string | null; note: string; progress: number }) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase
        .from("reading_diary")
        .insert({ user_id: user.id, book_id: bookId, note, progress_pct: progress });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success("Diary entry saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEditDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note, progress }: { id: string; note: string; progress: number }) => {
      const { error } = await supabase.from("reading_diary").update({ note, progress_pct: progress }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success("Entry updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reading_diary").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success("Entry removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// REVIEWS
export type Review = {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
  updated_at: string;
};

export function useReviews(bookId: string) {
  return useQuery({
    queryKey: ["reviews", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("book_id", bookId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
}

export function useUpsertReview() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ bookId, rating, body, quote }: { bookId: string; rating: number; body: string; quote?: string }) => {
      if (!user) throw new Error("Sign in to write a review");
      const { error } = await supabase
        .from("reviews")
        .upsert(
          { book_id: bookId, user_id: user.id, rating, body, favorite_quote: quote?.trim() || null } as any,
          { onConflict: "book_id,user_id" },
        );
      if (error) throw error;
      const noteParts = [`Rated ${rating}/5`];
      if (body.trim()) noteParts.push(body.trim());
      if (quote?.trim()) noteParts.push(`Quote: "${quote.trim()}"`);
      await supabase
        .from("reading_diary")
        .insert({ user_id: user.id, book_id: bookId, note: noteParts.join(" — "), progress_pct: 100 });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["reviews", vars.bookId] });
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success("Review saved & added to your diary");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}


export function useDeleteReview() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ bookId }: { bookId: string }) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("reviews").delete().eq("book_id", bookId).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["reviews", vars.bookId] });
      toast.success("Review removed");
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

// INSIGHTS — derive reading insights from diary + favorites + rentals.
export function useReadingInsights() {
  const { user } = useSession();
  const { data: diary = [] } = useDiary();
  const { data: favorites = [] } = useFavorites();
  const { data: rentals = [] } = useRentals();

  if (!user) return null;

  // Streak: consecutive days (ending today or yesterday) with at least one diary entry.
  const dayKeys = new Set(
    (diary as any[]).map((e) => new Date(e.created_at).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();
  // If no entry today, allow streak to anchor on yesterday.
  if (!dayKeys.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (dayKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const booksRead = new Set(
    (rentals as any[]).filter((r) => r.returned_at).map((r) => r.book_id),
  ).size;

  const genreCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  for (const r of rentals as any[]) {
    if (!r.books) continue;
    genreCounts.set(r.books.genre, (genreCounts.get(r.books.genre) ?? 0) + 1);
    authorCounts.set(r.books.author, (authorCounts.get(r.books.author) ?? 0) + 1);
  }
  const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const totalSpent = (rentals as any[]).reduce((s, r) => s + Number(r.price_paid ?? 0), 0);

  return {
    streak,
    diaryCount: diary.length,
    lovedCount: favorites.length,
    booksRead,
    activeRentals: (rentals as any[]).filter((r) => !r.returned_at).length,
    topGenre,
    topAuthor,
    totalSpent,
  };
}
