import { createFileRoute, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/lib/auth";
import {
  useIsStaff, useIsAdmin, useMyRoles, useMyLibraryScope, useAllRentals, useUpdateRentalStatus, useMarkReturned,
  useAllWaitlist, useRemoveWaitlistEntry, useAllSuggestions, useDecideSuggestion,
  useUpdateBook, useDeleteBook, useCreateBook,
  useAdminLibraries, useCreateLibrary, useUpdateLibrary, useDeleteLibrary,
  useStaffRoles, useSetUserRole, useLibraryMembers,
  useGrantLibrarianForLibrary, useRevokeLibrarianForLibrary,
  useStaffUserSummary,
  useBulkImportBooks, useLibraryBookCounts, type BookImportRow, type ImportMode,
  useAdminUsers, useTransactionLog,
} from "@/lib/admin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBooks, displayRating } from "@/lib/books";
import { useLibrary } from "@/lib/library";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "@e965/xlsx";
import { toast } from "sonner";
import {
  Shield, Library as LibIcon, Package, Clock, Lightbulb,
  Search as SearchIcon, Trash2, CheckCircle2, Plus, Pencil, X, Save,
  Upload, Grid3x3, List as ListIcon, Building2, Users, Mail, Star, Activity,
  FileText, FileDown, ArrowUpDown, ArrowUp, ArrowDown, LayoutDashboard, Megaphone,
} from "lucide-react";
import { exportCsv, exportPdf } from "@/lib/pdf-export";
import { AdsTab } from "@/components/admin/AdsTab";

type Tab = "overview" | "books" | "rentals" | "waitlist" | "suggestions" | "ads" | "libraries" | "roles" | "users" | "activity";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin · Bookary" }] }),
  beforeLoad: async ({ location }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!roles.includes("admin") && !roles.includes("librarian")) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  const { data: roles = [], isLoading: rolesLoading } = useMyRoles();
  const isStaff = useIsStaff();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("overview");
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: pathname } });
  }, [user, loading, navigate, pathname]);

  if (loading || rolesLoading) {
    return <AppLayout><div className="h-64 animate-pulse rounded-2xl bg-surface" /></AppLayout>;
  }

  if (!isStaff) {
    return (
      <AppLayout>
        <div className="glass-card mx-auto max-w-md rounded-2xl p-8 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-rose-400" />
          <h1 className="text-xl font-bold">Staff only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This area is for library admins and librarians. Ask the library admin to grant you access.
          </p>
          <Link to="/" className="mt-5 inline-flex cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Back to library
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tabs: { id: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "books", label: "Books", icon: LibIcon },
    { id: "rentals", label: "Rentals", icon: Package },
    { id: "waitlist", label: "Waitlist", icon: Clock },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb },
    { id: "ads", label: "Ads", icon: Megaphone },
    { id: "libraries", label: "Libraries", icon: Building2, adminOnly: true },
    { id: "users", label: "Users", icon: Users, adminOnly: true },
    { id: "roles", label: "Roles", icon: Shield, adminOnly: true },
    { id: "activity", label: "Activity log", icon: Activity, adminOnly: true },
  ];

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? "Admin" : "Library Admin"} dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Role: <span className="font-semibold text-accent">{roles.map((r) => r === "admin" ? "Admin" : r === "librarian" ? "Library Admin" : r).join(" · ") || "staff"}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddMemberOpen(true)}
          className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Users className="h-4 w-4" /> Add member
        </button>
      </div>
      {addMemberOpen && <AddMemberDialog onClose={() => setAddMemberOpen(false)} />}

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface/40 p-1.5">
        {tabs.filter((t) => !t.adminOnly || isAdmin).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "books" && <BooksTab />}
      {tab === "rentals" && <RentalsTab />}
      {tab === "waitlist" && <WaitlistTab />}
      {tab === "suggestions" && <SuggestionsTab />}
      {tab === "ads" && <AdsTab />}
      {tab === "libraries" && isAdmin && <LibrariesTab />}
      {tab === "users" && isAdmin && <UsersTab />}
      {tab === "roles" && isAdmin && <StaffRolesTab />}
      {tab === "activity" && isAdmin && <ActivityLogTab />}
      <RealtimeStaffToasts enabled={isStaff} />
    </AppLayout>
  );
}

// ===== OVERVIEW =====
function OverviewTab() {
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { data: rentals = [] } = useAllRentals();
  const { data: waitlist = [] } = useAllWaitlist();
  const { data: libs = [] } = useAdminLibraries();

  const rows = useMemo(() => {
    const all = libs.map((l) => ({ id: l.id, name: l.name }));
    all.push({ id: "__unassigned", name: "Unassigned" });

    const bookLib = new Map<string, string>();
    for (const b of books as any[]) bookLib.set(b.id, b.library_id || "__unassigned");

    return all.map((lib) => {
      const libBooks = (books as any[]).filter((b) => (b.library_id || "__unassigned") === lib.id);
      const libRentals = (rentals as any[]).filter((r) => bookLib.get(r.book_id) === lib.id);
      const active = libRentals.filter((r) => !r.returned_at);
      const returned = libRentals.filter((r) => r.returned_at);
      const overdue = active.filter((r) => r.due_at && new Date(r.due_at) < new Date());
      const wait = (waitlist as any[]).filter((w) => bookLib.get(w.book_id) === lib.id);
      const revenue = libRentals.reduce((s, r) => s + Number(r.price_paid || 0), 0);
      return {
        id: lib.id,
        name: lib.name,
        books: libBooks.length,
        active: active.length,
        overdue: overdue.length,
        returned: returned.length,
        waitlist: wait.length,
        revenue,
      };
    }).filter((r) => r.books || r.active || r.returned || r.waitlist);
  }, [books, rentals, waitlist, libs]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    books: a.books + r.books, active: a.active + r.active, overdue: a.overdue + r.overdue,
    returned: a.returned + r.returned, waitlist: a.waitlist + r.waitlist, revenue: a.revenue + r.revenue,
  }), { books: 0, active: 0, overdue: 0, returned: 0, waitlist: 0, revenue: 0 }), [rows]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Books" value={totals.books} />
        <Stat label="Active rentals" value={totals.active} />
        <Stat label="Overdue" value={totals.overdue} />
        <Stat label="Returned" value={totals.returned} />
        <Stat label="Waitlisted" value={totals.waitlist} />
        <Stat label="Revenue (₹)" value={totals.revenue} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Per-library breakdown</h2>
        {rows.length === 0 ? (
          <p className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <>
            {/* Cards on mobile */}
            <div className="grid gap-3 sm:hidden">
              {rows.map((r) => (
                <div key={r.id} className="glass-card rounded-2xl p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <Building2 className="h-4 w-4 text-primary" /> {r.name}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Mini label="Books" value={r.books} />
                    <Mini label="Active" value={r.active} tone="emerald" />
                    <Mini label="Overdue" value={r.overdue} tone="rose" />
                    <Mini label="Returned" value={r.returned} />
                    <Mini label="Waitlist" value={r.waitlist} tone="amber" />
                    <Mini label="₹" value={r.revenue} />
                  </div>
                </div>
              ))}
            </div>
            {/* Table on tablet+ */}
            <div className="glass-card hidden overflow-x-auto rounded-2xl sm:block">
              <table className="w-full text-sm">
                <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Library</th>
                    <th className="px-3 py-2.5 text-right">Books</th>
                    <th className="px-3 py-2.5 text-right">Active</th>
                    <th className="px-3 py-2.5 text-right">Overdue</th>
                    <th className="px-3 py-2.5 text-right">Returned</th>
                    <th className="px-3 py-2.5 text-right">Waitlist</th>
                    <th className="px-3 py-2.5 text-right">Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/40">
                      <td className="px-3 py-2.5 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5 text-right">{r.books.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right">
                        {r.active > 0 ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">{r.active}</span> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.overdue > 0 ? <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">{r.overdue}</span> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{r.returned}</td>
                      <td className="px-3 py-2.5 text-right">
                        {r.waitlist > 0 ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">{r.waitlist}</span> : <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">{r.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "rose" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : tone === "amber" ? "text-amber-300" : "text-foreground";
  return (
    <div className="rounded-lg bg-surface/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${cls}`}>{Number(value).toLocaleString()}</div>
    </div>
  );
}


// ===== BOOKS =====
type BooksView = "grid" | "table";

type BookSortKey =
  | "shelf_code" | "title" | "title_ml" | "author" | "author_ml" | "original_author"
  | "genre" | "genre_ml" | "language" | "publisher" | "rent_price" | "rating"
  | "pages" | "published_year" | "created_at";

function BooksTab() {
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { data: libs = [] } = useAdminLibraries();
  const { data: allRentals = [] } = useAllRentals();
  const scope = useMyLibraryScope();
  const [q, setQ] = useState("");
  const [view, setView] = useState<BooksView>("table");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [libFilter, setLibFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<BookSortKey>("shelf_code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const outIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRentals as any[]) {
      if (!r.returned_at && r.tracking_status !== "reserved") s.add(r.book_id);
    }
    return s;
  }, [allRentals]);


  const rackCompare = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  };

  const libNameById = useMemo(() => {
    const m = new Map<string, string>();
    libs.forEach((l) => m.set(l.id, l.name));
    return m;
  }, [libs]);

  const scopedBooks = useMemo(() => {
    if (scope === null) return books as any[];
    const set = new Set(scope);
    return (books as any[]).filter((b) => b.library_id && set.has(b.library_id));
  }, [books, scope]);

  const filtered = useMemo(() => {
    let pool = scopedBooks;
    if (libFilter === "__unassigned") pool = pool.filter((b) => !b.library_id);
    else if (libFilter !== "all") pool = pool.filter((b) => b.library_id === libFilter);

    if (q.trim()) {
      const needle = q.toLowerCase();
      pool = pool.filter(
        (b) =>
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle) ||
          (b.shelf_code ?? "").toLowerCase().includes(needle) ||
          (b.publisher ?? "").toLowerCase().includes(needle) ||
          (b.genre ?? "").toLowerCase().includes(needle) ||
          (b.language ?? "").toLowerCase().includes(needle) ||
          (b.title_ml ?? "").includes(q) ||
          (b.author_ml ?? "").includes(q) ||
          (b.genre_ml ?? "").includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    const numericKeys: BookSortKey[] = ["rent_price", "rating", "pages", "published_year"];
    pool = [...pool].sort((a, b) => {
      if (sortKey === "shelf_code") return rackCompare(a.shelf_code, b.shelf_code) * dir;
      if (sortKey === "created_at") {
        return (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()) * dir;
      }
      if (numericKeys.includes(sortKey)) {
        const av = Number(a[sortKey] ?? 0);
        const bv = Number(b[sortKey] ?? 0);
        return (av - bv) * dir;
      }
      const av = String(a[sortKey] ?? "").toLowerCase();
      const bv = String(b[sortKey] ?? "").toLowerCase();
      return av.localeCompare(bv) * dir;
    });
    return pool;
  }, [scopedBooks, q, libFilter, sortKey, sortDir]);

  const shown = filtered.slice(0, 500);

  const totalForScope = useMemo(() => {
    if (libFilter === "all") return scopedBooks.length;
    if (libFilter === "__unassigned") return scopedBooks.filter((b) => !b.library_id).length;
    return scopedBooks.filter((b) => b.library_id === libFilter).length;
  }, [scopedBooks, libFilter]);

  const exportColumns = [
    { header: "Rack", get: (b: any) => b.shelf_code ?? "" },
    { header: "Title (EN)", get: (b: any) => b.title ?? "" },
    { header: "Title (ML)", get: (b: any) => b.title_ml ?? "" },
    { header: "Author (EN)", get: (b: any) => b.author ?? "" },
    { header: "Author (ML)", get: (b: any) => b.author_ml ?? "" },
    
    { header: "Genre (EN)", get: (b: any) => b.genre ?? "" },
    { header: "Genre (ML)", get: (b: any) => b.genre_ml ?? "" },
    { header: "Language", get: (b: any) => b.language ?? "" },
    { header: "Publisher", get: (b: any) => b.publisher ?? "" },
    { header: "Year", get: (b: any) => b.published_year ?? "" },
    { header: "Pages", get: (b: any) => b.pages ?? "" },
    { header: "Price", get: (b: any) => Number(b.rent_price ?? 0) },
    { header: "Rating", get: (b: any) => Number(displayRating(b).toFixed(2)) },
    { header: "Library", get: (b: any) => (b.library_id ? libNameById.get(b.library_id) ?? "" : "") },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={libFilter}
          onChange={(e) => setLibFilter(e.target.value)}
          className="cursor-pointer rounded-xl border border-border bg-surface/50 px-3 py-2.5 text-sm font-medium"
          title="Filter by library"
        >
          <option value="all">All libraries</option>
          {libs.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
          {scope === null && <option value="__unassigned">Unassigned</option>}
        </select>
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-border bg-surface/50 px-4 py-2.5">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title / author / rack / publisher…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <select
          value={`${sortKey}:${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split(":") as [BookSortKey, "asc" | "desc"];
            setSortKey(k); setSortDir(d);
          }}
          className="cursor-pointer rounded-xl border border-border bg-surface/50 px-3 py-2.5 text-sm"
          title="Sort"
        >
          <option value="shelf_code:asc">Rack ↑</option>
          <option value="shelf_code:desc">Rack ↓</option>
          <option value="title:asc">Title A→Z</option>
          <option value="title:desc">Title Z→A</option>
          <option value="author:asc">Author A→Z</option>
          <option value="author:desc">Author Z→A</option>
          <option value="genre:asc">Genre A→Z</option>
          <option value="genre:desc">Genre Z→A</option>
          <option value="language:asc">Language A→Z</option>
          <option value="publisher:asc">Publisher A→Z</option>
          <option value="rent_price:desc">Price ↓</option>
          <option value="rent_price:asc">Price ↑</option>
          <option value="rating:desc">Rating ↓</option>
          <option value="published_year:desc">Year ↓</option>
          <option value="pages:desc">Pages ↓</option>
          <option value="created_at:desc">Newest</option>
          <option value="created_at:asc">Oldest</option>
        </select>
        <div className="flex gap-1 rounded-xl border border-border bg-surface/40 p-1">
          <button
            type="button"
            onClick={() => setView("table")}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ListIcon className="h-3.5 w-3.5" /> Table
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> Grid
          </button>
        </div>
        <button
          type="button"
          onClick={() => exportCsv({ filename: `books-${Date.now()}.csv`, columns: exportColumns, rows: filtered })}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface/50 px-3 py-2.5 text-sm font-semibold hover:bg-surface-elevated"
          title="Export filtered books to CSV"
        >
          <FileDown className="h-4 w-4" /> CSV
        </button>
        <button
          type="button"
          onClick={() => exportPdf({ filename: `books-${Date.now()}.pdf`, title: "Books", subtitle: `${filtered.length} rows${q ? ` · matching "${q}"` : ""}`, columns: exportColumns, rows: filtered })}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface/50 px-3 py-2.5 text-sm font-semibold hover:bg-surface-elevated"
          title="Export filtered books to PDF"
        >
          <FileText className="h-4 w-4" /> PDF
        </button>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-3 py-2.5 text-sm font-semibold hover:bg-surface-elevated"
        >
          <Upload className="h-4 w-4" /> Import CSV/Excel
        </button>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add book
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />
          ))}
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Showing {shown.length.toLocaleString()} of {filtered.length.toLocaleString()} matched · {totalForScope.toLocaleString()} total{q && ` · search "${q}"`} · sort: {sortKey} {sortDir === "asc" ? "↑" : "↓"}.
          </p>
          {view === "table" ? (
            <BooksTable books={shown} editing={editing} setEditing={setEditing} sortKey={sortKey} sortDir={sortDir} setSort={(k) => { if (k === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } }} libNameById={libNameById} outIds={outIds} />
          ) : (
            <BooksGridAdmin books={shown} setEditing={setEditing} outIds={outIds} />
          )}
        </>
      )}

      {adding && <AddBookModal onClose={() => setAdding(false)} defaultLibraryId={libFilter !== "all" && libFilter !== "__unassigned" ? libFilter : undefined} />}
      {importing && <ImportBooksModal onClose={() => setImporting(false)} defaultLibraryId={libFilter !== "all" && libFilter !== "__unassigned" ? libFilter : undefined} />}
      {editing && (
        <EditBookModal
          book={books.find((b) => b.id === editing)!}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SortableHeader({ label, k, sortKey, sortDir, setSort, className = "" }: { label: string; k: BookSortKey; sortKey: BookSortKey; sortDir: "asc" | "desc"; setSort: (k: BookSortKey) => void; className?: string }) {
  const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-2 py-2.5 text-left ${className}`}>
      <button onClick={() => setSort(k)} className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground">
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function BooksTable({ books, editing, setEditing, sortKey, sortDir, setSort, libNameById, outIds }: { books: any[]; editing: string | null; setEditing: (id: string | null) => void; sortKey: BookSortKey; sortDir: "asc" | "desc"; setSort: (k: BookSortKey) => void; libNameById: Map<string, string>; outIds: Set<string> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <SortableHeader label="Rack" k="shelf_code" sortKey={sortKey} sortDir={sortDir} setSort={setSort} className="w-20" />
            <SortableHeader label="Title" k="title" sortKey={sortKey} sortDir={sortDir} setSort={setSort} />
            <SortableHeader label="Title (ML)" k="title_ml" sortKey={sortKey} sortDir={sortDir} setSort={setSort} />
            <SortableHeader label="Author" k="author" sortKey={sortKey} sortDir={sortDir} setSort={setSort} />
            <SortableHeader label="Author (ML)" k="author_ml" sortKey={sortKey} sortDir={sortDir} setSort={setSort} />
            
            <SortableHeader label="Genre" k="genre" sortKey={sortKey} sortDir={sortDir} setSort={setSort} />
            <SortableHeader label="Genre (ML)" k="genre_ml" sortKey={sortKey} sortDir={sortDir} setSort={setSort} />
            <SortableHeader label="Lang" k="language" sortKey={sortKey} sortDir={sortDir} setSort={setSort} className="w-20" />
            <SortableHeader label="Rs." k="rent_price" sortKey={sortKey} sortDir={sortDir} setSort={setSort} className="w-16" />
            <SortableHeader label="Year" k="published_year" sortKey={sortKey} sortDir={sortDir} setSort={setSort} className="w-16" />
            <SortableHeader label="Pages" k="pages" sortKey={sortKey} sortDir={sortDir} setSort={setSort} className="w-16" />
            <SortableHeader label="Rating" k="rating" sortKey={sortKey} sortDir={sortDir} setSort={setSort} className="w-16" />
            <SortableHeader label="Publisher" k="publisher" sortKey={sortKey} sortDir={sortDir} setSort={setSort} />
            <th className="px-2 py-2.5 text-left">Library</th>
            <th className="px-2 py-2.5 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <EditableRow key={b.id} book={b} isEditing={editing === b.id} onEdit={() => setEditing(b.id)} onClose={() => setEditing(null)} libName={b.library_id ? libNameById.get(b.library_id) : undefined} isOut={outIds.has(b.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableRow({ book, isEditing, onEdit, onClose, libName, isOut }: { book: any; isEditing: boolean; onEdit: () => void; onClose: () => void; libName?: string; isOut?: boolean }) {
  if (isEditing) {
    // Use full modal for editing all fields
    return (
      <tr className="border-t border-border/40 bg-primary/5">
        <td colSpan={16} className="px-3 py-2 text-xs text-muted-foreground">Opening editor…</td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border/40 hover:bg-surface/40" onDoubleClick={onEdit}>
      <td className="px-2 py-2 text-xs font-bold text-primary">
        <span className="inline-flex items-center gap-1.5">
          <span title={isOut ? "Rented / unavailable" : "Available"} className={`inline-block h-2 w-2 rounded-full ${isOut ? "bg-rose-500" : "bg-emerald-500"}`} />
          {book.shelf_code ?? "—"}
        </span>
      </td>
      <td className="px-2 py-2">
        <Link to="/books/$id" params={{ id: book.id }} className="cursor-pointer font-medium hover:text-primary">{book.title}</Link>
      </td>
      <td className="px-2 py-2 font-mal text-accent">{book.title_ml ?? "—"}</td>
      <td className="px-2 py-2 text-foreground/80">{book.author}</td>
      <td className="px-2 py-2 font-mal text-foreground/70">{book.author_ml ?? "—"}</td>

      <td className="px-2 py-2 text-muted-foreground">{book.genre}</td>
      <td className="px-2 py-2 font-mal text-muted-foreground">{book.genre_ml ?? "—"}</td>
      <td className="px-2 py-2 text-muted-foreground">{book.language ?? "—"}</td>
      <td className="px-2 py-2">₹{Number(book.rent_price ?? 10).toFixed(0)}</td>
      <td className="px-2 py-2 text-muted-foreground">{book.published_year ?? "—"}</td>
      <td className="px-2 py-2 text-muted-foreground">{book.pages ?? "—"}</td>
      <td className="px-2 py-2">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {displayRating(book).toFixed(1)}
        </span>
      </td>
      <td className="px-2 py-2 text-muted-foreground">{book.publisher ?? "—"}</td>
      <td className="px-2 py-2 text-[11px] text-muted-foreground/80">{libName ?? "—"}</td>
      <td className="px-2 py-2 text-right">
        <button onClick={onEdit} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-elevated">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </td>
    </tr>
  );
}

function BooksGridAdmin({ books, setEditing, outIds }: { books: any[]; setEditing: (id: string) => void; outIds: Set<string> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {books.map((b) => {
        const isOut = outIds.has(b.id);
        return (
        <div key={b.id} className="glass-card flex flex-col gap-1.5 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              <span title={isOut ? "Rented / unavailable" : "Available"} className={`inline-block h-1.5 w-1.5 rounded-full ${isOut ? "bg-rose-500" : "bg-emerald-500"}`} />
              {b.shelf_code ?? "—"}
            </span>
            <button
              onClick={() => setEditing(b.id)}
              className="cursor-pointer rounded-md border border-border p-1 text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <Link to="/books/$id" params={{ id: b.id }} className="cursor-pointer">
            <div className="line-clamp-2 text-sm font-semibold hover:text-primary">{b.title}</div>
            {b.title_ml && <div className="line-clamp-1 font-mal text-xs text-accent">{b.title_ml}</div>}
          </Link>
          <div className="line-clamp-1 text-[11px] text-foreground/80">{b.author}</div>
          {b.author_ml && <div className="line-clamp-1 font-mal text-[11px] text-foreground/60">{b.author_ml}</div>}

          <div className="line-clamp-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {b.genre}{b.genre_ml ? <span className="font-mal normal-case"> · {b.genre_ml}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>₹{Number(b.rent_price ?? 10).toFixed(0)}</span>
            {b.language && <span>· {b.language}</span>}
            {b.published_year && <span>· {b.published_year}</span>}
            {b.pages && <span>· {b.pages}p</span>}
            <span className="inline-flex items-center gap-0.5">· <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{displayRating(b).toFixed(1)}</span>
          </div>
          {b.publisher && <div className="line-clamp-1 text-[10px] text-muted-foreground/70">{b.publisher}</div>}
        </div>
        );
      })}
    </div>
  );
}

function EditBookModal({ book, onClose }: { book: any; onClose: () => void }) {
  const update = useUpdateBook();
  const del = useDeleteBook();
  const [title, setTitle] = useState(book.title ?? "");
  const [titleMl, setTitleMl] = useState(book.title_ml ?? "");
  const [author, setAuthor] = useState(book.author ?? "");
  const [authorMl, setAuthorMl] = useState(book.author_ml ?? "");
  
  const [genre, setGenre] = useState(book.genre ?? "");
  const [genreMl, setGenreMl] = useState(book.genre_ml ?? "");
  const [shelf, setShelf] = useState(book.shelf_code ?? "");
  const [publisher, setPublisher] = useState(book.publisher ?? "");
  const [language, setLanguage] = useState(book.language ?? "");
  const [rentPrice, setRentPrice] = useState(String(book.rent_price ?? 10));
  const [pages, setPages] = useState(book.pages != null ? String(book.pages) : "");
  const [year, setYear] = useState(book.published_year != null ? String(book.published_year) : "");
  const [coverUrl, setCoverUrl] = useState(book.cover_url ?? "");
  const [description, setDescription] = useState(book.description ?? "");
  const [availability, setAvailability] = useState<string>(book.availability ?? "available");

  const save = () => {
    update.mutate(
      {
        id: book.id,
        patch: {
          title: title.trim() || book.title,
          title_ml: titleMl.trim() || null,
          author: author.trim() || book.author,
          author_ml: authorMl.trim() || null,
          original_author: null,
          genre: genre.trim() || book.genre,
          genre_ml: genreMl.trim() || null,
          shelf_code: shelf.trim() || null,
          publisher: publisher.trim() || null,
          language: language.trim() || null,
          rent_price: Number(rentPrice) > 0 ? Number(rentPrice) : Number(book.rent_price ?? 10),
          pages: pages.trim() ? Number(pages) : null,
          published_year: year.trim() ? Number(year) : null,
          cover_url: coverUrl.trim() || null,
          description: description.trim() || null,
        },
      },
      { onSuccess: onClose },
    );
  };

  const fld = "w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit book</h2>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Rack #</span><input value={shelf} onChange={(e) => setShelf(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Price (₹)</span><input type="number" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Title (English)</span><input value={title} onChange={(e) => setTitle(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Title (Malayalam)</span><input value={titleMl} onChange={(e) => setTitleMl(e.target.value)} className={`${fld} font-mal`} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Author (English)</span><input value={author} onChange={(e) => setAuthor(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Author (Malayalam)</span><input value={authorMl} onChange={(e) => setAuthorMl(e.target.value)} className={`${fld} font-mal`} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Genre (English)</span><input value={genre} onChange={(e) => setGenre(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Genre (Malayalam)</span><input value={genreMl} onChange={(e) => setGenreMl(e.target.value)} className={`${fld} font-mal`} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Language</span><input value={language} onChange={(e) => setLanguage(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Publisher</span><input value={publisher} onChange={(e) => setPublisher(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Published Year</span><input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Pages</span><input type="number" value={pages} onChange={(e) => setPages(e.target.value)} className={fld} /></label>
          <label className="text-xs sm:col-span-2"><span className="mb-1 block text-muted-foreground">Cover image URL</span><input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className={fld} /></label>
          <label className="text-xs sm:col-span-2"><span className="mb-1 block text-muted-foreground">Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={fld} /></label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => { if (confirm(`Delete "${book.title}"? This cannot be undone.`)) del.mutate(book.id, { onSuccess: onClose }); }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Cancel</button>
            <button
              disabled={update.isPending}
              onClick={save}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddBookModal({ onClose, defaultLibraryId }: { onClose: () => void; defaultLibraryId?: string }) {
  const create = useCreateBook();
  const { selectedId } = useLibrary();
  const { data: libs = [] } = useAdminLibraries();
  const scope = useMyLibraryScope();
  const [title, setTitle] = useState("");
  const [titleMl, setTitleMl] = useState("");
  const [author, setAuthor] = useState("");
  const [authorMl, setAuthorMl] = useState("");
  
  const [genre, setGenre] = useState("");
  const [genreMl, setGenreMl] = useState("");
  const [shelf, setShelf] = useState("");
  const [publisher, setPublisher] = useState("");
  const [language, setLanguage] = useState("");
  const [rentPrice, setRentPrice] = useState("10");
  const [pages, setPages] = useState("");
  const [year, setYear] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const fallbackLib = defaultLibraryId ?? selectedId ?? (scope && scope.length ? scope[0] : "") ?? "";
  const [libraryId, setLibraryId] = useState<string>(fallbackLib);

  const fld = "w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a book</h2>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs sm:col-span-2"><span className="mb-1 block text-muted-foreground">Library</span>
            <select value={libraryId} onChange={(e) => setLibraryId(e.target.value)} className={`${fld} cursor-pointer`}>
              {scope === null && <option value="">— No library (unassigned) —</option>}
              {libs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Rack #</span><input value={shelf} onChange={(e) => setShelf(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Price (₹)</span><input type="number" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Title (English)</span><input value={title} onChange={(e) => setTitle(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Title (Malayalam)</span><input value={titleMl} onChange={(e) => setTitleMl(e.target.value)} className={`${fld} font-mal`} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Author (English)</span><input value={author} onChange={(e) => setAuthor(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Author (Malayalam)</span><input value={authorMl} onChange={(e) => setAuthorMl(e.target.value)} className={`${fld} font-mal`} /></label>
          
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Genre (English)</span><input value={genre} onChange={(e) => setGenre(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Genre (Malayalam)</span><input value={genreMl} onChange={(e) => setGenreMl(e.target.value)} className={`${fld} font-mal`} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Language</span><input value={language} onChange={(e) => setLanguage(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Publisher</span><input value={publisher} onChange={(e) => setPublisher(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Published Year</span><input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={fld} /></label>
          <label className="text-xs"><span className="mb-1 block text-muted-foreground">Pages</span><input type="number" value={pages} onChange={(e) => setPages(e.target.value)} className={fld} /></label>
          <label className="text-xs sm:col-span-2"><span className="mb-1 block text-muted-foreground">Cover image URL</span><input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className={fld} /></label>
          <label className="text-xs sm:col-span-2"><span className="mb-1 block text-muted-foreground">Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={fld} /></label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Cancel</button>
          <button
            disabled={create.isPending || !title.trim() || !author.trim() || !genre.trim()}
            onClick={() => create.mutate(
              {
                title, author, genre,
                title_ml: titleMl, author_ml: authorMl, genre_ml: genreMl,
                shelf_code: shelf, publisher, library_id: libraryId || undefined,
                language, rent_price: Number(rentPrice) > 0 ? Number(rentPrice) : 10,
                pages: pages.trim() ? Number(pages) : null,
                published_year: year.trim() ? Number(year) : null,
                cover_url: coverUrl, description,
              },
              { onSuccess: onClose },
            )}
            className="cursor-pointer rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending ? "Adding…" : "Add book"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ===== IMPORT MODAL =====
function normalizeKey(k: string): string {
  // strip BOM, accents, all non-alphanumerics → lowercase
  return String(k)
    .replace(/^\uFEFF/, "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}
const FIELD_MAP: Record<string, keyof BookImportRow> = {
  // English title
  title: "title", titleen: "title", englishtitle: "title", booktitle: "title",
  bookname: "title", nameen: "title", englishname: "title",
  // Malayalam title
  titleml: "title_ml", malayalamtitle: "title_ml", titlemal: "title_ml",
  mltitle: "title_ml", titlemalayalam: "title_ml", nameml: "title_ml", malayalamname: "title_ml",
  // Author
  author: "author", authoren: "author", englishauthor: "author", writer: "author",
  writeren: "author", authorname: "author",
  // Author Malayalam
  authorml: "author_ml", malayalamauthor: "author_ml", writerml: "author_ml", mlauthor: "author_ml",
  // Genre
  genre: "genre", category: "genre", type: "genre", subject: "genre",
  // Shelf / rack code — only explicit headers, never bare "no"/"number" (those collide with serial numbers)
  shelf: "shelf_code", shelfcode: "shelf_code", shelfno: "shelf_code", shelfnumber: "shelf_code",
  rack: "shelf_code", rackcode: "shelf_code", rackno: "shelf_code", racknumber: "shelf_code",
  bookno: "shelf_code", bookcode: "shelf_code", booknumber: "shelf_code",
  accession: "shelf_code", accessionno: "shelf_code", accessionnumber: "shelf_code",
  acc: "shelf_code", accno: "shelf_code", callno: "shelf_code", callnumber: "shelf_code",
  code: "shelf_code",
  // Publisher
  publisher: "publisher", publication: "publisher", publishers: "publisher",
  // Price
  price: "rent_price", rentprice: "rent_price", rent: "rent_price",
};

function mapRow(raw: Record<string, any>, mapping: Record<string, keyof BookImportRow | "">): BookImportRow | null {
  const mapped: any = {};
  for (const [k, v] of Object.entries(raw)) {
    const target = mapping[k];
    if (target && v != null && String(v).trim() !== "") {
      mapped[target] = target === "shelf_code" ? String(v).trim() : v;
    }
  }
  if (!mapped.title || !mapped.author) return null;
  if (!mapped.genre) mapped.genre = "നോവൽ";
  return mapped as BookImportRow;
}

const IMPORT_FIELDS: { value: keyof BookImportRow | ""; label: string }[] = [
  { value: "", label: "— Ignore —" },
  { value: "title", label: "Title (English)" },
  { value: "title_ml", label: "Title (Malayalam)" },
  { value: "author", label: "Author (English)" },
  { value: "author_ml", label: "Author (Malayalam)" },
  { value: "genre", label: "Genre" },
  { value: "shelf_code", label: "Rack / Shelf code" },
  { value: "publisher", label: "Publisher" },
  { value: "rent_price", label: "Rent price" },
];

function ImportBooksModal({ onClose, defaultLibraryId }: { onClose: () => void; defaultLibraryId?: string }) {
  const importMut = useBulkImportBooks();
  const { selectedId } = useLibrary();
  const { data: libs = [] } = useAdminLibraries();
  const scope = useMyLibraryScope();
  const [rawRecords, setRawRecords] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, keyof BookImportRow | "">>({});
  const [filename, setFilename] = useState<string>("");
  const [mode, setMode] = useState<ImportMode>("append");
  const [libraryId, setLibraryId] = useState<string>(defaultLibraryId ?? selectedId ?? (scope && scope.length ? scope[0] : ""));
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setRawRecords([]);
    setHeaders([]);
    setMapping({});
    try {
      let records: Record<string, any>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        records = parsed.data as Record<string, any>[];
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        records = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
      }
      const hdrs = records[0] ? Object.keys(records[0]) : [];
      const auto: Record<string, keyof BookImportRow | ""> = {};
      for (const h of hdrs) auto[h] = (FIELD_MAP[normalizeKey(h)] ?? "") as keyof BookImportRow | "";
      setHeaders(hdrs);
      setMapping(auto);
      setRawRecords(records);
    } catch (e: any) {
      toast.error(`Couldn't read file: ${e?.message ?? e}`);
    }
  };

  const { rows, skipped } = useMemo(() => {
    if (!rawRecords.length) return { rows: [] as BookImportRow[], skipped: 0 };
    const mapped: BookImportRow[] = [];
    let skip = 0;
    for (const r of rawRecords) {
      const m = mapRow(r, mapping);
      if (m) mapped.push(m); else skip++;
    }
    return { rows: mapped, skipped: skip };
  }, [rawRecords, mapping]);



  const overwriteCount = rows.filter((r) => !!r.shelf_code).length;
  const libName = libs.find((l) => l.id === libraryId)?.name ?? "Unassigned";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Import books from CSV / Excel</h2>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Target library</span>
            <select value={libraryId} onChange={(e) => setLibraryId(e.target.value)} className="w-full cursor-pointer rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
              {scope === null && <option value="">— Unassigned —</option>}
              {libs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Import mode</span>
            <div className="flex gap-1.5 rounded-lg border border-border bg-surface/40 p-1">
              <button
                type="button"
                onClick={() => setMode("append")}
                className={`flex-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium ${mode === "append" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Append
              </button>
              <button
                type="button"
                onClick={() => setMode("upsert")}
                className={`flex-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium ${mode === "upsert" ? "bg-emerald-500 text-emerald-950" : "text-muted-foreground hover:text-foreground"}`}
              >
                Update + add
              </button>
              <button
                type="button"
                onClick={() => setMode("overwrite")}
                className={`flex-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium ${mode === "overwrite" ? "bg-amber-500 text-amber-950" : "text-muted-foreground hover:text-foreground"}`}
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          {mode === "append"
            ? "Append: every row becomes a new book. Existing books are untouched. Use this for a separate CSV of new books only."
            : mode === "upsert"
            ? `Update + add: rows with a rack code that already exists in ${libName} are updated in place (preserves rentals, reviews, waitlist, diary). Rows with new or missing rack codes are inserted.`
            : `Overwrite: existing books in ${libName} with matching rack codes are deleted and re-created. ⚠ This breaks links from past rentals/reviews to those books — use Update + add instead unless you really want fresh ids.`}
        </p>

        <div className="rounded-xl border border-dashed border-border bg-surface/30 p-6 text-center">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm">Drop a .csv, .xlsx, or .xls file — or pick one below.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Choose file
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Recognized columns: <code>title, title_ml, author, author_ml, genre, shelf_code, publisher, rent_price</code>.
            Synonyms like <em>Rack No, Writer, Category</em> also work.
          </p>
        </div>

        {filename && (
          <div className="mt-4 rounded-xl border border-border bg-surface/40 p-3 text-sm">
            <div className="font-medium">{filename}</div>
            {headers.length > 0 && (
              <div className="mt-2 rounded-md border border-border/50 bg-background/40 p-2 text-xs">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Column mapping</div>
                  <button
                    type="button"
                    onClick={() => {
                      const reset: Record<string, keyof BookImportRow | ""> = {};
                      for (const h of headers) reset[h] = (FIELD_MAP[normalizeKey(h)] ?? "") as keyof BookImportRow | "";
                      setMapping(reset);
                    }}
                    className="cursor-pointer rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Auto-detect
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {headers.map((h, i) => (
                    <div key={`${h}-${i}`} className="flex items-center gap-2 rounded-md border border-border/50 bg-surface/40 px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-medium" title={h}>{h || "(blank)"}</span>
                      <span className="text-muted-foreground">→</span>
                      <select
                        value={mapping[h] ?? ""}
                        onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as keyof BookImportRow | "" }))}
                        className="cursor-pointer rounded border border-border bg-background/60 px-1.5 py-0.5 text-[11px]"
                      >
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {!Object.values(mapping).includes("shelf_code") && mode !== "append" && (
                  <div className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                    ⚠ No column is mapped to <code>Rack / Shelf code</code>. {mode === "upsert" ? "Update + add" : "Overwrite"} mode needs this to match existing books.
                  </div>
                )}
                {(!Object.values(mapping).includes("title") || !Object.values(mapping).includes("author")) && (
                  <div className="mt-2 rounded bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
                    ⚠ Map at least one column to <code>Title</code> and one to <code>Author</code>.
                  </div>
                )}
              </div>
            )}


            <div className="text-xs text-muted-foreground">
              {rows.length.toLocaleString()} ready to import{skipped > 0 && ` · ${skipped} skipped (missing title/author)`} · target: <span className="font-semibold text-primary">{libName}</span>
              {mode === "overwrite" && overwriteCount > 0 && ` · will replace up to ${overwriteCount} existing rack codes`}
              {mode === "upsert" && overwriteCount > 0 && ` · ${overwriteCount} rows have a rack code (existing → update, new → insert)`}
            </div>
            {rows.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border/50 text-xs">
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="px-2 py-1.5 text-left">Title</th><th className="px-2 py-1.5 text-left">Author</th><th className="px-2 py-1.5 text-left">Rack</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-border/30">
                        <td className="px-2 py-1">{r.title}</td>
                        <td className="px-2 py-1">{r.author}</td>
                        <td className="px-2 py-1">{r.shelf_code ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 50 && <div className="bg-surface/40 px-2 py-1 text-[10px] text-muted-foreground">…and {rows.length - 50} more</div>}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Cancel</button>
          <button
            disabled={importMut.isPending || rows.length === 0}
            onClick={() => {
              if (mode === "overwrite" && !confirm(`Overwrite books with matching rack codes in ${libName}? This DELETES and re-creates them, breaking links from past rentals/reviews. Continue?`)) return;
              importMut.mutate({ rows, libraryId: libraryId || null, mode }, { onSuccess: onClose });
            }}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold shadow-lg disabled:opacity-50 ${mode === "overwrite" ? "bg-amber-500 text-amber-950 shadow-amber-500/20 hover:opacity-90" : mode === "upsert" ? "bg-emerald-500 text-emerald-950 shadow-emerald-500/20 hover:opacity-90" : "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-primary/20 hover:opacity-90"}`}
          >
            {importMut.isPending ? "Importing…" : `${mode === "overwrite" ? "Overwrite" : mode === "upsert" ? "Update + add" : "Import"} ${rows.length.toLocaleString()} books`}
          </button>
        </div>

      </div>
    </div>
  );
}

// ===== RENTALS =====
type RentalSort = "rented_at" | "due_at" | "returned_at" | "member" | "book" | "price_paid" | "fine_amount" | "tracking_status";
function RentalsTab() {
  const { data: rentals = [], isLoading } = useAllRentals();
  const update = useUpdateRentalStatus();
  const markReturned = useMarkReturned();
  const [filter, setFilter] = useState<"active" | "returned" | "all">("active");
  const [viewingUser, setViewingUser] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<RentalSort>("rented_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const shown = useMemo(() => {
    const filtered = (rentals as any[]).filter((r) => {
      if (filter === "active") return !r.returned_at;
      if (filter === "returned") return !!r.returned_at;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r: any): any => {
      if (sortKey === "member") return r.member_name ?? "";
      if (sortKey === "book") return r.books?.title ?? "";
      if (sortKey === "fine_amount") return Number(r.fine_amount ?? 0);
      if (sortKey === "price_paid") return Number(r.price_paid ?? 0);
      if (sortKey === "tracking_status") return r.tracking_status ?? "";
      const v = r[sortKey]; return v ? new Date(v).getTime() : 0;
    };
    return [...filtered].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rentals, filter, sortKey, sortDir]);

  const exportColumns = [
    { header: "Member", get: (r: any) => r.member_name ?? r.user_id },
    { header: "Phone", get: (r: any) => r.member_phone ?? "" },
    { header: "Book", get: (r: any) => r.books?.title ?? "" },
    { header: "Author", get: (r: any) => r.books?.author ?? "" },
    { header: "Rack", get: (r: any) => r.books?.shelf_code ?? "" },
    { header: "Rented", get: (r: any) => new Date(r.rented_at).toLocaleString() },
    { header: "Due", get: (r: any) => new Date(r.due_at).toLocaleString() },
    { header: "Returned", get: (r: any) => r.returned_at ? new Date(r.returned_at).toLocaleString() : "" },
    { header: "Price ₹", get: (r: any) => Number(r.price_paid ?? 0).toFixed(0) },
    { header: "Fine ₹", get: (r: any) => Number(r.fine_amount ?? 0).toFixed(0) },
    { header: "Status", get: (r: any) => r.tracking_status ?? "" },
  ];

  const STATUSES = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

  const SortableTh = ({ k, children, className = "" }: { k: RentalSort; children: any; className?: string }) => {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={`px-2 py-2.5 text-left ${className}`}>
        <button onClick={() => { if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } }}
          className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground">
          {children} <Icon className="h-3 w-3" />
        </button>
      </th>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 rounded-lg border border-border bg-surface/40 p-1">
          {(["active", "returned", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv({ filename: `rentals-${Date.now()}.csv`, columns: exportColumns, rows: shown })}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-xs hover:bg-surface-elevated"
          ><FileDown className="h-3.5 w-3.5" /> CSV</button>
          <button
            onClick={() => exportPdf({ filename: `rentals-${Date.now()}.pdf`, title: "Rentals", subtitle: `Filter: ${filter} · ${shown.length} rows`, columns: exportColumns, rows: shown })}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-xs hover:bg-surface-elevated"
          ><FileText className="h-3.5 w-3.5" /> PDF</button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-surface/60" />)}</div>
      ) : shown.length === 0 ? (
        <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No rentals to show.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <SortableTh k="member">Member</SortableTh>
                <SortableTh k="book">Book</SortableTh>
                <SortableTh k="rented_at">Rented</SortableTh>
                <SortableTh k="due_at">Due</SortableTh>
                <SortableTh k="returned_at">Returned</SortableTh>
                <SortableTh k="price_paid">Price ₹</SortableTh>
                <SortableTh k="fine_amount">Fine ₹</SortableTh>
                <SortableTh k="tracking_status">Status</SortableTh>
                <th className="px-2 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r: any) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-surface/40">
                  <td className="px-2 py-2">
                    <button onClick={() => setViewingUser(r.user_id)} className="cursor-pointer text-left font-semibold hover:text-primary">
                      {r.member_name ?? "—"}
                    </button>
                    {r.member_phone && <div className="text-[10px] text-muted-foreground">📞 {r.member_phone}</div>}
                  </td>
                  <td className="px-2 py-2">
                    <Link to="/books/$id" params={{ id: r.books?.id ?? "" }} className="cursor-pointer font-medium hover:text-primary">{r.books?.title ?? "Book"}</Link>
                    <div className="text-[10px] text-muted-foreground">by {r.books?.author ?? "—"} · Rack {r.books?.shelf_code ?? "—"}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{new Date(r.rented_at).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{new Date(r.due_at).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">{r.returned_at ? new Date(r.returned_at).toLocaleDateString() : "—"}</td>
                  <td className="px-2 py-2 text-xs">₹{Number(r.price_paid ?? 0).toFixed(0)}</td>
                  <td className="px-2 py-2 text-xs">{Number(r.fine_amount ?? 0) > 0 ? <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-300">₹{Number(r.fine_amount).toFixed(0)}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-2 py-2">
                    {!r.returned_at ? (
                      <select
                        value={r.tracking_status ?? "confirmed"}
                        onChange={(e) => update.mutate({ id: r.id, status: e.target.value })}
                        className="cursor-pointer rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px]"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                      </select>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> returned
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {!r.returned_at && (
                      <button
                        onClick={() => { if (confirm(`Mark "${r.books?.title}" as returned? Late fine (₹1/day after 20d) is auto-deducted.`)) markReturned.mutate(r.id); }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-emerald-950 hover:opacity-90"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Return
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingUser && <UserDashboardModal userId={viewingUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
}

// ===== WAITLIST =====
function WaitlistTab() {
  const { data: list = [], isLoading } = useAllWaitlist();
  const remove = useRemoveWaitlistEntry();
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  // Pull pending (reserved-but-unclaimed) rentals so staff can see who is in their 24-hour claim window.
  const { data: reservations = [] } = useQuery({
    queryKey: ["admin-reservations"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("id, user_id, book_id, reserved_until, created_at, books(id, title, author)")
        .eq("tracking_status", "reserved")
        .is("returned_at", null)
        .order("reserved_until", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch reader profiles (display_name + email) for every user_id in waitlist + reservations.
  const userIds = useMemo(() => {
    const s = new Set<string>();
    for (const w of list as any[]) if (w.user_id) s.add(w.user_id);
    for (const r of reservations as any[]) if (r.user_id) s.add(r.user_id);
    return [...s];
  }, [list, reservations]);

  const { data: profileMap = {} } = useQuery({
    queryKey: ["admin-waitlist-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      if (error) throw error;
      const map: Record<string, { display_name: string | null }> = {};
      for (const p of data ?? []) map[p.id] = { display_name: (p as any).display_name };
      return map;
    },
  });

  // Group queue entries by book so staff can see "this book has 3 readers waiting, in this order".
  const grouped = useMemo(() => {
    const m = new Map<string, { book: any; rows: any[] }>();
    for (const w of list as any[]) {
      const id = w.books?.id ?? "unknown";
      const g = m.get(id) ?? { book: w.books, rows: [] };
      g.rows.push(w);
      m.set(id, g);
    }
    // rows already arrive sorted by created_at ASC, so queue order is preserved.
    return [...m.values()].sort((a, b) => b.rows.length - a.rows.length);
  }, [list]);

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />)}</div>;

  const totalQueued = (list as any[]).length;
  const totalReserved = (reservations as any[]).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Books with a queue" value={grouped.length} />
        <Stat label="Total readers waiting" value={totalQueued} />
        <Stat label="Pending 24h reservations" value={totalReserved} />
      </div>

      {totalReserved > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Clock className="h-4 w-4" /> Pending reservations · auto-expire if not claimed
          </h2>
          <div className="space-y-2">
            {(reservations as any[]).map((r) => {
              const left = r.reserved_until ? Math.max(0, Math.round((new Date(r.reserved_until).getTime() - Date.now()) / 3_600_000)) : null;
              return (
                <div key={r.id} className="glass-card flex items-center justify-between gap-3 rounded-xl p-3">
                  <div className="min-w-0">
                    <Link to="/books/$id" params={{ id: r.books?.id ?? "" }} className="cursor-pointer text-sm font-semibold hover:text-primary">
                      {r.books?.title ?? "Book"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Reader: <span className="font-medium text-foreground/80">{profileMap[r.user_id]?.display_name ?? "Unknown"}</span> · Offered {new Date(r.created_at).toLocaleString()} · {left !== null ? `${left}h left` : "no expiry"}
                    </p>
                    <button onClick={() => setViewingUser(r.user_id)} className="cursor-pointer text-[11px] text-primary hover:underline">View reader →</button>
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">Awaiting claim</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Clock className="h-4 w-4" /> Waiting lists by book
        </h2>
        {grouped.length === 0 ? (
          <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No waitlist entries.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ book, rows }) => (
              <div key={book?.id ?? "u"} className="glass-card rounded-xl p-3">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <Link to="/books/$id" params={{ id: book?.id ?? "" }} className="cursor-pointer text-sm font-semibold hover:text-primary">
                    {book?.title ?? "Book"}
                  </Link>
                  <span className="text-xs text-muted-foreground">{rows.length} in queue</span>
                </div>
                <ol className="space-y-1.5">
                  {rows.map((w: any, i: number) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface/40 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">{i + 1}</span>
                        <button onClick={() => setViewingUser(w.user_id)} className="cursor-pointer text-left text-primary hover:underline">
                          {profileMap[w.user_id]?.display_name ?? "Reader"} <span className="text-muted-foreground">· joined {new Date(w.created_at).toLocaleDateString()}</span>
                        </button>
                      </div>
                      <button
                        onClick={() => remove.mutate(w.id)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-rose-500/40 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      {viewingUser && <UserDashboardModal userId={viewingUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
}

// ===== SUGGESTIONS =====
function SuggestionsTab() {
  const { data: list = [], isLoading } = useAllSuggestions();
  const decide = useDecideSuggestion();
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  const userIds = Array.from(new Set((list as any[]).map((s) => s.user_id).filter(Boolean)));
  const { data: readers = {} } = useQuery({
    queryKey: ["suggestion-readers", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: profs }, { data: rents }] = await Promise.all([
        supabase.from("profiles").select("id, display_name").in("id", userIds),
        supabase.from("rentals").select("user_id").in("user_id", userIds).is("returned_at", null),
      ]);
      const counts: Record<string, number> = {};
      (rents ?? []).forEach((r: any) => { counts[r.user_id] = (counts[r.user_id] ?? 0) + 1; });
      const map: Record<string, { name: string; active: number }> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = { name: p.display_name ?? "Reader", active: counts[p.id] ?? 0 }; });
      return map;
    },
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />)}</div>;
  if (list.length === 0) return <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No suggestions yet.</p>;

  const STATUS: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300",
    approved: "bg-emerald-500/15 text-emerald-300",
    rejected: "bg-rose-500/15 text-rose-300",
    available: "bg-primary/15 text-primary",
  };

  const exportColumns = [
    { header: "Title", get: (r: any) => r.title ?? "" },
    { header: "Author", get: (r: any) => r.author ?? "" },
    { header: "Status", get: (r: any) => r.status ?? "pending" },
    { header: "Note", get: (r: any) => r.note ?? "" },
    { header: "Decision note", get: (r: any) => r.decision_note ?? "" },
    { header: "Created", get: (r: any) => new Date(r.created_at).toLocaleString() },
  ];

  return (
    <div className="space-y-2">
      <div className="mb-2 flex justify-end gap-2">
        <button
          onClick={() => exportCsv({ filename: `suggestions-${Date.now()}.csv`, columns: exportColumns, rows: list as any[] })}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-xs hover:bg-surface-elevated"
        ><FileDown className="h-3.5 w-3.5" /> CSV</button>
        <button
          onClick={() => exportPdf({ filename: `suggestions-${Date.now()}.pdf`, title: "Book suggestions", subtitle: `${(list as any[]).length} rows`, columns: exportColumns, rows: list as any[] })}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-xs hover:bg-surface-elevated"
        ><FileText className="h-3.5 w-3.5" /> PDF</button>
      </div>
      {(list as any[]).map((s) => (
        <div key={s.id} className="glass-card rounded-xl p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{s.title}</h3>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS[s.status ?? "pending"] ?? STATUS.pending}`}>
                {s.status ?? "pending"}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {s.author && <p className="text-xs text-muted-foreground">by {s.author}</p>}
          {s.note && <p className="mt-1 text-sm text-foreground/80">{s.note}</p>}
          {s.decision_note && (
            <p className="mt-1 rounded-md bg-surface/60 px-2 py-1 text-xs text-muted-foreground">Librarian note: {s.decision_note}</p>
          )}
          {(readers as any)[s.user_id] && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Reader: <span className="text-foreground/80">{(readers as any)[s.user_id].name}</span>
              {" · "}{(readers as any)[s.user_id].active} active rental{(readers as any)[s.user_id].active === 1 ? "" : "s"}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={() => setViewingUser(s.user_id)} className="cursor-pointer text-[11px] text-primary hover:underline">View reader →</button>
            {(s.status ?? "pending") === "pending" && (
              <>
                <button
                  onClick={() => decide.mutate({ id: s.id, decision: "approved" })}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                >
                  <CheckCircle2 className="h-3 w-3" /> Approve
                </button>
                <button
                  onClick={() => decide.mutate({ id: s.id, decision: "available" })}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-primary/40 px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
                >
                  <LibIcon className="h-3 w-3" /> Mark available
                </button>
                <button
                  onClick={() => { if (confirm("Reject this suggestion?")) decide.mutate({ id: s.id, decision: "rejected" }); }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                >
                  <X className="h-3 w-3" /> Reject
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {viewingUser && <UserDashboardModal userId={viewingUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
}

// ===== LIBRARIES (admin) =====
function LibrariesTab() {
  const { data: libs = [], isLoading } = useAdminLibraries();
  const { data: counts = {} } = useLibraryBookCounts();
  const create = useCreateLibrary();
  const update = useUpdateLibrary();
  const del = useDeleteLibrary();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [nameMl, setNameMl] = useState("");
  const [location, setLocation] = useState("");

  const totalBooks = Object.values(counts as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{libs.length} branches · {totalBooks.toLocaleString()} books total{(counts.__unassigned ?? 0) > 0 && ` · ${(counts.__unassigned as number).toLocaleString()} unassigned`}</p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add library
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />)}</div>
      ) : (
        <div className="space-y-2">
          {libs.map((lib) => (
            <div key={lib.id} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-semibold">{lib.name}</h3>
                  {lib.is_default && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">Default</span>}
                </div>
                {lib.name_ml && <p className="font-mal text-xs text-accent">{lib.name_ml}</p>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">slug: <code>{lib.slug}</code>{lib.location && ` · ${lib.location}`} · <span className="font-semibold text-primary">{(counts[lib.id] ?? 0).toLocaleString()} books</span></p>
              </div>
              <div className="flex gap-2">
                {!lib.is_default && (
                  <button
                    onClick={() => update.mutate({ id: lib.id, patch: { is_default: true } })}
                    className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-elevated"
                  >
                    Make default
                  </button>
                )}
                <button
                  onClick={() => { if (confirm(`Remove "${lib.name}"?`)) del.mutate(lib.id); }}
                  className="cursor-pointer rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={() => setAdding(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass-card w-full max-w-md rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Add library</h2>
              <button onClick={() => setAdding(false)} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (English)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
              <input value={nameMl} onChange={(e) => setNameMl(e.target.value)} placeholder="Name (Malayalam)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mal" />
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (e.g. naduvil)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Cancel</button>
              <button
                disabled={create.isPending || !name.trim() || !slug.trim()}
                onClick={() => create.mutate(
                  { name, slug: slug.trim().toLowerCase(), name_ml: nameMl, location },
                  { onSuccess: () => { setAdding(false); setName(""); setSlug(""); setNameMl(""); setLocation(""); } },
                )}
                className="cursor-pointer rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {create.isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== ROLE MANAGEMENT (admin) =====
function StaffRolesTab() {
  const { data: list = [], isLoading } = useStaffRoles();
  const { data: libraries = [] } = useAdminLibraries();
  const setRole = useSetUserRole();
  const grantForLib = useGrantLibrarianForLibrary();
  const revokeForLib = useRevokeLibrarianForLibrary();
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<"admin" | "librarian">("librarian");
  const [libraryId, setLibraryId] = useState<string>("");

  const submit = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;
    if (role === "librarian") {
      if (!libraryId) {
        toast.error("Pick a library for the Library Admin");
        return;
      }
      grantForLib.mutate({ email: cleanEmail, libraryId }, { onSuccess: () => { setEmail(""); } });
    } else {
      setRole.mutate({ email: cleanEmail, role: "admin", enabled: true }, { onSuccess: () => setEmail("") });
    }
  };

  return (
    <div>
      <div className="glass-card mb-4 rounded-xl p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-4 w-4 text-accent" /> Grant staff access by email
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          The user must have signed in at least once. <span className="font-semibold text-foreground">Admins</span> manage every library and grant staff. <span className="font-semibold text-foreground">Library Admins</span> are scoped to a single library — pick which one when granting access. Only Admins can grant either role.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 min-w-[200px] rounded-lg border border-border bg-background/50 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRoleValue(e.target.value as "admin" | "librarian")}
            className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm"
          >
            <option value="librarian">Library Admin</option>
            <option value="admin">Admin</option>
          </select>
          {role === "librarian" && (
            <select
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
              className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm"
            >
              <option value="">Select library…</option>
              {libraries.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={setRole.isPending || grantForLib.isPending || !email.trim() || (role === "librarian" && !libraryId)}
            onClick={submit}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Grant
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />)}</div>
      ) : list.length === 0 ? (
        <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No staff roles granted yet.</p>
      ) : (
        <div className="space-y-2">
          {list.map((l) => {
            const labelFor = (r: string) => (r === "admin" ? "Admin" : "Library Admin");
            const isLibrarian = l.roles.includes("librarian");
            const isAdminRole = l.roles.includes("admin");
            // Library scopes attached to this librarian (filtering nulls = global)
            const scopedLibs = l.libraries.filter((lib) => lib.id);
            // Libraries this user is NOT yet a librarian for — candidates to add
            const remaining = libraries.filter((lib) => !scopedLibs.some((s) => s.id === lib.id));
            return (
              <div key={l.user_id} className="glass-card flex flex-col gap-3 rounded-xl p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{l.display_name ?? l.email}</div>
                    <div className="text-xs text-muted-foreground">{l.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {l.roles.map((r) => (
                        <span key={r} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${r === "admin" ? "bg-amber-500/20 text-amber-300" : "bg-primary/15 text-primary"}`}>{labelFor(r)}</span>
                      ))}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground/70">First granted {new Date(l.granted_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isAdminRole && (
                      <button
                        onClick={() => {
                          if (confirm(`Revoke Admin access for ${l.email}?`)) {
                            setRole.mutate({ email: l.email, role: "admin", enabled: false });
                          }
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3 w-3" /> Revoke Admin
                      </button>
                    )}
                    {!isAdminRole && (
                      <button
                        onClick={() => setRole.mutate({ email: l.email, role: "admin", enabled: true })}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-surface-elevated"
                      >
                        <Plus className="h-3 w-3" /> Grant Admin
                      </button>
                    )}
                  </div>
                </div>

                {isLibrarian && (
                  <div className="rounded-lg border border-border/60 bg-surface/30 p-3">
                    <div className="mb-2 text-xs font-semibold text-muted-foreground">Library Admin scopes</div>
                    {scopedLibs.length === 0 ? (
                      <p className="mb-2 text-xs text-amber-300">No library assigned — this librarian cannot access any library's tools.</p>
                    ) : (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {scopedLibs.map((lib) => (
                          <span key={lib.id!} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-xs">
                            {lib.name ?? "Library"}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Remove ${l.email} from ${lib.name ?? "this library"}?`)) {
                                  revokeForLib.mutate({ email: l.email, libraryId: lib.id! });
                                }
                              }}
                              className="cursor-pointer text-rose-300 hover:text-rose-200"
                              aria-label="Remove from library"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {remaining.length > 0 && (
                      <AddLibraryScope
                        email={l.email}
                        libraries={remaining.map((lib) => ({ id: lib.id, name: lib.name }))}
                        onAdd={(libId) => grantForLib.mutate({ email: l.email, libraryId: libId })}
                      />
                    )}
                  </div>
                )}

                {!isLibrarian && (
                  <AddLibraryScope
                    email={l.email}
                    libraries={libraries.map((lib) => ({ id: lib.id, name: lib.name }))}
                    onAdd={(libId) => grantForLib.mutate({ email: l.email, libraryId: libId })}
                    label="Grant Library Admin for"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddLibraryScope({
  email: _email,
  libraries,
  onAdd,
  label = "Add another library",
}: {
  email: string;
  libraries: { id: string; name: string }[];
  onAdd: (libraryId: string) => void;
  label?: string;
}) {
  const [pick, setPick] = useState("");
  if (libraries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <select
        value={pick}
        onChange={(e) => setPick(e.target.value)}
        className="rounded-lg border border-border bg-background/50 px-2 py-1 text-xs"
      >
        <option value="">Select library…</option>
        {libraries.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={!pick}
        onClick={() => { if (pick) { onAdd(pick); setPick(""); } }}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-elevated disabled:opacity-50"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}

// ===== USER DASHBOARD MODAL (staff) =====
function UserDashboardModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data, isLoading } = useStaffUserSummary(userId);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Reader dashboard</h2>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {isLoading || !data ? (
          <div className="h-40 animate-pulse rounded-xl bg-surface/60" />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface/40 p-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-xl font-bold text-white">
                {(data.profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{data.profile?.display_name ?? "Reader"}</div>
                <div className="text-xs text-muted-foreground">{data.email}</div>
                {data.profile?.phone && <div className="text-xs text-muted-foreground">📞 {data.profile.phone}</div>}
                {data.profile?.address && <div className="text-xs text-muted-foreground">📍 {data.profile.address}</div>}
              </div>
              <div className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300">
                Wallet ₹{Number(data.profile?.wallet_balance ?? 0).toFixed(0)}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Active rentals" value={(data.active_rentals ?? []).length} />
              <Stat label="Past rentals" value={data.past_rentals_count ?? 0} />
              <Stat label="Reviews" value={data.reviews_count ?? 0} />
              <Stat label="Diary entries" value={data.diary_count ?? 0} />
            </div>

            <h3 className="mb-2 text-sm font-semibold">Active rentals</h3>
            {(data.active_rentals ?? []).length === 0 ? (
              <p className="rounded-lg bg-surface/40 p-3 text-xs text-muted-foreground">None right now.</p>
            ) : (
              <div className="space-y-2">
                {(data.active_rentals as any[]).map((r) => (
                  <div key={r.id} className="rounded-lg border border-border/60 bg-surface/30 p-2.5 text-xs">
                    <div className="font-medium">{r.book?.title ?? "Book"}</div>
                    <div className="text-muted-foreground">Status: {r.tracking_status} · Due {new Date(r.due_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}

            {(data.waitlist ?? []).length > 0 && (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold">On waitlist</h3>
                <div className="space-y-2">
                  {(data.waitlist as any[]).map((w) => (
                    <div key={w.id} className="rounded-lg border border-border/60 bg-surface/30 p-2.5 text-xs">
                      <div className="font-medium">{w.book?.title ?? "Book"}</div>
                      <div className="text-muted-foreground">Joined {new Date(w.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="mt-5 flex justify-end">
              <Link
                to="/u/$id"
                params={{ id: userId }}
                onClick={onClose}
                className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated"
              >
                Open public profile →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

// ===== USERS (admin) =====
function UsersTab() {
  const { data: users = [], isLoading } = useAdminUsers();
  const [viewingUser, setViewingUser] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return users;
    const needle = q.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(needle) ||
        (u.display_name ?? "").toLowerCase().includes(needle),
    );
  }, [users, q]);

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-surface/60" />)}</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-border bg-surface/50 px-4 py-2.5">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">{users.length.toLocaleString()} total members</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">Member</th>
              <th className="px-3 py-2.5 text-left">Email</th>
              <th className="px-3 py-2.5 text-left">Roles</th>
              <th className="px-3 py-2.5 text-left">Wallet</th>
              <th className="px-3 py-2.5 text-left">Active</th>
              <th className="px-3 py-2.5 text-left">Total rentals</th>
              <th className="px-3 py-2.5 text-left">Joined</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id} className="border-t border-border/40 hover:bg-surface/40">
                <td className="px-3 py-2 font-medium">{u.display_name ?? u.email.split("@")[0]}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 ? (
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">reader</span>
                    ) : (
                      u.roles.map((r) => (
                        <span key={r} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${r === "admin" ? "bg-amber-500/20 text-amber-300" : "bg-primary/15 text-primary"}`}>{r}</span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">₹{Number(u.wallet_balance).toFixed(0)}</td>
                <td className="px-3 py-2 text-xs">
                  {Number(u.active_rentals) > 0 ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">{u.active_rentals}</span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.total_rentals}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setViewingUser(u.user_id)}
                    className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-elevated"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewingUser && <UserDashboardModal userId={viewingUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
}

// ===== ACTIVITY LOG (admin) =====
const ACTION_STYLE: Record<string, { label: string; cls: string }> = {
  rental_created: { label: "Rented", cls: "bg-emerald-500/15 text-emerald-300" },
  rental_returned: { label: "Returned", cls: "bg-blue-500/15 text-blue-300" },
  rental_status: { label: "Tracking", cls: "bg-slate-500/15 text-slate-300" },
  fine_charged: { label: "Fine", cls: "bg-rose-500/15 text-rose-300" },
  suggestion_decided: { label: "Suggestion", cls: "bg-accent/15 text-accent" },
  waitlist_joined: { label: "Waitlisted", cls: "bg-amber-500/15 text-amber-300" },
  waitlist_cancelled: { label: "Wait cancel", cls: "bg-rose-500/15 text-rose-300" },
  waitlist_assigned: { label: "Wait → rented", cls: "bg-violet-500/15 text-violet-300" },
  role_granted: { label: "Role +", cls: "bg-primary/15 text-primary" },
  role_revoked: { label: "Role −", cls: "bg-rose-500/15 text-rose-300" },
  book_created: { label: "Book +", cls: "bg-emerald-500/15 text-emerald-300" },
  book_updated: { label: "Book ✎", cls: "bg-slate-500/15 text-slate-300" },
  book_deleted: { label: "Book −", cls: "bg-rose-500/15 text-rose-300" },
};

function ActivityLogTab() {
  const { data: log = [], isLoading } = useTransactionLog(300);
  const [filter, setFilter] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const ACTIONS = ["all", ...Object.keys(ACTION_STYLE)];
  const filtered = filter === "all" ? log : log.filter((l) => l.action === filter);
  const shown = [...filtered].sort((a, b) => (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * (sortDir === "asc" ? 1 : -1));

  const amount = (row: any) => {
    if (row.action === "fine_charged") return `-₹${row.metadata?.fine ?? 0}`;
    if (row.action === "rental_created") return `₹${row.metadata?.price_paid ?? ""}`;
    return "";
  };

  const exportColumns = [
    { header: "When", get: (r: any) => new Date(r.created_at).toLocaleString() },
    { header: "Action", get: (r: any) => ACTION_STYLE[r.action]?.label ?? r.action },
    { header: "User", get: (r: any) => r.subject_user_name ?? r.actor_name ?? "system" },
    { header: "Book", get: (r: any) => r.book_title ?? "" },
    { header: "Amount", get: (r: any) => amount(r) },
    { header: "Details", get: (r: any) => r.metadata ? Object.entries(r.metadata).map(([k, v]) => `${k}: ${v}`).join("; ") : "" },
  ];

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-surface/60" />)}</div>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface/40 p-1.5">
          {ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setFilter(a)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-medium ${filter === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {a === "all" ? "All" : ACTION_STYLE[a]?.label ?? a}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv({ filename: `activity-${Date.now()}.csv`, columns: exportColumns, rows: shown })} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-xs hover:bg-surface-elevated"><FileDown className="h-3.5 w-3.5" /> CSV</button>
          <button onClick={() => exportPdf({ filename: `activity-${Date.now()}.pdf`, title: "Activity log", subtitle: `${shown.length} rows · filter: ${filter}`, columns: exportColumns, rows: shown })} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5 text-xs hover:bg-surface-elevated"><FileText className="h-3.5 w-3.5" /> PDF</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">
                  <button onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")} className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground">
                    When {sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left">Action</th>
                <th className="px-3 py-2.5 text-left">User</th>
                <th className="px-3 py-2.5 text-left">Book</th>
                <th className="px-3 py-2.5 text-left">Amount</th>
                <th className="px-3 py-2.5 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const style = ACTION_STYLE[row.action] ?? { label: row.action, cls: "bg-surface text-muted-foreground" };
                const dt = new Date(row.created_at);
                const amt = amount(row);
                return (
                  <tr key={row.id} className="border-t border-border/40 hover:bg-surface/40">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {dt.toLocaleDateString()} <span className="text-foreground/60">{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.cls}`}>{style.label}</span></td>
                    <td className="px-3 py-2 text-xs font-medium">{row.subject_user_name ?? row.actor_name ?? "system"}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.book_id ? (
                        <Link to="/books/$id" params={{ id: row.book_id }} className="cursor-pointer hover:text-primary">{row.book_title ?? "Book"}</Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-xs font-semibold ${amt.startsWith("-") ? "text-rose-300" : "text-foreground/80"}`}>{amt || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {row.metadata && Object.keys(row.metadata).length > 0
                        ? Object.entries(row.metadata).filter(([k]) => k !== "fine" && k !== "price_paid").map(([k, v]) => `${k}: ${String(v)}`).join(" · ")
                        : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== REALTIME STAFF TOASTS =====
function RealtimeStaffToasts({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase
      .channel("staff-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transaction_log" }, (payload) => {
        const row = payload.new as any;
        const style = ACTION_STYLE[row.action];
        toast(`${style?.label ?? row.action} · ${row.subject_user_name ?? row.actor_name ?? ""}`, {
          description: row.book_title ?? undefined,
        });
        qc.invalidateQueries({ queryKey: ["admin-transaction-log"] });
        qc.invalidateQueries({ queryKey: ["admin-rentals"] });
        qc.invalidateQueries({ queryKey: ["admin-waitlist"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [enabled, qc]);
  return null;
}

// ===== ADD MEMBER DIALOG =====
function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("librarian_add_member", {
      _email: email.trim(),
      _display_name: displayName.trim() || undefined,
      _phone: phone.trim() || undefined,
      _address: address.trim() || undefined,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = data as any;
    if (!r?.ok) { toast.error(r?.error ?? "Could not add member"); return; }
    toast.success("Member added");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-card w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Add member</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">The person must sign in once with this email before you can attach them.</p>
        <div className="space-y-3">
          <input type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          <input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
          <textarea placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={busy || !email.trim()} className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? "Adding…" : "Add member"}
          </button>
        </div>
      </div>
    </div>
  );
}
