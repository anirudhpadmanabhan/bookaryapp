import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home, Search, BookMarked, PenLine, Heart, UserRound,
  Library, NotebookPen, Wallet, LogOut, Sparkles, Hand, Bell, X,
} from "lucide-react";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { useProfile, useDueSoonRentals } from "@/lib/userdata";
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
  { title: "Sort what you see", body: "Every list has a Sort menu — new arrivals, shelf code, rating, or price." },
  { title: "Switch tile or list", body: "Use the grid icon to flip between rich tiles and a dense list." },
  { title: "Rate without typing", body: "Pick a star count on any book — even a silent rating helps other readers." },
  { title: "Thumbnails carry the title", body: "Every cover is illustrated with its Malayalam and English title — scan the shelf at a glance." },
  { title: "Loved syncs everywhere", body: "Tap the heart anywhere — it shows up on your Loved tab instantly." },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const dueSoon = useDueSoonRentals();
  const [bellOpen, setBellOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const bellRef = useRef<HTMLDivElement | null>(null);

  const tip = TIPS[Math.floor(Date.now() / (1000 * 60 * 60 * 6)) % TIPS.length];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    if (bellOpen) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [bellOpen]);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const goSearch = (q: string) => {
    navigate({ to: "/search", search: { q: q.trim() || undefined } });
  };

  return (
    <div className="min-h-screen pb-20 text-foreground md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
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

          {/* Live header search — hidden on /search to avoid duplication */}
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


          <div className="flex items-center gap-3">
            {user && profile ? (
              <>
                <div className="hidden items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-400 sm:flex">
                  <Wallet className="h-3.5 w-3.5" />
                  ₹{Number(profile.wallet_balance).toFixed(0)}
                </div>

                {/* Notification bell — rentals due within 20 days */}
                <div ref={bellRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setBellOpen((o) => !o)}
                    className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-surface/60 hover:bg-surface-elevated"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {dueSoon.length > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                        {dueSoon.length}
                      </span>
                    )}
                  </button>
                  {bellOpen && (
                    <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-border bg-popover p-2 shadow-2xl">
                      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Return reminders (20-day window)
                      </div>
                      {dueSoon.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground">Nothing due soon. Happy reading.</p>
                      ) : (
                        <ul className="max-h-80 space-y-1 overflow-y-auto">
                          {dueSoon.map((r) => (
                            <li key={r.id}>
                              <Link
                                to="/books/$id"
                                params={{ id: r.book_id }}
                                onClick={() => setBellOpen(false)}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-elevated"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{r.books?.title}</div>
                                  <div className="truncate text-xs text-muted-foreground">{r.books?.author}</div>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${r.overdue ? "bg-rose-500/20 text-rose-300" : r.daysLeft <= 5 ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                                  {r.overdue ? `${Math.abs(r.daysLeft)}d overdue` : `${r.daysLeft}d left`}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <Link to="/profile" className="flex cursor-pointer items-center gap-2 rounded-full bg-surface px-3 py-1.5 hover:bg-surface-elevated">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold">
                    {profile.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="hidden text-sm font-medium sm:inline">{profile.display_name}</span>
                </Link>
                <button onClick={signOut} title="Sign out" className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                search={{ redirect: pathname }}
                className="cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile library switcher — sits right under the BOOKARY logo */}
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
          {!user && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <Hand className="h-4 w-4" />
              <span>You're browsing as a guest. <Link to="/auth" search={{ redirect: pathname }} className="cursor-pointer underline underline-offset-2">Sign in</Link> to rent, love and keep a reading diary.</span>
            </div>
          )}
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
