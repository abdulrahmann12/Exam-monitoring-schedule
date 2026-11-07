import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** Footer for a table: "21–40 of 62", rows per page, previous / next and page numbers. */
export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange, noun = "rows" }: {
  /** 0-based */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  const from = total === 0 ? 0 : current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{from}–{to}</span> of <span className="tabular-nums">{total}</span> {noun}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Rows per page
          <Select value={String(pageSize)} onValueChange={(value) => { onPageSizeChange(Number(value)); onPageChange(0); }}>
            <SelectTrigger className="h-8 w-[4.5rem]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <nav className="flex items-center gap-1" aria-label="Pages">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={current === 0} onClick={() => onPageChange(current - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pageNumbers(current, pages).map((item, index) => item === "…"
            ? <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">…</span>
            : (
              <Button
                key={item}
                variant={item === current ? "default" : "ghost"}
                size="sm"
                className="h-8 min-w-8 px-2 tabular-nums"
                aria-current={item === current ? "page" : undefined}
                aria-label={`Page ${item + 1}`}
                onClick={() => onPageChange(item)}
              >
                {item + 1}
              </Button>
            ))}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={current >= pages - 1} onClick={() => onPageChange(current + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </div>
  );
}

/** 0-based page numbers to show, with "…" gaps: 1 … 4 5 6 … 12. */
export function pageNumbers(current: number, pages: number): Array<number | "…"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index);
  const keep = new Set([0, pages - 1, current - 1, current, current + 1].filter((value) => value >= 0 && value < pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) out.push("…");
    out.push(value);
  });
  return out;
}

/** The rows of one page (clamps the page when the list got shorter). */
export function pageOf<T>(items: T[], page: number, pageSize: number): T[] {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages - 1);
  return items.slice(current * pageSize, (current + 1) * pageSize);
}
