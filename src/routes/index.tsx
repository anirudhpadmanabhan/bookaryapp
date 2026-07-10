import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchHomeData, fetchBooksPage, fetchGenreFacets, type BookSort, type SortDirection, slugify } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { BookCard } from "@/components/BookCard";
import { colorAt } from "@/lib/books";
import { SortBar } from "@/components/SortBar";
import { useLibrary } from "@/lib/library";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";
import { ArrowRight, Library, PenLine, Sparkles, ChevronDown, ChevronUp, Languages as LangIcon, Flame, ChevronsLeft, ChevronsRight, Building2, Check } from "lucide-react";
import { useMemo, useState, useEffect } from "react";


export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bookary — Library catalogue" },
      { name: "description", content: "Browse Malayalam books available from your local reading library." },
    ],
  }),
  component: HomePage,
});

const HOME_LIMIT = 60;
const PAGE_SIZE = 30;

const ONBOARDING_KEY = "bookary.onboarding_done";

function HomePage() {
  const { libraries, selected, selectedId, setSelectedId } = useLibrary();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = window.localStorage.getItem(ONBOARDING_KEY);
    if (!done && libraries.length >= 1) setShowPicker(true);
  }, [libraries.length]);
  const confirmLibrary = (id: string) => {
    setSelectedId(id);
    window.localStorage.setItem(ONBOARDING_KEY, "1");
    setShowPicker(false);
  };
  const filteredLibraries = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return libraries;
    return libraries.filter((l) =>
      [l.name, l.name_ml ?? "", l.location ?? ""].some((s) => s.toLowerCase().includes(q))
    );
  }, [libraries, pickerQuery]);



  const { data, isLoading } = useQuery({
    queryKey: ["home-data", selectedId],
    queryFn: () => fetchHomeData(HOME_LIMIT, 5),
    staleTime: 5 * 60_000,
  });
  const popular = (data?.popular ?? []).slice(0, 5);
  const writers = data?.writers ?? [];
  const languages = data?.languages ?? [];
  const { data: genreData } = useQuery({
    queryKey: ["genre-facets", selectedId],
    queryFn: fetchGenreFacets,
    staleTime: 5 * 60_000,
  });
  const genres = genreData?.genres ?? [];

  const [sort, setSort] = useState<BookSort>("newest");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [view, setView] = useState<ViewMode>("tile");
  const [page, setPage] = useState(1);
  const [genresOpen, setGenresOpen] = useState(false);
  const [writersOpen, setWritersOpen] = useState(false);
  const [langsOpen, setLangsOpen] = useState(false);

  // Server-paginated "All Published Books" — only fetches the current page.
  const { data: pageData, isLoading: pageLoading, isFetching: pageFetching } = useQuery({
    queryKey: ["books-page", { page, sort, direction, pageSize: PAGE_SIZE, libraryId: selectedId }],
    queryFn: () => fetchBooksPage({ page, pageSize: PAGE_SIZE, sort, direction }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const shown = pageData?.books ?? [];
  const totalAll = pageData?.total ?? data?.total ?? 0;
  const total = data?.total ?? totalAll;
  const pageCount = Math.max(1, Math.ceil(totalAll / PAGE_SIZE));
  // Clamp page if list shrinks.
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount, page]);
  // Reset to page 1 whenever sort changes.
  useEffect(() => { setPage(1); }, [sort, direction]);

  const start = (page - 1) * PAGE_SIZE;

  // Build a compact page-number list with ellipses around the current page.
  const pageNumbers = useMemo(() => {
    const pages: (number | "…")[] = [];
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
    add(1);
    for (let n = page - 2; n <= page + 2; n++) {
      if (n > 1 && n < pageCount) add(n);
    }
    if (pageCount > 1) add(pageCount);
    const withGaps: (number | "…")[] = [];
    for (let i = 0; i < pages.length; i++) {
      const cur = pages[i] as number;
      const prev = pages[i - 1] as number | undefined;
      if (prev !== undefined && cur - prev > 1) withGaps.push("…");
      withGaps.push(cur);
    }
    return withGaps;
  }, [page, pageCount]);



  return (
    <AppLayout>
      {showPicker && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur">
          <div className="glass-card w-full max-w-lg rounded-3xl p-7">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Welcome to Bookary</h2>
                <p className="text-xs text-muted-foreground">Pick your library to see its shelves. You can switch anytime from the top bar.</p>
              </div>
            </div>
            <div className="space-y-2">
              {libraries.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => confirmLibrary(l.id)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-primary/60 hover:bg-surface/60 ${
                    selectedId === l.id ? "border-primary/60 bg-primary/5" : "border-border bg-surface/30"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{l.name}</span>
                      {l.is_default && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary">Default</span>}
                    </div>
                    {l.name_ml && <div className="font-mal text-sm text-accent">{l.name_ml}</div>}
                    {l.location && <div className="text-[11px] text-muted-foreground">{l.location}</div>}
                  </div>
                  {selectedId === l.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { window.localStorage.setItem(ONBOARDING_KEY, "1"); setShowPicker(false); }}
              className="mt-4 w-full cursor-pointer rounded-lg border border-border py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* Hero — dynamic per selected library */}
      <section className="glass-card relative mb-8 overflow-hidden rounded-3xl p-6 md:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wider text-white/80 backdrop-blur">
            <Sparkles className="h-3 w-3" /> {selected?.name ?? "Bookary"}
          </div>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            {selected?.name_ml ? (
              <>
                <span className="font-mal text-accent">{selected.name_ml}</span>
                <span className="block text-xl font-semibold text-foreground/80 mt-2 md:text-2xl">{selected.name}</span>
              </>
            ) : (
              <span>{selected?.name ?? "Reading library"}</span>
            )}
          </h1>
          <p className="mt-4 text-base text-foreground/80 md:text-lg">
            {selected?.location ? <span className="mr-2 text-muted-foreground">📍 {selected.location} ·</span> : null}
            {total.toLocaleString()} books · {genres.length} genres · {writers.length} writers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/search" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Browse the catalog <ArrowRight className="h-4 w-4" />
            </Link>
            {selected?.slug && (
              <Link to="/libraries/$slug" params={{ slug: selected.slug }} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/50 px-5 py-3 text-sm font-semibold hover:bg-surface">
                <Building2 className="h-4 w-4" /> Library profile
              </Link>
            )}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
                key={info.en}
                to="/genres/$slug"
                params={{ slug: slugify(info.slugKey) }}
                className="cursor-pointer rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs hover:border-primary/60 hover:text-primary"
              >
                {info.en}{info.ml && info.ml !== info.en ? ` / ${info.ml}` : ""} <span className="text-muted-foreground">· {info.count}</span>
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
            {languages.slice(0, 30).map((info) => (
              <Link
                key={info.key}
                to="/languages/$slug"
                params={{ slug: slugify(info.key) }}
                className="cursor-pointer rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs hover:border-primary/60 hover:text-primary"
              >
                {info.key} <span className="text-muted-foreground">· {info.count}</span>
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
            See all {total.toLocaleString()} ›
          </Link>
        </div>
        <SortBar
          count={shown.length}
          total={total}
          sort={sort}
          onSortChange={setSort}
          direction={direction}
          onDirectionChange={setDirection}
          view={view}
          onViewChange={setView}
        />
        {(isLoading || pageLoading) && shown.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : (
          <div className={pageFetching ? "opacity-70 transition-opacity" : ""}>
            <BooksGrid books={shown} view={view} hideShelf />
            {pageCount > 1 && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <Pagination>
                  <PaginationContent className="flex-wrap justify-center">
                    <PaginationItem>
                      <PaginationLink
                        aria-label="Go to first page"
                        size="default"
                        className={`gap-1 px-2.5 ${page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                        onClick={() => page > 1 && setPage(1)}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">First</span>
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationPrevious
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        onClick={() => page > 1 && setPage(page - 1)}
                      />
                    </PaginationItem>
                    {pageNumbers.map((p, i) =>
                      p === "…" ? (
                        <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            isActive={p === page}
                            className="cursor-pointer"
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        className={page === pageCount ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        onClick={() => page < pageCount && setPage(page + 1)}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        aria-label="Go to last page"
                        size="default"
                        className={`gap-1 px-2.5 ${page === pageCount ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                        onClick={() => page < pageCount && setPage(pageCount)}
                      >
                        <span className="hidden sm:inline">Last</span>
                        <ChevronsRight className="h-4 w-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p className="text-xs text-muted-foreground">
                  Page {page} of {pageCount} · Showing {start + 1}–{Math.min(start + PAGE_SIZE, totalAll)} of {totalAll.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

      </section>
    </AppLayout>
  );
}
