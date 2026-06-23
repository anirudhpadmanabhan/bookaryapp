import type { Book } from "@/lib/books";
import { colorForBook } from "@/lib/books";
import { cn } from "@/lib/utils";

export function BookCover({
  book,
  className,
  colorOverride,
}: {
  book: Pick<Book, "id" | "title" | "title_ml" | "author" | "author_ml" | "genre_ml" | "cover_color"> & { cover_url?: string | null };
  className?: string;
  colorOverride?: string;
}) {
  const color = colorOverride ?? colorForBook(book.id);
  if (book.cover_url) {
    return (
      <div className={cn("cover relative overflow-hidden !p-0", `cover-${color}`, className)}>
        <img
          src={book.cover_url}
          alt={`Cover for ${book.title}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className={cn("cover", `cover-${color}`, className)}>
      <div className="relative z-10">
        <span className="font-mal text-[10px] tracking-wide text-white/70 line-clamp-1">{book.genre_ml ?? ""}</span>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-1.5 px-1 text-center">
        {book.title_ml && (
          <span className="font-mal text-[18px] font-bold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] line-clamp-3">
            {book.title_ml}
          </span>
        )}
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] line-clamp-3 leading-snug">
          {book.title}
        </span>
      </div>
      <div className="relative z-10 text-center">
        <span className="font-mal text-[11px] text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] line-clamp-1">
          {book.author_ml ?? book.author}
        </span>
      </div>
    </div>
  );
}
