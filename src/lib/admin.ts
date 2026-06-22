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
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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

// ===== LIBRARIES MANAGEMENT =====
export type LibraryRow = {
  id: string;
  slug: string;
  name: string;
  name_ml: string | null;
  location: string | null;
  is_default: boolean;
};

export function useAdminLibraries() {
  return useQuery({
    queryKey: ["admin-libraries"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("libraries")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as LibraryRow[];
    },
  });
}

export function useCreateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lib: { name: string; slug: string; name_ml?: string; location?: string; is_default?: boolean }) => {
      const { error } = await supabase.from("libraries").insert({
        name: lib.name,
        slug: lib.slug,
        name_ml: lib.name_ml || null,
        location: lib.location || null,
        is_default: !!lib.is_default,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-libraries"] });
      qc.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LibraryRow> }) => {
      const { error } = await supabase.from("libraries").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-libraries"] });
      qc.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("libraries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-libraries"] });
      qc.invalidateQueries({ queryKey: ["libraries"] });
      toast.success("Library removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== LIBRARIAN ROLES =====
export function useLibrarians() {
  return useQuery({
    queryKey: ["admin-librarians"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_librarians" as any);
      if (error) throw error;
      return (data ?? []) as { user_id: string; email: string; display_name: string | null; granted_at: string }[];
    },
  });
}

export function useGrantLibrarian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("admin_grant_librarian" as any, { _email: email.trim().toLowerCase() });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res?.ok) throw new Error(res?.error || "Failed to grant");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-librarians"] });
      toast.success("Librarian access granted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeLibrarian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("admin_revoke_librarian" as any, { _email: email.trim().toLowerCase() });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res?.ok) throw new Error(res?.error || "Failed to revoke");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-librarians"] });
      toast.success("Librarian access revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== STAFF USER DASHBOARD =====
export function useStaffUserSummary(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["staff-user-summary", userId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("staff_user_summary" as any, { _user_id: userId });
      if (error) throw error;
      return data as any;
    },
  });
}

// ===== BULK BOOK UPLOAD =====
export type BookImportRow = {
  title: string;
  author: string;
  genre: string;
  title_ml?: string | null;
  author_ml?: string | null;
  shelf_code?: string | null;
  publisher?: string | null;
  rent_price?: number;
};

export function useBulkImportBooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, libraryId }: { rows: BookImportRow[]; libraryId: string | null }) => {
      if (rows.length === 0) throw new Error("No rows to import");
      const payload = rows.map((r) => ({
        title: String(r.title).trim(),
        author: String(r.author).trim(),
        genre: String(r.genre || "നോവൽ").trim(),
        title_ml: r.title_ml?.toString().trim() || null,
        author_ml: r.author_ml?.toString().trim() || null,
        shelf_code: r.shelf_code?.toString().trim() || null,
        publisher: r.publisher?.toString().trim() || null,
        rent_price: Number(r.rent_price) > 0 ? Number(r.rent_price) : 10,
        library_id: libraryId,
      }));
      // Chunked insert
      const chunkSize = 200;
      let inserted = 0;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("books").insert(chunk as any);
        if (error) throw new Error(`Row ${i + 1}: ${error.message}`);
        inserted += chunk.length;
      }
      return inserted;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["new-arrivals"] });
      toast.success(`${count} books imported`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

