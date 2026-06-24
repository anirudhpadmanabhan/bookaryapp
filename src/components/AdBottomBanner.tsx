import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useActiveBannerAd } from "@/lib/ads";

const safeUrl = (u: string | null | undefined) =>
  u && /^https?:\/\//i.test(u) ? u : null;

/**
 * Platform-wide dismissible bottom banner advertisement.
 * Stays hidden after the user dismisses the current ad (per ad id, per session).
 */
export function AdBottomBanner() {
  const { data: ad } = useActiveBannerAd("bottom");
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissedId(sessionStorage.getItem("ad_bottom_dismissed_id"));
  }, []);

  if (!ad || ad.id === dismissedId) return null;

  const dismiss = () => {
    sessionStorage.setItem("ad_bottom_dismissed_id", ad.id);
    setDismissedId(ad.id);
  };

  const inner = (
    <div className="flex items-center gap-3">
      <img
        src={ad.image_url}
        alt={ad.title || ad.name}
        className="h-12 w-20 flex-none rounded-md object-cover sm:h-14 sm:w-24"
      />
      <div className="min-w-0 flex-1">
        {ad.title && <p className="truncate text-sm font-semibold text-white">{ad.title}</p>}
        {ad.description && (
          <p className="truncate text-xs text-white/70">{ad.description}</p>
        )}
      </div>
      {ad.cta_text && ad.cta_url && (
        <span className="hidden flex-none rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground sm:inline-block">
          {ad.cta_text}
        </span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-3">
      <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-black/85 p-3 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {ad.cta_url ? (
              <a
                href={ad.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block cursor-pointer"
              >
                {inner}
              </a>
            ) : (
              inner
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss advertisement"
            onClick={dismiss}
            className="grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
