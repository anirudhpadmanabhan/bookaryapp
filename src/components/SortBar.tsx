import { LayoutGrid, List, ArrowDownUp, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import type { BookSort, SortDirection } from "@/lib/books";
import type { ViewMode } from "./BooksGrid";

const SORT_OPTIONS: { value: BookSort; label: string }[] = [
  { value: "newest", label: "New on shelf (latest rack)" },
  { value: "shelf", label: "Rack code (numeric)" },
  { value: "title", label: "Title A–Z" },
  { value: "rating", label: "Rating" },
];


export function SortBar({
  count,
  total,
  sort,
  onSortChange,
  direction = "desc",
  onDirectionChange,
  view,
  onViewChange,
}: {
  count: number;
  total?: number;
  sort: BookSort;
  onSortChange: (s: BookSort) => void;
  direction?: SortDirection;
  onDirectionChange?: (d: SortDirection) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  const toggleDir = () => onDirectionChange?.(direction === "asc" ? "desc" : "asc");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {total !== undefined && total !== count
          ? `Showing ${count.toLocaleString()} of ${total.toLocaleString()} books`
          : `${count.toLocaleString()} book${count !== 1 ? "s" : ""}`}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-1.5 text-sm">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as BookSort)}
            className="cursor-pointer bg-transparent text-sm outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-background">
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {onDirectionChange && (
          <button
            type="button"
            onClick={toggleDir}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-xs font-medium hover:bg-surface-elevated"
            title={direction === "asc" ? "Ascending — click to flip" : "Descending — click to flip"}
          >
            {direction === "asc" ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
            {direction === "asc" ? "Asc" : "Desc"}
          </button>
        )}
        <div className="flex overflow-hidden rounded-lg border border-border bg-surface/60">
          <button
            type="button"
            onClick={() => onViewChange("tile")}
            className={`grid h-8 w-8 cursor-pointer place-items-center ${view === "tile" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-surface-elevated"}`}
            aria-label="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={`grid h-8 w-8 cursor-pointer place-items-center ${view === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-surface-elevated"}`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
