import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchHomeData, sortBooks, type BookSort, type SortDirection, slugify } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { BookCard } from "@/components/BookCard";
import { colorAt } from "@/lib/books";
import { SortBar } from "@/components/SortBar";
import { ArrowRight, Library, PenLine, Sparkles, ChevronDown, ChevronUp, Languages as LangIcon, Flame } from "lucide-react";
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
  const { data, isLoading } = useQuery({
    queryKey: ["home-data"],
    queryFn: () => fetchHomeData(HOME_LIMIT, 6),
    staleTime: 5 * 60_000,
  });
  const books = data?.latest ?? [];
  const popular = data?.popular ?? [];
  const total = data?.total ?? 0;
  const genres = data?.genres ?? [];
  const writers = data?.writers ?? [];
  const languages = data?.languages ?? [];

  const [sort, setSort] = useState<BookSort>("newest");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<ViewMode>("tile");
  const [genresOpen, setGenresOpen] = useState(false);
  const [writersOpen, setWritersOpen] = useState(false);
  const [langsOpen, setLangsOpen] = useState(false);

  const sorted = useMemo(() => sortBooks(books, sort, direction), [books, sort, direction]);
  const shown = sorted.slice(0, HOME_LIMIT);


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
            Uploaded catalogue: {books.length.toLocaleString()} books · {genres.length} genres · {writers.length} writers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/search" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Browse the catalog <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/genres" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-5 py-3 text-sm font-semibold hover:bg-surface">
              <Library className="h-4 w-4" /> Explore genres
            </Link>
            <Link to="/writers" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-5 py-3 text-sm font-semibold hover:bg-surface">
              <PenLine className="h-4 w-4" /> Explore writers
            </Link>
            <Link to="/languages" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-5 py-3 text-sm font-semibold hover:bg-surface">
              <LangIcon className="h-4 w-4" /> Explore languages
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Must Read */}
      {popular.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-amber-300">
                <Flame className="h-4 w-4" /> Most rented all-time
              </div>
              <h2 className="text-xl font-bold">Popular Must Read Books</h2>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline">Currently available — out books rotate automatically</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {popular.map((b, i) => (
              <BookCard key={b.id} book={b} coverColor={colorAt(i)} />
            ))}
          </div>
        </section>
      )}

      {/* Genres — minimized strip */}
      <section className="mb-4">
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
            {genres.slice(0, 30).map((info) => (
              <Link
                key={info.key}
                to="/genres/$slug"
                params={{ slug: slugify(info.key) }}
                className="cursor-pointer rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs hover:border-primary/60 hover:text-primary"
              >
                {info.key}{info.ml ? ` / ${info.ml}` : ""} <span className="text-muted-foreground">· {info.count}</span>
              </Link>
            ))}
            <Link to="/genres" className="cursor-pointer rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25">
              All genres ›
            </Link>
          </div>
        )}
      </section>

      {/* Writers — minimized strip */}
      <section className="mb-8">
        <button
          type="button"
          onClick={() => setWritersOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-surface/40 px-4 py-3 text-sm hover:bg-surface/60"
        >
          <span className="flex items-center gap-2 font-semibold">
            <PenLine className="h-4 w-4 text-accent" /> Browse by Writer
            <span className="text-xs font-normal text-muted-foreground">({writers.length})</span>
          </span>
          {writersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {writersOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {writers.slice(0, 40).map((info) => (
              <Link
                key={info.key}
                to="/writers/$slug"
                params={{ slug: slugify(info.key) }}
                className="cursor-pointer rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs hover:border-accent/60 hover:text-accent"
              >
                {info.key}{info.ml ? ` / ${info.ml}` : ""} <span className="text-muted-foreground">· {info.count}</span>
              </Link>
            ))}
            <Link to="/writers" className="cursor-pointer rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/25">
              All writers ›
            </Link>
          </div>
        )}
      </section>

      {/* Languages — minimized strip */}
      <section className="mb-8">
        <button
          type="button"
          onClick={() => setLangsOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-surface/40 px-4 py-3 text-sm hover:bg-surface/60"
        >
          <span className="flex items-center gap-2 font-semibold">
            <LangIcon className="h-4 w-4 text-primary" /> Browse by Language
            <span className="text-xs font-normal text-muted-foreground">({languages.length})</span>
          </span>
          {langsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {langsOpen && (
          <div className="mt-3 flex flex-wrap gap-2">
            {languages.slice(0, 30).map(([name, count]) => (
              <Link
                key={name}
                to="/languages/$slug"
                params={{ slug: slugify(name) }}
                className="cursor-pointer rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs hover:border-primary/60 hover:text-primary"
              >
                {name} <span className="text-muted-foreground">· {count}</span>
              </Link>
            ))}
            <Link to="/languages" className="cursor-pointer rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25">
              All languages ›
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
            <h2 className="text-xl font-bold">All Published Books</h2>
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
          direction={direction}
          onDirectionChange={setDirection}
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
          <BooksGrid books={shown} view={view} hideShelf />
        )}
      </section>
    </AppLayout>
  );
}
