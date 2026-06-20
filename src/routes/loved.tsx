import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBooks } from "@/lib/books";
import { BooksGrid } from "@/components/BooksGrid";
import { useFavorites } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { Heart } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/loved")({
  ssr: false,
  head: () => ({ meta: [{ title: "Loved · Bookary" }] }),
  component: LovedPage,
});

function LovedPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  const { data: books = [] } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const { data: favorites = [] } = useFavorites();
  const favIds = new Set(favorites.map((f) => f.book_id));
  // Dedup by id (in addition to the hook-level dedup) — guards against any stale rows.
  const loved = books.filter((b, i, arr) => favIds.has(b.id) && arr.findIndex((x) => x.id === b.id) === i);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Heart className="h-6 w-6 fill-rose-400 text-rose-400" />
        <h1 className="text-2xl font-bold">Loved</h1>
        <span className="text-sm text-muted-foreground">({loved.length})</span>
      </div>
      {loved.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-muted-foreground">No favourites yet. Tap the heart on any book to save it here.</p>
          <Link to="/" className="mt-4 inline-block cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Browse books</Link>
        </div>
      ) : (
        <BooksGrid books={loved} />
      )}
    </AppLayout>
  );
}
