import { formatDMY } from "@/lib/utils";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useDiary, useEditDiaryFull, useDeleteDiary, useAddDiary, useProfile } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { fetchBooks } from "@/lib/books";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, Pencil, Trash2, X, Check, Plus, Star, LayoutGrid, List as ListIcon, Quote, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookCover } from "@/components/BookCover";

type DiaryView = "posters" | "timeline" | "reviews";

export const Route = createFileRoute("/diary")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reading Diary · Bookary" }] }),
  component: DiaryPage,
});

function DiaryPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", search: { redirect: pathname } }); }, [user, loading, navigate, pathname]);
  const { data: entries = [] } = useDiary();
  const [view, setView] = useState<DiaryView>("posters");

  const year = new Date().getFullYear();
  const thisYear = (entries as any[]).filter((e) => new Date(e.created_at).getFullYear() === year);

  const VIEWS: { id: DiaryView; label: string; icon: any }[] = [
    { id: "posters", label: "Posters", icon: LayoutGrid },
    { id: "timeline", label: "Timeline", icon: ListIcon },
    { id: "reviews", label: "Reviews", icon: Quote },
  ];

  return (
    <AppLayout>
      <div className="mb-4 flex items-center gap-3">
        <NotebookPen className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold">Reading Diary</h1>
        <span className="text-sm text-muted-foreground">({entries.length})</span>
      </div>

      {/* Add-entry form is now always available above the view tabs */}
      <NewEntryForm />

      <div className="mb-5 mt-5 flex flex-wrap gap-1.5 rounded-xl border border-border bg-surface/40 p-1.5">
        {VIEWS.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <v.icon className="h-4 w-4" /> {v.label}
            </button>
          );
        })}
      </div>

      {view === "posters" && <PostersView entries={entries as any[]} />}
      {view === "timeline" && <TimelineView entries={entries as any[]} thisYearCount={thisYear.length} year={year} />}
      {view === "reviews" && <ReviewsView entries={entries as any[]} />}
    </AppLayout>
  );
}

function StarRow({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-4 w-4" : "h-3 w-3";
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full) return <Star key={i} className={`${dim} fill-emerald-400 text-emerald-400`} />;
        if (i === full && half) {
          return (
            <span key={i} className="relative inline-block">
              <Star className={`${dim} text-emerald-400/40`} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <Star className={`${dim} fill-emerald-400 text-emerald-400`} />
              </span>
            </span>
          );
        }
        return <Star key={i} className={`${dim} text-emerald-400/30`} />;
      })}
    </span>
  );
}

function PostersView({ entries }: { entries: any[] }) {
  if (entries.length === 0) {
    return <div className="glass-card mt-2 rounded-2xl p-10 text-center text-muted-foreground">No diary entries with books yet.</div>;
  }
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {entries.map((e) => (
        <div key={e.id} className="flex flex-col gap-1.5">
          {e.books ? (
            <Link to="/books/$id" params={{ id: e.books.id }} className="block cursor-pointer transition hover:opacity-90">
              <BookCover book={e.books} className="!p-2 text-[10px]" />
            </Link>
          ) : (
            <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">No book</div>
          )}
          <div className="flex items-center justify-between px-0.5">
            {e.rating ? <StarRow value={e.rating} /> : <span className="text-[10px] text-muted-foreground">—</span>}
            <div className="flex items-center gap-1 text-muted-foreground">
              {e.note && <MessageSquare className="h-3 w-3" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineView({ entries, thisYearCount, year }: { entries: any[]; thisYearCount: number; year: number }) {
  // Group by Year-Month
  const groups = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const e of entries) {
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const arr = g.get(key) ?? [];
      arr.push(e);
      g.set(key, arr);
    }
    return Array.from(g.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  if (entries.length === 0) {
    return <div className="glass-card mt-2 rounded-2xl p-10 text-center text-muted-foreground">Your timeline is empty.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface/40 px-4 py-3 text-center text-sm text-muted-foreground">
        You've logged <span className="font-semibold text-foreground">{thisYearCount}</span> entries during {year}.
      </div>

      {groups.map(([key, rows]) => {
        const [y, m] = key.split("-").map(Number);
        const monthLabel = new Date(y, m, 1).toLocaleString(undefined, { month: "short" }).toUpperCase();
        return (
          <section key={key}>
            <div className="mb-2 flex items-center gap-3 px-1">
              <div className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-muted-foreground">
                <span className="block leading-none">{monthLabel}</span>
                <span className="block text-[9px] font-normal text-muted-foreground/70">{y}</span>
              </div>
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">{rows.length} entries</span>
            </div>
            <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/40">
              {rows.map((e) => {
                const d = new Date(e.created_at);
                return (
                  <div key={e.id} className="flex items-center gap-3 bg-surface/20 p-2.5 hover:bg-surface/40">
                    <div className="w-10 shrink-0 text-center text-2xl font-light tabular-nums text-muted-foreground">{d.getDate()}</div>
                    <div className="h-14 w-10 shrink-0">
                      {e.books ? (
                        <Link to="/books/$id" params={{ id: e.books.id }} className="block h-full w-full overflow-hidden rounded">
                          <BookCover book={e.books} className="!p-1 text-[8px]" />
                        </Link>
                      ) : (
                        <div className="grid h-full w-full place-items-center rounded bg-surface text-[8px] uppercase text-muted-foreground">—</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {e.books ? (
                        <Link to="/books/$id" params={{ id: e.books.id }} className="cursor-pointer text-base font-semibold hover:text-primary">{e.books.title}</Link>
                      ) : (
                        <span className="text-base font-semibold">Free entry</span>
                      )}
                      <div className="mt-0.5">{e.rating ? <StarRow value={e.rating} /> : <span className="text-[11px] text-muted-foreground">No rating</span>}</div>
                    </div>
                    <ListIcon className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ReviewsView({ entries }: { entries: any[] }) {
  const { user } = useSession();
  const { data: bookReviews = [] } = useQuery({
    enabled: !!user,
    queryKey: ["my-reviews", user?.id],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, body, favorite_quote, created_at, book_id, books(id, title, title_ml, author, cover_color)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  type Row = { kind: "diary" | "review"; id: string; created_at: string; rating: number | null; body: string; quote: string | null; book: any };
  // Reviews and diary entries are kept in sync server-side (writing one upserts the other).
  // Show the review when both exist for the same book + body so the tab doesn't double-list.
  const reviewKeys = new Set(
    (bookReviews as any[]).map((r) => `${r.book_id}|${(r.body ?? "").trim()}`),
  );
  const rows: Row[] = [
    ...entries
      .filter((e) => (e.note && e.note.trim()) || e.rating)
      .filter((e) => !e.book_id || !reviewKeys.has(`${e.book_id}|${(e.note ?? "").trim()}`))
      .map((e) => ({ kind: "diary" as const, id: `d-${e.id}`, created_at: e.created_at, rating: e.rating ?? null, body: e.note ?? "", quote: null, book: e.books })),
    ...(bookReviews as any[]).map((r) => ({ kind: "review" as const, id: `r-${r.id}`, created_at: r.created_at, rating: r.rating, body: r.body ?? "", quote: r.favorite_quote ?? null, book: r.books })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (rows.length === 0) {
    return <div className="glass-card mt-2 rounded-2xl p-10 text-center text-muted-foreground">No written reviews yet — add a note above or write one on a book page.</div>;
  }
  return (
    <div className="divide-y divide-border/40">
      {rows.map((e) => {
        const d = new Date(e.created_at);
        return (
          <article key={e.id} className="flex gap-4 py-5 first:pt-0">
            <div className="w-20 shrink-0 sm:w-24">
              {e.book ? (
                <Link to="/books/$id" params={{ id: e.book.id }} className="block cursor-pointer">
                  <BookCover book={e.book} className="!p-2 text-[10px]" />
                </Link>
              ) : (
                <div className="aspect-[2/3] w-full rounded-xl bg-surface" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                {e.book ? (
                  <Link to="/books/$id" params={{ id: e.book.id }} className="cursor-pointer text-lg font-bold hover:text-primary">{e.book.title}</Link>
                ) : (
                  <span className="text-lg font-bold">Free entry</span>
                )}
                {e.book?.title_ml && <span className="font-mal text-sm text-muted-foreground">{e.book.title_ml}</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${e.kind === "review" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}>
                  {e.kind === "review" ? "Book review" : "Diary"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {e.rating ? <StarRow value={e.rating} size="md" /> : null}
                <span>{d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              {e.body && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/85">{e.body}</p>}
              {e.quote && (
                <blockquote className="mt-3 flex gap-2 rounded-lg border-l-2 border-accent bg-accent/5 px-3 py-2 text-sm italic text-foreground/85">
                  <Quote className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span>{e.quote}</span>
                </blockquote>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StarPicker({ value, onChange, size = 5 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const dim = size === 5 ? "h-5 w-5" : "h-4 w-4";
  return (
    <div onMouseLeave={() => setHover(0)} className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          onMouseEnter={() => setHover(i + 1)}
          className="cursor-pointer p-0.5"
          aria-label={`${i + 1} stars`}
        >
          <Star className={`${dim} transition ${i < shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-200"}`} />
        </button>
      ))}
    </div>
  );
}

function NewEntryForm() {
  const add = useAddDiary();
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [open, setOpen] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [bookId, setBookId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);

  const suggestions = useMemo(() => {
    if (!bookSearch.trim()) return [];
    const q = bookSearch.toLowerCase();
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.title_ml ?? "").includes(bookSearch) ||
        b.author.toLowerCase().includes(q) ||
        (b.author_ml ?? "").includes(bookSearch),
    );
  }, [bookSearch, books]);
  const selectedBook = bookId ? books.find((b) => b.id === bookId) : null;

  const submit = () => {
    if (!note.trim() && rating === 0) return;
    add.mutate({ bookId, note: note.trim(), rating: rating || null }, {
      onSuccess: () => {
        setNote(""); setBookId(null); setBookSearch(""); setRating(0); setOpen(false);
      },
    });
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> New diary entry — note, rating & review
        </button>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">New diary entry</h2>
            <button type="button" onClick={() => setOpen(false)} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>

          {selectedBook ? (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-surface/60 px-3 py-2 text-sm">
              <span><span className="font-medium">{selectedBook.title}</span> <span className="text-muted-foreground">· {selectedBook.author}</span></span>
              <button type="button" onClick={() => { setBookId(null); setBookSearch(""); }} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Change</button>
            </div>
          ) : (
            <div className="mb-3">
              <input
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Optional — link a book (search title or author)…"
                className="w-full rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              {suggestions.length > 0 && (
                <>
                  <div className="mt-1 px-1 text-[11px] text-muted-foreground">{suggestions.length} match{suggestions.length === 1 ? "" : "es"} — scroll for more</div>
                  <ul className="mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover">
                    {suggestions.map((b) => (
                      <li key={b.id}>
                        <button type="button" onClick={() => { setBookId(b.id); setBookSearch(b.title); }} className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-elevated">
                          <span className="truncate">{b.title} <span className="text-muted-foreground">· {b.author}</span></span>
                          {b.shelf_code && <span className="text-xs text-muted-foreground">#{b.shelf_code}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="mb-2 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your rating</span>
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && <span className="text-xs text-muted-foreground">{rating}/5</span>}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Review or thought (Enter saves, Shift+Enter for newline)"
            rows={3}
            className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex justify-end">
            <button onClick={submit} disabled={add.isPending} className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {add.isPending ? "Saving…" : "Save entry"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DiaryItem({ entry }: { entry: any }) {
  const edit = useEditDiaryFull();
  const del = useDeleteDiary();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry.note);
  const [rating, setRating] = useState<number>(entry.rating ?? 0);
  const reviewerName = profile?.display_name ?? user?.email?.split("@")[0] ?? "Reader";

  const save = () => {
    if (!note.trim() && rating === 0) return;
    edit.mutate({ id: entry.id, note: note.trim(), rating: rating || null, bookId: entry.book_id }, { onSuccess: () => setEditing(false) });
  };

  return (
    <article className="glass-card flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:p-5">
      <div className="w-20 shrink-0 sm:w-24">
        {entry.books ? (
          <Link to="/books/$id" params={{ id: entry.books.id }} className="block cursor-pointer transition hover:opacity-90">
            <BookCover book={entry.books} className="!p-2 text-[10px]" />
          </Link>
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">No book</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          {entry.books ? (
            <Link to="/books/$id" params={{ id: entry.books.id }} className="cursor-pointer text-base font-semibold hover:text-primary">{entry.books.title}</Link>
          ) : (
            <h3 className="text-base font-semibold">Free entry</h3>
          )}
          {entry.books?.title_ml && <span className="font-mal text-sm text-accent">{entry.books.title_ml}</span>}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDMY(entry.created_at)}{entry.books?.author ? ` · ${entry.books.author}` : ""}
          </span>
        </div>
        <Link to="/u/$id" params={{ id: entry.user_id }} className="mb-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-primary">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-white">
            {reviewerName.slice(0, 1).toUpperCase()}
          </span>
          Review by {entry.user_id === user?.id ? "You" : reviewerName}
        </Link>

        {editing ? (
          <>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Rating</span>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } }}
              rows={3}
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={save} disabled={edit.isPending} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
                <Check className="h-3.5 w-3.5" /> Save
              </button>
              <button onClick={() => { setEditing(false); setNote(entry.note); setRating(entry.rating ?? 0); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {entry.rating ? (
              <div className="mb-2 flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < entry.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                ))}
                <span className="text-xs text-muted-foreground">{entry.rating}/5</span>
              </div>
            ) : null}
            {entry.note && <p className="whitespace-pre-wrap text-sm text-foreground/85">{entry.note}</p>}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(true)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-elevated">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => { if (confirm("Delete this entry?")) del.mutate(entry.id); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
