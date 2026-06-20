import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, colorAt, genreEnglish, genreMalayalam, slugify } from "@/lib/books";
import { BookOpen, Search as SearchIcon, ArrowDownUp } from "lucide-react";
import { useMemo, useState } from "react";

type GenreSort = "popular" | "az";

export const Route = createFileRoute("/genres")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Genres · Bookary" },
      { name: "description", content: "Browse the Cherukad library by genre." },
    ],
  }),
  component: GenresPage,
});

function GenresPage() {
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<GenreSort>("popular");

  const genres = useMemo(() => {
    const map = new Map<string, { count: number; ml: string | null; en: string }>();
    for (const b of books) {
      const cur = map.get(b.genre);
      if (cur) cur.count++;
      else map.set(b.genre, { count: 1, ml: genreMalayalam(b), en: genreEnglish(b) });
    }
    const arr = Array.from(map.entries());
    if (sort === "az") arr.sort((a, b) => a[0].localeCompare(b[0]));
    else arr.sort((a, b) => b[1].count - a[1].count);
    return arr;
  }, [books, sort]);

  const filtered = q.trim()
    ? genres.filter(([g, info]) => g.toLowerCase().includes(q.toLowerCase()) || info.en.toLowerCase().includes(q.toLowerCase()) || (info.ml ?? "").includes(q))
    : genres;

  return (
    <AppLayout>
      <h1 className="mb-1 text-2xl font-bold">Genres</h1>
      <p className="mb-5 text-sm text-muted-foreground">{genres.length} genres · {books.length.toLocaleString()} titles total</p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="glass-card flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter genres in English or Malayalam…"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-sm">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={sort} onChange={(e) => setSort(e.target.value as GenreSort)} className="cursor-pointer bg-transparent text-sm outline-none">
            <option value="popular" className="bg-background">Most titles</option>
            <option value="az" className="bg-background">Name A–Z</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map(([genre, info], i) => (
          <Link
            key={genre}
            to="/genres/$slug"
            params={{ slug: slugify(genre) }}
            className={`cover cover-${colorAt(i)} aspect-[4/3] flex flex-col justify-between !p-4 cursor-pointer transition-transform hover:scale-[1.02]`}
          >
            <BookOpen className="h-5 w-5 text-white/70" />
            <div>
              <div className="text-lg font-bold leading-tight">{info.en}</div>
              {info.ml && <div className="font-mal text-sm text-white/85">{info.ml}</div>}
              <div className="mt-2 text-xs text-white/75">{info.count} title{info.count !== 1 && "s"}</div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && <p className="mt-8 text-center text-sm text-muted-foreground">No genres match "{q}".</p>}
    </AppLayout>
  );
}
