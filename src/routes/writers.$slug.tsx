import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useLibrary } from "@/lib/library";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, genreEnglish, genreMalayalam, sortBooks, unslug, type BookSort } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { SortBar } from "@/components/SortBar";
import { ArrowLeft, Feather, BookOpen } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/writers/$slug")({
  ssr: false,
  component: WriterPage,
});

function WriterPage() {
  const { slug } = Route.useParams();
  const target = unslug(slug);
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [sort, setSort] = useState<BookSort>("newest");
  const [view, setView] = useState<ViewMode>("tile");

  const byAuthor = useMemo(
    () => books.filter((b) => b.author.toLowerCase() === target.toLowerCase()),
    [books, target],
  );
  const sorted = useMemo(() => sortBooks(byAuthor, sort), [byAuthor, sort]);
  const mlName = byAuthor[0]?.author_ml;
  const original = byAuthor[0]?.original_author;
  const genres = [...new Map(byAuthor.map((b) => [genreEnglish(b), genreMalayalam(b)])).entries()];
  const avgRating = byAuthor.length ? byAuthor.reduce((s, b) => s + Number(b.rating), 0) / byAuthor.length : 0;

  return (
    <AppLayout>
      <Link to="/writers" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All writers
      </Link>

      {/* Writer profile card */}
      <div className="glass-card mb-6 grid gap-5 rounded-3xl p-6 md:grid-cols-[120px_1fr]">
        <div className="grid h-28 w-28 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent">
          <Feather className="h-12 w-12 text-white" />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Feather className="h-3.5 w-3.5 text-accent" /> Writer
          </div>
          <h1 className="text-3xl font-bold">{byAuthor[0]?.author ?? target}</h1>
          {mlName && <p className="font-mal mt-1 text-xl text-accent">{mlName}</p>}
          {original && original !== mlName && (
            <p className="mt-1 text-xs text-muted-foreground">Also written as <span className="font-mal">{original}</span></p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
              <BookOpen className="h-3 w-3" /> {byAuthor.length.toLocaleString()} title{byAuthor.length !== 1 && "s"}
            </span>
            {genres.slice(0, 4).map(([en, ml]) => (
              <span key={en} className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground">{en}{ml ? ` / ${ml}` : ""}</span>
            ))}
            {genres.length > 4 && <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground">+{genres.length - 4} more</span>}
            {avgRating > 0 && <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">★ {avgRating.toFixed(1)} avg rating</span>}
          </div>
        </div>
      </div>

      <SortBar count={byAuthor.length} sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <BooksGrid books={sorted} view={view} />}
    </AppLayout>
  );
}
