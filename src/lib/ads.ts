import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdType = "popup" | "banner";
export type AdStatus = "active" | "inactive";
export type BannerPosition = "top" | "bottom" | "middle";

export type Advertisement = {
  id: string;
  name: string;
  type: AdType;
  image_url: string;
  image_path: string | null;
  title: string | null;
  description: string | null;
  cta_text: string | null;
  cta_url: string | null;
  status: AdStatus;
  start_date: string | null;
  end_date: string | null;
  banner_position: BannerPosition | null;
  auto_close_seconds: number;
  library_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "advertisements" as const;

export function useActivePopupAd() {
  return useQuery({
    queryKey: ["ads", "active", "popup"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("type", "popup")
        .eq("status", "active")
        .or(`start_date.is.null,start_date.lte.${nowIso}`)
        .or(`end_date.is.null,end_date.gte.${nowIso}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Advertisement | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useActiveBannerAd(position: BannerPosition) {
  return useQuery({
    queryKey: ["ads", "active", "banner", position],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("type", "banner")
        .eq("status", "active")
        .eq("banner_position", position)
        .or(`start_date.is.null,start_date.lte.${nowIso}`)
        .or(`end_date.is.null,end_date.gte.${nowIso}`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as Advertisement | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useAllAds() {
  return useQuery({
    queryKey: ["ads", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Advertisement[];
    },
  });
}

export type AdInput = Omit<Advertisement, "id" | "created_at" | "updated_at" | "created_by">;

export function useUpsertAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Partial<AdInput> }) => {
      if (id) {
        const { error } = await supabase.from(TABLE).update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ ...(values as AdInput), created_by: u.user?.id ?? null } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ads"] }),
  });
}

export function useDeleteAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ad: Advertisement) => {
      if (ad.image_path) {
        await supabase.storage.from("ads").remove([ad.image_path]).catch(() => {});
      }
      const { error } = await supabase.from(TABLE).delete().eq("id", ad.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ads"] }),
  });
}

export async function uploadAdImage(file: File): Promise<{ url: string; path: string }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id ?? "anon";
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("ads").upload(path, file, {
    upsert: false,
    contentType: file.type || "image/*",
  });
  if (error) throw error;
  // Bucket is private; use a long-lived signed URL so the image displays to all visitors.
  const { data, error: signErr } = await supabase.storage
    .from("ads")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;
  return { url: data.signedUrl, path };
}

// ---------- Analytics ----------

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let sid = sessionStorage.getItem("ad_sid");
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("ad_sid", sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

const trackedImpressions = new Set<string>();

export async function trackAdEvent(adId: string, type: "impression" | "click") {
  try {
    // Dedupe impressions per ad per session in memory.
    if (type === "impression") {
      const key = `imp_${adId}`;
      if (trackedImpressions.has(key)) return;
      trackedImpressions.add(key);
    }
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("ad_events").insert({
      ad_id: adId,
      event_type: type,
      user_id: u.user?.id ?? null,
      session_id: getSessionId(),
    });
  } catch {
    // Silently swallow — analytics must never break ads.
  }
}

export type AdStats = {
  impressions: number;
  clicks: number;
  unique_viewers: number;
  ctr: number;
  daily: Array<{ day: string; impressions: number; clicks: number }>;
};

export function useAdStats(adId: string | null | undefined) {
  return useQuery({
    queryKey: ["ads", "stats", adId],
    enabled: !!adId,
    queryFn: async (): Promise<AdStats> => {
      const { data, error } = await supabase.rpc("ad_stats", { _ad_id: adId! });
      if (error) throw error;
      return data as AdStats;
    },
    staleTime: 30_000,
  });
}
