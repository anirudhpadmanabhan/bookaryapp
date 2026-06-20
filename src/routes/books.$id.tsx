import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBook, synopsisFor } from "@/lib/books";
import { BookCover } from "@/components/BookCover";
import { Heart, Star, BookOpen, Calendar, Coins, ArrowLeft, NotebookPen, Building2 } from "lucide-react";
import { useFavorites, useRentals, useRentBook, useToggleFavorite, useAddDiary } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/books/$id")({
  ssr: false,
  component: BookPage,
});

function BookPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: book, isLoading } = useQuery({ queryKey: ["book", id], queryFn: () => fetchBook(id) });
  const { data: favorites } = useFavorites();
  const { data: rentals } = useRentals();
  const rent = useRentBook();
  const toggle = useToggleFavorite();
  const addDiary = useAddDiary();
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState(10);

  if (isLoading) return <AppLayout><div className="h-64 animate-pulse rounded-2xl bg-surface" /></AppLayout>;
  if (!book) return <AppLayout><p>Book not found.</p></AppLayout>;

  const isFav = !!favorites?.some((f) => f.book_id === book.id);
  const activeRental = rentals?.find((r) => r.book_id === book.id && !r.returned_at);

  return (
    <AppLayout>
      <button onClick={() => navigate({ to: "/" })} className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to library
      </button>
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="max-w-[280px]">
          <BookCover book={book} />
        </div>
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            {book.genre} · <span className="font-mal text-accent">{book.genre_ml}</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">{book.title}</h1>
          <p className="font-mal mt-1 text-xl text-accent">{book.title_ml}</p>
          <p className="mt-3 text-muted-foreground">by <span className="font-medium text-foreground">{book.author}</span> · <span className="font-mal">{book.author_ml}</span></p>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-300"><Star className="h-3.5 w-3.5 fill-amber-300" />{Number(book.rating).toFixed(1)} rating</span>
            {book.pages && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"><BookOpen className="h-3.5 w-3.5" />{book.pages} pages</span>}
            {book.published_year && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"><Calendar className="h-3.5 w-3.5" />{book.published_year}</span>}
            {book.publisher && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"><Building2 className="h-3.5 w-3.5" />{book.publisher}</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"><Coins className="h-3.5 w-3.5" />₹{book.rent_price} / 20 days</span>
          </div>

          <div className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Synopsis</h2>
            <p className="text-base leading-relaxed text-foreground/80">{synopsisFor(book)}</p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            {activeRental ? (
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-300">
                ✓ You've rented this — due {new Date(activeRental.due_at).toLocaleDateString()}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => user ? rent.mutate({ bookId: book.id, price: Number(book.rent_price) }) : (toast.error("Sign in to rent"), navigate({ to: "/auth" }))}
                disabled={rent.isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rent.isPending ? "Renting…" : `Rent for ₹${book.rent_price} · 20 days`}
              </button>
            )}
            <button
              type="button"
              onClick={() => user ? toggle.mutate({ bookId: book.id, currentlyFav: isFav }) : toast.error("Sign in to save favorites")}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold ${isFav ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-border bg-surface hover:bg-surface-elevated"}`}
            >
              <Heart className={`h-4 w-4 ${isFav ? "fill-rose-400" : ""}`} />
              {isFav ? "Loved" : "Add to Loved"}
            </button>
          </div>

          {activeRental && (
            <div className="glass-card mt-8 rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <NotebookPen className="h-4 w-4 text-accent" /> Add to reading diary
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What struck you on the page today?"
                rows={3}
                className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-muted-foreground">Progress {progress}%</label>
                <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
                <button
                  onClick={() => { if (!note.trim()) return toast.error("Write something"); addDiary.mutate({ bookId: book.id, note, progress }); setNote(""); }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Save entry
                </button>
              </div>
            </div>
          )}

          {!user && (
            <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">
              <Link to="/auth" className="font-semibold underline underline-offset-2">Sign in</Link> to rent this book, save it to Loved, and start a reading diary.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
