import type { Book } from "@/lib/books";
import { colorForBook } from "@/lib/books";
import { cn } from "@/lib/utils";

export function BookCover({
  book,
  className,
  colorOverride,
}: {
  book: Pick<Book, "id" | "title" | "title_ml" | "author" | "author_ml" | "genre_ml" | "cover_color">;
  className?: string;
  /** When rendered in a grid, the page can pass an alternating color so no two neighbours match. */
  colorOverride?: string;
}) {
  const color = colorOverride ?? colorForBook(book.id);
  return (
    <div className={cn("cover", `cover-${color}`, className)}>
      <div className="relative z-10">
        <span className="font-mal text-[11px] tracking-wide text-white/70">{book.genre_ml ?? ""}</span>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2 px-2 text-center">
        <span className="font-mal text-[22px] font-bold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]">
          {book.title_ml ?? book.title}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] line-clamp-2">
          {book.title}
        </span>
      </div>
      <div className="relative z-10 text-center">
        <span className="font-mal text-[12px] text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
          {book.author_ml ?? book.author}
        </span>
      </div>
    </div>
  );
}
