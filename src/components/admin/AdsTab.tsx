import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Save, Upload, Megaphone } from "lucide-react";
import {
  useAllAds, useUpsertAd, useDeleteAd, uploadAdImage,
  type Advertisement, type AdType, type AdStatus, type BannerPosition,
} from "@/lib/ads";

type FormState = {
  name: string;
  type: AdType;
  image_url: string;
  image_path: string | null;
  title: string;
  description: string;
  cta_text: string;
  cta_url: string;
  status: AdStatus;
  start_date: string;
  end_date: string;
  banner_position: BannerPosition;
  auto_close_seconds: number;
};

const EMPTY: FormState = {
  name: "",
  type: "popup",
  image_url: "",
  image_path: null,
  title: "",
  description: "",
  cta_text: "",
  cta_url: "",
  status: "inactive",
  start_date: "",
  end_date: "",
  banner_position: "top",
  auto_close_seconds: 3,
};

function toFormState(ad: Advertisement): FormState {
  const toLocal = (s: string | null) =>
    s ? new Date(s).toISOString().slice(0, 16) : "";
  return {
    name: ad.name,
    type: ad.type,
    image_url: ad.image_url,
    image_path: ad.image_path,
    title: ad.title ?? "",
    description: ad.description ?? "",
    cta_text: ad.cta_text ?? "",
    cta_url: ad.cta_url ?? "",
    status: ad.status,
    start_date: toLocal(ad.start_date),
    end_date: toLocal(ad.end_date),
    banner_position: (ad.banner_position ?? "top") as BannerPosition,
    auto_close_seconds: ad.auto_close_seconds,
  };
}

export function AdsTab() {
  const { data: ads = [], isLoading } = useAllAds();
  const [editing, setEditing] = useState<Advertisement | null>(null);
  const [creating, setCreating] = useState(false);
  const del = useDeleteAd();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Advertisements</h2>
          <p className="text-xs text-muted-foreground">Manage popup and banner ads displayed across the library.</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setCreating(true); }}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New ad
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : ads.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No advertisements yet.</td></tr>
            ) : ads.map((ad) => (
              <tr key={ad.id} className="border-t border-border/60">
                <td className="px-3 py-2 font-medium">{ad.name}</td>
                <td className="px-3 py-2 capitalize">{ad.type}{ad.type === "banner" && ad.banner_position ? ` · ${ad.banner_position}` : ""}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ad.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/40 text-muted-foreground"}`}>
                    {ad.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{ad.start_date ? new Date(ad.start_date).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{ad.end_date ? new Date(ad.end_date).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(ad.updated_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setCreating(false); setEditing(ad); }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-elevated"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`Delete "${ad.name}"?`)) return;
                        del.mutate(ad, {
                          onSuccess: () => toast.success("Ad deleted"),
                          onError: (e: any) => toast.error(e.message || "Delete failed"),
                        });
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <AdEditor
          initial={editing ? toFormState(editing) : EMPTY}
          editingId={editing?.id}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function AdEditor({ initial, editingId, onClose }: { initial: FormState; editingId?: string; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(initial);
  const [uploading, setUploading] = useState(false);
  const upsert = useUpsertAd();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    try {
      const { url, path } = await uploadAdImage(file);
      setForm((f) => ({ ...f, image_url: url, image_path: path }));
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.image_url) { toast.error("Image is required"); return; }
    if (form.type === "banner" && !form.banner_position) { toast.error("Banner position is required"); return; }
    const values = {
      name: form.name.trim(),
      type: form.type,
      image_url: form.image_url,
      image_path: form.image_path,
      title: form.title.trim() || null,
      description: form.description.trim() || null,
      cta_text: form.cta_text.trim() || null,
      cta_url: form.cta_url.trim() || null,
      status: form.status,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      banner_position: form.type === "banner" ? form.banner_position : null,
      auto_close_seconds: form.type === "popup" ? Math.max(1, Number(form.auto_close_seconds) || 3) : 3,
      library_id: null,
    };
    upsert.mutate({ id: editingId, values: values as any }, {
      onSuccess: () => { toast.success(editingId ? "Ad updated" : "Ad created"); onClose(); },
      onError: (e: any) => toast.error(e.message || "Save failed"),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{editingId ? "Edit ad" : "New advertisement"}</h3>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-1 hover:bg-surface-elevated">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Advertisement name *">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
          </Field>
          <Field label="Type *">
            <select value={form.type} onChange={(e) => set("type", e.target.value as AdType)} className="input">
              <option value="popup">Popup</option>
              <option value="banner">Banner</option>
            </select>
          </Field>

          <Field label="Image *" full>
            <div className="flex flex-wrap items-center gap-3">
              {form.image_url && (
                <img src={form.image_url} alt="Ad" className="h-20 w-32 rounded-md border border-border object-cover" />
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm hover:bg-surface">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : form.image_url ? "Replace image" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
                />
              </label>
            </div>
          </Field>

          <Field label="Title (popup only)">
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className="input" />
          </Field>
          <Field label="CTA button text">
            <input value={form.cta_text} onChange={(e) => set("cta_text", e.target.value)} className="input" />
          </Field>
          <Field label="Description (popup only)" full>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input min-h-20" />
          </Field>
          <Field label="CTA URL" full>
            <input value={form.cta_url} onChange={(e) => set("cta_url", e.target.value)} placeholder="https://…" className="input" />
          </Field>

          <Field label="Status">
            <select value={form.status} onChange={(e) => set("status", e.target.value as AdStatus)} className="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          {form.type === "banner" ? (
            <Field label="Banner position">
              <select value={form.banner_position} onChange={(e) => set("banner_position", e.target.value as BannerPosition)} className="input">
                <option value="top">Top of homepage</option>
                <option value="middle">Between content sections</option>
                <option value="bottom">Bottom of homepage</option>
              </select>
            </Field>
          ) : (
            <Field label="Auto close (seconds)">
              <input
                type="number"
                min={1}
                value={form.auto_close_seconds}
                onChange={(e) => set("auto_close_seconds", Number(e.target.value))}
                className="input"
              />
            </Field>
          )}

          <Field label="Start date">
            <input type="datetime-local" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="input" />
          </Field>
          <Field label="End date">
            <input type="datetime-local" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className="input" />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-elevated">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={upsert.isPending || uploading}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {upsert.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid hsl(var(--border));background:hsl(var(--surface-elevated));padding:.5rem .75rem;font-size:.875rem;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block text-sm ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
