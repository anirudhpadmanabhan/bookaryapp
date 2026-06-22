import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useDiary, useEditDiaryFull, useDeleteDiary, useAddDiary, useProfile } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { fetchBooks } from "@/lib/books";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, Pencil, Trash2, X, Check, Plus, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BookCover } from "@/components/BookCover";

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

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <NotebookPen className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold">Reading Diary</h1>
        <span className="text-sm text-muted-foreground">({entries.length})</span>
      </div>

      <NewEntryForm />

      {entries.length === 0 ? (
        <div className="glass-card mt-6 rounded-2xl p-10 text-center text-muted-foreground">
          No entries yet. Use the form above to log a thought, rating, or review.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {entries.map((e: any) => <DiaryItem key={e.id} entry={e} />)}
        </div>
      )}
    </AppLayout>
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
            {new Date(entry.created_at).toLocaleDateString()}{entry.books?.author ? ` · ${entry.books.author}` : ""}
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
