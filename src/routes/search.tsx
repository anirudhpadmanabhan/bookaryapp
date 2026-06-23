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

const PAGE_SIZE = 30;

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BookSort>("newest");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<ViewMode>("tile");
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { user } = useSession();
  const suggest = useSuggestBook();
  const [suggestAuthor, setSuggestAuthor] = useState("");
  const [suggestNote, setSuggestNote] = useState("");

  const trimmed = q.trim();

  // Live suggestions while typing (top 8 matches)
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

  useEffect(() => { setPage(1); }, [q, sort, direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const goTo = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | "…")[] = [];
    const set = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const sortedSet = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    let prev = 0;
    for (const n of sortedSet) {
      if (n - prev > 1) pages.push("…");
      pages.push(n);
      prev = n;
    }
    return pages;
  }, [currentPage, totalPages]);

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

      {totalPages > 1 && (
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
          <button
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          {pageNumbers.map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="px-2 text-sm text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => goTo(p)}
                aria-current={p === currentPage ? "page" : undefined}
                className={`min-w-10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium ${
                  p === currentPage
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card hover:bg-muted"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </AppLayout>
  );
}
