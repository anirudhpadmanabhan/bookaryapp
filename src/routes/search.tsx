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

const PAGE_SIZE = 60;

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<BookSort>("newest");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<ViewMode>("tile");
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { user } = useSession();
  const suggest = useSuggestBook();
  const [suggestAuthor, setSuggestAuthor] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const trimmed = q.trim();

  const liveSuggestions = useMemo(() => {
    if (!trimmed || trimmed.length < 2) return [];
    const ql = trimmed.toLowerCase();
    return books
      .filter((b) => {
        const hay = [b.title, b.author, b.publisher ?? "", b.shelf_code ?? ""].join(" ").toLowerCase();
        const hayMl = [b.title_ml ?? "", b.author_ml ?? ""].join(" ");
        return hay.includes(ql) || hayMl.includes(trimmed);
      })
      .slice(0, 8);
  }, [books, trimmed]);

  const filtered = useMemo(() => {
    const base = trimmed
      ? books.filter((b) => {
          const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
          const mlTokens = trimmed.split(/\s+/).filter(Boolean);
          const hay = [b.title, b.author, b.genre, b.publisher ?? "", b.shelf_code ?? ""].join(" ").toLowerCase();
          const hayMl = [b.title_ml ?? "", b.author_ml ?? "", b.genre_ml ?? "", b.original_author ?? ""].join(" ");
          return tokens.every((t: string, i: number) => hay.includes(t) || hayMl.includes(mlTokens[i] ?? t));
        })
      : books;
    return sortBooks(base, sort, direction);
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
      <div className="glass-card relative mb-2 flex items-center gap-3 rounded-2xl px-4 py-3">
        <SearchIcon className="h-5 w-5 text-muted-foreground" />
        <input
          autoFocus
          aria-label="Search the catalog"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try 'Basheer', 'നോവൽ', 'Aadujeevitham', or a shelf number…"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {q && <button onClick={() => setQ("")} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Clear</button>}
      </div>

      {/* Live autocomplete suggestions */}
      {liveSuggestions.length > 0 && filtered.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground self-center">Suggestions:</span>
          {liveSuggestions.slice(0, 6).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setQ(b.title)}
              className="cursor-pointer rounded-full border border-border bg-surface/60 px-3 py-1 text-xs hover:border-primary/60 hover:text-primary"
            >
              {b.title}
            </button>
          ))}
        </div>
      )}

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
