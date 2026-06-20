import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks } from "@/lib/books";
import { BookCard } from "@/components/BookCard";
import { ArrowRight, Flame, Library, Sparkles, Star } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Bookary — Rent Malayalam Books Online" },
      { name: "description", content: "Curated library of Malayalam novels, stories, poetry and study volumes. Rent for 14 days from ₹15." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: books = [], isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });

  const newArrivals = books.slice(0, 5);
  const topRated = [...books].sort((a, b) => b.rating - a.rating).slice(0, 5);
  const genres = Array.from(new Set(books.map((b) => b.genre)));

  return (
    <AppLayout>
      {/* Hero */}
      <section className="glass-card relative mb-8 overflow-hidden rounded-3xl p-8 md:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wider text-white/80 backdrop-blur">
            <Sparkles className="h-3 w-3" /> A reading sanctuary
          </div>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            Read the <span className="font-mal text-accent">മലയാളം</span> classics & the freshest contemporary voices.
          </h1>
          <p className="mt-4 text-base text-foreground/80 md:text-lg">
            From Basheer and MT to Akhil P. Dharmajan — rent any volume for 14 days, save the ones you love, and keep a reading diary as you go.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/search" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Browse the catalog <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/genres" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/50 px-5 py-3 text-sm font-semibold hover:bg-surface">
              Explore genres
            </Link>
          </div>
        </div>
      </section>

      <Shelf
        title="Newly Arrived Volumes"
        subtitle="Most recent acquisitions and freshly digitised editions"
        icon={<Flame className="h-4 w-4 text-orange-400" />}
        books={newArrivals}
        isLoading={isLoading}
      />

      <Shelf
        title="Top Rated"
        subtitle="Reader-loved across the library"
        icon={<Star className="h-4 w-4 text-amber-400" />}
        books={topRated}
        isLoading={isLoading}
      />

      {/* Genres */}
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold">Browse by Genre</h2>
            <p className="text-sm text-muted-foreground">Quick genre select</p>
          </div>
          <Link to="/genres" className="text-sm text-primary hover:underline">All genres ›</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <Link
              key={g}
              to="/search"
              search={{ q: g }}
              className="rounded-full border border-border bg-surface/60 px-4 py-2 text-sm hover:border-primary/60 hover:text-primary"
            >
              {g}
            </Link>
          ))}
        </div>
      </section>

      {/* All Books */}
      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Library className="h-4 w-4 text-primary" />
              Explore the full collection
            </div>
            <h2 className="text-xl font-bold">All Books</h2>
          </div>
          <Link to="/search" className="text-sm font-medium text-primary hover:underline">
            See all books ›
          </Link>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {books.slice(0, 40).map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function Shelf({ title, subtitle, icon, books, isLoading }: { title: string; subtitle: string; icon: React.ReactNode; books: any[]; isLoading: boolean }) {
  return (
    <section className="mt-10">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">{icon}{subtitle}</div>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {books.map((b) => <BookCard key={b.id} book={b} />)}
        </div>
      )}
    </section>
  );
}
