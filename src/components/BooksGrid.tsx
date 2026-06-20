import { type Book, colorAt } from "@/lib/books";
import { BookCard, BookRow } from "./BookCard";

export type ViewMode = "tile" | "list";

export function BooksGrid({ books, view = "tile" }: { books: Book[]; view?: ViewMode }) {
  if (view === "list") {
    return (
      <div className="space-y-2">
        {books.map((b) => <BookRow key={b.id} book={b} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {books.map((b, i) => (
        <BookCard key={b.id} book={b} coverColor={colorAt(i)} />
      ))}
    </div>
  );
}
