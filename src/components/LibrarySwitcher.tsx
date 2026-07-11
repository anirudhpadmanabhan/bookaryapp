import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useLibrary } from "@/lib/library";

export function LibrarySwitcher({ compact = false }: { compact?: boolean }) {
  const { libraries, selected, setSelectedId } = useLibrary();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!selected) return null;

  const onlyOne = libraries.length <= 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !onlyOne && setOpen((o) => !o)}
        className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface/40 px-2.5 py-1.5 text-left transition hover:border-primary/40 hover:bg-surface ${onlyOne ? "cursor-default" : ""}`}
        title={selected.name}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[11px] font-semibold">{selected.name.split("&")[0].trim()}</div>
          {!compact && selected.name_ml && (
            <div className="truncate font-malayalam text-[10px] text-muted-foreground">{selected.name_ml}</div>
          )}
        </div>
        {!onlyOne && <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && !onlyOne && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
          {libraries.map((lib) => {
            const active = lib.id === selected.id;
            return (
              <button
                key={lib.id}
                type="button"
                onClick={() => { setSelectedId(lib.id); setOpen(false); }}
                className={`flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-elevated ${active ? "bg-primary/10" : ""}`}
              >
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{lib.name}</div>
                  {lib.name_ml && <div className="truncate font-malayalam text-[11px] text-muted-foreground">{lib.name_ml}</div>}
                  {lib.location && <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/70">{lib.location}</div>}
                </div>
                {active && <Check className="mt-1 h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
