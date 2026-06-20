import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useDiary } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { NotebookPen } from "lucide-react";
import { useEffect } from "react";

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
      </div>
      {entries.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
          Rent a book and add diary entries as you read.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((e: any) => (
            <article key={e.id} className="glass-card rounded-2xl p-5">
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <h3 className="text-base font-semibold">{e.books?.title}</h3>
                <span className="font-mal text-sm text-accent">{e.books?.title_ml}</span>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface">
                <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${e.progress_pct}%` }} />
              </div>
              <p className="text-sm text-foreground/85">{e.note}</p>
              <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">{e.progress_pct}% through · {e.books?.author}</div>
            </article>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
