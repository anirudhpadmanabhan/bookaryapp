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

export const COVER_PALETTE = [
  "amber","teal","rose","forest","gold","cobalt","crimson","sage",
  "butter","rust","wine","fog","oxblood","stone",
] as const;

export function colorForBook(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[h % COVER_PALETTE.length];
}

export function colorAt(index: number): string {
  return COVER_PALETTE[(index * 5) % COVER_PALETTE.length];
}

// Price options removed per product decision (flat ₹10 / 20 days).
export type BookSort = "newest" | "title" | "rating" | "genre";
export type SortDirection = "asc" | "desc";

const GENRE_ENGLISH_RAW: Record<string, string> = {
  "നോവൽ": "Novel","ഡി.നോവൽ": "Detective novel","ക്രൈം നോവൽ": "Crime novel","ലഘുനോവൽ": "Short novel",
  "കഥ": "Stories","ചെറുകഥ": "Short stories","നർമ്മകഥ": "Humour stories","ബാലസാഹിത്യം": "Children's literature",
  "കവിത": "Poetry","ലേഖനം": "Essays","ഉപന്യാസം": "Essays","പഠനം": "Studies","ജി.കെ.പഠനം": "General knowledge studies",
  "നാടക പഠനം": "Drama studies","ഗണിതപഠനം": "Mathematics studies","ചരിത്രം": "History","ജീവചരിത്രം": "Biography",
  "ആത്മകഥ": "Autobiography","നാടകം": "Drama","ശാസ്ത്രം": "Science","വിജ്ഞാനം": "Knowledge","വൈജ്ഞാനികം": "Informative",
  "ഓർമ്മകൾ": "Memoirs","ഓർമ്മകുറിപ്പ്": "Memoir notes","ഓ൪മ്മകുറിപ്പ്": "Memoir notes",
  "യാത്രാവിവരണം": "Travelogue","യാത്രകുറിപ്പ്": "Travel notes","യാത്രാനുഭവം": "Travel experience",
  "പുരാണം": "Mythology","റഫറ൯സ്": "Reference","ക്വിസ്സ്": "Quiz","ആരോഗ്യം": "Health","അനുഭവം": "Experience",
  "നിരൂപണം": "Criticism","തിരക്കഥ": "Screenplay","വിവർത്തനം": "Translation","വിവരണം": "Description",
  "സാഹിത്യം": "Literature","ഗണിതം": "Mathematics","വിശകലനം": "Analysis","കുറിപ്പുകൾ": "Notes",
  "ഹാസ്യം": "Humour","കാറ്റലോക്": "Catalogue","മന:ശാസ്ത്രം": "Psychology","സിനിമ": "Cinema","ഇതിഹാസം": "Epic",
  "നിഘണ്ടു": "Dictionary","അഭിമുഖം": "Interview","റിപ്പോർട്ട്": "Report","ഫലിതം": "Jokes",
  "പ്രഭാഷണം": "Lecture","പ്രസംഗം": "Speech","വിദ്യാഭ്യാസം": "Education","ഫോക് ലോർ": "Folklore",
  "നർമ്മം": "Humour","കടങ്കഥ": "Riddles","വിമർശനം": "Review","ഡയറി": "Diary","പ്രബന്ധം": "Treatise",
  "നാടോടിസാഹിത്യം": "Folk literature","ഗാനങ്ങൾ": "Songs","കത്തുകൾ": "Letters","സോവിയറ്റ്സമീക്ഷ": "Soviet review",
  "സ്പോർട്സ്": "Sports","സ്‌പോര്‍ട്‌സ്": "Sports","കായികം": "Sports","ഫുട്ബോൾ": "Football","ക്രിക്കറ്റ്": "Cricket",
  "സംഗീതം": "Music","ചിത്രകല": "Art","പാചകം": "Cooking","കൃഷി": "Agriculture","രാഷ്ട്രീയം": "Politics",
  "സാമ്പത്തികം": "Economics","തത്വശാസ്ത്രം": "Philosophy","മതം": "Religion","ആത്മീയത": "Spirituality",
  "ജ്യോതിഷം": "Astrology","നിയമം": "Law","പത്രപ്രവർത്തനം": "Journalism","പരിസ്ഥിതി": "Environment",
  "അനുസ്മരണം": "Commemoration","ആക്ഷേപഹാസ്യം": "Satire","ആത്മീയം": "Spirituality","ഇയർബുക്ക്": "Yearbook",
  "കാഴചകൾ": "Views","കുട്ടികളുടെ ശാസ്ത്രം": "Children's science","ക്രൈം ത്രില്ലർ": "Crime thriller",
  "ചികിത്സ": "Treatment","നാടോടി കഥകൾ": "Folk tales","നിരീക്ഷണം": "Observation",
  "നോവൽപഠനം": "Novel studies","പഴഞ്ചൊല്ല്": "Proverbs","ഫിക്ഷ൯": "Fiction","ശാസ്ത്ര നോവൽ": "Science novel",
  "ശാസ്ത്രകഥ": "Science fiction","സംഭാഷണം": "Conversation","ആട്ടക്കഥ": "Attakatha","ആയുർവ്വേദം": "Ayurveda",
  "ആർക്കിടെക്ച്ചർ": "Architecture","ഉപനിഷത്ത്": "Upanishad","ഒറിഗാമി": "Origami","കഥാനുഭവം": "Story experience",
  "കരിയർഗൈഡ്": "Career guide","കല": "Art","കലകൾ": "Arts","കവികളിലുടെ": "Through poets","ജീവശാസ്ത്രം": "Biology",
  "ഡി.കഥകൾ": "Detective stories","തത്വചിന്ത": "Philosophy","നാട൯പാട്ട്": "Folk songs","നിയമങ്ങൾ": "Laws",
  "പാചകകുറിപ്പ്": "Recipes","പാട്ടുകൾ": "Songs","ബാല നാടകം": "Children's drama","ബാലവൈജഞാനികം": "Children's knowledge",
  "ഭക്തികവിത": "Devotional poetry","മാ.നോവൽ": "Magic novel","മാജിക്": "Magic","മൊഴി": "Language","യോഗ": "Yoga",
  "ലഘു ലേഖനം": "Short essays","ലിസ്റ്റ്": "List","വക്കീൽ കഥകൾ": "Lawyer stories","വാക്യങ്ങൾ": "Sentences",
  "വായന": "Reading","വിശ്വ.നോവൽ": "World novel","വ്യാകരണം": "Grammar","വ്യാഖ്യാനം": "Commentary",
  "സംഘടന": "Organization","സമാഹാരം": "Collection","സാമൂഹ്യം": "Society","സിദ്ധാന്തം": "Theory","സോഷ്യലിസം": "Socialism",
  "kvt]mÀSvkv": "Sports","kvt]mÀsvkv": "Sports",
};

// Normalize Malayalam: NFC + strip zero-width joiners so visually-equal strings collapse.
function normMl(s: string): string {
  return s.normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

const GENRE_ENGLISH: Record<string, string> = Object.fromEntries(
  Object.entries(GENRE_ENGLISH_RAW).map(([k, v]) => [normMl(k), v]),
);

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
  const g = normMl(genre);
  const m = ml ? normMl(ml) : null;
  return GENRE_ENGLISH[g] ?? (m ? GENRE_ENGLISH[m] : undefined) ?? genre;
}

export function genreMalayalam(book: Pick<Book, "genre" | "genre_ml">): string | null {
  const en = genreEnglish(book);
  if (book.genre_ml && normMl(book.genre_ml) !== normMl(en)) return book.genre_ml;
  if (/[\u0D00-\u0D7F]/.test(book.genre) && normMl(book.genre) !== normMl(en)) return book.genre;
  if (/kvt\]m/i.test(book.genre) && normMl(book.genre) !== normMl(en)) return book.genre;
  return null;
}

function shelfNum(code: string | null): number {
  const n = Number(code ?? Number.NaN);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

export function sortBooks(books: Book[], sort: BookSort, direction: SortDirection = "desc"): Book[] {
  const arr = [...books];
  switch (sort) {
    case "title":
      return arr.sort((a, b) => a.title.localeCompare(b.title) * (direction === "asc" ? 1 : -1));
    case "rating":
      return arr.sort((a, b) => {
        const dr = (displayRating(a) - displayRating(b)) * (direction === "asc" ? 1 : -1);
        if (dr !== 0) return dr;
        // Tiebreaker so a second click visibly reorders equal-rated books too.
        return a.title.localeCompare(b.title) * (direction === "asc" ? 1 : -1);
      });
    case "genre":
      return arr.sort((a, b) => {
        const ga = genreEnglish(a).toLowerCase();
        const gb = genreEnglish(b).toLowerCase();
        const c = ga.localeCompare(gb);
        if (c !== 0) return c * (direction === "asc" ? 1 : -1);
        return a.title.localeCompare(b.title) * (direction === "asc" ? 1 : -1);
      });
    case "newest":
    default:
      // "New on shelf" = highest shelf code first (newest physical entries).
      // Books without a shelf are pushed to the end regardless of direction.
      return arr.sort((a, b) => {
        const na = shelfNum(a.shelf_code), nb = shelfNum(b.shelf_code);
        const ma = Number.isFinite(na) ? 0 : 1, mb = Number.isFinite(nb) ? 0 : 1;
        if (ma !== mb) return ma - mb;
        return (nb - na) * (direction === "desc" ? 1 : -1);
      });
  }
}


const LIST_COLUMNS =
  "id,title,title_ml,author,author_ml,original_author,genre,genre_ml,rating,rent_price,cover_color,pages,published_year,publisher,shelf_code,language,cover_url,created_at,library_id";

export type HomeFacet = { key: string; ml?: string | null; count: number };
export type HomeData = {
  total: number;
  latest: Book[];
  popular: Book[];
  genres: HomeFacet[];
  writers: HomeFacet[];
  languages: HomeFacet[];
};

export async function fetchHomeData(latestLimit = 60, popularLimit = 5): Promise<HomeData> {
  const libraryId = getSelectedLibraryId();
  const { data, error } = await supabase.rpc("home_data", {
    _library_id: libraryId ?? undefined,
    _latest_limit: latestLimit,
    _popular_limit: popularLimit,
  });
  if (error) throw error;
  return (data ?? { total: 0, latest: [], popular: [], genres: [], writers: [], languages: [] }) as HomeData;
}

export async function fetchBookAvailability(id: string): Promise<{ out_of_stock: boolean; due_at: string | null }> {
  const { data, error } = await supabase.rpc("book_availability" as any, { _book_id: id });
  if (error) throw error;
  return (data ?? { out_of_stock: false, due_at: null }) as { out_of_stock: boolean; due_at: string | null };
}

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

/**
 * Server-paginated books fetch — fast initial paint for "All Published Books".
 * Sort is pushed to Postgres for every column we expose in SortBar.
 */
function sortColumn(sort: BookSort): { col: string; defaultAsc: boolean } {
  switch (sort) {
    case "title": return { col: "title", defaultAsc: true };
    case "rating": return { col: "rating", defaultAsc: false };
    case "genre": return { col: "genre", defaultAsc: true };
    case "newest":
    default:
      // "New on shelf" = highest numeric rack code first.
      return { col: "shelf_no", defaultAsc: false };
  }
}

export async function fetchBooksPage(opts: {
  page: number;
  pageSize: number;
  sort: BookSort;
  direction: SortDirection;
}): Promise<{ books: Book[]; total: number }> {
  const libraryId = getSelectedLibraryId();
  const { col } = sortColumn(opts.sort);
  const ascending = opts.direction === "asc";
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;
  let q = supabase
    .from("books")
    .select(LIST_COLUMNS, { count: "exact" })
    .order(col, { ascending, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (libraryId) q = q.eq("library_id", libraryId);
  const { data, count, error } = await q;
  if (error) throw error;
  return { books: (data ?? []) as unknown as Book[], total: count ?? 0 };
}


export async function fetchBook(id: string): Promise<Book | null> {
  const { data, error } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Book | null;
}

/**
 * "New on shelf" = highest numeric shelf codes (latest entries on the rack).
 * Falls back to created_at if nothing numeric is available.
 */
export async function fetchNewArrivals(limit = 6): Promise<Book[]> {
  const libraryId = getSelectedLibraryId();
  let q = supabase.from("books").select("*").not("shelf_code", "is", null);
  if (libraryId) q = q.eq("library_id", libraryId);
  const { data, error } = await q;
  if (error) throw error;
  const list = (data ?? []) as Book[];
  return list
    .filter((b) => Number.isFinite(Number(b.shelf_code)))
    .sort((a, b) => Number(b.shelf_code) - Number(a.shelf_code))
    .slice(0, limit);
}

/**
 * "Popular Must Read Books" = books with the highest all-time rental counts.
 * When a top book is currently rented out, it's skipped so the next must-read
 * surfaces automatically.
 */
export async function fetchPopularBooks(limit = 6): Promise<Book[]> {
  const libraryId = getSelectedLibraryId();
  const { data: rentals, error: rErr } = await supabase
    .from("rentals")
    .select("book_id, returned_at");
  if (rErr) throw rErr;

  const counts = new Map<string, number>();
  const out = new Set<string>();
  for (const r of (rentals ?? []) as { book_id: string; returned_at: string | null }[]) {
    counts.set(r.book_id, (counts.get(r.book_id) ?? 0) + 1);
    if (!r.returned_at) out.add(r.book_id);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const wantedIds = ranked.map(([id]) => id).filter((id) => !out.has(id)).slice(0, limit * 2);

  let popular: Book[] = [];
  if (wantedIds.length > 0) {
    let q = supabase.from("books").select("*").in("id", wantedIds);
    if (libraryId) q = q.eq("library_id", libraryId);
    const { data, error } = await q;
    if (error) throw error;
    const byId = new Map((data ?? []).map((b: any) => [b.id, b as Book]));
    popular = wantedIds.map((id) => byId.get(id)).filter(Boolean) as Book[];
  }

  if (popular.length >= limit) return popular.slice(0, limit);

  // Top up with latest books so the rail never goes empty.
  const have = new Set(popular.map((b) => b.id));
  let lq = supabase
    .from("books")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  if (libraryId) lq = lq.eq("library_id", libraryId);
  const { data: latest, error: lErr } = await lq;
  if (lErr) throw lErr;
  for (const b of (latest ?? []) as Book[]) {
    if (popular.length >= limit) break;
    if (!have.has(b.id) && !out.has(b.id)) {
      popular.push(b);
      have.add(b.id);
    }
  }
  return popular.slice(0, limit);
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
