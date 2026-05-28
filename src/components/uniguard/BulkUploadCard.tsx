import { AlertCircle, Download, FileSpreadsheet, LoaderCircle, RefreshCw, UploadCloud } from "lucide-react";
import {
    startTransition,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type DragEvent,
} from "react";
import * as XLSX from "xlsx";

import type { BulkDuplicateStrategy, BulkTemplateDownload, BulkUploadResult } from "@/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/utils/error";
import { toast } from "sonner";

type BulkUploadKind = "persons" | "rooms";

interface BulkUploadCardProps {
  kind: BulkUploadKind;
  existingNames: string[];
  isUploading: boolean;
  onDownloadTemplate: () => Promise<BulkTemplateDownload>;
  onUpload: (payload: { file: File; duplicateStrategy: BulkDuplicateStrategy }) => Promise<BulkUploadResult>;
}

interface RawPreviewRow {
  row: number;
  values: string[];
}

interface PreviewRow {
  row: number;
  name: string;
  secondaryValue: string;
  resolvedName: string;
  duplicate: boolean;
  skipped: boolean;
  issues: string[];
  statusLabel: string;
}

const PERSON_MAX_NAME_LENGTH = 160;
const ROOM_MAX_NAME_LENGTH = 120;
const PERSON_TYPE_OPTIONS = new Set(["CHIEF_INVIGILATOR", "INVIGILATOR"]);

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function normalizeEnumToken(value: string): string {
  return normalizeWhitespace(value).replace(/[\s-]+/g, "_").toUpperCase();
}

function resolveUniqueName(baseName: string, reservedNames: Set<string>, maxLength: number) {
  const normalizedBaseName = normalizeForComparison(baseName);

  if (!reservedNames.has(normalizedBaseName)) {
    reservedNames.add(normalizedBaseName);
    return { resolvedName: baseName, duplicate: false };
  }

  let suffix = 1;
  while (true) {
    const suffixText = ` (${suffix})`;
    const truncatedBaseName =
      baseName.length + suffixText.length > maxLength
        ? baseName.slice(0, Math.max(0, maxLength - suffixText.length)).trim()
        : baseName;
    const candidateName = `${truncatedBaseName}${suffixText}`;
    const normalizedCandidateName = normalizeForComparison(candidateName);

    if (!reservedNames.has(normalizedCandidateName)) {
      reservedNames.add(normalizedCandidateName);
      return { resolvedName: candidateName, duplicate: true };
    }

    suffix += 1;
  }
}

function buildPreviewRows(kind: BulkUploadKind, rows: RawPreviewRow[], existingNames: string[], duplicateStrategy: BulkDuplicateStrategy) {
  const reservedNames = new Set(
    existingNames.map((name) => normalizeForComparison(name)).filter((name) => name.length > 0),
  );

  return rows.map((row) => {
    const [first = "", second = ""] = row.values;
    const name = normalizeWhitespace(first);
    const secondaryValue = normalizeWhitespace(second);
    const issues: string[] = [];
    const maxLength = kind === "persons" ? PERSON_MAX_NAME_LENGTH : ROOM_MAX_NAME_LENGTH;

    if (!name) {
      issues.push("Name is empty.");
    } else if (name.length > maxLength) {
      issues.push(`Name must be at most ${maxLength} characters.`);
    }

    if (kind === "persons") {
      if (!secondaryValue) {
        issues.push("Type is required.");
      } else if (!PERSON_TYPE_OPTIONS.has(normalizeEnumToken(secondaryValue))) {
        issues.push("Type must be CHIEF_INVIGILATOR or INVIGILATOR.");
      }
    }

    if (issues.length > 0) {
      return {
        row: row.row,
        name,
        secondaryValue,
        resolvedName: name,
        duplicate: false,
        skipped: false,
        issues,
        statusLabel: "Needs attention",
      } satisfies PreviewRow;
    }

    const duplicateDetected = reservedNames.has(normalizeForComparison(name));
    if (duplicateDetected && duplicateStrategy === "SKIP_DUPLICATES") {
      return {
        row: row.row,
        name,
        secondaryValue,
        resolvedName: name,
        duplicate: true,
        skipped: true,
        issues: [],
        statusLabel: "Will be skipped",
      } satisfies PreviewRow;
    }

    const { resolvedName, duplicate } = resolveUniqueName(name, reservedNames, maxLength);
    return {
      row: row.row,
      name,
      secondaryValue,
      resolvedName,
      duplicate,
      skipped: false,
      issues: [],
      statusLabel: duplicate ? `Will be renamed to ${resolvedName}` : "Ready to upload",
    } satisfies PreviewRow;
  });
}

async function parseWorkbook(file: File): Promise<RawPreviewRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  return matrix
    .slice(1)
    .map((values, index) => ({
      row: index + 2,
      values: values.map((value) => (typeof value === "string" ? normalizeWhitespace(value) : String(value ?? ""))),
    }))
    .filter((row) => row.values.some((value) => value.length > 0));
}

function saveTemplate(download: BulkTemplateDownload) {
  const objectUrl = window.URL.createObjectURL(download.blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = download.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function BulkUploadCard({ kind, existingNames, isUploading, onDownloadTemplate, onUpload }: BulkUploadCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<RawPreviewRow[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<BulkDuplicateStrategy>("AUTO_RENAME");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isParsingPreview, setIsParsingPreview] = useState(false);
  const [lastResult, setLastResult] = useState<BulkUploadResult | null>(null);

  const labels =
    kind === "persons"
      ? {
          title: "Bulk upload persons",
          description:
            "Download the Excel template, fill it with chief invigilators and invigilators, then review the preview before import.",
          secondaryHeader: "Type",
          templateButton: "Download Persons Template",
          uploadButton: "Upload persons",
          emptyText: "Add a persons workbook to preview row validation and duplicate handling.",
        }
      : {
          title: "Bulk upload rooms",
          description:
            "Upload a room workbook with optional capacity and staffing details. Duplicate room names will be resolved server-side.",
          secondaryHeader: "Capacity",
          templateButton: "Download Rooms Template",
          uploadButton: "Upload rooms",
          emptyText: "Add a rooms workbook to preview row validation and duplicate handling.",
        };

  useEffect(() => {
    if (rawRows.length === 0) {
      setPreviewRows([]);
      return;
    }

    startTransition(() => {
      setPreviewRows(buildPreviewRows(kind, rawRows, existingNames, duplicateStrategy));
    });
  }, [duplicateStrategy, existingNames, kind, rawRows]);

  async function handleTemplateDownload() {
    try {
      setIsDownloadingTemplate(true);
      const download = await onDownloadTemplate();
      saveTemplate(download);
      toast.success(`${labels.templateButton} ready.`);
    } catch (error) {
      showErrorToast(error, { fallbackMessage: "Unable to download the template." });
    } finally {
      setIsDownloadingTemplate(false);
    }
  }

  async function handleFileSelection(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are supported.");
      return;
    }

    try {
      setIsParsingPreview(true);
      const rows = await parseWorkbook(file);
      setSelectedFile(file);
      setLastResult(null);
      startTransition(() => {
        setRawRows(rows);
      });
    } catch (error) {
      setSelectedFile(null);
      setRawRows([]);
      showErrorToast(error, { fallbackMessage: "The Excel file could not be parsed." });
    } finally {
      setIsParsingPreview(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    try {
      const result = await onUpload({ file: selectedFile, duplicateStrategy });
      setLastResult(result);

      if (result.successCount > 0 && result.failedCount === 0) {
        toast.success(`Imported ${result.successCount} ${kind}.`);
      } else if (result.successCount > 0) {
        toast.success(`Imported ${result.successCount} ${kind}; ${result.failedCount} rows need attention.`);
      } else {
        toast.error("No rows were imported. Review the errors and try again.");
      }
    } catch (error) {
      showErrorToast(error, { fallbackMessage: "Upload failed." });
    }
  }

  function handleBrowseClick() {
    inputRef.current?.click();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    void handleFileSelection(event.dataTransfer.files.item(0));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFileSelection(event.target.files?.item(0) ?? null);
  }

  const previewIssuesCount = previewRows.filter((row) => row.issues.length > 0).length;
  const previewDuplicatesCount = previewRows.filter((row) => row.duplicate && !row.skipped).length;
  const previewSkippedCount = previewRows.filter((row) => row.skipped).length;

  return (
    <Card className="border-border/80 bg-card/80 shadow-card">
      <CardHeader className="gap-3 border-b border-border/70 bg-gradient-to-r from-card via-card to-accent/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{labels.title}</CardTitle>
            <CardDescription className="max-w-2xl">{labels.description}</CardDescription>
          </div>
          <Button variant="outline" className="gap-2" disabled={isDownloadingTemplate} onClick={() => void handleTemplateDownload()}>
            {isDownloadingTemplate ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {labels.templateButton}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div
            className={cn(
              "rounded-2xl border border-dashed p-6 transition-smooth",
              isDragActive ? "border-primary bg-primary/5 shadow-glow" : "border-border bg-background/60",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleInputChange} />
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">Drag and drop an .xlsx file</div>
                  <p className="text-sm text-muted-foreground">
                    The preview checks row formatting, likely duplicates, and the rename strategy before upload.
                  </p>
                </div>
              </div>
              <Button type="button" className="gap-2" variant="secondary" onClick={handleBrowseClick}>
                <UploadCloud className="h-4 w-4" /> Choose file
              </Button>
            </div>

            <div className="mt-4 rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm">
              {selectedFile ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-foreground">{selectedFile.name}</div>
                    <div className="text-muted-foreground">{Math.max(1, Math.round(selectedFile.size / 1024))} KB</div>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-2" onClick={() => void handleFileSelection(selectedFile)}>
                    <RefreshCw className="h-4 w-4" /> Re-parse preview
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground">No file selected yet.</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="text-sm font-medium">Duplicate handling</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Preview uses the selected workbook plus the currently loaded directory snapshot. The backend rechecks live data before save.
            </p>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-smooth",
                  duplicateStrategy === "AUTO_RENAME"
                    ? "border-primary bg-primary/10 text-foreground shadow-glow"
                    : "border-border bg-card hover:border-primary/40",
                )}
                onClick={() => setDuplicateStrategy("AUTO_RENAME")}
              >
                <div className="font-medium">Auto rename duplicates</div>
                <div className="mt-1 text-sm text-muted-foreground">Default and recommended. The next available suffix is applied automatically.</div>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-smooth",
                  duplicateStrategy === "SKIP_DUPLICATES"
                    ? "border-warning bg-warning/10 text-foreground"
                    : "border-border bg-card hover:border-warning/40",
                )}
                onClick={() => setDuplicateStrategy("SKIP_DUPLICATES")}
              >
                <div className="font-medium">Skip duplicates</div>
                <div className="mt-1 text-sm text-muted-foreground">Duplicate rows are not inserted and return as row-level upload errors.</div>
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-success/30 bg-success/10 p-4">
            <div className="text-sm text-muted-foreground">Preview ready rows</div>
            <div className="mt-2 text-3xl font-semibold text-success">{Math.max(0, previewRows.length - previewIssuesCount - previewSkippedCount)}</div>
          </div>
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <div className="text-sm text-muted-foreground">Preview duplicates</div>
            <div className="mt-2 text-3xl font-semibold text-warning">{previewDuplicatesCount + previewSkippedCount}</div>
          </div>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <div className="text-sm text-muted-foreground">Preview validation issues</div>
            <div className="mt-2 text-3xl font-semibold text-destructive">{previewIssuesCount}</div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">Preview</div>
              <p className="text-sm text-muted-foreground">{labels.emptyText}</p>
            </div>
            <Button
              className="gap-2"
              disabled={!selectedFile || isUploading || isParsingPreview}
              onClick={() => void handleUpload()}
            >
              {isUploading || isParsingPreview ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {isUploading ? "Uploading..." : labels.uploadButton}
            </Button>
          </div>

          {previewRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
              {isParsingPreview ? "Parsing workbook preview..." : labels.emptyText}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                    <tr>
                      <th className="px-4 py-3 font-medium">Row</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">{labels.secondaryHeader}</th>
                      <th className="px-4 py-3 font-medium">Resolved name</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={`${kind}-${row.row}`} className="border-t border-border/80 align-top">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.row}</td>
                        <td className="px-4 py-3 font-medium">{row.name || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.secondaryValue || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={cn(row.duplicate && !row.skipped ? "font-semibold text-primary" : "text-foreground")}>{row.resolvedName || "-"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              row.issues.length > 0 && "bg-destructive/10 text-destructive",
                              row.skipped && "bg-warning/10 text-warning",
                              row.duplicate && !row.skipped && row.issues.length === 0 && "bg-primary/10 text-primary",
                              !row.duplicate && !row.skipped && row.issues.length === 0 && "bg-success/10 text-success",
                            )}
                          >
                            {row.statusLabel}
                          </div>
                          {row.issues.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs text-destructive">
                              {row.issues.map((issue) => (
                                <div key={`${row.row}-${issue}`} className="flex items-start gap-1">
                                  <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                                  <span>{issue}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {lastResult ? (
          <section className="space-y-4 rounded-2xl border border-border bg-background/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">Latest upload result</div>
                <p className="text-sm text-muted-foreground">Server-side validation, duplicate resolution, and persistence outcome.</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="rounded-xl bg-success/10 px-3 py-2 text-success">Success: {lastResult.successCount}</div>
                <div className="rounded-xl bg-destructive/10 px-3 py-2 text-destructive">Failed: {lastResult.failedCount}</div>
              </div>
            </div>

            {lastResult.errors.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Row</th>
                      <th className="px-4 py-3 font-medium">Error message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastResult.errors.map((error, index) => (
                      <tr key={`${error.row}-${error.message}-${index}`} className="border-t border-border/70">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{error.row}</td>
                        <td className="px-4 py-3">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                All rows were imported successfully.
              </div>
            )}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}