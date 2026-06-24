import { useAdStats } from "@/lib/ads";
import { Eye, MousePointerClick, Users, Percent } from "lucide-react";

export function AdInsights({ adId }: { adId: string }) {
  const { data, isLoading, error } = useAdStats(adId);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface/40" />;
  }
  if (error) {
    return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">Could not load analytics.</div>;
  }
  if (!data) return null;

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.impressions));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Eye}                label="Impressions"     value={data.impressions.toLocaleString()} tone="sky" />
        <Stat icon={MousePointerClick}  label="Clicks"          value={data.clicks.toLocaleString()}      tone="emerald" />
        <Stat icon={Users}              label="Unique viewers"  value={data.unique_viewers.toLocaleString()} tone="violet" />
        <Stat icon={Percent}            label="CTR"             value={`${data.ctr}%`}                     tone="amber" />
      </div>

      <div className="rounded-xl border border-border bg-surface/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Last 7 days</h4>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" /> Impressions</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" /> Clicks</span>
          </div>
        </div>
        <div className="flex h-32 items-end justify-between gap-1.5">
          {data.daily.map((d) => {
            const ih = Math.round((d.impressions / maxDaily) * 100);
            const ch = d.impressions > 0 ? Math.round((d.clicks / maxDaily) * 100) : 0;
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-sky-500/70" style={{ height: `${ih}%` }} title={`${d.impressions} impressions`} />
                  <div className="w-1/2 rounded-t bg-emerald-500/80" style={{ height: `${ch}%` }} title={`${d.clicks} clicks`} />
                </div>
                <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TONES = {
  sky:     "from-sky-500/20 to-sky-500/5 text-sky-300",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
  violet:  "from-violet-500/20 to-violet-500/5 text-violet-300",
  amber:   "from-amber-500/20 to-amber-500/5 text-amber-300",
} as const;

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: keyof typeof TONES }) {
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br ${TONES[tone]} p-3`}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
