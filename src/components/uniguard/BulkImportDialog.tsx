import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, UploadCloud, X,
} from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import type { BulkDuplicateStrategy, BulkTemplateDownload, BulkUploadResult } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildPreviewRows, parseWorkbook, saveTemplate, type BulkUploadKind, type PreviewRow, type RawPreviewRow } from "@/lib/bulkImport";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/utils/error";

interface Props {
  kind: BulkUploadKind;
  existingNames: string[];
  isUploading: boolean;
  onDownloadTemplate: () => Promise<BulkTemplateDownload>;
  onUpload: (payload: { file: File; duplicateStrategy: BulkDuplicateStrategy }) => Promise<BulkUploadResult>;
}

const TEXT = {
  persons: {
    title: "Import people from Excel",
    noun: ["person", "people"],
    secondary: "Type",
    columns: ["Name", "Type (CHIEF_INVIGILATOR or INVIGILATOR)", "Email", "Department", "Available days", "…"],
  },
  rooms: {
    title: "Import rooms from Excel",
    noun: ["room", "rooms"],
    secondary: "Capacity",
    columns: ["Name", "Capacity", "Type", "Min invigilators", "Hall gender"],
  },
} as const;

type Step = 1 | 2 | 3;

/** Excel import in three short steps: template → file → check and import. */
export function BulkImportDialog({ kind, existingNames, isUploading, onDownloadTemplate, onUpload }: Props) {
  const text = TEXT[kind];
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<RawPreviewRow[]>([]);
  const [strategy, setStrategy] = useState<BulkDuplicateStrategy>("AUTO_RENAME");
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);

  useEffect(() => {
    startTransition(() => setPreview(rawRows.length ? buildPreviewRows(kind, rawRows, existingNames, strategy) : []));
  }, [kind, rawRows, existingNames, strategy]);

  const summary = useMemo(() => ({
    problems: preview.filter((row) => row.issues.length > 0).length,
    renamed: preview.filter((row) => row.duplicate && !row.skipped && row.issues.length === 0).length,
    skipped: preview.filter((row) => row.skipped).length,
    ready: preview.filter((row) => row.issues.length === 0 && !row.skipped).length,
  }), [preview]);

  const step: Step = file || result ? 3 : 2;
  const plural = (count: number) => (count === 1 ? text.noun[0] : text.noun[1]);

  function reset() {
    setFile(null);
    setRawRows([]);
    setResult(null);
    setOnlyProblems(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function downloadTemplate() {
    try {
      setDownloading(true);
      saveTemplate(await onDownloadTemplate());
      setDownloaded(true);
    } catch (error) {
      showErrorToast(error, { fallbackMessage: "Unable to download the template." });
    } finally {
      setDownloading(false);
    }
  }

  async function chooseFile(next: File | null) {
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Choose an Excel .xlsx file.");
      return;
    }
    try {
      setParsing(true);
      const rows = await parseWorkbook(next);
      setFile(next);
      setResult(null);
      startTransition(() => setRawRows(rows));
    } catch (error) {
      reset();
      showErrorToast(error, { fallbackMessage: "The Excel file could not be read." });
    } finally {
      setParsing(false);
    }
  }

  async function upload() {
    if (!file) return;
    try {
      const outcome = await onUpload({ file, duplicateStrategy: strategy });
      setResult(outcome);
      if (outcome.successCount > 0) toast.success(`Imported ${outcome.successCount} ${plural(outcome.successCount)}.`);
      else toast.error("Nothing was imported. Check the rows below.");
    } catch (error) {
      showErrorToast(error, { fallbackMessage: "Upload failed." });
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void chooseFile(event.dataTransfer.files[0] ?? null);
  }

  const rows = onlyProblems ? preview.filter((row) => row.issues.length > 0 || row.skipped) : preview;

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" /> Import from Excel
      </Button>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="space-y-3 border-b border-border px-6 py-4 text-left">
            <div>
              <DialogTitle>{text.title}</DialogTitle>
              <DialogDescription>Add many {text.noun[1]} at once. You see exactly what will happen before anything is saved.</DialogDescription>
            </div>
            <ol className="flex items-center gap-2 text-xs" aria-label="Steps">
              {(["Template", "Choose file", result ? "Done" : "Check & import"] as const).map((label, index) => {
                const number = (index + 1) as Step;
                const done = number === 1 ? downloaded || file !== null : number < step || (number === 3 && result !== null);
                const current = number === step && !done;
                return (
                  <li key={label} className="flex items-center gap-2">
                    {index > 0 && <span className="h-px w-6 bg-border" />}
                    <span className={cn(
                      "grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold",
                      done ? "bg-success text-success-foreground" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}>
                      {done ? <Check className="h-3 w-3" /> : number}
                    </span>
                    <span className={cn(current ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
                  </li>
                );
              })}
            </ol>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} />

            {result ? (
              <ResultView result={result} plural={plural} />
            ) : !file ? (
              <>
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">1. Get the template</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">One row per {text.noun[0]}. Columns: {text.columns.join(", ")}.</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 gap-2" disabled={downloading} onClick={() => void downloadTemplate()}>
                    {downloading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download template
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">2. Choose your filled-in file</p>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Choose an Excel file"
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }}
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
                    onDrop={onDrop}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                      dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                    )}
                  >
                    {parsing ? <LoaderCircle className="h-8 w-8 animate-spin text-primary" /> : <UploadCloud className="h-8 w-8 text-primary" />}
                    <p className="mt-3 text-sm font-medium">{parsing ? "Reading the file…" : "Drop the .xlsx file here, or click to choose"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Only the first sheet is read. Nothing is saved yet.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success"><FileSpreadsheet className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{preview.length} row{preview.length === 1 ? "" : "s"} · {Math.max(1, Math.round(file.size / 1024))} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={reset}><X className="h-4 w-4" /> Change file</Button>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <SummaryChip tone="success" count={summary.ready - summary.renamed} label="ready" />
                  {summary.renamed > 0 && <SummaryChip tone="primary" count={summary.renamed} label="renamed (name exists)" />}
                  {summary.skipped > 0 && <SummaryChip tone="warning" count={summary.skipped} label="skipped (name exists)" />}
                  {summary.problems > 0 && <SummaryChip tone="destructive" count={summary.problems} label={summary.problems === 1 ? "problem" : "problems"} />}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">If a name already exists:</span>
                    <div className="inline-flex rounded-lg bg-muted/60 p-0.5" role="radiogroup" aria-label="If a name already exists">
                      {([["AUTO_RENAME", "Add with a number"], ["SKIP_DUPLICATES", "Skip it"]] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={strategy === value}
                          onClick={() => setStrategy(value)}
                          className={cn("rounded-md px-2.5 py-1 text-xs font-medium", strategy === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(summary.problems > 0 || summary.skipped > 0) && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={onlyProblems} onChange={(event) => setOnlyProblems(event.target.checked)} />
                      Only rows that won't be added
                    </label>
                  )}
                </div>

                {preview.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    This file has no rows under the header. Fill in the template and choose it again.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="max-h-72 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="w-14 px-3 py-2 font-medium">Row</th>
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">{text.secondary}</th>
                            <th className="px-3 py-2 font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => <PreviewLine key={row.row} row={row} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="items-center gap-2 border-t border-border px-6 py-4 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {result ? "" : file && summary.problems > 0 ? "Rows with problems are not imported; the server checks every row again." : "The server checks every row again before saving."}
            </p>
            <div className="flex gap-2">
              {result ? (
                <>
                  <Button variant="outline" className="gap-2" onClick={reset}><ArrowLeft className="h-4 w-4" /> Import another file</Button>
                  <Button onClick={() => { setOpen(false); reset(); }}>Done</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
                  <Button className="gap-2" disabled={!file || summary.ready === 0 || isUploading || parsing} onClick={() => void upload()}>
                    {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {isUploading ? "Importing…" : file ? `Import ${summary.ready} ${plural(summary.ready)}` : "Import"}
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryChip({ tone, count, label }: { tone: "success" | "primary" | "warning" | "destructive"; count: number; label: string }) {
  const tones = {
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return <span className={cn("rounded-full px-2.5 py-1 font-medium", tones[tone])}><span className="tabular-nums">{count}</span> {label}</span>;
}

function PreviewLine({ row }: { row: PreviewRow }) {
  const problem = row.issues.length > 0;
  const renamed = row.duplicate && !row.skipped && !problem;
  return (
    <tr className={cn("border-t border-border/70 align-top", problem && "bg-destructive/[0.04]")}>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.row}</td>
      <td className="px-3 py-2 font-medium">{row.name || <span className="text-muted-foreground">—</span>}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{row.secondaryValue || "—"}</td>
      <td className="px-3 py-2 text-xs">
        {problem ? (
          <div className="space-y-0.5 text-destructive">
            {row.issues.map((issue) => <div key={issue} className="flex items-start gap-1"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{issue}</div>)}
          </div>
        ) : row.skipped ? (
          <span className="text-warning">Skipped: the name already exists</span>
        ) : renamed ? (
          <span className="text-primary">Added as “{row.resolvedName}”</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" /> Ready</span>
        )}
      </td>
    </tr>
  );
}

function ResultView({ result, plural }: { result: BulkUploadResult; plural: (count: number) => string }) {
  const allGood = result.failedCount === 0 && result.successCount > 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4 text-center">
        <div className={cn("grid h-14 w-14 place-items-center rounded-full", allGood ? "bg-success/10 text-success" : "bg-warning/15 text-warning")}>
          {allGood ? <CheckCircle2 className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
        </div>
        <p className="mt-3 text-lg font-semibold">
          {result.successCount > 0 ? `Imported ${result.successCount} ${plural(result.successCount)}` : "Nothing was imported"}
        </p>
        {result.failedCount > 0 && <p className="text-sm text-muted-foreground">{result.failedCount} row{result.failedCount === 1 ? "" : "s"} could not be imported:</p>}
      </div>
      {result.errors.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="w-14 px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Reason</th></tr>
            </thead>
            <tbody>
              {result.errors.map((error, index) => (
                <tr key={`${error.row}-${index}`} className="border-t border-border/70">
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{error.row}</td>
                  <td className="px-3 py-2 text-xs">{error.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
