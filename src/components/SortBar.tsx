import { LayoutGrid, List, ArrowDownUp } from "lucide-react";
import type { BookSort } from "@/lib/books";
import type { ViewMode } from "./BooksGrid";

const SORT_OPTIONS: { value: BookSort; label: string }[] = [
  { value: "newest", label: "New on shelf" },
  { value: "shelf", label: "Shelf code" },
  { value: "title", label: "Title A–Z" },
  { value: "rating", label: "Highest rated" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
];

export function SortBar({
  count,
  total,
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  count: number;
  total?: number;
  sort: BookSort;
  onSortChange: (s: BookSort) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
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
        <div className="flex overflow-hidden rounded-lg border border-border bg-surface/60">
          <button
            type="button"
            onClick={() => onViewChange("tile")}
            className={`grid h-8 w-8 cursor-pointer place-items-center ${view === "tile" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-surface-elevated"}`}
            aria-label="Tile view"
            title="Tile view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={`grid h-8 w-8 cursor-pointer place-items-center ${view === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-surface-elevated"}`}
            aria-label="List view"
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
