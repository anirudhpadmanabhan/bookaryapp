import { supabase } from "@/integrations/supabase/client";

export type Book = {
  id: string;
  title: string;
  title_ml: string | null;
  author: string;
  author_ml: string | null;
  genre: string;
  genre_ml: string | null;
  rating: number;
  rent_price: number;
  cover_color: string;
  description: string | null;
  pages: number | null;
  published_year: number | null;
  publisher: string | null;
};

// Wide palette for visual variety — bg uses deep indigo, none of these match.
export const COVER_PALETTE = [
  "plum","teal","rose","amber","emerald","sienna","sapphire",
  "violet","rust","forest","oxblood","crimson","butter","wine",
  "sage","fog","cobalt","gold","stone",
] as const;

// Stable hash → palette index, so each book always gets the same color.
export function colorForBook(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}

export async function fetchBooks(): Promise<Book[]> {
  const pageSize = 1000;
  const all: Book[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as Book[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export async function fetchBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Book | null;
}

export function synopsisFor(book: Pick<Book, "description" | "title" | "title_ml" | "author" | "genre" | "genre_ml">): string {
  if (book.description && book.description.trim().length > 0) return book.description;
  const ml = book.title_ml ? ` (${book.title_ml})` : "";
  const g = book.genre_ml ? `${book.genre} / ${book.genre_ml}` : book.genre;
  return `${book.title}${ml} is a celebrated ${g.toLowerCase()} work by ${book.author}. A treasured addition to the Bookary catalog — rent it to read the full text and add your reflections to your reading diary.`;
}
