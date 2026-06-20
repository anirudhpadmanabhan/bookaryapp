import { supabase } from "@/integrations/supabase/client";

export type Book = {
  id: string;
  title: string;
  title_ml: string | null;
  author: string;
  author_ml: string | null;
  original_author: string | null;
  genre: string;
  genre_ml: string | null;
  rating: number;
  rent_price: number;
  cover_color: string;
  description: string | null;
  pages: number | null;
  published_year: number | null;
  publisher: string | null;
  shelf_code: string | null;
  language: string | null;
  cover_url: string | null;
  created_at?: string;
};

// Palette — every entry must have a matching .cover-<name> rule in styles.css.
// Background is deep indigo-violet, so violet/plum/midnight/indigo are kept as
// classes but excluded from the rotation so book covers never blend into the page.
export const COVER_PALETTE = [
  "amber","teal","rose","forest","gold","cobalt","crimson","sage",
  "butter","rust","wine","fog","oxblood","stone",
] as const;

export function colorForBook(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}

// Position-based palette walk that guarantees no two adjacent picks repeat.
export function colorAt(index: number): string {
  return COVER_PALETTE[(index * 5) % COVER_PALETTE.length];
}

export type BookSort = "newest" | "title" | "rating" | "price-asc" | "price-desc" | "shelf";

export function sortBooks(books: Book[], sort: BookSort): Book[] {
  const arr = [...books];
  switch (sort) {
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case "rating":
      return arr.sort((a, b) => Number(b.rating) - Number(a.rating));
    case "price-asc":
      return arr.sort((a, b) => Number(a.rent_price) - Number(b.rent_price));
    case "price-desc":
      return arr.sort((a, b) => Number(b.rent_price) - Number(a.rent_price));
    case "shelf":
      return arr.sort((a, b) => {
        const sa = Number(a.shelf_code ?? Infinity);
        const sb = Number(b.shelf_code ?? Infinity);
        if (!Number.isNaN(sa) && !Number.isNaN(sb) && sa !== sb) return sa - sb;
        return (a.shelf_code ?? "").localeCompare(b.shelf_code ?? "");
      });
    case "newest":
    default:
      return arr;
  }
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

// Newly-arrived shelf codes — pinned at the top of the home page in this order.
export const NEW_ARRIVAL_SHELF_CODES = ["4556", "4586", "4616", "4615", "4499"];

export async function fetchNewArrivals(): Promise<Book[]> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .in("shelf_code", NEW_ARRIVAL_SHELF_CODES);
  if (error) throw error;
  const list = (data ?? []) as Book[];
  // Preserve the order defined in NEW_ARRIVAL_SHELF_CODES.
  return NEW_ARRIVAL_SHELF_CODES
    .map((c) => list.find((b) => b.shelf_code === c))
    .filter((b): b is Book => !!b);
}

export function synopsisFor(book: Pick<Book, "description" | "title" | "title_ml" | "author" | "genre" | "genre_ml">): string {
  if (book.description && book.description.trim().length > 0) return book.description;
  const ml = book.title_ml ? ` (${book.title_ml})` : "";
  const g = book.genre_ml ? `${book.genre} / ${book.genre_ml}` : book.genre;
  return `${book.title}${ml} is a ${g.toLowerCase()} work by ${book.author}, part of the Cherukad Smaraka Vayanasala collection.`;
}

export function slugify(value: string): string {
  return encodeURIComponent(value.trim().toLowerCase().replace(/\s+/g, "-"));
}
export function unslug(value: string): string {
  return decodeURIComponent(value).replace(/-/g, " ");
}
