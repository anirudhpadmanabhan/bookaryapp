import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, genreEnglish, genreMalayalam, sortBooks, unslug, type BookSort } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { SortBar } from "@/components/SortBar";
import { ArrowLeft, Library, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/genres/$slug")({
  ssr: false,
  component: GenrePage,
});

function GenrePage() {
  const { slug } = Route.useParams();
  const target = unslug(slug);
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [sort, setSort] = useState<BookSort>("newest");
  const [view, setView] = useState<ViewMode>("tile");

  const inGenre = useMemo(
    () => books.filter((b) => b.genre.toLowerCase() === target.toLowerCase()),
    [books, target],
  );
  const sorted = useMemo(() => sortBooks(inGenre, sort), [inGenre, sort]);
  const mlName = inGenre[0] ? genreMalayalam(inGenre[0]) : null;
  const enName = inGenre[0] ? genreEnglish(inGenre[0]) : genreEnglish(target);
  const authors = [...new Set(inGenre.map((b) => b.author))];
  const avgRating = inGenre.length ? inGenre.reduce((s, b) => s + Number(b.rating), 0) / inGenre.length : 0;

  return (
    <AppLayout>
      <Link to="/genres" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All genres
      </Link>

      <div className="glass-card mb-6 grid gap-5 rounded-3xl p-6 md:grid-cols-[120px_1fr]">
        <div className="grid h-28 w-28 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent">
          <Library className="h-12 w-12 text-white" />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Library className="h-3.5 w-3.5 text-primary" /> Genre
          </div>
          <h1 className="text-3xl font-bold capitalize">{enName}</h1>
          {mlName && <p className="font-mal mt-1 text-xl text-accent">{mlName}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
              <BookOpen className="h-3 w-3" /> {inGenre.length.toLocaleString()} title{inGenre.length !== 1 && "s"}
            </span>
            <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground">{authors.length} author{authors.length !== 1 && "s"}</span>
            {avgRating > 0 && <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">★ {avgRating.toFixed(1)} avg rating</span>}
          </div>
        </div>
      </div>

      <SortBar count={inGenre.length} sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <BooksGrid books={sorted} view={view} />}
    </AppLayout>
  );
}
