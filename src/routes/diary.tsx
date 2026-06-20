import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useDiary, useEditDiary, useDeleteDiary, useAddDiary } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { fetchBooks } from "@/lib/books";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, Pencil, Trash2, X, Check, Plus } from "lucide-react";
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
          No entries yet. Use the form above to log a thought about any book — you don't have to rent it.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {entries.map((e: any) => <DiaryItem key={e.id} entry={e} />)}
        </div>
      )}
    </AppLayout>
  );
}

function NewEntryForm() {
  const add = useAddDiary();
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [open, setOpen] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [bookId, setBookId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState(0);

  const suggestions = useMemo(() => {
    if (!bookSearch.trim()) return [];
    const q = bookSearch.toLowerCase();
    return books.filter((b) => b.title.toLowerCase().includes(q) || (b.title_ml ?? "").includes(bookSearch) || b.author.toLowerCase().includes(q)).slice(0, 6);
  }, [bookSearch, books]);
  const selectedBook = bookId ? books.find((b) => b.id === bookId) : null;

  const submit = () => {
    if (!note.trim()) return;
    add.mutate({ bookId, note: note.trim(), progress }, {
      onSuccess: () => {
        setNote(""); setProgress(0); setBookId(null); setBookSearch(""); setOpen(false);
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
          <Plus className="h-4 w-4" /> New diary entry
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
                <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover">
                  {suggestions.map((b) => (
                    <li key={b.id}>
                      <button type="button" onClick={() => { setBookId(b.id); setBookSearch(b.title); }} className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-elevated">
                        <span className="truncate">{b.title} <span className="text-muted-foreground">· {b.author}</span></span>
                        {b.shelf_code && <span className="text-xs text-muted-foreground">#{b.shelf_code}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="What did you read or think today? (Enter saves, Shift+Enter for newline)"
            rows={3}
            className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted-foreground">Progress {progress}%</label>
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1 cursor-pointer accent-[var(--primary)]" />
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
  const edit = useEditDiary();
  const del = useDeleteDiary();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry.note);
  const [progress, setProgress] = useState(entry.progress_pct);

  const save = () => {
    if (!note.trim()) return;
    edit.mutate({ id: entry.id, note: note.trim(), progress }, { onSuccess: () => setEditing(false) });
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
          <h3 className="text-base font-semibold">{entry.books?.title ?? "Free entry"}</h3>
          {entry.books?.title_ml && <span className="font-mal text-sm text-accent">{entry.books.title_ml}</span>}
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(entry.created_at).toLocaleDateString()}{entry.books?.author ? ` · ${entry.books.author}` : ""}
          </span>
        </div>

        {editing ? (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } }}
              rows={3}
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-xs text-muted-foreground">Progress {progress}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="flex-1 cursor-pointer accent-[var(--primary)]"
              />
              <button
                onClick={save}
                disabled={edit.isPending}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" /> Save
              </button>
              <button
                onClick={() => { setEditing(false); setNote(entry.note); setProgress(entry.progress_pct); }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface">
              <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${entry.progress_pct}%` }} />
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground/85">{entry.note}</p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{entry.progress_pct}% through</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-elevated"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => { if (confirm("Delete this entry?")) del.mutate(entry.id); }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
