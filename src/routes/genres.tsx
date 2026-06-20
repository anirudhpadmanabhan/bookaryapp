import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks } from "@/lib/books";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/genres")({
  ssr: false,
  head: () => ({ meta: [{ title: "Genres · Bookary" }, { name: "description", content: "Browse the Bookary catalog by genre." }] }),
  component: GenresPage,
});

const PALETTE = ["cover-plum", "cover-teal", "cover-rose", "cover-amber", "cover-indigo", "cover-emerald", "cover-sienna", "cover-sapphire"];

function GenresPage() {
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const grouped = new Map<string, { count: number; ml: string | null }>();
  for (const b of books) {
    const cur = grouped.get(b.genre);
    if (cur) cur.count++;
    else grouped.set(b.genre, { count: 1, ml: b.genre_ml });
  }
  const genres = Array.from(grouped.entries()).sort((a, b) => b[1].count - a[1].count);

  return (
    <AppLayout>
      <h1 className="mb-1 text-2xl font-bold">Genres</h1>
      <p className="mb-6 text-sm text-muted-foreground">{genres.length} genres · {books.length} titles total</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {genres.map(([genre, info], i) => (
          <Link
            key={genre}
            to="/search"
            search={{ q: genre }}
            className={`cover ${PALETTE[i % PALETTE.length]} aspect-[4/3] flex flex-col justify-between !p-4 hover:scale-[1.02] transition-transform`}
          >
            <BookOpen className="h-5 w-5 text-white/70" />
            <div>
              <div className="text-lg font-bold leading-tight">{genre}</div>
              {info.ml && <div className="font-mal text-sm text-white/80">{info.ml}</div>}
              <div className="mt-2 text-xs text-white/70">{info.count} title{info.count !== 1 && "s"}</div>
            </div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
