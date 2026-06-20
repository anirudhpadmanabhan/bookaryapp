import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { fetchBook, synopsisFor } from "@/lib/books";
import { BookCover } from "@/components/BookCover";
import {
  Heart, Star, Calendar, ArrowLeft, NotebookPen,
  Building2, MapPin, Globe, User as UserIcon, MessageSquare, Trash2, Pencil, Quote, X,
} from "lucide-react";
import {
  useFavorites, useRentals, useRentBook, useToggleFavorite, useAddDiary,
  useReviews, useUpsertReview, useDeleteReview, useProfile,
} from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/books/$id")({
  ssr: false,
  component: BookPage,
});

function BookPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: book, isLoading } = useQuery({ queryKey: ["book", id], queryFn: () => fetchBook(id) });
  const { data: favorites } = useFavorites();
  const { data: rentals } = useRentals();
  const { data: reviews = [] } = useReviews(id);
  const rent = useRentBook();
  const toggle = useToggleFavorite();
  const addDiary = useAddDiary();
  const [note, setNote] = useState("");
  const [showRent, setShowRent] = useState(false);

  const avgRating = useMemo(() => {
    if (!reviews.length) return null;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  if (isLoading) return <AppLayout><div className="h-64 animate-pulse rounded-2xl bg-surface" /></AppLayout>;
  if (!book) return <AppLayout><p>Book not found.</p></AppLayout>;

  const isFav = !!favorites?.some((f) => f.book_id === book.id);
  const activeRental = rentals?.find((r: any) => r.book_id === book.id && !r.returned_at);
  const displayRating = avgRating ?? Number(book.rating);

  const requireSignIn = (msg: string) => {
    toast.error(msg);
    navigate({ to: "/auth", search: { redirect: pathname } });
  };

  const submitDiary = () => {
    if (!note.trim()) return toast.error("Write something");
    addDiary.mutate({ bookId: book.id, note: note.trim(), progress: 0 }, { onSuccess: () => setNote("") });
  };

  return (
    <AppLayout>
      <button onClick={() => navigate({ to: "/" })} className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to library
      </button>
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="max-w-[280px]">
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} className="w-full rounded-xl shadow-lg" />
          ) : (
            <BookCover book={book} />
          )}
          {book.shelf_code && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">Rack #{book.shelf_code}</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            {book.genre} {book.genre_ml && <>· <span className="font-mal text-accent">{book.genre_ml}</span></>}
          </div>
          <h1 className="mt-1 text-3xl font-bold md:text-4xl">{book.title}</h1>
          {book.title_ml && <p className="font-mal mt-1 text-xl text-accent">{book.title_ml}</p>}
          <p className="mt-3 text-muted-foreground">
            by <span className="font-medium text-foreground">{book.author}</span>
            {book.author_ml && <> · <span className="font-mal">{book.author_ml}</span></>}
          </p>
          {book.original_author && book.original_author !== book.author_ml && (
            <p className="mt-1 text-xs text-muted-foreground">Original author: <span className="font-mal">{book.original_author}</span></p>
          )}

          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-300">
              <Star className="h-3.5 w-3.5 fill-amber-300" />
              {displayRating.toFixed(1)}
              {reviews.length > 0 && <span className="text-xs text-amber-200/70">· {reviews.length} review{reviews.length !== 1 && "s"}</span>}
            </span>
            {book.shelf_code && <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-primary"><MapPin className="h-3.5 w-3.5" />Rack {book.shelf_code}</span>}
            {book.published_year && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"><Calendar className="h-3.5 w-3.5" />{book.published_year}</span>}
            {book.publisher && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"><Building2 className="h-3.5 w-3.5" />{book.publisher}</span>}
            {book.language && <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5"><Globe className="h-3.5 w-3.5" />{book.language}</span>}
          </div>

          <div className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</h2>
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
                onClick={() => user ? setShowRent(true) : requireSignIn("Sign in to rent")}
                disabled={rent.isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rent.isPending ? "Renting…" : "Rent Now · 20 days"}
              </button>
            )}
            <button
              type="button"
              onClick={() => user ? toggle.mutate({ bookId: book.id, currentlyFav: isFav }) : requireSignIn("Sign in to save favorites")}
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
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitDiary(); } }}
                placeholder="What struck you on the page today? (Enter to save, Shift+Enter for newline)"
                rows={3}
                className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={submitDiary}
                  disabled={addDiary.isPending}
                  className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  Save entry
                </button>
              </div>
            </div>
          )}

          {!user && (
            <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">
              <Link to="/auth" search={{ redirect: pathname }} className="cursor-pointer font-semibold underline underline-offset-2">Sign in</Link> to rent this book, save it to Loved, leave a review, and start a reading diary.
            </div>
          )}
        </div>
      </div>

      {/* Rent confirmation modal */}
      {showRent && user && profile && (
        <RentModal
          price={Number(book.rent_price)}
          balance={Number(profile.wallet_balance)}
          defaultAddress={profile.address ?? ""}
          title={book.title}
          onClose={() => setShowRent(false)}
          onConfirm={(addr) => {
            rent.mutate(
              { bookId: book.id, price: Number(book.rent_price), address: addr },
              { onSuccess: () => setShowRent(false) },
            );
          }}
          pending={rent.isPending}
        />
      )}

      {/* Reviews section */}
      <section className="mt-12">
        <div className="mb-4 flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-bold">Reviews</h2>
          <span className="text-sm text-muted-foreground">({reviews.length})</span>
        </div>
        {user ? (
          <ReviewForm bookId={book.id} existing={reviews.find((r) => r.user_id === user.id)} />
        ) : (
          <div className="glass-card mb-4 flex items-center justify-between gap-3 rounded-2xl p-4 text-sm">
            <span className="text-muted-foreground">Sign in to share your rating, review, and a favourite quote.</span>
            <Link to="/auth" search={{ redirect: pathname }} className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">Sign in</Link>
          </div>
        )}
        {reviews.length === 0 ? (
          <p className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No reviews yet. {user ? "Be the first to share what you thought." : ""}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {reviews.map((r) => (
              <article key={r.id} className="glass-card rounded-2xl p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
                      <UserIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium">{r.user_id === user?.id ? "You" : "Reader"}</span>
                    <span className="text-xs text-muted-foreground">· {new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </div>
                {r.body && <p className="text-sm text-foreground/85">{r.body}</p>}
                {r.favorite_quote && (
                  <blockquote className="mt-3 flex gap-3 rounded-xl border-l-2 border-accent bg-accent/5 px-4 py-3 text-sm italic text-foreground/85">
                    <Quote className="h-4 w-4 shrink-0 text-accent" />
                    <span>{r.favorite_quote}</span>
                  </blockquote>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

function RentModal({
  price, balance, defaultAddress, title, onClose, onConfirm, pending,
}: {
  price: number; balance: number; defaultAddress: string; title: string;
  onClose: () => void; onConfirm: (addr: string) => void; pending: boolean;
}) {
  const [address, setAddress] = useState(defaultAddress);
  const insufficient = balance < price;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Confirm rental</h2>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
          <button onClick={onClose} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rental fee</div>
            <div className="text-lg font-bold">₹{price.toFixed(0)}</div>
          </div>
          <div className={`rounded-xl p-3 ${insufficient ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Wallet</div>
            <div className="text-lg font-bold">₹{balance.toFixed(0)}</div>
          </div>
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery address</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="House, street, town, pincode"
          rows={3}
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Saved to your profile so future rentals pre-fill.</p>

        <div className="mt-4 rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5 text-xs text-muted-foreground">
          Return window: <span className="font-medium text-foreground">20 days</span> from confirmation.
          You'll see live tracking in your Profile → Active rentals.
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-surface-elevated">Cancel</button>
          <button
            onClick={() => onConfirm(address)}
            disabled={pending || insufficient || !address.trim()}
            className="flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {insufficient ? "Top up wallet first" : pending ? "Confirming…" : `Confirm · ₹${price.toFixed(0)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewForm({ bookId, existing }: { bookId: string; existing?: { id: string; rating: number; body: string; favorite_quote?: string | null } }) {
  const upsert = useUpsertReview();
  const del = useDeleteReview();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [quote, setQuote] = useState(existing?.favorite_quote ?? "");
  const [editing, setEditing] = useState(!existing);

  if (existing && !editing) {
    return (
      <div className="glass-card mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <span className="text-sm">Your review:</span>
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < existing.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        {existing.favorite_quote && (
          <span className="max-w-xs truncate text-xs italic text-muted-foreground">"{existing.favorite_quote}"</span>
        )}
        <button onClick={() => setEditing(true)} className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-elevated">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button onClick={() => del.mutate({ bookId })} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    );
  }

  const displayRating = hover || rating;

  return (
    <div className="glass-card mb-4 rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium">Your rating:</span>
        <div onMouseLeave={() => setHover(0)} className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i + 1)}
              onMouseEnter={() => setHover(i + 1)}
              className="cursor-pointer p-0.5"
              aria-label={`${i + 1} stars`}
            >
              <Star className={`h-6 w-6 transition ${i < displayRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-200"}`} />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <button type="button" onClick={() => setRating(0)} className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Clear</button>
        )}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your thoughts (optional)…"
        rows={3}
        className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm outline-none focus:border-primary"
      />
      <div className="mt-3">
        <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Quote className="h-3 w-3 text-accent" /> Favourite quote (optional)
        </label>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="A line from the book that stayed with you…"
          rows={2}
          className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm italic outline-none focus:border-primary"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            if (rating === 0) return toast.error("Pick a star rating first");
            upsert.mutate({ bookId, rating, body: body.trim(), quote: quote.trim() }, { onSuccess: () => setEditing(false) });
          }}
          disabled={upsert.isPending}
          className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {existing ? "Update review" : "Post review"}
        </button>
        {existing && (
          <button onClick={() => { setEditing(false); setRating(existing.rating); setBody(existing.body); setQuote(existing.favorite_quote ?? ""); }} className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
