import { formatDMY } from "@/lib/utils";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home, Search, BookMarked, PenLine, Heart, UserRound,
  Library, NotebookPen, LogOut, Sparkles, Bell, X, Truck, Languages as LangIcon,
  Building2,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { useProfile, useDueSoonRentals, useNotifications, useMarkNotificationsRead, useRentals } from "@/lib/userdata";
import { useIsStaff } from "@/lib/admin";
import { Shield } from "lucide-react";
import { useHideBrowse, useHideShelves } from "@/lib/ui-prefs";

import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LibrarySwitcher } from "@/components/LibrarySwitcher";
import { useLibrary } from "@/lib/library";
import { fetchBooks, type Book } from "@/lib/books";

const navMain = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/genres", label: "Genres", icon: Library },
  { to: "/writers", label: "Writers", icon: PenLine },
  { to: "/languages", label: "Languages", icon: LangIcon },
];

const navMine = [
  { to: "/loved", label: "Loved", icon: Heart },
  { to: "/diary", label: "Diary", icon: NotebookPen },
  { to: "/profile", label: "Profile", icon: UserRound },
];

// Mobile bottom-nav: 5 essentials, fixed at the bottom of the viewport.
const mobileNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/diary", label: "Diary", icon: NotebookPen },
  { to: "/genres", label: "Genres", icon: Library },
  { to: "/profile", label: "Profile", icon: UserRound },
];

const TIPS: { title: string; body: string }[] = [
  { title: "Sort what you see", body: "Every list has a Sort menu and an Asc/Desc toggle." },
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
  const { selected } = useLibrary();
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hideBrowse, setHideBrowse] = useHideBrowse();
  const [hideShelves, setHideShelves] = useHideShelves();
  
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const { data: allBooks = [] } = useQuery({
    queryKey: ["books"],
    queryFn: fetchBooks,
    staleTime: 5 * 60_000,
    enabled: searchValue.trim().length >= 2,
  });

  const suggestions = useMemo<Book[]>(() => {
    const n = searchValue.trim().toLowerCase();
    if (n.length < 2) return [];
    const ranked: { b: Book; s: number }[] = [];
    for (const b of allBooks as Book[]) {
      const title = `${b.title ?? ""} ${b.title_ml ?? ""}`.toLowerCase();
      const author = `${b.author ?? ""} ${b.author_ml ?? ""} ${b.original_author ?? ""}`.toLowerCase();
      const other = `${b.genre ?? ""} ${b.genre_ml ?? ""} ${b.shelf_code ?? ""}`.toLowerCase();
      let s = -1;
      if (title.startsWith(n)) s = 0;
      else if (title.includes(` ${n}`)) s = 1;
      else if (title.includes(n)) s = 2;
      else if (author.startsWith(n)) s = 3;
      else if (author.includes(n)) s = 4;
      else if (other.includes(n)) s = 5;
      if (s >= 0) ranked.push({ b, s });
    }
    ranked.sort((x, y) => x.s - y.s || (x.b.title || "").localeCompare(y.b.title || ""));
    return ranked.slice(0, 8).map((r) => r.b);
  }, [allBooks, searchValue]);

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
        body: `by ${r.books?.author ?? ""} · return by ${formatDMY(r.due_at)}`,
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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Realtime: live-refresh notifications/rentals for the signed-in user.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rentals", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["rentals"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["waitlist"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

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
    <div className="min-h-screen text-foreground pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl safe-top">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-2 px-3 md:h-16 md:gap-4 md:px-6">
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
            <div className="hidden max-w-[220px] sm:block">
              <LibrarySwitcher compact />
            </div>
          </div>

          {pathname !== "/search" && (
            <div ref={searchRef} className="relative hidden flex-1 max-w-2xl md:block">
              <form onSubmit={(e) => { e.preventDefault(); setSearchOpen(false); goSearch(searchValue); }}>
                <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface/50 px-4 py-2.5 text-sm focus-within:border-primary/60">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={searchValue}
                    onChange={(e) => { setSearchValue(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setSearchOpen(false); goSearch(searchValue); } if (e.key === "Escape") setSearchOpen(false); }}
                    placeholder="Search titles, authors, genres, shelf codes…"
                    className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                  />
                  {searchValue && (
                    <button type="button" onClick={() => { setSearchValue(""); setSearchOpen(false); }} className="cursor-pointer text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </form>
              {searchOpen && searchValue.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
                  {suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No matches. Press Enter to search anyway.</div>
                  ) : (
                    <ul className="max-h-96 overflow-y-auto">
                      {suggestions.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearchOpen(false);
                              setSearchValue("");
                              navigate({ to: "/books/$id", params: { id: b.id } });
                            }}
                            className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-surface-elevated"
                          >
                            <div className="grid h-9 w-7 shrink-0 place-items-center rounded bg-gradient-to-br from-primary/30 to-accent/20 text-[10px] font-bold text-primary">
                              {b.shelf_code ?? "—"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{b.title}</div>
                              <div className="truncate text-xs text-muted-foreground">{b.author}{b.genre ? ` · ${b.genre}` : ""}</div>
                            </div>
                          </button>
                        </li>
                      ))}
                      <li className="border-t border-border/40">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setSearchOpen(false); goSearch(searchValue); }}
                          className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-surface-elevated"
                        >
                          <span>See all results for "{searchValue.trim()}"</span>
                          <Search className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 md:gap-3">
            {user && profile ? (
              <>
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
                                  <Link to="/tracking" onClick={() => setBellOpen(false)} className="block cursor-pointer">{Inner}</Link>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Staff: top-level Admin button (always visible, doesn't depend on dropdown) */}
                {isStaff && (
                  <Link
                    to="/admin"
                    className="hidden cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 sm:inline-flex"
                    title="Library admin"
                  >
                    <Shield className="h-3.5 w-3.5" /> Admin
                  </Link>
                )}

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
                      </div>
                      <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                        <UserRound className="h-4 w-4" /> Profile
                      </Link>
                      <Link to="/tracking" onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                        <Truck className="h-4 w-4" /> Tracking & waitlist
                      </Link>
                      <Link to="/diary" onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                        <NotebookPen className="h-4 w-4" /> Reading diary
                      </Link>
                      <Link to="/loved" onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                        <Heart className="h-4 w-4" /> Loved books
                      </Link>
                      {selected?.slug && (
                        <Link to="/libraries/$slug" params={{ slug: selected.slug }} onClick={() => setMenuOpen(false)} className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-elevated">
                          <Building2 className="h-4 w-4" /> Library profile
                        </Link>
                      )}
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
            ) : (
              <Link
                to="/auth"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90"
              >
                <UserRound className="h-4 w-4" /> Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-border/60 bg-background/60 px-4 py-2 sm:hidden">
        <LibrarySwitcher compact />
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-3 py-4 sm:px-4 md:px-6 md:py-6">
        <aside className="sticky top-20 hidden h-fit w-60 shrink-0 flex-col gap-6 self-start md:flex">
          <nav className="glass-card flex flex-col gap-1 rounded-2xl p-3">
            <div className="flex items-center justify-between px-3 pb-1 pt-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Browse</span>
              <button
                type="button"
                onClick={() => setHideBrowse(!hideBrowse)}
                title={hideBrowse ? "Show Browse links" : "Hide Browse links"}
                className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              >
                {hideBrowse ? "Show" : "Hide"}
              </button>
            </div>
            {!hideBrowse && navMain.map((n) => {
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
            {!hideBrowse && selected?.slug && (
              <Link
                to="/libraries/$slug"
                params={{ slug: selected.slug }}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  pathname.startsWith("/libraries/") ? "bg-primary/15 text-primary" : "text-foreground/80 hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <Building2 className="h-4 w-4" />
                Library profile
              </Link>
            )}
            <div className="flex items-center justify-between px-3 pb-1 pt-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Your shelf</span>
              <button
                type="button"
                onClick={() => setHideShelves(!hideShelves)}
                title={hideShelves ? "Show shelf links" : "Hide shelf links"}
                className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
              >
                {hideShelves ? "Show" : "Hide"}
              </button>
            </div>
            {!hideShelves && navMine.map((n) => {
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
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
