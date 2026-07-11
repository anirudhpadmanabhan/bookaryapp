import { useEffect } from "react";
import { useActiveBannerAd, trackAdEvent, type BannerPosition } from "@/lib/ads";

const safeUrl = (u: string | null | undefined) =>
  u && /^https?:\/\//i.test(u) ? u : null;

export function AdBanner({ position }: { position: BannerPosition }) {
  const { data: ad } = useActiveBannerAd(position);

  useEffect(() => {
    if (ad) trackAdEvent(ad.id, "impression");
  }, [ad]);

  if (!ad) return null;
  const href = safeUrl(ad.cta_url);

  const img = (
    <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-black/30">
      <img
        src={ad.image_url}
        alt={ad.title || ad.name}
        className="h-full w-full object-cover"
      />
    </div>
  );

  return (
    <section className="mb-6">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block cursor-pointer"
          onClick={() => trackAdEvent(ad.id, "click")}
        >
          {img}
        </a>
      ) : (
        img
      )}
    </section>
  );
}
