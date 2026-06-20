import { Link } from "@tanstack/react-router";
import { Heart, Star } from "lucide-react";
import type { Book } from "@/lib/books";
import { BookCover } from "./BookCover";
import { useFavorites, useToggleFavorite } from "@/lib/userdata";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  book: Book;
  /** Hide rating + heart overlay (used on Loved/Diary to avoid duplication). */
  minimal?: boolean;
};

export function BookCard({ book, minimal = false }: Props) {
  const { user } = useSession();
  const { data: favorites } = useFavorites();
  const toggle = useToggleFavorite();
  const isFav = !!favorites?.some((f) => f.book_id === book.id);

  return (
    <div className="group flex flex-col">
      <div className="relative">
        <Link to="/books/$id" params={{ id: book.id }} className="block cursor-pointer">
          <BookCover book={book} className="transition-transform group-hover:-translate-y-1 group-hover:shadow-2xl" />
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
