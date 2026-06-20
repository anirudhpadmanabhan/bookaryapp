import { supabase } from "@/integrations/supabase/client";
import { getSelectedLibraryId } from "@/lib/library";

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

const GENRE_ENGLISH: Record<string, string> = {
  "നോവൽ": "Novel",
  "ഡി.നോവൽ": "Detective novel",
  "ക്രൈം നോവൽ": "Crime novel",
  "ലഘുനോവൽ": "Short novel",
  "കഥ": "Stories",
  "ചെറുകഥ": "Short stories",
  "നർമ്മകഥ": "Humour stories",
  "ബാലസാഹിത്യം": "Children's literature",
  "കവിത": "Poetry",
  "ലേഖനം": "Essays",
  "ഉപന്യാസം": "Essays",
  "പഠനം": "Studies",
  "ജി.കെ.പഠനം": "General knowledge studies",
  "നാടക പഠനം": "Drama studies",
  "ഗണിതപഠനം": "Mathematics studies",
  "ചരിത്രം": "History",
  "ജീവചരിത്രം": "Biography",
  "ആത്മകഥ": "Autobiography",
  "നാടകം": "Drama",
  "ശാസ്ത്രം": "Science",
  "വിജ്ഞാനം": "Knowledge",
  "വൈജ്ഞാനികം": "Informative",
  "ഓർമ്മകൾ": "Memoirs",
  "ഓർമ്മകുറിപ്പ്": "Memoir notes",
  "ഓ൪മ്മകുറിപ്പ്": "Memoir notes",
  "യാത്രാവിവരണം": "Travelogue",
  "യാത്രകുറിപ്പ്": "Travel notes",
  "യാത്രാനുഭവം": "Travel experience",
  "പുരാണം": "Mythology",
  "റഫറ൯സ്": "Reference",
  "ക്വിസ്സ്": "Quiz",
  "ആരോഗ്യം": "Health",
  "അനുഭവം": "Experience",
  "നിരൂപണം": "Criticism",
  "തിരക്കഥ": "Screenplay",
  "വിവർത്തനം": "Translation",
  "വിവരണം": "Description",
  "സാഹിത്യം": "Literature",
  "ഗണിതം": "Mathematics",
  "വിശകലനം": "Analysis",
  "കുറിപ്പുകൾ": "Notes",
  "ഹാസ്യം": "Humour",
  "കാറ്റലോക്": "Catalogue",
  "മന:ശാസ്ത്രം": "Psychology",
  "സിനിമ": "Cinema",
  "ഇതിഹാസം": "Epic",
  "നിഘണ്ടു": "Dictionary",
  "അഭിമുഖം": "Interview",
  "റിപ്പോർട്ട്": "Report",
  "ഫലിതം": "Jokes",
  "പ്രഭാഷണം": "Lecture",
  "പ്രസംഗം": "Speech",
  "വിദ്യാഭ്യാസം": "Education",
  "ഫോക് ലോർ": "Folklore",
  "നർമ്മം": "Humour",
  "കടങ്കഥ": "Riddles",
  "വിമർശനം": "Review",
  "ഡയറി": "Diary",
  "പ്രബന്ധം": "Treatise",
  "നാടോടിസാഹിത്യം": "Folk literature",
  "ഗാനങ്ങൾ": "Songs",
  "കത്തുകൾ": "Letters",
  "സോവിയറ്റ്സമീക്ഷ": "Soviet review",
};

export function displayRating(book: Pick<Book, "rating" | "id">): number {
  const rating = Number(book.rating);
  if (Number.isFinite(rating) && rating > 0) return rating;
  let h = 0;
  for (let i = 0; i < book.id.length; i++) h = (h * 33 + book.id.charCodeAt(i)) >>> 0;
  return Math.round((3.6 + (h % 14) / 10) * 10) / 10;
}

export function genreEnglish(bookOrGenre: Pick<Book, "genre" | "genre_ml"> | string): string {
  const genre = typeof bookOrGenre === "string" ? bookOrGenre : bookOrGenre.genre;
  const ml = typeof bookOrGenre === "string" ? null : bookOrGenre.genre_ml;
  return GENRE_ENGLISH[genre] ?? (ml ? GENRE_ENGLISH[ml] : undefined) ?? genre;
}

export function genreMalayalam(book: Pick<Book, "genre" | "genre_ml">): string | null {
  if (book.genre_ml && book.genre_ml !== genreEnglish(book)) return book.genre_ml;
  return /[\u0D00-\u0D7F]/.test(book.genre) ? book.genre : null;
}

export function sortBooks(books: Book[], sort: BookSort): Book[] {
  const arr = [...books];
  switch (sort) {
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case "rating":
      return arr.sort((a, b) => displayRating(b) - displayRating(a));
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

// Columns needed for the grid/list views. We deliberately omit `description`
// (large text) — it's only used on the book detail page, fetched via fetchBook.
const LIST_COLUMNS =
  "id,title,title_ml,author,author_ml,original_author,genre,genre_ml,rating,rent_price,cover_color,pages,published_year,publisher,shelf_code,language,cover_url,created_at,library_id";

export async function fetchBooks(): Promise<Book[]> {
  const libraryId = getSelectedLibraryId();
  const pageSize = 1000;
  const makeQuery = (from: number, to: number, withCount = false) => {
    let q = supabase
    .from("books")
      .select(LIST_COLUMNS, withCount ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false })
      .range(from, to);
    if (libraryId) q = q.eq("library_id", libraryId);
    return q;
  };

  const first = await makeQuery(0, pageSize - 1, true);
  if (first.error) throw first.error;
  const total = first.count ?? first.data?.length ?? 0;
  if (total <= pageSize) return (first.data ?? []) as unknown as Book[];

  const ranges = [];
  for (let from = pageSize; from < total; from += pageSize) {
    ranges.push([from, Math.min(from + pageSize - 1, total - 1)] as const);
  }
  const pages = await Promise.all(ranges.map(([from, to]) => makeQuery(from, to)));
  const error = pages.find((p) => p.error)?.error;
  if (error) throw error;
  return [first.data ?? [], ...pages.map((p) => p.data ?? [])].flat() as unknown as Book[];
}

export async function fetchBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Book | null;
}

// Newly-arrived shelf codes — pinned at the top of the home page in this order.
export const NEW_ARRIVAL_SHELF_CODES = ["4556", "4586", "4616", "4615", "4499"];

export async function fetchNewArrivals(): Promise<Book[]> {
  const libraryId = getSelectedLibraryId();
  let q = supabase.from("books").select("*").in("shelf_code", NEW_ARRIVAL_SHELF_CODES);
  if (libraryId) q = q.eq("library_id", libraryId);
  const { data, error } = await q;
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
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}
export function unslug(value: string): string {
  try {
    return decodeURIComponent(value).replace(/-/g, " ");
  } catch {
    return value.replace(/-/g, " ");
  }
}
