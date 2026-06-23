import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/lib/auth";
import {
  useProfile, useRentals, useTopUpWallet, useSuggestions, useSuggestBook,
  useReadingInsights, useFavorites, useDueSoonRentals, useUpdateProfile,
  useWaitlist, useLeaveWaitlist,
} from "@/lib/userdata";
import {
  Wallet, BookOpen, CheckCircle2, Lightbulb, Clock, Flame, Heart, NotebookPen,
  Trophy, BookMarked, AlertTriangle, BellRing, Pencil, X, Tag, Smartphone, Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchBooks } from "@/lib/books";

const SUGGESTED_TAGS = ["Bookworm", "Critic", "Casual reader", "Reviewer", "Collector", "Student"];

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Profile · Bookary" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", search: { redirect: pathname } }); }, [user, loading, navigate, pathname]);
  // Fire 5-day due-date reminders once per page mount (idempotent server-side)
  useEffect(() => {
    if (!user) return;
    supabase.rpc("enqueue_my_due_reminders" as any).then(() => {
      // notifications list refresh handled by realtime / next refetch
    });
  }, [user]);
  const { data: profile } = useProfile();
  const { data: rentals = [] } = useRentals();
  const { data: favorites = [] } = useFavorites();
  const { data: waitlist = [] } = useWaitlist();
  const { data: suggestions = [] } = useSuggestions();
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const insights = useReadingInsights();
  const dueSoon = useDueSoonRentals();
  const topUp = useTopUpWallet();
  const suggest = useSuggestBook();
  const updateProfile = useUpdateProfile();
  const leaveWait = useLeaveWaitlist();
  const qc = useQueryClient();

  const [sTitle, setSTitle] = useState("");
  const [sAuthor, setSAuthor] = useState("");
  const [sNote, setSNote] = useState("");

  const [editingIdentity, setEditingIdentity] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tag, setTag] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [showUPI, setShowUPI] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setTag((profile as any).tag ?? "");
      setPhone((profile as any).phone ?? "");
      setAddress((profile as any).address ?? "");
    }
  }, [profile]);

  const saveIdentity = () => {
    if (!displayName.trim()) return toast.error("Name can't be empty");
    updateProfile.mutate(
      { display_name: displayName.trim(), tag: tag.trim() || null },
      { onSuccess: () => setEditingIdentity(false) },
    );
  };

  const saveDetails = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ phone: phone.trim() || null, address: address.trim() || null } as any).eq("id", user.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    setEditingDetails(false);
    toast.success("Details saved");
  };

  const active = (rentals as any[]).filter((r) => !r.returned_at);
  const past = (rentals as any[]).filter((r) => r.returned_at);
  const totalSpent = (rentals as any[]).reduce((s, r) => s + Number(r.price_paid ?? 0), 0);

  const returnBook = async (rentalId: string) => {
    const { error } = await supabase.from("rentals").update({ returned_at: new Date().toISOString(), tracking_status: "returned" } as any).eq("id", rentalId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rentals"] });
    qc.invalidateQueries({ queryKey: ["waitlist"] });
    toast.success("Book returned");
  };

  const notifyRental = (title: string, dueAt: string) => {
    toast.success(`Reminder set for ${title} — due ${new Date(dueAt).toLocaleDateString()}`);
  };

  const submitSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTitle.trim()) return toast.error("Add a book title");
    suggest.mutate({ title: sTitle, author: sAuthor, note: sNote }, {
      onSuccess: () => { setSTitle(""); setSAuthor(""); setSNote(""); },
    });
  };

  if (!profile) return <AppLayout><div className="h-40 animate-pulse rounded-2xl bg-surface" /></AppLayout>;

  return (
    <AppLayout>
      {/* Identity card */}
      <div className="glass-card mb-8 flex flex-wrap items-start gap-6 rounded-3xl p-7">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-2xl font-bold">
          {profile.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-[220px]">
          {editingIdentity ? (
            <div className="flex flex-col gap-2">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="rounded-lg border border-border bg-background/50 px-3 py-2 text-base font-semibold outline-none focus:border-primary"
              />
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Tag className="h-3 w-3" /> Reader tag
                </label>
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. Bookworm"
                  className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SUGGESTED_TAGS.map((t) => (
                    <button key={t} type="button" onClick={() => setTag(t)} className="cursor-pointer rounded-full border border-border bg-surface/60 px-2 py-0.5 text-[10px] hover:border-accent/60 hover:text-accent">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveIdentity} disabled={updateProfile.isPending} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
                  <Check className="h-3 w-3" /> Save
                </button>
                <button onClick={() => { setEditingIdentity(false); setDisplayName(profile.display_name); setTag((profile as any).tag ?? ""); }} className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-elevated">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.display_name}</h1>
                {(profile as any).tag && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                    <Tag className="h-2.5 w-2.5" /> {(profile as any).tag}
                  </span>
                )}
                <button onClick={() => setEditingIdentity(true)} className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-surface-elevated">
                  <Pencil className="inline h-3 w-3" /> Edit
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">Reader since {new Date(profile.created_at).toLocaleDateString()}</p>
            </>
          )}

          {editingDetails ? (
            <div className="mt-3 flex flex-col gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary" />
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" rows={2} className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary" />
              <div className="flex gap-2">
                <button onClick={saveDetails} className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">Save</button>
                <button onClick={() => setEditingDetails(false)} className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-elevated">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {(profile as any).phone && <span>📞 {(profile as any).phone}</span>}
              {(profile as any).address && <span className="max-w-xs truncate">📍 {(profile as any).address}</span>}
              <button onClick={() => setEditingDetails(true)} className="cursor-pointer rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-surface-elevated">
                {(profile as any).phone || (profile as any).address ? "Edit contact" : "Add phone & address"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-300">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider"><Wallet className="h-3.5 w-3.5" />Wallet</div>
          <div className="text-2xl font-bold">₹{Number(profile.wallet_balance).toFixed(0)}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => topUp.mutate(100)} className="cursor-pointer rounded-lg bg-emerald-400/20 px-2.5 py-1 text-xs hover:bg-emerald-400/30">+ ₹100</button>
            <button type="button" onClick={() => setShowUPI(true)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary/20 px-2.5 py-1 text-xs text-primary hover:bg-primary/30">
              <Smartphone className="h-3 w-3" /> UPI
            </button>
          </div>
        </div>
      </div>

      {showUPI && <UPIModal onClose={() => setShowUPI(false)} onSuccess={(amt) => { topUp.mutate(amt); setShowUPI(false); }} />}

      {/* In-page nav: quick jump between profile sections */}
      <nav className="glass-card mb-8 flex flex-wrap items-center gap-1 rounded-2xl p-1.5 text-xs">
        {[
          { id: "insights", label: "Insights", icon: Trophy },
          { id: "due", label: "Due soon", icon: AlertTriangle },
          { id: "ledger", label: "Wallet & ledger", icon: Wallet },
          { id: "rentals", label: "Active rentals", icon: BookOpen },
          { id: "waitlist", label: "Waitlist", icon: Clock },
          { id: "suggest", label: "Suggestions", icon: Lightbulb },
          { id: "past", label: "History", icon: CheckCircle2 },
        ].map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground">
            <s.icon className="h-3.5 w-3.5" /> {s.label}
          </a>
        ))}
      </nav>

      {/* Insights */}
      {insights && (
        <section id="insights" className="mb-10 scroll-mt-20 border-t border-border/40 pt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Trophy className="h-4 w-4 text-amber-300" /> Reading insights</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Flame} tint="rose"    label="Day streak"     value={insights.streak} sub={insights.streak === 0 ? "Log today to start" : `${insights.streak} day${insights.streak === 1 ? "" : "s"} in a row`} />
            <Stat icon={BookMarked} tint="primary" label="Books read"      value={insights.booksRead} sub={`${insights.activeRentals} active right now`} />
            <Stat icon={NotebookPen} tint="accent" label="Diary entries"   value={insights.diaryCount} sub="All-time" />
            <Stat icon={Heart} tint="rose"   label="Loved"           value={favorites.length} sub="Books in your shelf" />
          </div>
          <div className="mt-3 rounded-2xl border border-border bg-surface/40 px-4 py-3 text-sm text-muted-foreground">
            Uploaded catalogue: <span className="font-semibold text-foreground">{books.length.toLocaleString()} books</span> in the selected library.
          </div>
          {(insights.topGenre || insights.topAuthor) && (
            <div className="glass-card mt-4 grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
              {insights.topGenre && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Favorite genre</div>
                  <div className="mt-1 text-lg font-semibold">{insights.topGenre}</div>
                </div>
              )}
              {insights.topAuthor && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Most-read writer</div>
                  <div className="mt-1 text-lg font-semibold">{insights.topAuthor}</div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {dueSoon.length > 0 && (
        <section id="due" className="mb-10 scroll-mt-20 border-t border-border/40 pt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-4 w-4 text-amber-300" /> Due within 20 days</h2>
          <ul className="space-y-2">
            {dueSoon.map((r) => (
              <li key={r.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${r.overdue ? "border-rose-500/40 bg-rose-500/10" : "border-amber-400/30 bg-amber-500/10"}`}>
                <span><span className="font-semibold">{r.books?.title}</span> <span className="text-muted-foreground">· due {new Date(r.due_at).toLocaleDateString()}</span></span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.overdue ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {r.overdue ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d left`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ledger */}
      <section id="ledger" className="mb-10 scroll-mt-20 border-t border-border/40 pt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Wallet className="h-4 w-4 text-emerald-400" /> Ledger</h2>
        <div className="glass-card grid grid-cols-2 gap-4 rounded-2xl p-5 sm:grid-cols-4">
          <Stat icon={Wallet} tint="emerald" label="Balance" value={`₹${Number(profile.wallet_balance).toFixed(0)}`} sub="Available to rent" />
          <Stat icon={Coins} tint="amber"   label="Total spent" value={`₹${totalSpent.toFixed(0)}`} sub={`${rentals.length} rental${rentals.length === 1 ? "" : "s"}`} />
          <Stat icon={BookOpen} tint="primary" label="Active rentals" value={active.length} sub="Out right now" />
          <Stat icon={CheckCircle2} tint="emerald" label="Returned" value={past.length} sub="Completed" />
        </div>
      </section>

      {/* Active rentals + Tracking */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><BookOpen className="h-4 w-4 text-primary" /> Active rentals & tracking ({active.length})</h2>
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
              const status = r.tracking_status ?? "confirmed";
              const statusLabel: Record<string, string> = {
                confirmed: "Confirmed", packed: "Packed", out_for_delivery: "Out for delivery", delivered: "Delivered",
              };
              return (
                <div key={r.id} className="glass-card flex flex-wrap items-start gap-4 rounded-2xl p-4">
                  <Link to="/books/$id" params={{ id: r.book_id }} className="block cursor-pointer">
                    <div className={`cover cover-${r.books?.cover_color || "amber"} h-20 w-14 flex-shrink-0 !aspect-auto !p-2 hover:opacity-90`}>
                      <span className="font-mal text-[8px] text-white/90">{r.books?.title_ml}</span>
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to="/books/$id" params={{ id: r.book_id }} className="cursor-pointer hover:text-primary">
                      <h3 className="font-semibold">{r.books?.title}</h3>
                    </Link>
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
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                        📦 {statusLabel[status] ?? status}
                      </span>
                      {r.delivery_address && (
                        <span className="text-muted-foreground">→ {r.delivery_address}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button type="button" onClick={() => notifyRental(r.books?.title ?? "this book", r.due_at)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-elevated">
                      <BellRing className="h-3.5 w-3.5" /> Notify
                    </button>
                    <button type="button" onClick={() => returnBook(r.id)} className="cursor-pointer rounded-lg bg-surface-elevated px-3 py-1.5 text-sm hover:bg-primary/20 hover:text-primary">Return</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Waiting list */}
      {waitlist.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Clock className="h-4 w-4 text-amber-300" /> Your waiting list ({waitlist.length})</h2>
          <div className="space-y-2">
            {(waitlist as any[]).map((w) => (
              <div key={w.id} className="glass-card flex items-center justify-between gap-3 rounded-xl p-3">
                <Link to="/books/$id" params={{ id: w.book_id }} className="flex items-center gap-3 cursor-pointer hover:opacity-90">
                  <div className={`cover cover-${w.books?.cover_color || "amber"} h-14 w-10 !aspect-auto !p-1.5`}>
                    <span className="font-mal text-[7px] text-white/90">{w.books?.title_ml}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{w.books?.title}</div>
                    <div className="text-xs text-muted-foreground">by {w.books?.author} · waiting since {new Date(w.created_at).toLocaleDateString()}</div>
                  </div>
                </Link>
                <button onClick={() => leaveWait.mutate(w.book_id)} className="cursor-pointer rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Suggest */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Lightbulb className="h-4 w-4 text-amber-300" /> Suggest a book to the library</h2>
        <form onSubmit={submitSuggestion} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
          <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="Book title *" className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <input value={sAuthor} onChange={(e) => setSAuthor(e.target.value)} placeholder="Author (optional)" className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <textarea value={sNote} onChange={(e) => setSNote(e.target.value)} placeholder="Why should we add it?" rows={2} className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2" />
          <div className="flex items-center justify-between sm:col-span-2">
            <span className="text-xs text-muted-foreground">{suggestions.length} previous suggestion{suggestions.length !== 1 && "s"}</span>
            <button type="submit" disabled={suggest.isPending} className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {suggest.isPending ? "Sending…" : "Send suggestion"}
            </button>
          </div>
        </form>
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Past rentals ({past.length})</h2>
          <div className="space-y-2">
            {past.map((r: any) => (
              <Link to="/books/$id" params={{ id: r.book_id }} key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-2.5 text-sm cursor-pointer hover:bg-surface-elevated">
                <div className="flex items-center gap-3">
                  <div className={`cover cover-${r.books?.cover_color || "amber"} h-10 w-7 !aspect-auto !p-1`}>
                    <span className="font-mal text-[6px] text-white/90">{r.books?.title_ml}</span>
                  </div>
                  <div>
                    <span className="font-medium">{r.books?.title}</span>
                    <span className="ml-2 text-muted-foreground">by {r.books?.author}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">returned {new Date(r.returned_at).toLocaleDateString()} · ₹{r.price_paid}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppLayout>
  );
}

function UPIModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (amount: number) => void }) {
  const [upi, setUpi] = useState("");
  const [amount, setAmount] = useState(100);
  const [step, setStep] = useState<"input" | "approving" | "done">("input");

  const approve = () => {
    if (!/^[\w.\-]+@[\w.\-]+$/.test(upi)) return toast.error("Enter a valid UPI ID like name@bank");
    if (amount <= 0) return toast.error("Enter an amount");
    setStep("approving");
    // Mock approval delay
    setTimeout(() => {
      setStep("done");
      setTimeout(() => onSuccess(amount), 600);
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-popover p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Recharge via UPI</h2>
            <p className="text-xs text-muted-foreground">Mock UPI — wallet credits instantly.</p>
          </div>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {step === "input" && (
          <>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">UPI ID</label>
            <input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@okhdfcbank" className="mb-3 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary" />
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (₹)</label>
            <input type="number" min={10} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mb-3 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary" />
            <div className="mb-4 flex flex-wrap gap-1.5">
              {[50, 100, 200, 500].map((a) => (
                <button key={a} type="button" onClick={() => setAmount(a)} className="cursor-pointer rounded-lg border border-border bg-surface/60 px-3 py-1 text-xs hover:border-primary/60">
                  ₹{a}
                </button>
              ))}
            </div>
            <button onClick={approve} className="w-full cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Connect UPI & Pay ₹{amount}
            </button>
          </>
        )}

        {step === "approving" && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm">Approve in your UPI app…</p>
            <p className="text-xs text-muted-foreground">{upi}</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-10 text-center text-emerald-300">
            <Check className="mx-auto mb-2 h-10 w-10" />
            <p className="text-sm font-semibold">₹{amount} credited</p>
          </div>
        )}
      </div>
    </div>
  );
}

const TINTS: Record<string, string> = {
  rose:    "bg-rose-500/10 text-rose-300 border-rose-500/20",
  primary: "bg-primary/10 text-primary border-primary/20",
  accent:  "bg-accent/10 text-accent border-accent/20",
  amber:   "bg-amber-500/10 text-amber-300 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

function Stat({ icon: Icon, tint, label, value, sub }: { icon: any; tint: keyof typeof TINTS | string; label: string; value: number | string; sub: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${TINTS[tint] ?? TINTS.primary}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Coins(props: any) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>;
}
