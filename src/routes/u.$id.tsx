import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePublicProfile } from "@/lib/userdata";
import { UserRound, Tag, Star, MessageSquare, Quote, Calendar, BookOpen, Flame, Heart, NotebookPen } from "lucide-react";

export const Route = createFileRoute("/u/$id")({
  ssr: false,
  head: ({ params }) => ({ meta: [{ title: `Reader · Bookary` }, { name: "robots", content: "noindex" }] }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { id } = Route.useParams();
  const { data: profile, isLoading } = usePublicProfile(id);

  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, books(id, title, title_ml, author, cover_color)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: insights } = useQuery({
    queryKey: ["reading-insights", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("reading_insights" as any, { _user_id: id });
      if (error) throw error;
      return data as { read: number; reading: number; want: number; favorite_genre: string | null; streak: number };
    },
  });

  if (isLoading) return <AppLayout><div className="h-40 animate-pulse rounded-2xl bg-surface" /></AppLayout>;
  if (!profile) return <AppLayout><p>Reader not found.</p></AppLayout>;

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r: any) => s + r.rating, 0) / reviews.length
    : null;

  return (
    <AppLayout>
      <div className="glass-card mb-8 flex flex-wrap items-center gap-6 rounded-3xl p-7">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-2xl font-bold text-white">
          {profile.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            {profile.tag && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                <Tag className="h-2.5 w-2.5" /> {profile.tag}
              </span>
            )}
          </div>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> Reader since {new Date(profile.created_at).toLocaleDateString()}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Public view — contact and ledger details are private.</p>
        </div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-300">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider"><Star className="h-3.5 w-3.5" /> Reviews</div>
          <div className="text-2xl font-bold">{reviews.length}</div>
          {avgRating !== null && <div className="text-xs">avg {avgRating.toFixed(1)} / 5</div>}
        </div>
      </div>

      {insights && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-4 w-4 text-accent" /> Reading insights
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <InsightStat icon={Flame} label="Day streak" value={insights.streak} tint="rose" />
            <InsightStat icon={BookOpen} label="Read" value={insights.read} tint="emerald" />
            <InsightStat icon={NotebookPen} label="Reading" value={insights.reading} tint="primary" />
            <InsightStat icon={Heart} label="Want" value={insights.want} tint="amber" />
            <div className="rounded-2xl border border-border bg-surface/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Favorite genre</div>
              <div className="mt-1 truncate text-sm font-semibold">{insights.favorite_genre ?? "—"}</div>
            </div>
          </div>
        </section>
      )}


      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <NotebookPen className="h-4 w-4 text-accent" /> Their diary
        </h2>
        {reviews.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
            This reader hasn't posted a review yet.
          </div>
        ) : (
          <div className="space-y-3">
            {(reviews as any[]).map((r) => (
              <article key={r.id} className="glass-card flex gap-4 rounded-2xl p-4">
                <Link to="/books/$id" params={{ id: r.book_id }} className="block w-14 shrink-0 cursor-pointer">
                  <div className={`cover cover-${r.books?.cover_color || "amber"} h-20 w-14 !aspect-auto !p-2`}>
                    <span className="font-mal text-[8px] text-white/90">{r.books?.title_ml}</span>
                  </div>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link to="/books/$id" params={{ id: r.book_id }} className="cursor-pointer font-semibold hover:text-primary">
                      {r.books?.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">by {r.books?.author}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="my-1.5 flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  {r.body && <p className="text-sm text-foreground/85">{r.body}</p>}
                  {r.favorite_quote && (
                    <blockquote className="mt-2 flex gap-2 rounded-lg border-l-2 border-accent bg-accent/5 px-3 py-2 text-xs italic text-foreground/80">
                      <Quote className="h-3 w-3 shrink-0 text-accent" />
                      <span>{r.favorite_quote}</span>
                    </blockquote>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function InsightStat({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: "rose" | "emerald" | "primary" | "amber" }) {
  const tintCls: Record<string, string> = {
    rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    primary: "border-primary/30 bg-primary/10 text-primary",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  };
  return (
    <div className={`rounded-2xl border p-3 ${tintCls[tint]}`}>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-80"><Icon className="h-3 w-3" /> {label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
