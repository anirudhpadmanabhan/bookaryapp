import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useActivePopupAd } from "@/lib/ads";

export function AdPopup() {
  const { data: ad } = useActivePopupAd();
  const [open, setOpen] = useState(false);
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    if (!ad || ad.id === shownId) return;
    setOpen(true);
    setShownId(ad.id);
    const seconds = Number(ad.auto_close_seconds ?? 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return; // 0 = stay open until dismissed
    const t = setTimeout(() => setOpen(false), seconds * 1000);
    return () => clearTimeout(t);
  }, [ad, shownId]);

  if (!ad || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close advertisement"
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>
        {ad.cta_url ? (
          <a href={ad.cta_url} target="_blank" rel="noopener noreferrer">
            <img src={ad.image_url} alt={ad.title || ad.name} className="block w-full" />
          </a>
        ) : (
          <img src={ad.image_url} alt={ad.title || ad.name} className="block w-full" />
        )}
        {(ad.title || ad.description || (ad.cta_text && ad.cta_url)) && (
          <div className="space-y-2 p-4">
            {ad.title && <h3 className="text-lg font-semibold">{ad.title}</h3>}
            {ad.description && <p className="text-sm text-muted-foreground">{ad.description}</p>}
            {ad.cta_text && ad.cta_url && (
              <a
                href={ad.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {ad.cta_text}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
