import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import {
  fetchBooks, sortBooks, type BookSort, type SortDirection,
} from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { SortBar } from "@/components/SortBar";
import { Search as SearchIcon, Lightbulb } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { z } from "zod";
import { useSession } from "@/lib/auth";
import { useSuggestBook } from "@/lib/userdata";
import { toast } from "sonner";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Search the catalog · Bookary" }] }),
  component: SearchPage,
});

const PAGE_SIZE = 40;

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<BookSort>("newest");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<ViewMode>("tile");
  const [showDropdown, setShowDropdown] = useState(false);
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks, staleTime: 5 * 60_000 });
  const { user } = useSession();
  const suggest = useSuggestBook();
  const [suggestAuthor, setSuggestAuthor] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const trimmed = q.trim();

  // Score each match: prefix > word-prefix > contains, with title preferred over author over other.
  // Lower score = more relevant. Returns null if no match.
  type Ranked = { book: typeof books[number]; score: number; bucket: 0 | 1 | 2 };
  const scoreMatch = (b: typeof books[number], needle: string): { score: number; bucket: 0 | 1 | 2 } | null => {
    const n = needle.toLowerCase().trim();
    if (!n) return null;
    const title = `${b.title ?? ""} ${b.title_ml ?? ""}`.toLowerCase().trim();
    const author = `${b.author ?? ""} ${b.author_ml ?? ""} ${b.original_author ?? ""}`.toLowerCase().trim();
    const other = `${b.genre ?? ""} ${b.genre_ml ?? ""} ${b.publisher ?? ""} ${b.shelf_code ?? ""}`.toLowerCase();

    const rank = (hay: string): number => {
      if (!hay) return -1;
      if (hay.startsWith(n)) return 0;            // exact prefix
      if (new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}`).test(hay)) return 1; // word-start
      if (hay.includes(n)) return 2;              // contains
      return -1;
    };

    const t = rank(title);
    if (t >= 0) return { score: t, bucket: 0 };       // 0,1,2
    const a = rank(author);
    if (a >= 0) return { score: 3 + a, bucket: 1 };   // 3,4,5
    if (other.includes(n)) return { score: 6, bucket: 2 };
    return null;
  };

  const alphaTitle = (a: typeof books[number], b: typeof books[number]) =>
    (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });

  const liveSuggestions = useMemo(() => {
    if (!trimmed || trimmed.length < 2) return [];
    const ranked: Ranked[] = [];
    for (const b of books) {
      const m = scoreMatch(b, trimmed);
      if (m) ranked.push({ book: b, score: m.score, bucket: m.bucket });
    }
    ranked.sort((x, y) => x.score - y.score || alphaTitle(x.book, y.book));
    return ranked.slice(0, 10).map((r) => r.book);
  }, [books, trimmed]);

  const filtered = useMemo(() => {
    if (!trimmed) return sortBooks(books, sort, direction);
    const ranked: Ranked[] = [];
    for (const b of books) {
      const m = scoreMatch(b, trimmed);
      if (m) ranked.push({ book: b, score: m.score, bucket: m.bucket });
    }
    // When the user hasn't picked an explicit sort (default newest), use relevance score.
    if (sort === "newest" && direction === "desc") {
      ranked.sort((x, y) => x.score - y.score || alphaTitle(x.book, y.book));
      return ranked.map((r) => r.book);
    }
    return sortBooks(ranked.map((r) => r.book), sort, direction);
  }, [books, trimmed, sort, direction]);



  useEffect(() => { setVisible(PAGE_SIZE); }, [q, sort, direction]);

  const pageItems = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible((v) => v + PAGE_SIZE);
      }
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length]);

  const submitSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    if (!user) return toast.error("Sign in to suggest a book");
    suggest.mutate(
      { title: trimmed, author: suggestAuthor, note: suggestNote },
      { onSuccess: () => { setSuggestAuthor(""); setSuggestNote(""); } },
    );
  };


  return (
    <AppLayout>
      <h1 className="mb-1 text-2xl font-bold">Search the catalog</h1>
      <p className="mb-5 text-sm text-muted-foreground">{books.length.toLocaleString()} books available — search by title, author, genre, or shelf code.</p>
      <div className="relative mb-4">
        <div className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            autoFocus
            aria-label="Search the catalog"
            value={q}
            onChange={(e) => { setQ(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Try 'Basheer', 'നോവൽ', 'Aadujeevitham', or a shelf number…"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {q && <button onClick={() => setQ("")} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Clear</button>}
        </div>

        {/* Live autocomplete dropdown — grouped: Books → Authors → Other */}
        {showDropdown && liveSuggestions.length > 0 && (() => {
          const titleHits = liveSuggestions.filter((b) => rankMatch(b, trimmed, trimmed) === 0);
          const authorHits = liveSuggestions.filter((b) => rankMatch(b, trimmed, trimmed) === 1);
          const otherHits = liveSuggestions.filter((b) => rankMatch(b, trimmed, trimmed) === 2);
          const Group = ({ label, items }: { label: string; items: typeof liveSuggestions }) =>
            items.length === 0 ? null : (
              <div>
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
                <ul>
                  {items.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setQ(b.title); setShowDropdown(false); }}
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
                </ul>
              </div>
            );
          return (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded-2xl border border-border bg-popover shadow-2xl">
              <Group label="Books" items={titleHits} />
              {titleHits.length > 0 && (authorHits.length > 0 || otherHits.length > 0) && <div className="border-t border-border/40" />}
              <Group label="Authors" items={authorHits} />
              {authorHits.length > 0 && otherHits.length > 0 && <div className="border-t border-border/40" />}
              <Group label="Other" items={otherHits} />
            </div>
          );
        })()}
      </div>


      <SortBar
        count={filtered.length}
        sort={sort}
        onSortChange={setSort}
        direction={direction}
        onDirectionChange={setDirection}
        view={view}
        onViewChange={setView}
      />

      {filtered.length === 0 ? (
        <div className="glass-card mt-6 rounded-2xl p-6">
          <div className="mb-3 flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-500/15 text-amber-300">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">No matches for "{trimmed}"</h3>
              <p className="text-sm text-muted-foreground">Don't see what you're looking for? Suggest it to the library — we'll consider adding it to the next batch.</p>
            </div>
          </div>
          <form onSubmit={submitSuggestion} className="grid gap-3 sm:grid-cols-2">
            <input
              value={trimmed}
              readOnly
              className="rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm text-muted-foreground"
            />
            <input
              value={suggestAuthor}
              onChange={(e) => setSuggestAuthor(e.target.value)}
              placeholder="Author (optional)"
              className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={suggestNote}
              onChange={(e) => setSuggestNote(e.target.value)}
              placeholder="Why should we add it? (optional)"
              rows={2}
              className="rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!trimmed || suggest.isPending}
                className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggest.isPending ? "Sending…" : "Suggest this book to the library"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <BooksGrid books={pageItems} view={view} />
      )}

      {filtered.length > 0 && (
        <>
          <div ref={sentinelRef} className="h-10" />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {hasMore
              ? `Showing ${pageItems.length} of ${filtered.length.toLocaleString()} — scroll for more`
              : `All ${filtered.length.toLocaleString()} results shown`}
          </p>
        </>
      )}
    </AppLayout>
  );
}
