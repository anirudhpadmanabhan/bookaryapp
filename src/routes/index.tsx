import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, fetchNewArrivals, sortBooks, type BookSort, slugify } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { BookCard } from "@/components/BookCard";
import { colorAt } from "@/lib/books";
import { SortBar } from "@/components/SortBar";
import { ArrowRight, Library, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bookary — Cherukad Smaraka Vayanasala" },
      { name: "description", content: "Browse 4,650+ Malayalam books from Cherukad Smaraka Vayanasala & Grandhalayam, Naduvil." },
    ],
  }),
  component: HomePage,
});

const HOME_LIMIT = 60;

function HomePage() {
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { data: newArrivals = [] } = useQuery({ queryKey: ["new-arrivals"], queryFn: fetchNewArrivals });
  const [sort, setSort] = useState<BookSort>("newest");
  const [view, setView] = useState<ViewMode>("tile");
  const [genresOpen, setGenresOpen] = useState(false);

  const sorted = useMemo(() => sortBooks(books, sort), [books, sort]);
  const shown = sorted.slice(0, HOME_LIMIT);

  const genres = useMemo(() => {
    const map = new Map<string, { count: number; ml: string | null }>();
    for (const b of books) {
      const cur = map.get(b.genre);
      if (cur) cur.count++;
      else map.set(b.genre, { count: 1, ml: b.genre_ml });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [books]);

  return (
    <AppLayout>
      {/* Hero */}
      <section className="glass-card relative mb-8 overflow-hidden rounded-3xl p-6 md:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wider text-white/80 backdrop-blur">
            <Sparkles className="h-3 w-3" /> Cherukad Smaraka Vayanasala
          </div>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            <span className="font-mal text-accent">ചെറുകാട്</span> reading library — every book on every rack.
          </h1>
          <p className="mt-4 text-base text-foreground/80 md:text-lg">
            {books.length.toLocaleString()} titles across {genres.length} genres, all browsable by shelf code.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/search" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Browse the catalog <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/genres" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-5 py-3 text-sm font-semibold hover:bg-surface">
              Explore genres
            </Link>
          </div>
        </div>
      </section>

      {/* Newly Arrived — pinned 5 books from latest delivery */}
      {newArrivals.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-accent">
                <Sparkles className="h-4 w-4" /> Just added to the shelf
              </div>
              <h2 className="text-xl font-bold">Newly Arrived Volumes</h2>
            </div>
            <span className="text-xs text-muted-foreground">{newArrivals.length} new this week</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {newArrivals.map((b, i) => (
              <BookCard key={b.id} book={b} coverColor={colorAt(i)} />
            ))}
          </div>
        </section>
      )}

      {/* Genres — minimized strip */}
      <section className="mb-8">
        <button
          type="button"
          onClick={() => setGenresOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-surface/40 px-4 py-3 text-sm hover:bg-surface/60"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Library className="h-4 w-4 text-primary" /> Browse by Genre
            <span className="text-xs font-normal text-muted-foreground">({genres.length})</span>
          </span>
          {genresOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {genresOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {genres.slice(0, 30).map(([g, info]) => (
              <Link
                key={g}
                to="/genres/$slug"
                params={{ slug: slugify(g) }}
                className="cursor-pointer rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs hover:border-primary/60 hover:text-primary"
              >
                {info.ml ?? g} <span className="text-muted-foreground">· {info.count}</span>
              </Link>
            ))}
            <Link to="/genres" className="cursor-pointer rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25">
              All genres ›
            </Link>
          </div>
        )}
      </section>

      {/* All Books */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Library className="h-4 w-4 text-primary" />
              The full collection
            </div>
            <h2 className="text-xl font-bold">All Books</h2>
          </div>
          <Link to="/search" className="cursor-pointer text-sm font-medium text-primary hover:underline">
            See all {books.length.toLocaleString()} ›
          </Link>
        </div>
        <SortBar
          count={shown.length}
          total={books.length}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={setView}
        />
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : (
          <BooksGrid books={shown} view={view} />
        )}
      </section>
    </AppLayout>
  );
}
