import { useState } from "react";
import type { Book } from "@/lib/books";
import { colorForBook } from "@/lib/books";
import { cn } from "@/lib/utils";

function extractDriveId(s: string): string | null {
  const m1 = s.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/drive\.google\.com\/(?:open|uc)\?[^ ]*id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  const m3 = s.match(/docs\.google\.com\/uc\?[^ ]*id=([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  const m4 = s.match(/drive\.usercontent\.google\.com\/download\?id=([a-zA-Z0-9_-]+)/);
  if (m4) return m4[1];
  return null;
}

/** Ordered list of embeddable URL candidates to try for a Google Drive cover. */
function coverCandidates(url: string): string[] {
  try {
    const clean = url.trim();
    const id = extractDriveId(clean);
    if (!id) return [clean];
    return [
      `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
      `https://lh3.googleusercontent.com/d/${id}=w800`,
      `https://drive.usercontent.google.com/download?id=${id}&export=view`,
    ];
  } catch {
    return [url];
  }
}

function TextCover({ book, color, className }: { book: any; color: string; className?: string }) {
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
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  if (book.cover_url && !failed) {
    const candidates = coverCandidates(book.cover_url);
    const src = candidates[Math.min(attempt, candidates.length - 1)];
    return (
      <div className={cn("cover relative overflow-hidden !p-0", `cover-${color}`, className)}>
        <img
          src={src}
          alt={`Cover for ${book.title}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (attempt < candidates.length - 1) setAttempt(attempt + 1);
            else setFailed(true);
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  return <TextCover book={book} color={color} className={className} />;
}
