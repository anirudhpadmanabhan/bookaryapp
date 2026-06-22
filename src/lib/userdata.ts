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
      if (data) return data;
      const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Reader";
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({ id: user.id, display_name: displayName, wallet_balance: 100 } as any)
        .select("*")
        .single();
      if (createError) throw createError;
      return created;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (updates: { display_name?: string; tag?: string | null; phone?: string | null; address?: string | null }) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("profiles").update(updates as any).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// FAVORITES
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
      const { data: prof, error: pErr } = await supabase.from("profiles").select("wallet_balance, address").eq("id", user.id).maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error("Add your profile details before renting");
      const { data: existing, error: activeErr } = await supabase
        .from("rentals")
        .select("id, user_id, due_at")
        .eq("book_id", bookId)
        .is("returned_at", null)
        .maybeSingle();
      if (activeErr) throw activeErr;
      if (existing) {
        if (existing.user_id === user.id) {
          throw new Error(`You've already rented this — due ${new Date(existing.due_at).toLocaleDateString()}`);
        }
        throw new Error("This book is rented out — join the waiting list instead.");
      }
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

// WAITLIST
export function useWaitlist(bookId?: string) {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["waitlist", user?.id, bookId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("waitlist").select("*, books(*)").order("created_at", { ascending: true });
      if (bookId) q = q.eq("book_id", bookId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useJoinWaitlist() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ bookId, address }: { bookId: string; address?: string }) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("waitlist").insert({
        user_id: user.id, book_id: bookId, delivery_address: address?.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("Added to the waiting list — you'll be assigned when it's returned.");
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "You're already on the waiting list." : e.message),
  });
}

export function useLeaveWaitlist() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (bookId: string) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase.from("waitlist").delete().eq("book_id", bookId).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("Removed from waiting list");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Notifications — rentals due within 20 days (and overdue).
export function useDueSoonRentals() {
  const { data: rentals = [] } = useRentals();
  const now = Date.now();
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

// DIARY
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
    mutationFn: async ({ bookId, note, rating }: { bookId: string | null; note: string; rating?: number | null }) => {
      if (!user) throw new Error("Sign in");
      const { error } = await supabase
        .from("reading_diary")
        .insert({ user_id: user.id, book_id: bookId, note, rating: rating ?? null, progress_pct: 0 } as any);
      if (error) throw error;
      if (bookId && rating && rating > 0) {
        const { error: reviewError } = await supabase.from("reviews").upsert(
          { book_id: bookId, user_id: user.id, rating, body: note } as any,
          { onConflict: "book_id,user_id" },
        );
        if (reviewError) throw reviewError;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      if (vars.bookId) qc.invalidateQueries({ queryKey: ["reviews", vars.bookId] });
      toast.success("Diary entry saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEditDiaryFull() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ id, note, rating, bookId }: { id: string; note: string; rating?: number | null; bookId?: string | null }) => {
      const { error } = await supabase.from("reading_diary").update({ note, rating: rating ?? null } as any).eq("id", id);
      if (error) throw error;
      if (user && bookId && rating && rating > 0) {
        const { error: reviewError } = await supabase.from("reviews").upsert(
          { book_id: bookId, user_id: user.id, rating, body: note } as any,
          { onConflict: "book_id,user_id" },
        );
        if (reviewError) throw reviewError;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["diary"] });
      if (vars.bookId) qc.invalidateQueries({ queryKey: ["reviews", vars.bookId] });
      toast.success("Entry updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEditDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.from("reading_diary").update({ note }).eq("id", id);
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
  favorite_quote: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewWithAuthor = Review & {
  author_display_name: string | null;
  author_tag: string | null;
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
      const reviews = (data ?? []) as Review[];
      if (reviews.length === 0) return [] as ReviewWithAuthor[];
      const ids = [...new Set(reviews.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles_public" as any)
        .select("id, display_name, tag")
        .in("id", ids);
      const lookup = new Map<string, { display_name: string; tag: string | null }>();
      for (const p of (profiles ?? []) as any[]) lookup.set(p.id, { display_name: p.display_name, tag: p.tag });
      return reviews.map((r) => ({
        ...r,
        author_display_name: lookup.get(r.user_id)?.display_name ?? null,
        author_tag: lookup.get(r.user_id)?.tag ?? null,
      })) as ReviewWithAuthor[];
    },
  });
}

// PUBLIC PROFILE — safe columns only via profiles_public view
export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles_public" as any)
        .select("id, display_name, tag, created_at")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; display_name: string; tag: string | null; created_at: string } | null;
    },
  });
}

// NOTIFICATIONS
export function useNotifications() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications" as any)
        .update({ read_at: new Date().toISOString() } as any)
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
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
      const { data: diary } = await supabase
        .from("reading_diary")
        .select("id")
        .eq("user_id", user.id)
        .eq("book_id", bookId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (diary?.id) {
        const { error: diaryError } = await supabase
          .from("reading_diary")
          .update({ note: body, rating } as any)
          .eq("id", diary.id);
        if (diaryError) throw diaryError;
      } else {
        const { error: diaryError } = await supabase
          .from("reading_diary")
          .insert({ user_id: user.id, book_id: bookId, note: body, rating, progress_pct: 0 } as any);
        if (diaryError) throw diaryError;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["reviews", vars.bookId] });
      qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success("Review saved");
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

// INSIGHTS
export function useReadingInsights() {
  const { user } = useSession();
  const { data: diary = [] } = useDiary();
  const { data: favorites = [] } = useFavorites();
  const { data: rentals = [] } = useRentals();

  if (!user) return null;

  const dayKeys = new Set(
    (diary as any[]).map((e) => new Date(e.created_at).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();
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
