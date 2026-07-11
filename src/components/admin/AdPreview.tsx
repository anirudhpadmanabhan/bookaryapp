import { X } from "lucide-react";

const safeUrl = (u: string | null | undefined) =>
  u && /^https?:\/\//i.test(u) ? u : null;

export type AdPreviewData = {
  name: string;
  type: "popup" | "banner";
  image_url: string;
  title: string | null;
  description: string | null;
  cta_text: string | null;
  cta_url: string | null;
  banner_position: "top" | "middle" | "bottom" | null;
};

/**
 * Renders an ad exactly as users will see it — popup overlay, top/middle banner,
 * or bottom sticky banner — scaled inside a frame.
 */
export function AdPreview({ ad }: { ad: AdPreviewData }) {
  if (!ad.image_url) {
    return (
      <div className="grid h-72 place-items-center rounded-xl border border-dashed border-border bg-surface/40 text-sm text-muted-foreground">
        Upload an image to preview the ad.
      </div>
    );
  }

  if (ad.type === "popup") return <PopupPreview ad={ad} />;
  if (ad.banner_position === "bottom") return <BottomBannerPreview ad={ad} />;
  return <InlineBannerPreview ad={ad} />;
}

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-zinc-900 to-zinc-800">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/50">
        <span>Live preview · {label}</span>
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400/70" />
          <span className="h-2 w-2 rounded-full bg-amber-400/70" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        </span>
      </div>
      <div className="relative h-80 w-full overflow-hidden bg-[linear-gradient(135deg,#1a1a2e_0%,#16213e_100%)]">
        {children}
      </div>
    </div>
  );
}

function PopupPreview({ ad }: { ad: AdPreviewData }) {
  return (
    <Frame label="Popup overlay · portrait">
      <div className="absolute inset-0 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="relative w-[60%] max-w-[220px] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          <button type="button" className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white">
            <X className="h-3 w-3" />
          </button>
          <div className="aspect-[3/4] w-full overflow-hidden bg-black/40">
            <img src={ad.image_url} alt={ad.title || ad.name} className="h-full w-full object-cover" />
          </div>
          {(ad.title || ad.description || (ad.cta_text && safeUrl(ad.cta_url))) && (
            <div className="space-y-1.5 p-3">
              {ad.title && <h3 className="text-sm font-semibold">{ad.title}</h3>}
              {ad.description && <p className="line-clamp-2 text-xs text-muted-foreground">{ad.description}</p>}
              {ad.cta_text && safeUrl(ad.cta_url) && (
                <span className="inline-flex rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                  {ad.cta_text}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}

function InlineBannerPreview({ ad }: { ad: AdPreviewData }) {
  const pos = ad.banner_position ?? "top";
  return (
    <Frame label={`Inline banner · ${pos} · landscape`}>
      <div className="flex h-full flex-col gap-2 p-3">
        {pos !== "top" && <FakeBlock h="h-8" />}
        {pos === "middle" && <FakeBlock h="h-6" />}
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="aspect-[16/9] w-full bg-black/30">
            <img src={ad.image_url} alt={ad.title || ad.name} className="h-full w-full object-cover" />
          </div>
        </div>
        {pos !== "bottom" && <FakeBlock h="h-6" />}
      </div>
    </Frame>
  );
}

function BottomBannerPreview({ ad }: { ad: AdPreviewData }) {
  return (
    <Frame label="Sticky bottom banner">
      <div className="flex h-full flex-col justify-between p-3">
        <div className="flex flex-col gap-2">
          <FakeBlock h="h-10" />
          <FakeBlock h="h-20" />
          <FakeBlock h="h-6" />
        </div>
        <div className="mx-auto w-full max-w-sm rounded-xl border border-border bg-black/85 p-2 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2">
            <img src={ad.image_url} alt={ad.title || ad.name} className="h-10 w-16 flex-none rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              {ad.title && <p className="truncate text-xs font-semibold text-white">{ad.title}</p>}
              {ad.description && <p className="truncate text-[10px] text-white/70">{ad.description}</p>}
            </div>
            {ad.cta_text && safeUrl(ad.cta_url) && (
              <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                {ad.cta_text}
              </span>
            )}
            <button type="button" className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function FakeBlock({ h }: { h: string }) {
  return <div className={`${h} rounded-md bg-white/5`} />;
}
