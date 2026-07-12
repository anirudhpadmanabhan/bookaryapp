import { useState } from "react";
import { Sprout } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Library = {
  id: string;
  slug: string;
  name: string;
  name_ml: string | null;
  location: string | null;
  is_default: boolean;
};

type Book = Record<string, unknown> & { id: string };

type Catalogue = { libraries: Library[]; books: Book[] };

/**
 * Admin-only one-click seed. Loads /seed/catalogue.json (checked into the
 * repo) and upserts libraries + books via the Data API. Existing rows are
 * left alone thanks to `onConflict:id, ignoreDuplicates:true`.
 *
 * Use this after remixing the project into a fresh Lovable Cloud database
 * to populate the same book catalogue.
 */
export function SeedCatalogueButton({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  if (!isAdmin) return null;

  async function run() {
    if (busy) return;
    if (!confirm("Seed libraries + full book catalogue into this project? Existing rows are kept — only missing ones are inserted.")) return;
    setBusy(true);
    setProgress("Downloading catalogue…");
    try {
      const res = await fetch("/seed/catalogue.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Catalogue not found (${res.status})`);
      const data = (await res.json()) as Catalogue;

      setProgress(`Seeding ${data.libraries.length} libraries…`);
      const { error: libErr } = await supabase
        .from("libraries")
        .upsert(data.libraries as never, { onConflict: "id", ignoreDuplicates: true });
      if (libErr) throw libErr;

      const CHUNK = 200;
      const total = data.books.length;
      let inserted = 0;
      for (let i = 0; i < total; i += CHUNK) {
        const batch = data.books.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("books")
          .upsert(batch as never, { onConflict: "id", ignoreDuplicates: true });
        if (error) throw error;
        inserted += batch.length;
        setProgress(`Seeding books ${inserted}/${total}…`);
      }

      qc.invalidateQueries();
      toast.success(`Seeded ${data.libraries.length} libraries and ${total} books.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Seed failed: ${msg}`);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm font-medium text-foreground hover:bg-surface disabled:cursor-wait disabled:opacity-60"
      title="Populate a freshly-remixed project with the full library + book catalogue"
    >
      <Sprout className="h-4 w-4" />
      {busy ? progress || "Seeding…" : "Seed catalogue"}
    </button>
  );
}
