import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useDiary, useEditDiary, useDeleteDiary } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { NotebookPen, Pencil, Trash2, X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/diary")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reading Diary · Bookary" }] }),
  component: DiaryPage,
});

function DiaryPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  const { data: entries = [] } = useDiary();

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <NotebookPen className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold">Reading Diary</h1>
        <span className="text-sm text-muted-foreground">({entries.length})</span>
      </div>
      {entries.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
          Rent a book and add diary entries as you read.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((e: any) => <DiaryItem key={e.id} entry={e} />)}
        </div>
      )}
    </AppLayout>
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
        {entry.books && <BookCover book={entry.books} className="!p-2 text-[10px]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <h3 className="text-base font-semibold">{entry.books?.title}</h3>
          {entry.books?.title_ml && <span className="font-mal text-sm text-accent">{entry.books.title_ml}</span>}
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(entry.created_at).toLocaleDateString()} · {entry.books?.author}
          </span>
        </div>

        {editing ? (
          <>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if ((e.key === "Enter" && (e.metaKey || e.ctrlKey))) save(); }}
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
