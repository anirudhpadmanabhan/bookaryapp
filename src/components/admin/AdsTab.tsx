import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, X, Save, Upload, Megaphone, Eye,
  FileText, CalendarClock, LayoutTemplate, Image as ImageIcon,
  CircleDot, Clock3, BarChart3, MonitorPlay,
} from "lucide-react";
import {
  useAllAds, useUpsertAd, useDeleteAd, uploadAdImage,
  type Advertisement, type AdType, type AdStatus, type BannerPosition,
} from "@/lib/ads";
import { AdPreview, type AdPreviewData } from "./AdPreview";
import { AdInsights } from "./AdInsights";

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
  const toLocal = (s: string | null) => {
    if (!s) return "";
    const d = new Date(s);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
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

type EffectiveStatus = "live" | "scheduled" | "expired" | "paused";
function effectiveStatus(ad: Advertisement): EffectiveStatus {
  if (ad.status !== "active") return "paused";
  const now = Date.now();
  if (ad.start_date && new Date(ad.start_date).getTime() > now) return "scheduled";
  if (ad.end_date && new Date(ad.end_date).getTime() < now) return "expired";
  return "live";
}

const STATUS_META: Record<EffectiveStatus, { label: string; cls: string; dot: string }> = {
  live:      { label: "Live now", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400 animate-pulse" },
  scheduled: { label: "Scheduled", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", dot: "bg-sky-400" },
  expired:   { label: "Expired",   cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", dot: "bg-zinc-400" },
  paused:    { label: "Paused",    cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
};

function fmtDT(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AdsTab() {
  const { data: ads = [], isLoading } = useAllAds();
  const [editing, setEditing] = useState<Advertisement | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<Advertisement | null>(null);
  const [insightsFor, setInsightsFor] = useState<Advertisement | null>(null);
  const del = useDeleteAd();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Advertisements</h2>
          <p className="text-xs text-muted-foreground">Schedule popup and banner ads. Status reflects the live state at this moment.</p>
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
              <th className="px-3 py-2">Starts</th>
              <th className="px-3 py-2">Ends</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : ads.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No advertisements yet.</td></tr>
            ) : ads.map((ad) => {
              const eff = effectiveStatus(ad);
              const meta = STATUS_META[eff];
              return (
                <tr key={ad.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-medium">{ad.name}</td>
                  <td className="px-3 py-2 capitalize">{ad.type}{ad.type === "banner" && ad.banner_position ? ` · ${ad.banner_position}` : ""}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDT(ad.start_date)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDT(ad.end_date)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDT(ad.updated_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewing(ad)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-elevated"
                        title="Preview"
                      >
                        <Eye className="h-3 w-3" /> Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setInsightsFor(ad)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-elevated"
                        title="Insights"
                      >
                        <BarChart3 className="h-3 w-3" /> Insights
                      </button>
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
              );
            })}
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

      {previewing && (
        <Modal title={`Preview · ${previewing.name}`} onClose={() => setPreviewing(null)}>
          <AdPreview ad={adToPreview(previewing)} />
        </Modal>
      )}

      {insightsFor && (
        <Modal title={`Insights · ${insightsFor.name}`} onClose={() => setInsightsFor(null)} wide>
          <AdInsights adId={insightsFor.id} />
        </Modal>
      )}
    </div>
  );
}

function adToPreview(ad: Advertisement): AdPreviewData {
  return {
    name: ad.name,
    type: ad.type,
    image_url: ad.image_url,
    title: ad.title,
    description: ad.description,
    cta_text: ad.cta_text,
    cta_url: ad.cta_url,
    banner_position: ad.banner_position,
  };
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full ${wide ? "max-w-3xl" : "max-w-xl"} overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg p-1 hover:bg-surface-elevated">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type EditorTab = "basics" | "content" | "schedule" | "display";

function AdEditor({ initial, editingId, onClose }: { initial: FormState; editingId?: string; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(initial);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<EditorTab>("basics");
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
    if (!form.name.trim()) { setTab("basics"); toast.error("Name is required"); return; }
    if (!form.image_url) { setTab("basics"); toast.error("Image is required"); return; }
    if (form.type === "banner" && !form.banner_position) { setTab("display"); toast.error("Banner position is required"); return; }
    const ctaTrimmed = form.cta_url.trim();
    if (ctaTrimmed && !/^https?:\/\//i.test(ctaTrimmed)) {
      setTab("content");
      toast.error("CTA URL must start with http:// or https://");
      return;
    }
    if (form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date)) {
      setTab("schedule");
      toast.error("End time must be after start time");
      return;
    }
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

  const TABS: { id: EditorTab; label: string; icon: any }[] = [
    { id: "basics",   label: "Basics",   icon: ImageIcon },
    { id: "content",  label: "Content",  icon: FileText },
    { id: "schedule", label: "Schedule", icon: CalendarClock },
    { id: "display",  label: "Display",  icon: LayoutTemplate },
  ];

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

        <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border bg-surface/40 p-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "basics" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Advertisement name *">
              <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="Internal name" />
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
                  <img src={form.image_url} alt="Ad" className="h-24 w-40 rounded-md border border-border object-cover" />
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
                <p className="w-full text-xs text-muted-foreground">PNG/JPG up to 5 MB. Use 16:9 for banners and square/portrait for popups.</p>
              </div>
            </Field>
          </div>
        )}

        {tab === "content" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={form.type === "popup" ? "Title" : "Title (optional overlay)"} full>
              <input value={form.title} onChange={(e) => set("title", e.target.value)} className="input" placeholder="Headline shown to users" />
            </Field>
            <Field label="Description" full>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input min-h-24" placeholder="Short supporting copy" />
            </Field>
            <Field label="CTA button text">
              <input value={form.cta_text} onChange={(e) => set("cta_text", e.target.value)} className="input" placeholder="e.g. Learn more" />
            </Field>
            <Field label="CTA URL">
              <input value={form.cta_url} onChange={(e) => set("cta_url", e.target.value)} placeholder="https://…" className="input" />
            </Field>
          </div>
        )}

        {tab === "schedule" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date & time">
                <input type="datetime-local" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="input" />
              </Field>
              <Field label="End date & time">
                <input type="datetime-local" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className="input" />
              </Field>
            </div>
            <Field label="Status">
              <div className="flex gap-2">
                {(["active", "inactive"] as AdStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("status", s)}
                    className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition ${
                      form.status === s
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CircleDot className="h-3.5 w-3.5" /> {s}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-elevated/60 p-3 text-xs text-muted-foreground">
              <Clock3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <p>
                Leave dates empty for an always-on ad. The ad is auto-hidden before the start time and after the end time, even when the status is Active. Set status to Inactive to pause manually.
              </p>
            </div>
          </div>
        )}

        {tab === "display" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {form.type === "banner" ? (
              <Field label="Banner position" full>
                <select value={form.banner_position} onChange={(e) => set("banner_position", e.target.value as BannerPosition)} className="input">
                  <option value="top">Top of homepage</option>
                  <option value="middle">Between content sections</option>
                  <option value="bottom">Bottom of homepage (sticky)</option>
                </select>
              </Field>
            ) : (
              <Field label="Auto close (seconds)" full>
                <input
                  type="number"
                  min={1}
                  value={form.auto_close_seconds}
                  onChange={(e) => set("auto_close_seconds", Number(e.target.value))}
                  className="input"
                />
                <p className="mt-1 text-xs text-muted-foreground">Popup closes automatically after this many seconds.</p>
              </Field>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Tab <span className="font-semibold capitalize text-foreground">{tab}</span> · {form.type === "popup" ? "Popup overlay" : `Banner · ${form.banner_position}`}
          </p>
          <div className="flex gap-2">
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
      </div>
      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid hsl(var(--border));background:hsl(var(--surface-elevated));padding:.5rem .75rem;font-size:.875rem;outline:none;color:inherit}.input:focus{border-color:hsl(var(--primary))}`}</style>
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
