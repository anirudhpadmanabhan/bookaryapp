import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/lib/auth";
import {
  useIsStaff, useMyRoles, useAllRentals, useUpdateRentalStatus, useMarkReturned,
  useAllWaitlist, useRemoveWaitlistEntry, useAllSuggestions,
  useUpdateBook, useDeleteBook, useCreateBook,
} from "@/lib/admin";
import { useQuery } from "@tanstack/react-query";
import { fetchBooks } from "@/lib/books";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, Library as LibIcon, Package, Clock, Lightbulb,
  Search as SearchIcon, Trash2, CheckCircle2, Truck, Plus, Pencil, X, Save,
} from "lucide-react";

type Tab = "books" | "rentals" | "waitlist" | "suggestions";

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

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "books", label: "Books", icon: LibIcon },
    { id: "rentals", label: "Rentals", icon: Package },
    { id: "waitlist", label: "Waitlist", icon: Clock },
    { id: "suggestions", label: "Suggestions", icon: Lightbulb },
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
        {tabs.map((t) => {
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
    </AppLayout>
  );
}

// ===== BOOKS =====
function BooksTab() {
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) return books.slice(0, 100);
    const needle = q.toLowerCase();
    return books
      .filter(
        (b) =>
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle) ||
          (b.shelf_code ?? "").includes(needle) ||
          (b.title_ml ?? "").includes(q) ||
          (b.author_ml ?? "").includes(q),
      )
      .slice(0, 150);
  }, [books, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface/50 px-4 py-2.5">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title / author / rack…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
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
            Showing {filtered.length.toLocaleString()} of {books.length.toLocaleString()} books{q && ` matching "${q}"`}.
          </p>
          <div className="space-y-2">
            {filtered.map((b) => (
              <BookRowAdmin key={b.id} book={b as any} editing={editing === b.id} onEdit={() => setEditing(b.id)} onCancel={() => setEditing(null)} />
            ))}
          </div>
        </>
      )}

      {adding && <AddBookModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function BookRowAdmin({ book, editing, onEdit, onCancel }: any) {
  const update = useUpdateBook();
  const del = useDeleteBook();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [shelf, setShelf] = useState(book.shelf_code ?? "");
  const [genre, setGenre] = useState(book.genre);

  if (editing) {
    return (
      <div className="glass-card rounded-xl p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm" />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm" />
          <input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="Rack #" className="rounded-lg border border-border bg-background/50 px-3 py-1.5 text-sm" />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => {
              update.mutate(
                { id: book.id, patch: { title, author, genre, shelf_code: shelf || null } },
                { onSuccess: onCancel },
              );
            }}
            disabled={update.isPending}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button onClick={onCancel} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-elevated">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete "${book.title}"? This cannot be undone.`)) del.mutate(book.id);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface/30 px-3 py-2.5 hover:bg-surface/60">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
        {book.shelf_code ?? "—"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <Link to="/books/$id" params={{ id: book.id }} className="cursor-pointer text-sm font-semibold hover:text-primary">{book.title}</Link>
          {book.title_ml && <span className="font-mal text-xs text-accent">{book.title_ml}</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{book.author} · {book.genre}</p>
      </div>
      <button onClick={onEdit} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-elevated">
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}

function AddBookModal({ onClose }: { onClose: () => void }) {
  const create = useCreateBook();
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
              { title, author, genre, title_ml: titleMl, author_ml: authorMl, shelf_code: shelf, publisher },
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

// ===== RENTALS =====
function RentalsTab() {
  const { data: rentals = [], isLoading } = useAllRentals();
  const update = useUpdateRentalStatus();
  const markReturned = useMarkReturned();
  const [filter, setFilter] = useState<"active" | "returned" | "all">("active");

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
    </div>
  );
}

// ===== WAITLIST =====
function WaitlistTab() {
  const { data: list = [], isLoading } = useAllWaitlist();
  const remove = useRemoveWaitlistEntry();

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
            <Link to="/u/$id" params={{ id: w.user_id }} className="cursor-pointer text-[11px] text-primary hover:underline">View reader →</Link>
          </div>
          <button
            onClick={() => remove.mutate(w.id)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      ))}
    </div>
  );
}

// ===== SUGGESTIONS =====
function SuggestionsTab() {
  const { data: list = [], isLoading } = useAllSuggestions();

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
          <Link to="/u/$id" params={{ id: s.user_id }} className="mt-1 inline-block cursor-pointer text-[11px] text-primary hover:underline">View reader →</Link>
        </div>
      ))}
    </div>
  );
}
