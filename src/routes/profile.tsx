import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/lib/auth";
import { useProfile, useRentals, useTopUpWallet, useSuggestions, useSuggestBook } from "@/lib/userdata";
import { Wallet, BookOpen, CheckCircle2, Lightbulb, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Profile · Bookary" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  const { data: profile } = useProfile();
  const { data: rentals = [] } = useRentals();
  const { data: suggestions = [] } = useSuggestions();
  const topUp = useTopUpWallet();
  const suggest = useSuggestBook();
  const qc = useQueryClient();

  const [sTitle, setSTitle] = useState("");
  const [sAuthor, setSAuthor] = useState("");
  const [sNote, setSNote] = useState("");

  const active = rentals.filter((r: any) => !r.returned_at);
  const past = rentals.filter((r: any) => r.returned_at);

  const returnBook = async (rentalId: string) => {
    const { error } = await supabase.from("rentals").update({ returned_at: new Date().toISOString() }).eq("id", rentalId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rentals"] });
    toast.success("Book returned");
  };

  const submitSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTitle.trim()) return toast.error("Add a book title");
    suggest.mutate(
      { title: sTitle, author: sAuthor, note: sNote },
      { onSuccess: () => { setSTitle(""); setSAuthor(""); setSNote(""); } },
    );
  };

  if (!profile) return <AppLayout><div className="h-40 animate-pulse rounded-2xl bg-surface" /></AppLayout>;

  return (
    <AppLayout>
      <div className="glass-card mb-8 flex flex-wrap items-center gap-6 rounded-3xl p-7">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-2xl font-bold">
          {profile.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Reader since {new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-300">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider"><Wallet className="h-3.5 w-3.5" />Wallet</div>
          <div className="text-2xl font-bold">₹{Number(profile.wallet_balance).toFixed(0)}</div>
          <button type="button" onClick={() => topUp.mutate(100)} className="mt-2 cursor-pointer rounded-lg bg-emerald-400/20 px-3 py-1 text-xs hover:bg-emerald-400/30">+ Add ₹100</button>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><BookOpen className="h-4 w-4 text-primary" /> Active rentals ({active.length})</h2>
        {active.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">No active rentals.</div>
        ) : (
          <div className="space-y-3">
            {active.map((r: any) => {
              const dueDate = new Date(r.due_at);
              const rentedDate = new Date(r.rented_at);
              const msLeft = dueDate.getTime() - Date.now();
              const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
              const overdue = msLeft < 0;
              return (
                <div key={r.id} className="glass-card flex flex-wrap items-center gap-4 rounded-2xl p-4">
                  <div className={`cover cover-${r.books?.cover_color || "indigo"} h-20 w-14 flex-shrink-0 !aspect-auto !p-2`}>
                    <span className="font-mal text-[8px] text-white/90">{r.books?.title_ml}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{r.books?.title}</h3>
                    <p className="text-xs text-muted-foreground">by {r.books?.author}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Rented {rentedDate.toLocaleDateString()}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">Due {dueDate.toLocaleDateString()}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${overdue ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                        <Clock className="h-3 w-3" />
                        {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </span>
                      <span className="text-muted-foreground">· Paid ₹{r.price_paid}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => returnBook(r.id)} className="cursor-pointer rounded-lg bg-surface-elevated px-3 py-1.5 text-sm hover:bg-primary/20 hover:text-primary">Return</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Lightbulb className="h-4 w-4 text-amber-300" /> Suggest a book to the library</h2>
        <form onSubmit={submitSuggestion} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
          <input
            value={sTitle}
            onChange={(e) => setSTitle(e.target.value)}
            placeholder="Book title *"
            className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={sAuthor}
            onChange={(e) => setSAuthor(e.target.value)}
            placeholder="Author (optional)"
            className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <textarea
            value={sNote}
            onChange={(e) => setSNote(e.target.value)}
            placeholder="Why should we add it?"
            rows={2}
            className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2"
          />
          <div className="flex items-center justify-between sm:col-span-2">
            <span className="text-xs text-muted-foreground">{suggestions.length} previous suggestion{suggestions.length !== 1 && "s"}</span>
            <button type="submit" disabled={suggest.isPending} className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {suggest.isPending ? "Sending…" : "Send suggestion"}
            </button>
          </div>
        </form>
        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {suggestions.slice(0, 5).map((s: any) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2 text-xs">
                <span><span className="font-medium text-foreground">{s.title}</span>{s.author && <span className="text-muted-foreground"> · {s.author}</span>}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Past rentals ({past.length})</h2>
          <div className="space-y-2">
            {past.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium">{r.books?.title}</span>
                  <span className="ml-2 text-muted-foreground">by {r.books?.author}</span>
                </div>
                <span className="text-xs text-muted-foreground">returned {new Date(r.returned_at).toLocaleDateString()} · ₹{r.price_paid}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppLayout>
  );
}
