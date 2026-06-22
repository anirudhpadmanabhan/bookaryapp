import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://bookary-boost-engine.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/search", changefreq: "weekly", priority: "0.8" },
          { path: "/genres", changefreq: "weekly", priority: "0.7" },
          { path: "/writers", changefreq: "weekly", priority: "0.7" },
          { path: "/loved", changefreq: "weekly", priority: "0.6" },
          { path: "/diary", changefreq: "weekly", priority: "0.5" },
        ];

        try {
          const [{ data: books }, { data: genres }, { data: writers }] = await Promise.all([
            supabase.from("books").select("id").limit(5000),
            supabase.from("books").select("genre").not("genre", "is", null).limit(5000),
            supabase.from("books").select("author").not("author", "is", null).limit(5000),
          ]);
          const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\u0D00-\u0D7F]+/g, "-").replace(/^-|-$/g, "");
          for (const b of books ?? []) entries.push({ path: `/books/${(b as any).id}`, changefreq: "monthly", priority: "0.6" });
          const gSet = new Set<string>();
          for (const g of genres ?? []) { const s = slugify(String((g as any).genre ?? "")); if (s) gSet.add(s); }
          for (const s of gSet) entries.push({ path: `/genres/${s}`, changefreq: "weekly", priority: "0.5" });
          const wSet = new Set<string>();
          for (const w of writers ?? []) { const s = slugify(String((w as any).author ?? "")); if (s) wSet.add(s); }
          for (const s of wSet) entries.push({ path: `/writers/${s}`, changefreq: "weekly", priority: "0.5" });
        } catch {
          // ignore — ship static entries only on error
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
