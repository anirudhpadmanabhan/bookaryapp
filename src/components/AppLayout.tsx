import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home, Search, BookMarked, PenLine, Heart, UserRound,
  Library, NotebookPen, Wallet, LogOut, Sparkles, Bell, X,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { useProfile, useDueSoonRentals, useNotifications, useMarkNotificationsRead, useRentals } from "@/lib/userdata";
import { useIsStaff } from "@/lib/admin";
import { Shield } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LibrarySwitcher } from "@/components/LibrarySwitcher";

const navMain = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/genres", label: "Genres", icon: Library },
  { to: "/writers", label: "Writers", icon: PenLine },
];

const navMine = [
  { to: "/loved", label: "Loved", icon: Heart },
  { to: "/diary", label: "Diary", icon: NotebookPen },
  { to: "/profile", label: "Profile", icon: UserRound },
];

const mobileNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/genres", label: "Genres", icon: Library },
  { to: "/diary", label: "Diary", icon: NotebookPen },
  { to: "/loved", label: "Loved", icon: Heart },
];

const TIPS: { title: string; body: string }[] = [
  { title: "Sort what you see", body: "Every list has a Sort menu and an Asc/Desc toggle." },
  { title: "Switch tile or list", body: "Use the grid icon to flip between rich tiles and a dense list." },
  { title: "Rate without typing", body: "Pick a star count on any book — even a silent rating helps other readers." },
  { title: "Thumbnails carry the title", body: "Every cover is illustrated with its Malayalam and English title." },
  { title: "Loved syncs everywhere", body: "Tap the heart anywhere — it shows up on your Loved tab instantly." },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dueSoon = useDueSoonRentals();
  const { data: rentals = [] } = useRentals();
  const { data: notifs = [] } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const isStaff = useIsStaff();
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const bellRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const tip = TIPS[Math.floor(Date.now() / (1000 * 60 * 60 * 6)) % TIPS.length];

  // Merge persisted notifications + derived due-soon reminders + tracking updates into one inbox.
  const inbox = useMemo(() => {
    const items: { id: string; kind: string; title: string; body?: string; ts: number; unread: boolean; bookId?: string }[] = [];
    for (const n of notifs as any[]) {
      items.push({
        id: `n-${n.id}`,
        kind: n.kind,
        title: n.title,
        body: n.body ?? undefined,
        ts: new Date(n.created_at).getTime(),
        unread: !n.read_at,
        bookId: n.book_id ?? undefined,
      });
    }
    for (const r of dueSoon as any[]) {
      items.push({
        id: `due-${r.id}`,
        kind: r.overdue ? "overdue" : "due_soon",
        title: r.overdue ? `${r.books?.title ?? "Book"} is overdue` : `${r.books?.title ?? "Book"} due in ${r.daysLeft}d`,
        body: `by ${r.books?.author ?? ""} · return by ${new Date(r.due_at).toLocaleDateString()}`,
        ts: new Date(r.due_at).getTime(),
        unread: true,
        bookId: r.book_id,
      });
    }
    // Tracking updates for shipments that aren't yet delivered
    for (const r of rentals as any[]) {
      if (r.returned_at) continue;
      const status = r.tracking_status ?? "confirmed";
      if (status === "delivered" || status === "returned") continue;
      items.push({
        id: `track-${r.id}`,
        kind: "tracking",
        title: `Tracking · ${r.books?.title ?? "Your rental"}`,
        body: `Status: ${status.replace(/_/g, " ")}`,
        ts: new Date(r.rented_at).getTime(),
        unread: false,
        bookId: r.book_id,
      });
    }
    return items.sort((a, b) => b.ts - a.ts);
  }, [notifs, dueSoon, rentals]);

  const unreadCount = inbox.filter((i) => i.unread).length;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const openBell = () => {
    setBellOpen((o) => {
      if (!o && unreadCount > 0) markRead.mutate();
      return !o;
    });
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setMenuOpen(false);
    navigate({ to: "/" });
  };

  const goSearch = (q: string) => {
    navigate({ to: "/search", search: { q: q.trim() || undefined } });
  };

  return (
    <div className="min-h-screen pb-20 text-foreground md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-2 px-3 md:gap-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex cursor-pointer items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
                <BookMarked className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold tracking-tight">BOOKARY</div>
                <div className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">Reading library</div>
              </div>
            </Link>
            <div className="hidden w-64 sm:block">
              <LibrarySwitcher />
            </div>
          </div>

          {pathname !== "/search" && (
            <form
              onSubmit={(e) => { e.preventDefault(); goSearch(searchValue); }}
              className="hidden flex-1 max-w-md md:flex"
            >
              <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface/50 px-4 py-2.5 text-sm focus-within:border-primary/60">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goSearch(searchValue); } }}
                  placeholder="Search titles, authors, genres, shelf codes…"
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                />
                {searchValue && (
                  <button type="button" onClick={() => setSearchValue("")} className="cursor-pointer text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="flex items-center gap-1.5 md:gap-3">
            {user && profile ? (
              <>
                <Link
                  to="/profile"
                  className="hidden cursor-pointer items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-400 transition hover:bg-emerald-500/25 sm:flex"
                  title="Manage wallet"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  ₹{Number(profile.wallet_balance).toFixed(0)}
                </Link>

                {/* Notification bell — unified inbox */}
                <div ref={bellRef} className="relative">
                  <button
                    type="button"
                    onClick={openBell}
                    className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-surface/60 hover:bg-surface-elevated"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {bellOpen && (
                    <div className="fixed inset-x-2 top-16 z-50 max-w-sm rounded-2xl border border-border bg-popover p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications</div>
                        <button onClick={() => setBellOpen(false)} className="sm:hidden cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </div>
                      {inbox.length === 0 ? (
                        <p className="px-3 py-6 text-sm text-muted-foreground">No new notifications. We'll ping you about rentals, tracking, returns, and waitlist openings.</p>
                      ) : (
                        <ul className="max-h-[65vh] space-y-1 overflow-y-auto sm:max-h-96">
                          {inbox.map((item) => {
                            const tone =
                              item.kind === "waitlist_assigned" ? "bg-emerald-500/20 text-emerald-300" :
                              item.kind === "overdue" ? "bg-rose-500/20 text-rose-300" :
                              item.kind === "due_soon" ? "bg-amber-500/20 text-amber-300" :
                              item.kind === "tracking" ? "bg-primary/15 text-primary" :
                              "bg-surface text-foreground/80";
                            const label =
                              item.kind === "waitlist_assigned" ? "Available" :
                              item.kind === "overdue" ? "Overdue" :
                              item.kind === "due_soon" ? "Due soon" :
                              item.kind === "tracking" ? "Tracking" :
                              "New";
                            const Inner = (
                              <div className="flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-elevated">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>{label}</span>
                                    {item.unread && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                                  </div>
                                  <div className="mt-1 truncate text-sm font-medium">{item.title}</div>
                                  {item.body && <div className="truncate text-xs text-muted-foreground">{item.body}</div>}
                                </div>
                              </div>
                            );
                            return (
                              <li key={item.id}>
                                {item.bookId ? (
                                  <Link to="/books/$id" params={{ id: item.bookId }} onClick={() => setBellOpen(false)} className="block cursor-pointer">{Inner}</Link>
                                ) : (
                                  <Link to="/profile" onClick={() => setBellOpen(false)} className="block cursor-pointer">{Inner}</Link>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>


                {/* Profile circle with dropdown menu (includes logout) */}
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-surface px-2 py-1 hover:bg-surface-elevated md:px-3 md:py-1.5"
                    aria-label="Profile menu"
                  >
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold">
                      {profile.display_name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="hidden text-sm font-medium md:inline">{profile.display_name}</span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
                      <div className="border-b border-border/60 px-3 py-3">
                        <div className="truncate text-sm font-semibold">{profile.display_name}</div>
                        {(profile as any).tag && (
                          <div className="mt-0.5 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">
                            {(profile as any).tag}
                          </div>
                        )}
                        <div className="mt-1 truncate text-xs text-muted-foreground">{user.email}</div>
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                          <Wallet className="h-3 w-3" /> ₹{Number(profile.wallet_balance).toFixed(0)}
                        </div>
                      </div>
                      <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                        <UserRound className="h-4 w-4" /> Profile & tracking
                      </Link>
                      <Link to="/diary" onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                        <NotebookPen className="h-4 w-4" /> Reading diary
                      </Link>
                      <Link to="/loved" onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                        <Heart className="h-4 w-4" /> Loved books
                      </Link>
                      {isStaff && (
                        <Link
                          to="/admin"
                          onClick={() => setMenuOpen(false)}
                          className="flex cursor-pointer items-center gap-2 border-t border-border/60 bg-gradient-to-r from-primary/10 to-accent/10 px-3 py-2.5 text-sm font-semibold text-primary hover:from-primary/20 hover:to-accent/20"
                        >
                          <Shield className="h-4 w-4" /> Library admin
                        </Link>
                      )}
                      <button onClick={signOut} className="flex w-full cursor-pointer items-center gap-2 border-t border-border/60 px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  )}
                </div>

              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="border-b border-border/60 bg-background/60 px-4 py-2 sm:hidden">
        <LibrarySwitcher compact />
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 md:px-6">
        <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-60 shrink-0 flex-col gap-6 md:flex">
          <nav className="glass-card flex flex-col gap-1 rounded-2xl p-3">
            <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Browse</div>
            {navMain.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-surface-elevated hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
            <div className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your shelf</div>
            {navMine.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-surface-elevated hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              {tip.title}
            </div>
            <p className="mt-2 text-sm leading-snug text-foreground/80">{tip.body}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {mobileNav.map((n) => {
            const active = pathname === n.to;
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className={`flex cursor-pointer flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <n.icon className={`h-5 w-5 ${active ? "" : "opacity-80"}`} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
