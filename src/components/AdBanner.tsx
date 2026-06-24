import { useActiveBannerAd, type BannerPosition } from "@/lib/ads";

const safeUrl = (u: string | null | undefined) =>
  u && /^https?:\/\//i.test(u) ? u : null;

export function AdBanner({ position }: { position: BannerPosition }) {
  const { data: ad } = useActiveBannerAd(position);
  if (!ad) return null;
  const href = safeUrl(ad.cta_url);

  const img = (
    <img
      src={ad.image_url}
      alt={ad.title || ad.name}
      className="block w-full rounded-2xl border border-border object-cover"
    />
  );

  return (
    <section className="mb-6">
      {ad.cta_url ? (
        <a href={ad.cta_url} target="_blank" rel="noopener noreferrer" className="block cursor-pointer">
          {img}
        </a>
      ) : (
        img
      )}
    </section>
  );
}
