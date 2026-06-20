import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, sortBooks, unslug, type BookSort } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { SortBar } from "@/components/SortBar";
import { ArrowLeft, Library } from "lucide-react";
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
  const mlName = inGenre[0]?.genre_ml;

  return (
    <AppLayout>
      <Link to="/genres" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All genres
      </Link>
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Library className="h-4 w-4 text-primary" /> Genre
      </div>
      <h1 className="text-3xl font-bold capitalize">{inGenre[0]?.genre ?? target}</h1>
      {mlName && <p className="font-mal mt-1 text-xl text-accent">{mlName}</p>}
      <p className="mb-5 mt-2 text-sm text-muted-foreground">{inGenre.length.toLocaleString()} title{inGenre.length !== 1 && "s"} in this genre</p>

      <SortBar count={inGenre.length} sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <BooksGrid books={sorted} view={view} />}
    </AppLayout>
  );
}
