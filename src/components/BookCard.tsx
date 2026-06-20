import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, Star, MapPin, LogIn } from "lucide-react";
import { displayRating, genreEnglish, type Book } from "@/lib/books";
import { BookCover } from "./BookCover";
import { useFavorites, useToggleFavorite } from "@/lib/userdata";
import { useSession } from "@/lib/auth";

type Props = {
  book: Book;
  minimal?: boolean;
  index?: number;
  coverColor?: string;
  /** Hide the rack/shelf code chip (e.g. on the home grid). */
  hideShelf?: boolean;
};

export function BookCard({ book, minimal = false, coverColor, hideShelf = true }: Props) {
  const { user } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();
  const isFav = !!favorites?.some((f) => f.book_id === book.id);

  return (
    <Link
      to="/books/$id"
      params={{ id: book.id }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/30 transition hover:-translate-y-1 hover:border-primary/40 hover:bg-surface/60 hover:shadow-[0_18px_40px_-20px_rgba(99,102,241,0.55)]"
    >
      <div className="relative">
        <BookCover
          book={book}
          colorOverride={coverColor}
          className="!rounded-none !rounded-t-2xl"
        />
        {!minimal && (
          <>
            {user ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggle.mutate({ bookId: book.id, currentlyFav: isFav });
                }}
                className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/45 backdrop-blur hover:bg-black/70"
                aria-label="Favorite"
              >
                <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : "text-white/85"}`} />
              </button>
            ) : null}
            <div className="absolute left-2.5 top-2.5 z-10 chip">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-white">{displayRating(book).toFixed(1)}</span>
            </div>
            {!hideShelf && book.shelf_code && (
              <div className="absolute bottom-2.5 right-2.5 z-10 chip">
                <MapPin className="h-3 w-3" />
                <span className="text-white">#{book.shelf_code}</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{genreEnglish(book)}</div>
        <h3 className="line-clamp-1 text-xs font-semibold text-foreground group-hover:text-primary">{book.title}</h3>
        <p className="line-clamp-1 text-[11px] text-muted-foreground">by {book.author}</p>
        <div className="mt-2">
          {user ? (
            <span className="inline-flex w-full items-center justify-center rounded-md bg-primary/15 px-2.5 py-1.5 text-[11px] font-semibold text-primary group-hover:bg-primary group-hover:text-primary-foreground">
              View &amp; Rent
            </span>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: pathname }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary/50 hover:text-primary"
            >
              <LogIn className="h-3 w-3" /> Sign in to rent
            </Link>
          )}
        </div>
      </div>
    </Link>
  );
}

export function BookRow({ book, hideShelf = false }: { book: Book; hideShelf?: boolean }) {
  const { user } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();
  const isFav = !!favorites?.some((f) => f.book_id === book.id);
  return (
    <div className="glass-card flex items-center gap-4 rounded-xl p-3">
      <Link to="/books/$id" params={{ id: book.id }} className="block w-12 shrink-0 cursor-pointer">
        <BookCover book={book} className="!p-1.5 !rounded-md text-[8px]" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to="/books/$id" params={{ id: book.id }} className="block cursor-pointer">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="truncate text-sm font-semibold hover:text-primary">{book.title}</h3>
            {book.title_ml && <span className="font-mal text-sm text-accent">{book.title_ml}</span>}
          </div>
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {book.author} · {genreEnglish(book)}
          {book.publisher && ` · ${book.publisher}`}
        </p>
      </div>
      <span className="hidden items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 sm:inline-flex">
        <Star className="h-3 w-3 fill-amber-300" /> {displayRating(book).toFixed(1)}
      </span>
      {!hideShelf && book.shelf_code && (
        <span className="hidden items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex">
          <MapPin className="h-3 w-3" /> {book.shelf_code}
        </span>
      )}
      {user && (
        <button
          type="button"
          onClick={() => toggle.mutate({ bookId: book.id, currentlyFav: isFav })}
          className="cursor-pointer rounded-full p-2 hover:bg-surface-elevated"
          aria-label="Favorite"
        >
          <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
        </button>
      )}
      <Link
        to="/books/$id"
        params={{ id: book.id }}
        className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        {user ? "Rent now" : "Sign in"}
      </Link>
    </div>
  );
}
