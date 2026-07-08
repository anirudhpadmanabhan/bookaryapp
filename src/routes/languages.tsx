import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useLibrary } from "@/lib/library";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks, colorAt, slugify } from "@/lib/books";
import { useMemo, useState } from "react";
import { Languages as LangIcon, Search as SearchIcon, ArrowDownUp } from "lucide-react";

type Sort = "popular" | "az";

export const Route = createFileRoute("/languages")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Languages · Bookary" },
      { name: "description", content: "Browse books in the Cherukad library by language — Malayalam, English, Hindi and more." },
    ],
  }),
  component: () => <Outlet />,
});

export function LanguagesPage() {
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("popular");

  const languages = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of books as any[]) {
      const lang = (b.language ?? "Unknown").trim() || "Unknown";
      map.set(lang, (map.get(lang) ?? 0) + 1);
    }
    return Array.from(map.entries());
  }, [books]);

  const sorted = useMemo(() => {
    const arr = [...languages];
    if (sort === "az") arr.sort((a, b) => a[0].localeCompare(b[0]));
    else arr.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return arr;
  }, [languages, sort]);

  const filtered = q.trim()
    ? sorted.filter(([name]) => name.toLowerCase().includes(q.toLowerCase()))
    : sorted;

  return (
    <AppLayout>
      <h1 className="mb-1 text-2xl font-bold">Languages</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {languages.length} language{languages.length !== 1 && "s"} · {books.length.toLocaleString()} titles
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="glass-card flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
          <SearchIcon className="h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a language…"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-sm">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            aria-label="Sort languages by"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="cursor-pointer bg-transparent text-sm outline-none"
          >
            <option value="popular" className="bg-background">Most titles</option>
            <option value="az" className="bg-background">Name A–Z</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map(([name, count], i) => (
          <Link
            key={name}
            to="/languages/$slug"
            params={{ slug: slugify(name) }}
            className={`cover cover-${colorAt(i)} aspect-[4/3] flex flex-col items-center justify-center text-center gap-2 !p-4 cursor-pointer transition-transform hover:scale-[1.02]`}
          >
            <LangIcon className="h-5 w-5 text-white/70" />
            <div>
              <div className="text-base font-bold leading-tight">{name}</div>
              <div className="mt-2 text-xs text-white/75">
                {count.toLocaleString()} title{count !== 1 && "s"}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">No languages match "{q}".</p>
      )}
    </AppLayout>
  );
}
