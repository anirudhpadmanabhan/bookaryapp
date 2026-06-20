import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home, Search, BookMarked, PenLine, Heart, UserRound,
  Library, NotebookPen, Wallet, LogOut, Sparkles, Hand,
} from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { useProfile } from "@/lib/userdata";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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

// Mobile bottom bar shows the 5 most-used destinations.
const mobileNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/genres", label: "Genres", icon: Library },
  { to: "/diary", label: "Diary", icon: NotebookPen },
  { to: "/loved", label: "Loved", icon: Heart },
];

const TIPS: { title: string; body: string }[] = [
  { title: "Sort the shelf", body: "Use the Sort menu on every list — by new arrival, shelf code, rating, or price." },
  { title: "List or tile view", body: "Switch between visual tiles and a compact list anywhere you see the grid icon." },
  { title: "Shelf codes", body: "Every book shows its rack number from Cherukad Vayanasala — find it on the cover chip and on the book page." },
  { title: "Rate as you read", body: "Open any book and leave a 1–5 star rating with a short review — others can see what's worth picking up." },
  { title: "Reading diary", body: "Once you rent a book, jot a note after each session. Hit Enter to save quickly." },
  { title: "Loved shelf", body: "Tap the heart on any cover to bookmark it. Your Loved page collects them in one place." },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tip = TIPS[Math.floor(Date.now() / (1000 * 60 * 60 * 6)) % TIPS.length];

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen pb-20 text-foreground md:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/" className="flex cursor-pointer items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
              <BookMarked className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-bold tracking-tight">BOOKARY</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Cherukad Vayanasala</div>
            </div>
          </Link>

          <div className="hidden flex-1 max-w-md md:flex">
            <Link
              to="/search"
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface/50 px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/50"
            >
              <Search className="h-4 w-4" />
              <span>Search titles, authors, genres…</span>
              <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">/</kbd>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {user && profile ? (
              <>
                <div className="hidden items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-400 sm:flex">
                  <Wallet className="h-3.5 w-3.5" />
                  ₹{Number(profile.wallet_balance).toFixed(0)}
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
              <Link to="/auth" className="cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 md:px-6">
        {/* Sidebar (desktop only) */}
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
              <span>You're browsing as a guest. <Link to="/auth" className="cursor-pointer underline underline-offset-2">Sign in</Link> to rent, love and keep a reading diary.</span>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
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
