import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/lib/auth";
import {
  useIsStaff, useIsAdmin, useMyRoles, useAllRentals, useUpdateRentalStatus, useMarkReturned,
  useAllWaitlist, useRemoveWaitlistEntry, useAllSuggestions,
  useUpdateBook, useDeleteBook, useCreateBook,
  useAdminLibraries, useCreateLibrary, useUpdateLibrary, useDeleteLibrary,
  useStaffRoles, useSetUserRole,
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
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Shield, Library as LibIcon, Package, Clock, Lightbulb,
  Search as SearchIcon, Trash2, CheckCircle2, Plus, Pencil, X, Save,
  Upload, Grid3x3, List as ListIcon, Building2, Users, Mail, Star, Activity,
} from "lucide-react";

type Tab = "books" | "rentals" | "waitlist" | "suggestions" | "libraries" | "roles" | "users" | "activity";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin · Bookary" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  const { data: roles = [], isLoading: rolesLoading } = useMyRoles();
  const isStaff = useIsStaff();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("books");

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
    { id: "books", label: "Books", icon: LibIcon },
    { id: "rentals", label: "Rentals", icon: Package },
    { id: "waitlist", label: "Waitlist", icon: Clock },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb },
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
          <h1 className="text-2xl font-bold">Library admin</h1>
          <p className="text-xs text-muted-foreground">
            Role: <span className="font-semibold text-accent">{roles.join(" · ") || "staff"}</span>
          </p>
        </div>
      </div>

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

      {tab === "books" && <BooksTab />}
      {tab === "rentals" && <RentalsTab />}
      {tab === "waitlist" && <WaitlistTab />}
      {tab === "suggestions" && <SuggestionsTab />}
      {tab === "libraries" && isAdmin && <LibrariesTab />}
      {tab === "users" && isAdmin && <UsersTab />}
      {tab === "roles" && isAdmin && <StaffRolesTab />}
      {tab === "activity" && isAdmin && <ActivityLogTab />}
      <RealtimeStaffToasts enabled={isStaff} />
    </AppLayout>
  );
}

// ===== BOOKS =====
type BooksView = "grid" | "table";

function BooksTab() {
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { data: libs = [] } = useAdminLibraries();
  const [q, setQ] = useState("");
  const [view, setView] = useState<BooksView>("table");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [libFilter, setLibFilter] = useState<string>("all"); // "all" | lib.id | "__unassigned"

  const rackCompare = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  };

  const filtered = useMemo(() => {
    let pool = books as any[];
    if (libFilter === "__unassigned") pool = pool.filter((b) => !b.library_id);
    else if (libFilter !== "all") pool = pool.filter((b) => b.library_id === libFilter);

    if (q.trim()) {
      const needle = q.toLowerCase();
      pool = pool.filter(
        (b) =>
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle) ||
          (b.shelf_code ?? "").toLowerCase().includes(needle) ||
          (b.title_ml ?? "").includes(q) ||
          (b.author_ml ?? "").includes(q),
      );
    }
    pool = [...pool].sort((a, b) => rackCompare(a.shelf_code, b.shelf_code));
    return pool.slice(0, 500);
  }, [books, q, libFilter]);

  const totalForScope = useMemo(() => {
    if (libFilter === "all") return books.length;
    if (libFilter === "__unassigned") return (books as any[]).filter((b) => !b.library_id).length;
    return (books as any[]).filter((b) => b.library_id === libFilter).length;
  }, [books, libFilter]);

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
          <option value="__unassigned">Unassigned</option>
        </select>
        <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-border bg-surface/50 px-4 py-2.5">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title / author / rack…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
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
            Showing {filtered.length.toLocaleString()} of {totalForScope.toLocaleString()} books{q && ` matching "${q}"`} · sorted by rack code.
          </p>
          {view === "table" ? (
            <BooksTable books={filtered} editing={editing} setEditing={setEditing} />
          ) : (
            <BooksGridAdmin books={filtered} setEditing={setEditing} />
          )}
        </>
      )}

      {adding && <AddBookModal onClose={() => setAdding(false)} defaultLibraryId={libFilter !== "all" && libFilter !== "__unassigned" ? libFilter : undefined} />}
      {importing && <ImportBooksModal onClose={() => setImporting(false)} defaultLibraryId={libFilter !== "all" && libFilter !== "__unassigned" ? libFilter : undefined} />}
      {editing && view === "grid" && (
        <EditBookModal
          book={books.find((b) => b.id === editing)!}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BooksTable({ books, editing, setEditing }: { books: any[]; editing: string | null; setEditing: (id: string | null) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-2 py-2.5 text-left w-20">Rack</th>
            <th className="px-2 py-2.5 text-left">Title</th>
            <th className="px-2 py-2.5 text-left font-mal">Title (ml)</th>
            <th className="px-2 py-2.5 text-left">Author</th>
            <th className="px-2 py-2.5 text-left">Genre</th>
            <th className="px-2 py-2.5 text-left w-24">Rent ₹</th>
            <th className="px-2 py-2.5 text-left w-20">★</th>
            <th className="px-2 py-2.5 w-32"></th>
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <EditableRow key={b.id} book={b} isEditing={editing === b.id} onEdit={() => setEditing(b.id)} onClose={() => setEditing(null)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableRow({ book, isEditing, onEdit, onClose }: { book: any; isEditing: boolean; onEdit: () => void; onClose: () => void }) {
  const update = useUpdateBook();
  const del = useDeleteBook();
  const [draft, setDraft] = useState({
    shelf_code: book.shelf_code ?? "",
    title: book.title ?? "",
    title_ml: book.title_ml ?? "",
    author: book.author ?? "",
    genre: book.genre ?? "",
    rent_price: String(book.rent_price ?? 10),
  });

  useEffect(() => {
    if (isEditing) {
      setDraft({
        shelf_code: book.shelf_code ?? "",
        title: book.title ?? "",
        title_ml: book.title_ml ?? "",
        author: book.author ?? "",
        genre: book.genre ?? "",
        rent_price: String(book.rent_price ?? 10),
      });
    }
  }, [isEditing, book]);

  const save = () => {
    update.mutate(
      {
        id: book.id,
        patch: {
          shelf_code: draft.shelf_code.trim() || null,
          title: draft.title.trim() || book.title,
          title_ml: draft.title_ml.trim() || null,
          author: draft.author.trim() || book.author,
          genre: draft.genre.trim() || book.genre,
          rent_price: Number(draft.rent_price) > 0 ? Number(draft.rent_price) : Number(book.rent_price),
        },
      },
      { onSuccess: onClose },
    );
  };

  const cellCls = "w-full rounded border border-primary/40 bg-background/80 px-2 py-1 text-xs outline-none focus:border-primary";

  if (isEditing) {
    return (
      <tr className="border-t border-border/40 bg-primary/5">
        <td className="px-2 py-1.5"><input value={draft.shelf_code} onChange={(e) => setDraft({ ...draft, shelf_code: e.target.value })} className={cellCls} /></td>
        <td className="px-2 py-1.5"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={cellCls} /></td>
        <td className="px-2 py-1.5"><input value={draft.title_ml} onChange={(e) => setDraft({ ...draft, title_ml: e.target.value })} className={`${cellCls} font-mal`} /></td>
        <td className="px-2 py-1.5"><input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className={cellCls} /></td>
        <td className="px-2 py-1.5"><input value={draft.genre} onChange={(e) => setDraft({ ...draft, genre: e.target.value })} className={cellCls} /></td>
        <td className="px-2 py-1.5"><input type="number" value={draft.rent_price} onChange={(e) => setDraft({ ...draft, rent_price: e.target.value })} className={cellCls} /></td>
        <td className="px-2 py-1.5 text-xs">{displayRating(book).toFixed(1)}</td>
        <td className="px-2 py-1.5 text-right">
          <div className="flex justify-end gap-1">
            <button onClick={save} disabled={update.isPending} className="cursor-pointer rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <Save className="h-3 w-3" />
            </button>
            <button onClick={onClose} className="cursor-pointer rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-elevated">
              <X className="h-3 w-3" />
            </button>
            <button
              onClick={() => { if (confirm(`Delete "${book.title}"?`)) del.mutate(book.id, { onSuccess: onClose }); }}
              className="cursor-pointer rounded border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border/40 hover:bg-surface/40" onDoubleClick={onEdit}>
      <td className="px-2 py-2 text-xs font-bold text-primary">{book.shelf_code ?? "—"}</td>
      <td className="px-2 py-2">
        <Link to="/books/$id" params={{ id: book.id }} className="cursor-pointer font-medium hover:text-primary">{book.title}</Link>
      </td>
      <td className="px-2 py-2 font-mal text-xs text-accent">{book.title_ml ?? "—"}</td>
      <td className="px-2 py-2 text-xs text-foreground/80">{book.author}</td>
      <td className="px-2 py-2 text-xs text-muted-foreground">{book.genre}</td>
      <td className="px-2 py-2 text-xs">₹{Number(book.rent_price ?? 10).toFixed(0)}</td>
      <td className="px-2 py-2 text-xs">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {displayRating(book).toFixed(1)}
        </span>
      </td>
      <td className="px-2 py-2 text-right">
        <button onClick={onEdit} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-elevated">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </td>
    </tr>
  );
}

function BooksGridAdmin({ books, setEditing }: { books: any[]; setEditing: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {books.map((b) => (
        <div key={b.id} className="glass-card flex flex-col gap-2 rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
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
          <div className="line-clamp-1 text-[11px] text-muted-foreground">{b.author}</div>
          <div className="line-clamp-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">{b.genre}</div>
        </div>
      ))}
    </div>
  );
}

function EditBookModal({ book, onClose }: { book: any; onClose: () => void }) {
  const update = useUpdateBook();
  const del = useDeleteBook();
  const [title, setTitle] = useState(book.title);
  const [titleMl, setTitleMl] = useState(book.title_ml ?? "");
  const [author, setAuthor] = useState(book.author);
  const [authorMl, setAuthorMl] = useState(book.author_ml ?? "");
  const [genre, setGenre] = useState(book.genre);
  const [shelf, setShelf] = useState(book.shelf_code ?? "");
  const [publisher, setPublisher] = useState(book.publisher ?? "");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card w-full max-w-lg rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit book</h2>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (English)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          <input value={titleMl} onChange={(e) => setTitleMl(e.target.value)} placeholder="Title (Malayalam)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mal" />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author (English)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          <input value={authorMl} onChange={(e) => setAuthorMl(e.target.value)} placeholder="Author (Malayalam)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mal" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="Rack #" className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Publisher" className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          </div>
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
              onClick={() => update.mutate(
                { id: book.id, patch: { title, title_ml: titleMl || null, author, author_ml: authorMl || null, genre, shelf_code: shelf || null, publisher: publisher || null } },
                { onSuccess: onClose },
              )}
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

function AddBookModal({ onClose }: { onClose: () => void }) {
  const create = useCreateBook();
  const { selectedId } = useLibrary();
  const [title, setTitle] = useState("");
  const [titleMl, setTitleMl] = useState("");
  const [author, setAuthor] = useState("");
  const [authorMl, setAuthorMl] = useState("");
  const [genre, setGenre] = useState("");
  const [shelf, setShelf] = useState("");
  const [publisher, setPublisher] = useState("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card w-full max-w-lg rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add a book</h2>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (English)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          <input value={titleMl} onChange={(e) => setTitleMl(e.target.value)} placeholder="Title (Malayalam)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mal" />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author (English)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          <input value={authorMl} onChange={(e) => setAuthorMl(e.target.value)} placeholder="Author (Malayalam)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mal" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre (e.g. നോവൽ / Novel)" className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="Rack #" className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Publisher" className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated">Cancel</button>
          <button
            disabled={create.isPending || !title.trim() || !author.trim() || !genre.trim()}
            onClick={() => create.mutate(
              { title, author, genre, title_ml: titleMl, author_ml: authorMl, shelf_code: shelf, publisher, library_id: selectedId ?? undefined },
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
  return k.toLowerCase().replace(/[\s_-]+/g, "");
}
const FIELD_MAP: Record<string, keyof BookImportRow> = {
  title: "title", titleen: "title", englishtitle: "title", name: "title",
  titleml: "title_ml", malayalamtitle: "title_ml", titlemal: "title_ml",
  author: "author", authoren: "author", englishauthor: "author", writer: "author",
  authorml: "author_ml", malayalamauthor: "author_ml",
  genre: "genre", category: "genre", type: "genre",
  shelf: "shelf_code", shelfcode: "shelf_code", rack: "shelf_code", rackno: "shelf_code", rackcode: "shelf_code", shelfno: "shelf_code", number: "shelf_code", no: "shelf_code", sno: "shelf_code",
  publisher: "publisher", publication: "publisher",
  price: "rent_price", rentprice: "rent_price", rent: "rent_price",
};

function mapRow(raw: Record<string, any>): BookImportRow | null {
  const mapped: any = {};
  for (const [k, v] of Object.entries(raw)) {
    const target = FIELD_MAP[normalizeKey(String(k))];
    if (target && v != null && String(v).trim() !== "") mapped[target] = v;
  }
  if (!mapped.title || !mapped.author) return null;
  if (!mapped.genre) mapped.genre = "നോവൽ";
  return mapped as BookImportRow;
}

function ImportBooksModal({ onClose }: { onClose: () => void }) {
  const importMut = useBulkImportBooks();
  const { selectedId } = useLibrary();
  const [rows, setRows] = useState<BookImportRow[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [skipped, setSkipped] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setRows([]);
    setSkipped(0);
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
        records = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      }
      const mapped: BookImportRow[] = [];
      let skip = 0;
      for (const r of records) {
        const m = mapRow(r);
        if (m) mapped.push(m); else skip++;
      }
      setRows(mapped);
      setSkipped(skip);
      if (mapped.length === 0) toast.error("No usable rows. Need at least 'title' and 'author' columns.");
    } catch (e: any) {
      toast.error(`Couldn't read file: ${e?.message ?? e}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-card w-full max-w-2xl rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Import books from CSV / Excel</h2>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
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
            <div className="text-xs text-muted-foreground">
              {rows.length.toLocaleString()} ready to import{skipped > 0 && ` · ${skipped} skipped (missing title/author)`}.
              {selectedId && " · Will attach to currently selected library."}
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
            onClick={() => importMut.mutate({ rows, libraryId: selectedId ?? null }, { onSuccess: onClose })}
            className="cursor-pointer rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50"
          >
            {importMut.isPending ? "Importing…" : `Import ${rows.length.toLocaleString()} books`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== RENTALS =====
function RentalsTab() {
  const { data: rentals = [], isLoading } = useAllRentals();
  const update = useUpdateRentalStatus();
  const markReturned = useMarkReturned();
  const [filter, setFilter] = useState<"active" | "returned" | "all">("active");
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  const shown = (rentals as any[]).filter((r) => {
    if (filter === "active") return !r.returned_at;
    if (filter === "returned") return !!r.returned_at;
    return true;
  });

  const STATUSES = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

  return (
    <div>
      <div className="mb-3 flex gap-1.5 rounded-lg border border-border bg-surface/40 p-1">
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

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface/60" />)}</div>
      ) : shown.length === 0 ? (
        <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No rentals to show.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r: any) => (
            <div key={r.id} className="glass-card rounded-xl p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/books/$id" params={{ id: r.books?.id ?? "" }} className="cursor-pointer text-sm font-semibold hover:text-primary">
                    {r.books?.title ?? "Book"}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    by {r.books?.author ?? "—"} · Rack {r.books?.shelf_code ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rented {new Date(r.rented_at).toLocaleDateString()} · Due {new Date(r.due_at).toLocaleDateString()}
                    {r.returned_at && ` · Returned ${new Date(r.returned_at).toLocaleDateString()}`}
                  </p>
                  {r.delivery_address && <p className="mt-1 line-clamp-2 text-xs text-foreground/70">📍 {r.delivery_address}</p>}
                  <button onClick={() => setViewingUser(r.user_id)} className="mt-1 cursor-pointer text-[11px] text-primary hover:underline">View reader dashboard →</button>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {!r.returned_at ? (
                    <>
                      <select
                        value={r.tracking_status ?? "confirmed"}
                        onChange={(e) => update.mutate({ id: r.id, status: e.target.value })}
                        className="cursor-pointer rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => { if (confirm("Mark as returned? Next waitlist reader will be auto-assigned.")) markReturned.mutate(r.id); }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:opacity-90"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark returned
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Returned
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
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

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />)}</div>;
  if (list.length === 0) return <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No waitlist entries.</p>;

  return (
    <div className="space-y-2">
      {(list as any[]).map((w) => (
        <div key={w.id} className="glass-card flex items-center justify-between gap-3 rounded-xl p-3">
          <div className="min-w-0">
            <Link to="/books/$id" params={{ id: w.books?.id ?? "" }} className="cursor-pointer text-sm font-semibold hover:text-primary">
              {w.books?.title ?? "Book"}
            </Link>
            <p className="text-xs text-muted-foreground">
              by {w.books?.author ?? "—"} · joined {new Date(w.created_at).toLocaleDateString()}
            </p>
            <button onClick={() => setViewingUser(w.user_id)} className="cursor-pointer text-[11px] text-primary hover:underline">View reader →</button>
          </div>
          <button
            onClick={() => remove.mutate(w.id)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ))}
      {viewingUser && <UserDashboardModal userId={viewingUser} onClose={() => setViewingUser(null)} />}
    </div>
  );
}

// ===== SUGGESTIONS =====
function SuggestionsTab() {
  const { data: list = [], isLoading } = useAllSuggestions();
  const [viewingUser, setViewingUser] = useState<string | null>(null);

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-surface/60" />)}</div>;
  if (list.length === 0) return <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">No suggestions yet.</p>;

  return (
    <div className="space-y-2">
      {(list as any[]).map((s) => (
        <div key={s.id} className="glass-card rounded-xl p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{s.title}</h3>
            <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
          </div>
          {s.author && <p className="text-xs text-muted-foreground">by {s.author}</p>}
          {s.note && <p className="mt-1 text-sm text-foreground/80">{s.note}</p>}
          <button onClick={() => setViewingUser(s.user_id)} className="mt-1 cursor-pointer text-[11px] text-primary hover:underline">View reader →</button>
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
  const setRole = useSetUserRole();
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<"admin" | "librarian">("librarian");

  return (
    <div>
      <div className="glass-card mb-4 rounded-xl p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-4 w-4 text-accent" /> Grant staff access by email
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          The user must have signed in at least once. Admins can manage libraries and staff roles; librarians can manage books, rentals, waitlist, and reader dashboards.
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
            <option value="librarian">Librarian</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="button"
            disabled={setRole.isPending || !email.trim()}
            onClick={() => setRole.mutate({ email, role, enabled: true }, { onSuccess: () => setEmail("") })}
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
          {list.map((l) => (
            <div key={l.user_id} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{l.display_name ?? l.email}</div>
                <div className="text-xs text-muted-foreground">{l.email}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {l.roles.map((r) => (
                    <span key={r} className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{r}</span>
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground/70">First granted {new Date(l.granted_at).toLocaleDateString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["admin", "librarian"] as const).map((r) => {
                  const enabled = l.roles.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        if (!enabled) return setRole.mutate({ email: l.email, role: r, enabled: true });
                        if (confirm(`Revoke ${r} access for ${l.email}?`)) setRole.mutate({ email: l.email, role: r, enabled: false });
                      }}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${enabled ? "border-rose-500/40 text-rose-300 hover:bg-rose-500/10" : "border-border hover:bg-surface-elevated"}`}
                    >
                      {enabled ? <Trash2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {enabled ? `Revoke ${r}` : `Grant ${r}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
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
