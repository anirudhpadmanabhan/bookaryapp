import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, colorAt, slugify } from "@/lib/books";
import { useState, useMemo } from "react";
import { Search as SearchIcon, Feather, ArrowDownUp } from "lucide-react";

type WriterSort = "popular" | "az";

export const Route = createFileRoute("/writers")({
  ssr: false,
  head: () => ({ meta: [{ title: "Writers · Bookary" }, { name: "description", content: "Discover Malayalam writers in the Cherukad library." }] }),
  component: () => <Outlet />,
});

const CSVG_KEYWORDS = ["csvg", "cherukad smaraka", "ചെറുകാട്"];

function isCsvg(name: string, ml: string | null): boolean {
  const hay = `${name} ${ml ?? ""}`.toLowerCase();
  return CSVG_KEYWORDS.some((k) => hay.includes(k));
}

export function WritersPage() {
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<WriterSort>("popular");

  const authors = useMemo(() => {
    const map = new Map<string, { count: number; ml: string | null }>();
    for (const b of books) {
      const cur = map.get(b.author);
      if (cur) cur.count++;
      else map.set(b.author, { count: 1, ml: b.author_ml });
    }
    return Array.from(map.entries());
  }, [books]);

  const sorted = useMemo(() => {
    const arr = [...authors];
    if (sort === "az") {
      arr.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      arr.sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
    }
    // Always push CSVG-style internal "writers" to the bottom.
    return arr.sort((a, b) => Number(isCsvg(a[0], a[1].ml)) - Number(isCsvg(b[0], b[1].ml)));
  }, [authors, sort]);

  const filtered = q.trim()
    ? sorted.filter(([a, info]) => a.toLowerCase().includes(q.toLowerCase()) || (info.ml ?? "").includes(q))
    : sorted;

  return (
    <AppLayout>
      <h1 className="mb-1 text-2xl font-bold">Famous Writers</h1>
      <p className="mb-5 text-sm text-muted-foreground">{authors.length} authors · {books.length.toLocaleString()} titles</p>

      {/* Search + sort row — sort sits to the right of the search box. */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="glass-card flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a writer (English or Malayalam)…"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-sm">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          <select aria-label="Sort writers by" value={sort} onChange={(e) => setSort(e.target.value as WriterSort)} className="cursor-pointer bg-transparent text-sm outline-none">
            <option value="popular" className="bg-background">Most titles</option>
            <option value="az" className="bg-background">Name A–Z</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map(([author, info], i) => (
          <Link
            key={author}
            to="/writers/$slug"
            params={{ slug: slugify(author) }}
            className={`cover cover-${colorAt(i)} aspect-[4/3] flex flex-col justify-between !p-4 cursor-pointer transition-transform hover:scale-[1.02]`}
          >
            <Feather className="h-5 w-5 text-white/70" />
            <div>
              <div className="text-base font-bold leading-tight line-clamp-2">{author}</div>
              {info.ml && <div className="font-mal text-sm text-white/85 line-clamp-1">{info.ml}</div>}
              <div className="mt-2 text-xs text-white/75">{info.count} title{info.count !== 1 && "s"}</div>
            </div>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && <p className="mt-8 text-center text-sm text-muted-foreground">No writers match "{q}".</p>}
    </AppLayout>
  );
}
