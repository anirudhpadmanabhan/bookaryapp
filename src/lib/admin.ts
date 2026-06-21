import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./auth";
import { toast } from "sonner";

export type AppRole = "admin" | "librarian" | "reader";

export function useMyRoles() {
  const { user } = useSession();
  return useQuery({
    enabled: !!user,
    queryKey: ["my-roles", user?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useIsStaff() {
  const { data: roles = [] } = useMyRoles();
  return roles.includes("admin") || roles.includes("librarian");
}

export function useIsAdmin() {
  const { data: roles = [] } = useMyRoles();
  return roles.includes("admin");
}

// ===== BOOK MANAGEMENT =====
export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<{
        title: string;
        title_ml: string | null;
        author: string;
        author_ml: string | null;
        genre: string;
        shelf_code: string | null;
        rent_price: number;
        publisher: string | null;
      }>;
    }) => {
      const { error } = await supabase.from("books").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["book"] });
      qc.invalidateQueries({ queryKey: ["new-arrivals"] });
      toast.success("Book updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["new-arrivals"] });
      toast.success("Book removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (book: {
      title: string;
      author: string;
      genre: string;
      title_ml?: string;
      author_ml?: string;
      shelf_code?: string;
      publisher?: string;
      library_id?: string;
    }) => {
      const { error } = await supabase.from("books").insert({
        title: book.title,
        author: book.author,
        genre: book.genre,
        title_ml: book.title_ml || null,
        author_ml: book.author_ml || null,
        shelf_code: book.shelf_code || null,
        publisher: book.publisher || null,
        library_id: book.library_id || null,
        rent_price: 10,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["new-arrivals"] });
      toast.success("Book added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== RENTAL MANAGEMENT =====
export function useAllRentals() {
  return useQuery({
    queryKey: ["admin-rentals"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("*, books(id, title, author, shelf_code)")
        .order("rented_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateRentalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("rentals")
        .update({ tracking_status: status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rentals"] });
      qc.invalidateQueries({ queryKey: ["rentals"] });
      toast.success("Tracking updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkReturned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rentals")
        .update({ returned_at: new Date().toISOString(), tracking_status: "returned" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rentals"] });
      qc.invalidateQueries({ queryKey: ["rentals"] });
      qc.invalidateQueries({ queryKey: ["admin-waitlist"] });
      toast.success("Marked returned — next waitlist reader auto-assigned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== WAITLIST MANAGEMENT =====
export function useAllWaitlist() {
  return useQuery({
    queryKey: ["admin-waitlist"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*, books(id, title, author)")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRemoveWaitlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waitlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-waitlist"] });
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      toast.success("Waitlist entry removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== SUGGESTIONS MANAGEMENT =====
export function useAllSuggestions() {
  return useQuery({
    queryKey: ["admin-suggestions"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_suggestions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}
