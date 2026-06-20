import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, sortBooks, unslug, type BookSort } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { SortBar } from "@/components/SortBar";
import { ArrowLeft, Feather } from "lucide-react";
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
  const genres = [...new Set(byAuthor.map((b) => b.genre))];

  return (
    <AppLayout>
      <Link to="/writers" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All writers
      </Link>
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Feather className="h-4 w-4 text-accent" /> Writer
      </div>
      <h1 className="text-3xl font-bold">{byAuthor[0]?.author ?? target}</h1>
      {mlName && <p className="font-mal mt-1 text-xl text-accent">{mlName}</p>}
      <p className="mb-5 mt-2 text-sm text-muted-foreground">
        {byAuthor.length.toLocaleString()} title{byAuthor.length !== 1 && "s"}
        {genres.length > 0 && <> · {genres.slice(0, 5).join(", ")}{genres.length > 5 && "…"}</>}
      </p>

      <SortBar count={byAuthor.length} sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <BooksGrid books={sorted} view={view} />}
    </AppLayout>
  );
}
