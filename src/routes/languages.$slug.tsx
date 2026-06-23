import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, sortBooks, unslug, slugify, type BookSort } from "@/lib/books";
import { BooksGrid, type ViewMode } from "@/components/BooksGrid";
import { SortBar } from "@/components/SortBar";
import { ArrowLeft, Languages as LangIcon, BookOpen, Library, PenLine } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/languages/$slug")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `${unslug(params.slug)} books · Bookary` },
      { name: "description", content: `Browse ${unslug(params.slug)} titles from Cherukad Smaraka Vayanasala.` },
    ],
  }),
  component: LanguagePage,
});

function LanguagePage() {
  const { slug } = Route.useParams();
  const target = unslug(slug);
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [sort, setSort] = useState<BookSort>("newest");
  const [view, setView] = useState<ViewMode>("tile");

  const inLang = useMemo(
    () => books.filter((b) => (b.language ?? "").toLowerCase() === target.toLowerCase()),
    [books, target],
  );
  const sorted = useMemo(() => sortBooks(inLang, sort), [inLang, sort]);
  const authors = [...new Set(inLang.map((b) => b.author))];

  return (
    <AppLayout>
      <Link to="/languages" className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All languages
      </Link>

      <div className="glass-card mb-6 grid gap-5 rounded-3xl p-6 md:grid-cols-[120px_1fr]">
        <div className="grid h-28 w-28 place-items-center rounded-2xl bg-gradient-to-br from-accent to-primary">
          <LangIcon className="h-12 w-12 text-white" />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <LangIcon className="h-3.5 w-3.5 text-accent" /> Language
          </div>
          <h1 className="text-3xl font-bold capitalize">{target}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
              <BookOpen className="h-3 w-3" /> {inLang.length.toLocaleString()} title{inLang.length !== 1 && "s"}
            </span>
            <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground">{authors.length} author{authors.length !== 1 && "s"}</span>
          </div>
        </div>
      </div>

      <SortBar count={inLang.length} sort={sort} onSortChange={setSort} view={view} onViewChange={setView} />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : <BooksGrid books={sorted} view={view} />}
    </AppLayout>
  );
}
