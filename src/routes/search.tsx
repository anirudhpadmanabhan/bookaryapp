import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, sortBooks, type BookSort } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { SortBar } from "@/components/SortBar";
import { Search as SearchIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { z } from "zod";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Search the catalog · Bookary" }, { name: "description", content: "Search Malayalam classics and contemporary releases." }] }),
  component: SearchPage,
});

const PAGE_SIZE = 30;

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BookSort>("newest");
  const [view, setView] = useState<ViewMode>("tile");
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });

  const filtered = useMemo(() => {
    const query = q.trim();
    const base = query
      ? books.filter((b) => {
          const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
          const mlTokens = query.split(/\s+/).filter(Boolean);
          const hay = [b.title, b.author, b.genre, b.publisher ?? "", b.shelf_code ?? ""].join(" ").toLowerCase();
          const hayMl = [b.title_ml ?? "", b.author_ml ?? "", b.genre_ml ?? "", b.original_author ?? ""].join(" ");
          return tokens.every((t, i) => hay.includes(t) || hayMl.includes(mlTokens[i] ?? t));
        })
      : books;
    return sortBooks(base, sort);
  }, [books, q, sort]);

  useEffect(() => { setPage(1); }, [q, sort]);

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
    const sorted = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) pages.push("…");
      pages.push(n);
      prev = n;
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <AppLayout>
      <h1 className="mb-1 text-2xl font-bold">Search the catalog</h1>
      <p className="mb-5 text-sm text-muted-foreground">{books.length.toLocaleString()} books available — search by title, author, genre, or shelf code.</p>
      <div className="glass-card mb-6 flex items-center gap-3 rounded-2xl px-4 py-3">
        <SearchIcon className="h-5 w-5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try 'Basheer', 'നോവൽ', 'Aadujeevitham', or a shelf number…"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {q && <button onClick={() => setQ("")} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Clear</button>}
      </div>

      <SortBar
        count={filtered.length}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
      />

      <BooksGrid books={pageItems} view={view} />

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
