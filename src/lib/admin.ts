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
        language: string | null;
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
        .select("*, books(id, title, author, shelf_code, library_id)")
        .order("rented_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, phone").in("id", userIds);
        const map = new Map<string, { display_name: string; phone: string | null }>();
        for (const p of (profs ?? []) as any[]) map.set(p.id, { display_name: p.display_name, phone: p.phone });
        for (const r of rows) {
          const p = map.get(r.user_id);
          r.member_name = p?.display_name ?? null;
          r.member_phone = p?.phone ?? null;
        }
      }
      return rows;
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
      const { data, error } = await supabase.rpc("librarian_mark_returned" as any, { _rental_id: id });
      if (error) throw error;
      return data as { ok: boolean; fine?: number; days_over?: number; error?: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-rentals"] });
      qc.invalidateQueries({ queryKey: ["rentals"] });
      qc.invalidateQueries({ queryKey: ["admin-waitlist"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      if (res?.fine && res.fine > 0) {
        toast.success(`Returned · ₹${res.fine} fine charged (${res.days_over}d late)`);
      } else {
        toast.success("Marked returned — next waitlist reader auto-assigned");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDecideSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "approved" | "rejected" | "available"; note?: string }) => {
      const { error } = await supabase.rpc("librarian_decide_suggestion" as any, { _id: id, _decision: decision, _note: note ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-suggestions"] });
      qc.invalidateQueries({ queryKey: ["suggestions"] });
      toast.success("Suggestion updated — reader notified");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLibraryMembers(libraryId: string | null | undefined) {
  return useQuery({
    enabled: !!libraryId,
    queryKey: ["library-members", libraryId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("library_members" as any, { _library_id: libraryId });
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; display_name: string; email: string; phone: string | null; rental_count: number; last_rental: string | null }>;
    },
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

export function useLibraryBookCounts() {
  return useQuery({
    queryKey: ["admin-library-book-counts"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: libs, error: libErr } = await supabase.from("libraries").select("id");
      if (libErr) throw libErr;
      const ids = (libs ?? []).map((l: any) => l.id);
      const counts: Record<string, number> = {};
      await Promise.all(
        ids.map(async (id: string) => {
          const { count } = await supabase.from("books").select("id", { count: "exact", head: true }).eq("library_id", id);
          counts[id] = count ?? 0;
        }),
      );
      const { count: unassigned } = await supabase.from("books").select("id", { count: "exact", head: true }).is("library_id", null);
      counts.__unassigned = unassigned ?? 0;
      return counts;
    },
  });
}

// ===== STAFF ROLE MANAGEMENT =====

export type StaffRoleRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  roles: AppRole[];
  libraries: Array<{ id: string | null; name: string | null }>;
  granted_at: string;
};

export function useStaffRoles() {
  return useQuery({
    queryKey: ["admin-staff-roles"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_staff_roles" as any);
      if (error) throw error;
      const map = new Map<string, StaffRoleRow>();
      for (const r of (data ?? []) as any[]) {
        const cur = map.get(r.user_id) ?? {
          user_id: r.user_id, email: r.email, display_name: r.display_name,
          roles: [] as AppRole[], libraries: [] as Array<{ id: string | null; name: string | null }>,
          granted_at: r.granted_at,
        };
        if (!cur.roles.includes(r.role as AppRole)) cur.roles.push(r.role as AppRole);
        if (r.library_id && !cur.libraries.some((l) => l.id === r.library_id)) {
          cur.libraries.push({ id: r.library_id, name: r.library_name });
        }
        map.set(r.user_id, cur);
      }
      return Array.from(map.values());
    },
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role, enabled }: { email: string; role: "admin" | "librarian"; enabled: boolean }) => {
      const { data, error } = await supabase.rpc("admin_set_user_role" as any, {
        _email: email.trim().toLowerCase(),
        _role: role,
        _enabled: enabled,
      });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res?.ok) throw new Error(res?.error || "Failed to update role");
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-staff-roles"] });
      qc.invalidateQueries({ queryKey: ["admin-librarians"] });
      qc.invalidateQueries({ queryKey: ["my-roles"] });
      toast.success(`${vars.role === "admin" ? "Admin" : "Librarian"} access ${vars.enabled ? "granted" : "revoked"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLibrarians() {
  const roles = useStaffRoles();
  return { ...roles, data: (roles.data ?? []).filter((u) => u.roles.includes("librarian")) };
}

export function useGrantLibrarian() {
  const setRole = useSetUserRole();
  return { ...setRole, mutate: (email: string, options?: any) => setRole.mutate({ email, role: "librarian", enabled: true }, options) };
}

export function useRevokeLibrarian() {
  const setRole = useSetUserRole();
  return { ...setRole, mutate: (email: string, options?: any) => setRole.mutate({ email, role: "librarian", enabled: false }, options) };
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

export type ImportMode = "append" | "overwrite";

export function useBulkImportBooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, libraryId, mode = "append" }: { rows: BookImportRow[]; libraryId: string | null; mode?: ImportMode }) => {
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

      if (mode === "overwrite") {
        const codes = Array.from(new Set(payload.map((p) => p.shelf_code).filter((c): c is string => !!c)));
        const chunk = 200;
        for (let i = 0; i < codes.length; i += chunk) {
          const slice = codes.slice(i, i + chunk);
          let q = supabase.from("books").delete().in("shelf_code", slice);
          q = libraryId ? q.eq("library_id", libraryId) : q.is("library_id", null);
          const { error: delErr } = await q;
          if (delErr) throw new Error(`Overwrite step failed: ${delErr.message}`);
        }
      }

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
      qc.invalidateQueries({ queryKey: ["admin-library-book-counts"] });
      toast.success(`${count} books imported`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ===== ADMIN USERS LIST =====
export type AdminUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  wallet_balance: number;
  roles: AppRole[];
  created_at: string;
  active_rentals: number;
  total_rentals: number;
};

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users" as any);
      if (error) throw error;
      return (data ?? []) as AdminUserRow[];
    },
  });
}

// ===== TRANSACTION LOG =====
export type TxLogRow = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  subject_user_id: string | null;
  subject_user_name: string | null;
  book_id: string | null;
  book_title: string | null;
  library_id: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
};

export function useTransactionLog(limit = 200) {
  return useQuery({
    queryKey: ["admin-transaction-log", limit],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as TxLogRow[];
    },
  });
}

