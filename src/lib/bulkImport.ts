import * as XLSX from "xlsx";

import type { BulkDuplicateStrategy, BulkTemplateDownload } from "@/api";

/**
 * Excel import helpers for people and rooms: read the first sheet, then predict what the server will
 * do with each row (problems, duplicate names renamed or skipped). The server checks again on upload.
 */
export type BulkUploadKind = "persons" | "rooms";

export interface RawPreviewRow {
  row: number;
  values: string[];
}

export interface PreviewRow {
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

export function buildPreviewRows(kind: BulkUploadKind, rows: RawPreviewRow[], existingNames: string[], duplicateStrategy: BulkDuplicateStrategy) {
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

export async function parseWorkbook(file: File): Promise<RawPreviewRow[]> {
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

export function saveTemplate(download: BulkTemplateDownload) {
  const objectUrl = window.URL.createObjectURL(download.blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = download.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
