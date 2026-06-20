import { Link } from "@tanstack/react-router";
import { Heart, Star, MapPin } from "lucide-react";
import type { Book } from "@/lib/books";
import { BookCover } from "./BookCover";
import { useFavorites, useToggleFavorite } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  book: Book;
  minimal?: boolean;
  /** Position in parent list — enables alternating cover colors. */
  index?: number;
  /** Resolved alternating cover color (preferred over index). */
  coverColor?: string;
};

export function BookCard({ book, minimal = false, coverColor }: Props) {
  const { user } = useSession();
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();
  const isFav = !!favorites?.some((f) => f.book_id === book.id);

  return (
    <div className="group flex flex-col">
      <div className="relative">
        <Link to="/books/$id" params={{ id: book.id }} className="block cursor-pointer">
          <BookCover
            book={book}
            colorOverride={coverColor}
            className="transition-transform group-hover:-translate-y-1 group-hover:shadow-2xl"
          />
        </Link>
        {!minimal && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!user) return toast.error("Sign in to save favorites");
                toggle.mutate({ bookId: book.id, currentlyFav: isFav });
              }}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60"
              aria-label="Favorite"
            >
              <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : "text-white/80"}`} />
            </button>
            <div className="absolute left-3 top-3 z-10 chip">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-white">{Number(book.rating).toFixed(1)}</span>
            </div>
            {book.shelf_code && (
              <div className="absolute bottom-3 right-3 z-10 chip">
                <MapPin className="h-3 w-3" />
                <span className="text-white">#{book.shelf_code}</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-3 px-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{book.genre}</div>
        <Link to="/books/$id" params={{ id: book.id }} className="mt-0.5 block cursor-pointer">
          <h3 className="line-clamp-1 text-xs font-semibold text-foreground group-hover:text-primary">{book.title}</h3>
        </Link>
        <p className="line-clamp-1 text-[11px] text-muted-foreground">by {book.author}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">₹{book.rent_price}/20d</span>
          <Link
            to="/books/$id"
            params={{ id: book.id }}
            className="cursor-pointer rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/25"
          >
            Rent ›
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Compact list-view row variant used when user toggles list view. */
export function BookRow({ book }: { book: Book }) {
  const { user } = useSession();
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
          {book.author} · {book.genre}
          {book.publisher && ` · ${book.publisher}`}
        </p>
      </div>
      {book.shelf_code && (
        <span className="hidden items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex">
          <MapPin className="h-3 w-3" /> {book.shelf_code}
        </span>
      )}
      <span className="hidden text-xs text-muted-foreground sm:inline">₹{book.rent_price}</span>
      <button
        type="button"
        onClick={() => {
          if (!user) return toast.error("Sign in to save favorites");
          toggle.mutate({ bookId: book.id, currentlyFav: isFav });
        }}
        className="cursor-pointer rounded-full p-2 hover:bg-surface-elevated"
        aria-label="Favorite"
      >
        <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
      </button>
      <Link
        to="/books/$id"
        params={{ id: book.id }}
        className="cursor-pointer rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25"
      >
        Open
      </Link>
    </div>
  );
}
