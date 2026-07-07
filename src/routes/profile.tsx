import { formatDMY } from "@/lib/utils";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/lib/auth";
import {
  useProfile, useRentals, useSuggestions, useSuggestBook,
  useReadingInsights, useFavorites, useDueSoonRentals, useUpdateProfile,
  useWaitlist, useLeaveWaitlist, useClaimReservation, useDeclineReservation,
  useAvatarUrl,
} from "@/lib/userdata";
import {
  BookOpen, CheckCircle2, Lightbulb, Clock, Flame, Heart, NotebookPen,
  Trophy, BookMarked, AlertTriangle, BellRing, Pencil, Tag, Check, ChevronDown, Camera, Trash2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchBooks } from "@/lib/books";

/**
 * Profile page sections are heavy on mobile. Wrap each one in <Section>:
 *  - desktop (md+): always-visible header + content (no collapse)
 *  - mobile: <details> accordion, collapsed by default
 */
function Section({ id, title, icon: Icon, children, defaultOpen = false }: { id: string; title: string; icon: any; children: ReactNode; defaultOpen?: boolean }) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <details id={id} open={defaultOpen} className="group mb-4 scroll-mt-20 rounded-2xl border border-border/40 bg-surface/30 [&[open]>summary>svg.chev]:rotate-180">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 text-base font-bold"><Icon className="h-4 w-4 text-primary" /> {title}</span>
          <ChevronDown className="chev h-4 w-4 transition-transform" />
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
    );
  }
  return (
    <section id={id} className="mb-10 scroll-mt-20 border-t border-border/40 pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
      {children}
    </section>
  );
}

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
  // On mount: sweep expired reservations, then enqueue any due-bucket reminders.
  useEffect(() => {
    if (!user) return;
    (async () => {
      await supabase.rpc("expire_stale_reservations" as any);
      await supabase.rpc("enqueue_my_due_reminders" as any);
      qc.invalidateQueries({ queryKey: ["rentals"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const { data: profile } = useProfile();
  const { data: rentals = [] } = useRentals();
  const { data: favorites = [] } = useFavorites();
  const { data: waitlist = [] } = useWaitlist();
  const { data: suggestions = [] } = useSuggestions();
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const insights = useReadingInsights();
  const dueSoon = useDueSoonRentals();
  const suggest = useSuggestBook();
  const updateProfile = useUpdateProfile();
  const leaveWait = useLeaveWaitlist();
  const qc = useQueryClient();

  const [sTitle, setSTitle] = useState("");
  const [sAuthor, setSAuthor] = useState("");
  const [sPublisher, setSPublisher] = useState("");
  const [sNote, setSNote] = useState("");


  const [editingIdentity, setEditingIdentity] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tag, setTag] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

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

  const reservations = (rentals as any[]).filter((r) => r.tracking_status === "reserved" && !r.returned_at);
  const active = (rentals as any[]).filter((r) => !r.returned_at && r.tracking_status !== "reserved");
  const past = (rentals as any[]).filter((r) => r.returned_at);
  const claim = useClaimReservation();
  const decline = useDeclineReservation();

  const returnBook = async (rentalId: string) => {
    const { error } = await supabase.from("rentals").update({ returned_at: new Date().toISOString(), tracking_status: "returned" } as any).eq("id", rentalId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rentals"] });
    qc.invalidateQueries({ queryKey: ["waitlist"] });
    toast.success("Book returned");
  };

  const notifyRental = (title: string, dueAt: string) => {
    toast.success(`Reminder set for ${title} — due ${formatDMY(dueAt)}`);
  };

  const submitSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTitle.trim()) return toast.error("Add a book title");
    const noteWithPublisher = [sPublisher.trim() ? `Publisher: ${sPublisher.trim()}` : "", sNote.trim()].filter(Boolean).join("\n\n");
    suggest.mutate({ title: sTitle, author: sAuthor, note: noteWithPublisher }, {
      onSuccess: () => { setSTitle(""); setSAuthor(""); setSPublisher(""); setSNote(""); },
    });
  };


  if (!profile) return <AppLayout><div className="h-40 animate-pulse rounded-2xl bg-surface" /></AppLayout>;

  return (
    <AppLayout>
      {/* Identity card */}
      <div className="glass-card mb-8 flex flex-wrap items-start gap-6 rounded-3xl p-7">
        <AvatarTile profile={profile} />
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
              <p className="mt-1 text-xs text-muted-foreground">Reader since {formatDMY(profile.created_at)}</p>
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

      </div>

      {/* In-page nav: hidden on mobile (sections are collapsible accordions there) */}
      <nav className="glass-card mb-8 hidden flex-wrap items-center gap-1 rounded-2xl p-1.5 text-xs md:flex">
        {[
          { id: "insights", label: "Insights", icon: Trophy },
          { id: "due", label: "Due soon", icon: AlertTriangle },
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
        <Section id="insights" title="Reading insights" icon={Trophy} defaultOpen>
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
        </Section>
      )}

      {dueSoon.length > 0 && (
        <Section id="due" title={`Due within 20 days (${dueSoon.length})`} icon={AlertTriangle}>
          {/* Compact grid — keeps the list dense and avoids vertical sprawl */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dueSoon.map((r) => (
              <div key={r.id} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${r.overdue ? "border-rose-500/40 bg-rose-500/10" : "border-amber-400/30 bg-amber-500/10"}`}>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.books?.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">due {formatDMY(r.due_at)}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${r.overdue ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {r.overdue ? `${Math.abs(r.daysLeft)}d late` : `${r.daysLeft}d`}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Active rentals + Tracking */}
      <Section id="rentals" title={`Active rentals & tracking (${active.length})`} icon={BookOpen}>
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
                      <span className="text-muted-foreground">Rented {formatDMY(rentedDate)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">Due {formatDMY(dueDate)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${overdue ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                        <Clock className="h-3 w-3" />
                        {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </span>
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
      </Section>

      {/* Reservations (24h window) */}
      {reservations.length > 0 && (
        <Section id="reservations" title={`Reserved for you (${reservations.length})`} icon={BellRing} defaultOpen>
          <div className="space-y-2">
            {reservations.map((r: any) => {
              const exp = r.reserved_until ? new Date(r.reserved_until) : null;
              const hoursLeft = exp ? Math.max(0, Math.round((exp.getTime() - Date.now()) / 3600000)) : null;
              return (
                <div key={r.id} className="glass-card flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link to="/books/$id" params={{ id: r.book_id }} className="text-sm font-semibold hover:underline">{r.books?.title ?? "Your reserved book"}</Link>
                    <div className="text-xs text-amber-300">
                      {hoursLeft !== null ? `Claim within ${hoursLeft}h` : "Claim within 24h"} or it passes to the next reader.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => claim.mutate(r.id)}
                      disabled={claim.isPending}
                      className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-60"
                    >Claim</button>
                    <button
                      onClick={() => decline.mutate(r.id)}
                      disabled={decline.isPending}
                      className="cursor-pointer rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
                    >Decline</button>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Waiting list */}
      {waitlist.length > 0 && (
        <Section id="waitlist" title={`Your waiting list (${waitlist.length})`} icon={Clock}>
          <div className="space-y-2">
            {(waitlist as any[]).map((w) => (
              <div key={w.id} className="glass-card flex items-center justify-between gap-3 rounded-xl p-3">
                <Link to="/books/$id" params={{ id: w.book_id }} className="flex items-center gap-3 cursor-pointer hover:opacity-90">
                  <div className={`cover cover-${w.books?.cover_color || "amber"} h-14 w-10 !aspect-auto !p-1.5`}>
                    <span className="font-mal text-[7px] text-white/90">{w.books?.title_ml}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{w.books?.title}</div>
                    <div className="text-xs text-muted-foreground">by {w.books?.author} · waiting since {formatDMY(w.created_at)}</div>
                  </div>
                </Link>
                <button onClick={() => leaveWait.mutate(w.book_id)} className="cursor-pointer rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Suggest */}
      <Section id="suggest" title="Suggest a book to the library" icon={Lightbulb}>
        <form onSubmit={submitSuggestion} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
          <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="Book title *" className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <input value={sAuthor} onChange={(e) => setSAuthor(e.target.value)} placeholder="Author (optional)" className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary" />
          <input value={sPublisher} onChange={(e) => setSPublisher(e.target.value)} placeholder="Publisher (optional)" className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2" />
          <textarea value={sNote} onChange={(e) => setSNote(e.target.value)} placeholder="Why should we add it?" rows={2} className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2" />

          <div className="flex items-center justify-between sm:col-span-2">
            <span className="text-xs text-muted-foreground">{suggestions.length} previous suggestion{suggestions.length !== 1 && "s"}</span>
            <button type="submit" disabled={suggest.isPending} className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {suggest.isPending ? "Sending…" : "Send suggestion"}
            </button>
          </div>
        </form>
      </Section>

      {past.length > 0 && (
        <Section id="past" title={`Past rentals (${past.length})`} icon={CheckCircle2}>
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
                <span className="text-xs text-muted-foreground">returned {formatDMY(r.returned_at)}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </AppLayout>
  );
}


function AvatarTile({ profile }: { profile: any }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const updateProfile = useUpdateProfile();
  const { data: signedUrl } = useAvatarUrl(profile.avatar_url);
  const inputRef = useState<{ el: HTMLInputElement | null }>({ el: null })[0];
  const [uploading, setUploading] = useState(false);

  const onPick = async (file: File) => {
    if (!user) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be under 3 MB");
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      // Remove any older avatar with a different extension
      if (profile.avatar_url && profile.avatar_url !== path) {
        await supabase.storage.from("avatars").remove([profile.avatar_url]).catch(() => {});
      }
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await new Promise((r) => updateProfile.mutate({ avatar_url: path }, { onSuccess: () => r(null), onError: () => r(null) }));
      qc.invalidateQueries({ queryKey: ["avatar-url"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async () => {
    if (!profile.avatar_url) return;
    try {
      await supabase.storage.from("avatars").remove([profile.avatar_url]).catch(() => {});
      updateProfile.mutate({ avatar_url: null });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove photo");
    }
  };

  return (
    <div className="group relative">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent text-2xl font-bold">
        {signedUrl ? (
          <img src={signedUrl} alt={profile.display_name} className="h-full w-full object-cover" />
        ) : (
          <span>{profile.display_name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.el?.click()}
        title={signedUrl ? "Change photo" : "Add photo"}
        className="absolute -bottom-1 -right-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-60"
        disabled={uploading}
      >
        <Camera className="h-3 w-3" /> {uploading ? "…" : signedUrl ? "Change" : "Add"}
      </button>
      {profile.avatar_url && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove photo"
          className="absolute -top-1 -right-1 hidden cursor-pointer rounded-full border border-border bg-background p-1 text-rose-300 shadow-lg hover:bg-rose-500/10 group-hover:inline-flex"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <input
        ref={(el) => { inputRef.el = el; }}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
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

