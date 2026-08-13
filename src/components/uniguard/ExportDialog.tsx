import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUniGuard } from "@/lib/uniguard/store";
import { useBranding } from "@/lib/branding/BrandingProvider";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { FileDown, Calendar as CalendarIcon, FileText, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { toast } from "sonner";
import { exportPdf, exportXlsx } from "@/lib/uniguard/exporters";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate?: string;
  initialFormat?: "pdf" | "xlsx";
}

export function ExportDialog({ open, onOpenChange, defaultDate, initialFormat = "pdf" }: Props) {
  const { schedule, staff, rooms, slots } = useUniGuard();
  const branding = useBranding();
  const { activeGroup } = useScheduleGroup();
  const examPeriod = activeGroup?.name || branding.examPeriod;
  const [fmt, setFmt] = useState<"pdf" | "xlsx">(initialFormat);
  const [mode, setMode] = useState<"single" | "full">("single");
  const [date, setDate] = useState<Date>(defaultDate ? new Date(defaultDate) : new Date());

  useEffect(() => { if (open) setFmt(initialFormat); }, [open, initialFormat]);

  const availableDates = useMemo(() => [...new Set(schedule.map((e) => e.date))].sort(), [schedule]);

  const onExport = () => {
    if (schedule.length === 0) {
      toast.error("Nothing to export — generate a schedule first.");
      return;
    }
    const ctx = {
      schedule, staff, rooms, slots,
      brand: {
        appName: branding.appName,
        university: branding.university,
        department: branding.department,
        examPeriod,
        logoDataUrl: branding.logoDataUrl,
      },
    };
    const dateStr = format(date, "yyyy-MM-dd");
    try {
      const filename = fmt === "pdf"
        ? exportPdf(ctx, { mode, date: dateStr })
        : exportXlsx(ctx, { mode, date: dateStr });
      toast.success(`${fmt.toUpperCase()} exported`, { description: filename });
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Export failed", { description: err?.message ?? "Unknown error" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-4 w-4" /> Export schedule
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Format</Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <button onClick={() => setFmt("pdf")} className={cn("rounded-lg border p-3 text-left transition-smooth", fmt === "pdf" ? "border-primary bg-primary/5" : "border-border")}>
                <FileText className="h-5 w-5 text-destructive mb-1.5" />
                <div className="text-sm font-semibold">PDF</div>
                <div className="text-[11px] text-muted-foreground">Printable document</div>
              </button>
              <button onClick={() => setFmt("xlsx")} className={cn("rounded-lg border p-3 text-left transition-smooth", fmt === "xlsx" ? "border-primary bg-primary/5" : "border-border")}>
                <FileSpreadsheet className="h-5 w-5 text-success mb-1.5" />
                <div className="text-sm font-semibold">Excel</div>
                <div className="text-[11px] text-muted-foreground">Schedule + workload</div>
              </button>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Scope</Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <button onClick={() => setMode("single")} className={cn("rounded-lg border p-3 text-left transition-smooth", mode === "single" ? "border-primary bg-primary/5" : "border-border")}>
                <div className="text-sm font-semibold">Single day</div>
                <div className="text-[11px] text-muted-foreground">One date only</div>
              </button>
              <button onClick={() => setMode("full")} className={cn("rounded-lg border p-3 text-left transition-smooth", mode === "full" ? "border-primary bg-primary/5" : "border-border")}>
                <div className="text-sm font-semibold">Full period</div>
                <div className="text-[11px] text-muted-foreground">Every scheduled date</div>
              </button>
            </div>
          </div>

          {mode === "single" && (
            <div>
              <Label>Exam date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {availableDates.length > 0 && !availableDates.includes(format(date, "yyyy-MM-dd")) && (
                <p className="text-[11px] text-warning mt-1.5">No schedule on this date. Available: {availableDates.join(", ")}</p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Header:</span> {branding.university} · {branding.department} · {examPeriod}
            <div className="mt-1">University and department come from Settings. The exam period follows the header selector.</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onExport} className="gap-2"><FileDown className="h-4 w-4" /> Export {fmt.toUpperCase()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}