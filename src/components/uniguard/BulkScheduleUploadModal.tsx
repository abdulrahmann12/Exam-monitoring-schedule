import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { FormSelect } from "@/components/uniguard/FormSelect";
import {
  type ChangeEvent,
  type DragEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import type { ImportDateOrder, ScheduleBulkUploadRowError, UUID } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/utils/error";
import {
  downloadScheduleBulkTemplate,
  extractBulkUploadRowErrors,
  useBulkScheduleUploadMutation,
} from "@/hooks/useBulkScheduleUpload";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BulkScheduleUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The active schedule-group ID. Required to scope both endpoints correctly. */
  groupId: UUID;
  /** Display name of the schedule group – used in dialog copy. */
  groupName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkScheduleUploadModal({
  open,
  onOpenChange,
  groupId,
  groupName,
}: BulkScheduleUploadModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadMutation = useBulkScheduleUploadMutation();

  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rowErrors, setRowErrors] = useState<ScheduleBulkUploadRowError[]>([]);
  const [dateOrder, setDateOrder] = useState<ImportDateOrder>("AUTO");

  // ── Reset state when the dialog closes ──────────────────────────────────
  function handleOpenChange(value: boolean) {
    if (!value) {
      setFile(null);
      setRowErrors([]);
      setIsDragActive(false);
    }
    onOpenChange(value);
  }

  // ── Template download ────────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    try {
      setIsDownloading(true);
      const download = await downloadScheduleBulkTemplate(groupId);
      triggerDownload(download.blob, download.fileName);
      toast.success("Template downloaded.", {
        description: "Fill in the schedule rows then upload the file here.",
      });
    } catch (error) {
      showErrorToast(error, { fallbackMessage: "Failed to download the template." });
    } finally {
      setIsDownloading(false);
    }
  }

  // ── File selection ───────────────────────────────────────────────────────
  function acceptFile(picked: File | null | undefined) {
    if (!picked) return;

    const name = picked.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      toast.error("Upload an Excel (.xlsx) or CSV (.csv) file.");
      return;
    }

    setFile(picked);
    setRowErrors([]);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.item(0));
    // reset so the same file can be re-selected
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    acceptFile(event.dataTransfer.files.item(0));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!file) return;

    setRowErrors([]);

    try {
      const result = await uploadMutation.mutateAsync({ groupId, file, dateOrder });
      const details = [
        `Staff placed: chiefs ${result.chiefSlotsFilled}/${result.chiefSlotsTotal}, invigilators ${result.invigilatorSlotsFilled}/${result.invigilatorSlotsTotal}.`,
        result.timeSlotsCreated.length > 0 ? `New time slots: ${result.timeSlotsCreated.join(", ")}.` : null,
        result.warnings.length > 0 ? `${result.warnings.length} staffing warning(s): see the Scheduler or Reports > coverage gaps.` : null,
      ].filter(Boolean).join(" ");
      const imported = `${result.roomAssignmentsCreated} exam room${result.roomAssignmentsCreated !== 1 ? "s" : ""} imported.`;
      if (result.warnings.length > 0) {
        toast.warning(imported, { description: details, duration: 10000 });
      } else {
        toast.success(imported, { description: details, duration: 8000 });
      }
      handleOpenChange(false);
    } catch (error) {
      const extracted = extractBulkUploadRowErrors(error);
      if (extracted.length > 0) {
        setRowErrors(extracted);
        // don't fire the generic toast – the inline error list is shown instead
      } else {
        showErrorToast(error, { fallbackMessage: "Upload failed. Please try again." });
      }
    }
  }

  const isUploading = uploadMutation.isPending;
  const canUpload = !!file && !isUploading;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl gap-0 p-0 overflow-hidden"
        aria-labelledby="bulk-schedule-upload-title"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-card via-card to-primary/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle id="bulk-schedule-upload-title" className="text-lg">
                Bulk Schedule Generation
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {groupName
                  ? `Generate assignments for "${groupName}" via Excel upload.`
                  : "Upload a filled Excel template to auto-assign staff."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* ── Step 1: Download template ─────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold items-center justify-center shrink-0">
                1
              </span>
              Download the template
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Use the Excel template for this exam period, or upload an export from your student-information system
              (Banner, PeopleSoft, Odoo) as Excel or CSV. Columns are recognised by their names; rooms must already exist,
              missing time slots are created.
            </p>
            <details className="mb-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Recognised column names</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                <li><b>Date:</b> Date, Exam Date (2027-01-10, 10-JAN-2027, or Excel dates)</li>
                <li><b>Time:</b> Time Slot (09:00 - 12:00), or Start Time + End Time (also 9:00 AM, 0900)</li>
                <li><b>Room:</b> Room, Classroom, Facility ID, Location (optional Building is combined with Room)</li>
                <li><b>Subject:</b> Subject Name, Course Title, Descr; Subject Code, Course Code, or Subject + Course Number / Catalog Nbr</li>
                <li><b>Students:</b> Students, Enrollment, Enrl Tot, Headcount</li>
              </ul>
            </details>
            <Button
              id="bulk-schedule-download-template"
              variant="outline"
              className="gap-2"
              disabled={isDownloading}
              onClick={() => void handleDownloadTemplate()}
            >
              {isDownloading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              {isDownloading ? "Downloading…" : "Download Template (.xlsx)"}
            </Button>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Dates like 03/04/2027 mean:</span>
              <FormSelect
                className="h-9 w-56 max-w-full"
                value={dateOrder}
                onValueChange={(value) => setDateOrder(value as ImportDateOrder)}
                aria-label="Date order"
                options={[
                  { value: "AUTO", label: "Decide from the file" },
                  { value: "DAY_FIRST", label: "Day first (3 April)" },
                  { value: "MONTH_FIRST", label: "Month first (4 March)" },
                ]}
              />
            </label>
          </section>

          {/* ── Step 2: Upload filled file ────────────────────────────────── */}
          <section>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold items-center justify-center shrink-0">
                2
              </span>
              Upload your filled template
            </h2>

            {/* Drag-and-drop zone */}
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed p-6 transition-all duration-200 cursor-pointer",
                isDragActive
                  ? "border-primary bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]"
                  : "border-border bg-background/60 hover:border-primary/50 hover:bg-primary/3",
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Drop zone: click or drag an Excel or CSV file here"
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                id="bulk-schedule-file-input"
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={handleInputChange}
                aria-label="Select an Excel or CSV timetable file"
              />

              <div className="flex flex-col items-center justify-center gap-2 text-center pointer-events-none">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                  <Upload className="h-5 w-5" />
                </div>
                {file ? (
                  <>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {Math.max(1, Math.round(file.size / 1024))} KB · Click to choose a different file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">
                      {isDragActive ? "Drop the file here" : "Drag & drop your Excel or CSV file"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or <span className="text-primary underline-offset-2 hover:underline">browse</span> to select
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ── Row-level error list (400 response) ───────────────────────── */}
          {rowErrors.length > 0 && (
            <section
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
              aria-live="polite"
              aria-label="Upload validation errors"
            >
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-sm">
                  {rowErrors.length} row{rowErrors.length !== 1 ? "s" : ""} failed validation
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Nothing was imported. Fix the rows below in your file and upload it again.
              </p>
              <div className="overflow-hidden rounded-xl border border-destructive/20">
                <table className="w-full text-sm">
                  <thead className="bg-destructive/10 text-left text-xs uppercase tracking-wide text-destructive/70">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold w-20">Row</th>
                      <th className="px-4 py-2.5 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowErrors.map((err, index) => (
                      <tr
                        key={`${err.row}-${index}`}
                        className="border-t border-destructive/10 align-top"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {err.row}
                        </td>
                        <td className="px-4 py-2.5 text-destructive flex items-start gap-1.5">
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive/70" />
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Success hint (file selected, no errors) ───────────────────── */}
          {file && rowErrors.length === 0 && !isUploading && (
            <div
              className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success animate-in fade-in duration-200"
              aria-live="polite"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                <strong>{file.name}</strong> is ready to upload. Click "Generate Schedule" below.
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50 flex-row justify-end gap-2">
          <Button
            id="bulk-schedule-cancel"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            id="bulk-schedule-submit"
            className="gap-2 min-w-[160px]"
            disabled={!canUpload}
            onClick={() => void handleUpload()}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Generate Schedule
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
