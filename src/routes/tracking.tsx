import { formatDMY } from "@/lib/utils";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "@/lib/auth";
import { useRentals, useWaitlist, useNotifications, useLeaveWaitlist } from "@/lib/userdata";
import { Package, Clock, CheckCircle2, MapPin, Calendar, Bell, Truck } from "lucide-react";

export const Route = createFileRoute("/tracking")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tracking · Bookary" }] }),
  component: TrackingPage,
});

const TRACK_STEPS = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"] as const;

function StatusTimeline({ status, rentedAt, dueAt, returnedAt }: { status: string; rentedAt: string; dueAt: string; returnedAt: string | null }) {
  const idx = Math.max(0, TRACK_STEPS.indexOf(status as any));
  return (
    <div>
      <div className="mt-3 flex items-center gap-1.5">
        {TRACK_STEPS.map((s, i) => {
          const done = i <= idx;
          return (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <div className={`h-2 w-2 shrink-0 rounded-full ${done ? "bg-primary" : "bg-border"}`} />
              <div className={`h-0.5 flex-1 ${i < TRACK_STEPS.length - 1 ? (done ? "bg-primary/60" : "bg-border") : "bg-transparent"}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        {TRACK_STEPS.map((s) => <span key={s} className="capitalize">{s.replace(/_/g, " ")}</span>)}
      </div>
      <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <span className="inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" />Rented {formatDMY(rentedAt)}</span>
        <span className="inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" />Due {formatDMY(dueAt)}</span>
        {returnedAt && <span className="inline-flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="h-3 w-3" />Returned {formatDMY(returnedAt)}</span>}
      </div>
    </div>
  );
}

function TrackingPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", search: { redirect: pathname } }); }, [user, loading, navigate, pathname]);

  const { data: rentals = [] } = useRentals();
  const { data: waitlist = [] } = useWaitlist();
  const { data: notifs = [] } = useNotifications();
  const leaveWait = useLeaveWaitlist();

  const active = (rentals as any[]).filter((r) => !r.returned_at);
  const past = (rentals as any[]).filter((r) => r.returned_at).slice(0, 10);

  const notifFor = (bookId?: string) =>
    bookId ? (notifs as any[]).filter((n) => n.book_id === bookId).slice(0, 4) : [];

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
          <Truck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Tracking</h1>
          <p className="text-xs text-muted-foreground">Live delivery status, due dates, admin notes, and waitlist position.</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Package className="h-4 w-4" /> Active rentals ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Nothing in transit. <Link to="/" className="cursor-pointer text-primary hover:underline">Pick a book →</Link>
          </p>
        ) : (
          <div className="space-y-3">
            {active.map((r: any) => {
              const events = notifFor(r.book_id);
              return (
                <article key={r.id} className="glass-card rounded-2xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to="/books/$id" params={{ id: r.books?.id ?? "" }} className="cursor-pointer text-base font-semibold hover:text-primary">
                        {r.books?.title ?? "Book"}
                      </Link>
                      <p className="text-xs text-muted-foreground">by {r.books?.author ?? "—"}</p>
                      {r.delivery_address && (
                        <p className="mt-1 flex items-start gap-1.5 text-xs text-foreground/70">
                          <MapPin className="h-3 w-3 shrink-0 translate-y-0.5" /> {r.delivery_address}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold capitalize text-primary">
                      {(r.tracking_status ?? "confirmed").replace(/_/g, " ")}
                    </span>
                  </div>
                  <StatusTimeline status={r.tracking_status ?? "confirmed"} rentedAt={r.rented_at} dueAt={r.due_at} returnedAt={r.returned_at} />
                  {events.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-3">
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Updates</div>
                      <ul className="space-y-1.5">
                        {events.map((n) => (
                          <li key={n.id} className="flex items-start gap-2 text-xs">
                            <Bell className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                            <span className="text-foreground/80"><span className="font-medium">{n.title}</span>{n.body && <> · <span className="text-muted-foreground">{n.body}</span></>}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-4 w-4" /> Waiting list ({waitlist.length})
        </h2>
        {waitlist.length === 0 ? (
          <p className="glass-card rounded-2xl p-6 text-center text-xs text-muted-foreground">
            You're not on any waiting lists. Open a rented-out book and tap "Join waiting list" to claim the next copy.
          </p>
        ) : (
          <div className="space-y-2">
            {(waitlist as any[]).map((w) => (
              <div key={w.id} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-3">
                <div className="min-w-0">
                  <Link to="/books/$id" params={{ id: w.books?.id ?? "" }} className="cursor-pointer text-sm font-semibold hover:text-primary">
                    {w.books?.title ?? "Book"}
                  </Link>
                  <p className="text-xs text-muted-foreground">Joined {formatDMY(w.created_at)} · You'll be auto-assigned when the current reader returns.</p>
                </div>
                <button
                  onClick={() => leaveWait.mutate(w.book_id)}
                  className="cursor-pointer rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> Recently returned
          </h2>
          <div className="space-y-2">
            {past.map((r: any) => (
              <div key={r.id} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm">
                <div className="min-w-0">
                  <Link to="/books/$id" params={{ id: r.books?.id ?? "" }} className="cursor-pointer font-medium hover:text-primary">
                    {r.books?.title ?? "Book"}
                  </Link>
                  <p className="text-xs text-muted-foreground">Returned {formatDMY(r.returned_at)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Returned
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppLayout>
  );
}
