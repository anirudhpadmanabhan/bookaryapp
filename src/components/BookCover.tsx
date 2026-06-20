import type { Book } from "@/lib/books";
import { colorForBook } from "@/lib/books";
import { cn } from "@/lib/utils";

export function BookCover({
  book,
  className,
}: {
  book: Pick<Book, "id" | "title" | "title_ml" | "author" | "author_ml" | "genre_ml" | "cover_color">;
  className?: string;
}) {
  // Deterministic color per book id so each thumbnail is visually distinct,
  // and never matches the app background.
  const color = colorForBook(book.id);
  return (
    <div className={cn("cover", `cover-${color}`, className)}>
      <div className="relative z-10">
        <span className="font-mal text-[11px] tracking-wide text-white/70">{book.genre_ml ?? ""}</span>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        <span className="font-mal text-xl font-bold leading-tight">{book.title_ml ?? book.title}</span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-white/70">{book.title}</span>
      </div>
      <div className="relative z-10 text-center">
        <span className="font-mal text-[12px] text-white/80">{book.author_ml ?? book.author}</span>
      </div>
    </div>
  );
}
