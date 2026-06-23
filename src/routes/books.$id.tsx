import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { displayRating as catalogRating, fetchBook, genreEnglish, genreMalayalam, synopsisFor } from "@/lib/books";
import { BookCover } from "@/components/BookCover";
import {
  Heart, Star, Calendar, ArrowLeft, NotebookPen,
  Building2, MapPin, Globe, MessageSquare, Trash2, Pencil, Quote, X, Crosshair, Clock,
} from "lucide-react";
import {
  useFavorites, useRentals, useRentBook, useToggleFavorite, useAddDiary,
  useReviews, useUpsertReview, useDeleteReview, useProfile,
  useWaitlist, useJoinWaitlist, useLeaveWaitlist, useWaitlistPosition,
} from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo, useState, useEffect } from "react";

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
  const { data: myWaitlist = [] } = useWaitlist();
  const { data: waitlistPos } = useWaitlistPosition(id);
  const [otherRental, setOtherRental] = useState<{ due_at: string } | null>(null);

  const rent = useRentBook();
  const joinWait = useJoinWaitlist();
  const leaveWait = useLeaveWaitlist();
  const toggle = useToggleFavorite();
  const addDiary = useAddDiary();
  const [note, setNote] = useState("");
  const [showRent, setShowRent] = useState(false);
  const [showWait, setShowWait] = useState(false);

  const avgRating = useMemo(() => {
    if (!reviews.length) return null;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  // Detect if any OTHER user holds this rental (so we can offer the waitlist).
  useEffect(() => {
    if (!book || !user) { setOtherRental(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("rentals")
        .select("user_id, due_at")
        .eq("book_id", book.id)
        .is("returned_at", null)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.user_id !== user.id) setOtherRental({ due_at: data.due_at });
      else setOtherRental(null);
    })();
    return () => { cancelled = true; };
  }, [book, user, rentals]);

  if (isLoading) return <AppLayout><div className="h-64 animate-pulse rounded-2xl bg-surface" /></AppLayout>;
  if (!book) return <AppLayout><p>Book not found.</p></AppLayout>;

  const isFav = !!favorites?.some((f) => f.book_id === book.id);
  const activeRental = rentals?.find((r: any) => r.book_id === book.id && !r.returned_at);
  const onWaitlist = !!myWaitlist?.some((w: any) => w.book_id === book.id);
  const displayRating = avgRating ?? catalogRating(book);
  const enGenre = genreEnglish(book);
  const mlGenre = genreMalayalam(book);
  // Flat ₹10 covers the first 20 days for every book. After 20 days the book's
  // own rent_price applies as a late fee per cycle.
  const rentPrice = 10;

  const requireSignIn = (msg: string) => {
    toast.error(msg);
    navigate({ to: "/auth", search: { redirect: pathname } });
  };

  const submitDiary = () => {
    if (!note.trim()) return toast.error("Write something");
    addDiary.mutate({ bookId: book.id, note: note.trim() }, { onSuccess: () => setNote("") });
  };

  // Renders the primary action used both inline and in the fixed mobile bar.
  const PrimaryAction = ({ className = "" }: { className?: string }) => {
    if (activeRental) {
      return (
        <span className={`inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-300 ${className}`}>
          ✓ You've rented this — due {new Date(activeRental.due_at).toLocaleDateString()}
        </span>
      );
    }
    if (otherRental) {
      return onWaitlist ? (
        <div className={`flex flex-col items-stretch gap-1.5 ${className}`}>
          <button
            type="button"
            onClick={() => leaveWait.mutate(book.id)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-6 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/20"
          >
            <Clock className="h-4 w-4" /> Cancel waitlist
          </button>
          {typeof waitlistPos === "number" && (
            <span className="text-center text-[11px] text-amber-200/80">You're #{waitlistPos} in line</span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => user ? setShowWait(true) : requireSignIn("Sign in to join the waitlist")}
          className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-amber-950 hover:opacity-90 ${className}`}
        >
          <Clock className="h-4 w-4" /> Join waiting list
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => user ? setShowRent(true) : requireSignIn("Sign in to rent")}
        disabled={rent.isPending}
        className={`relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary to-accent px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-[0_18px_40px_-12px_hsl(var(--primary)/0.7)] transition hover:scale-[1.02] hover:shadow-[0_22px_50px_-12px_hsl(var(--primary)/0.85)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        {rent.isPending ? "Confirming…" : "Rent now"}
      </button>
    );
  };


  return (
    <AppLayout>
      <button onClick={() => navigate({ to: "/" })} className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to library
      </button>
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="max-w-[280px]">
          {book.cover_url ? (
            <img src={book.cover_url} alt={`Cover for ${book.title}`} loading="lazy" decoding="async" className="w-full rounded-xl shadow-lg" />
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
            {enGenre} {mlGenre && <>· <span className="font-mal text-accent">{mlGenre}</span></>}
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

          {otherRental && !activeRental && (
            <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Currently rented by another reader — due {new Date(otherRental.due_at).toLocaleDateString()}. Join the waiting list and you'll be auto-assigned when it's returned.
            </div>
          )}

          {/* Inline action row (hidden on mobile — fixed bar below) */}
          <div className="mt-7 hidden flex-wrap gap-3 md:flex">
            <PrimaryAction />
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
                placeholder="What struck you on the page today?"
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

      {/* Mobile fixed action bar */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border/60 bg-background/95 px-3 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => user ? toggle.mutate({ bookId: book.id, currentlyFav: isFav }) : requireSignIn("Sign in to save favorites")}
            className={`grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-xl border ${isFav ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-border bg-surface"}`}
            aria-label="Loved"
          >
            <Heart className={`h-4 w-4 ${isFav ? "fill-rose-400" : ""}`} />
          </button>
          <div className="flex-1"><PrimaryAction className="w-full !py-3.5" /></div>
        </div>
      </div>

      {/* Rent confirmation modal */}
      {showRent && user && profile && (
        <RentModal
          price={rentPrice}
          balance={Number(profile.wallet_balance)}
          defaultAddress={(profile as any).address ?? ""}
          defaultPhone={(profile as any).phone ?? ""}
          title={book.title}
          onClose={() => setShowRent(false)}
          onConfirm={(addr, phone) => {
            rent.mutate(
              { bookId: book.id, price: rentPrice, address: addr, phone },
              {
                onSuccess: () => {
                  setShowRent(false);
                  toast.success("Rental confirmed — tracking saved to your profile", {
                    action: { label: "Track", onClick: () => navigate({ to: "/profile" }) },
                  });
                },
              },
            );
          }}
          pending={rent.isPending}
        />

      )}

      {/* Waitlist join modal */}
      {showWait && user && profile && (
        <WaitlistModal
          title={book.title}
          defaultAddress={(profile as any).address ?? ""}
          onClose={() => setShowWait(false)}
          onConfirm={(addr) => {
            joinWait.mutate({ bookId: book.id, address: addr }, { onSuccess: () => setShowWait(false) });
          }}
          pending={joinWait.isPending}
        />
      )}

      {/* Reviews section */}
      <section className="mt-12 pb-24 md:pb-0">
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
                  <Link
                    to="/u/$id"
                    params={{ id: r.user_id }}
                    className="flex cursor-pointer items-center gap-2 hover:opacity-90"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
                      {(r.author_display_name ?? "R").slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">
                      {r.user_id === user?.id ? "You" : (r.author_display_name ?? "Reader")}
                    </span>
                    {r.author_tag && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent">{r.author_tag}</span>
                    )}
                    <span className="text-xs text-muted-foreground">· {new Date(r.created_at).toLocaleDateString()}</span>
                  </Link>
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

function useGeolocateAddress(setAddress: (a: string) => void) {
  const [busy, setBusy] = useState(false);
  const detect = () => {
    if (!navigator.geolocation) return toast.error("Geolocation unsupported");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const j = await res.json();
        const addr = j.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setAddress(addr);
        toast.success("Current location filled in");
      } catch {
        toast.error("Couldn't fetch address");
      } finally {
        setBusy(false);
      }
    }, () => { setBusy(false); toast.error("Location permission denied"); });
  };
  return { detect, busy };
}

function RentModal({
  price, balance, defaultAddress, defaultPhone, title, onClose, onConfirm, pending,
}: {
  price: number; balance: number; defaultAddress: string; defaultPhone: string; title: string;
  onClose: () => void; onConfirm: (addr: string, phone: string) => void; pending: boolean;
}) {
  const [address, setAddress] = useState(defaultAddress);
  const [phone, setPhone] = useState(defaultPhone);
  const { detect, busy } = useGeolocateAddress(setAddress);
  const insufficient = balance < price;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Confirm rental</h2>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface/60 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rental fee · 20 days</div>
            <div className="text-lg font-bold">₹{price.toFixed(0)}</div>
          </div>
          <div className={`rounded-xl p-3 ${insufficient ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}>
            <div className="text-[10px] uppercase tracking-wider opacity-80">Wallet</div>
            <div className="text-lg font-bold">₹{balance.toFixed(0)}</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-primary/15 px-2 py-2 text-primary">1. Address</div>
          <div className="rounded-lg bg-emerald-500/10 px-2 py-2 text-emerald-300">2. Wallet</div>
          <div className="rounded-lg bg-accent/10 px-2 py-2 text-accent">3. Tracking</div>
        </div>

        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery address</label>
          <button
            type="button"
            onClick={detect}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface/60 px-2 py-0.5 text-[11px] hover:bg-surface-elevated disabled:opacity-60"
          >
            <Crosshair className="h-3 w-3" /> {busy ? "Locating…" : "Use current location"}
          </button>
        </div>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="House, street, town, pincode"
          rows={3}
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Saved to your profile so future rentals pre-fill.</p>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile number (private)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98xxxxxxxx"
            inputMode="tel"
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">For courier updates. Saved to your profile — never shown publicly.</p>
        </div>

        <div className="mt-4 rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5 text-xs text-muted-foreground">
          Return window: <span className="font-medium text-foreground">20 days</span> at flat ₹10. After day 20 a <span className="font-medium text-rose-300">₹1/day late fine</span> is auto-deducted from your wallet on return.
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-surface-elevated">Cancel</button>
          <button
            onClick={() => onConfirm(address, phone)}
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

function WaitlistModal({
  title, defaultAddress, onClose, onConfirm, pending,
}: {
  title: string; defaultAddress: string;
  onClose: () => void; onConfirm: (addr: string) => void; pending: boolean;
}) {
  const [address, setAddress] = useState(defaultAddress);
  const { detect, busy } = useGeolocateAddress(setAddress);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Join the waiting list</h2>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          When the current reader returns this book, you'll be automatically assigned a rental and the wallet will be charged.
        </p>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivery address</label>
          <button type="button" onClick={detect} disabled={busy} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface/60 px-2 py-0.5 text-[11px] hover:bg-surface-elevated disabled:opacity-60">
            <Crosshair className="h-3 w-3" /> {busy ? "Locating…" : "Use current location"}
          </button>
        </div>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="House, street, town, pincode"
          className="w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-surface-elevated">Cancel</button>
          <button
            onClick={() => onConfirm(address)}
            disabled={pending}
            className="flex-1 cursor-pointer rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Join waiting list"}
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

  // Sync local state when existing review changes (e.g. after upsert refetch).
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setBody(existing.body);
      setQuote(existing.favorite_quote ?? "");
    }
  }, [existing?.id, existing?.rating]);

  if (existing && !editing) {
    return (
      <div className="glass-card mb-4 rounded-2xl p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Your review:</span>
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < existing.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{existing.rating}/5</span>
          <button onClick={() => setEditing(true)} className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface-elevated">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={() => del.mutate({ bookId })} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
        {existing.body && <p className="mt-2 text-sm text-foreground/85">{existing.body}</p>}
        {existing.favorite_quote && (
          <blockquote className="mt-2 rounded-lg border-l-2 border-accent bg-accent/5 px-3 py-2 text-xs italic text-foreground/80">
            "{existing.favorite_quote}"
          </blockquote>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">Only one review per book — edit yours to update.</p>
      </div>
    );
  }

  const displayRatingPreview = hover || rating;

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
              <Star className={`h-6 w-6 transition ${i < displayRatingPreview ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-200"}`} />
            </button>
          ))}
        </div>
        {rating > 0 && <span className="text-xs text-muted-foreground">{rating}/5</span>}
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
          placeholder="A line that stayed with you…"
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
