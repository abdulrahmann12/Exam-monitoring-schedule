import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import { BulkImportDialog } from "./BulkImportDialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The test browser (jsdom) has no File.arrayBuffer(); real browsers do.
if (!("arrayBuffer" in File.prototype)) {
  Object.defineProperty(File.prototype, "arrayBuffer", {
    value(this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    },
  });
}

function workbook(rows: string[][]): File {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Name", "Type"], ...rows]), "People");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([bytes], "people.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function setup(onUpload = vi.fn().mockResolvedValue({ successCount: 2, failedCount: 0, errors: [] })) {
  render(
    <BulkImportDialog
      kind="persons"
      existingNames={["Dr. Omar Nabil"]}
      isUploading={false}
      onDownloadTemplate={vi.fn()}
      onUpload={onUpload}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Import from Excel/ }));
  const dialog = screen.getByRole("dialog");
  const input = dialog.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
  return { dialog, input, onUpload };
}

describe("Excel import window", () => {
  it("shows what will happen to each row, then imports and reports", async () => {
    const { dialog, input, onUpload } = setup();
    expect(within(dialog).getByRole("button", { name: /^Import$/ })).toBeDisabled();

    fireEvent.change(input, { target: { files: [workbook([
      ["Sara Adel", "INVIGILATOR"],
      ["Dr. Omar Nabil", "CHIEF_INVIGILATOR"],
      ["", "INVIGILATOR"],
    ])] } });

    expect(await within(dialog).findByText("people.xlsx")).toBeInTheDocument();
    expect(await within(dialog).findByText("Added as “Dr. Omar Nabil (1)”")).toBeInTheDocument();
    expect(within(dialog).getByText("Name is empty.")).toBeInTheDocument();
    const importButton = within(dialog).getByRole("button", { name: "Import 2 people" });

    fireEvent.click(within(dialog).getByRole("radio", { name: "Skip it" }));
    expect(await within(dialog).findByText("Skipped: the name already exists")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Import 1 person" })).toBe(importButton);

    fireEvent.click(importButton);
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(expect.objectContaining({ duplicateStrategy: "SKIP_DUPLICATES" })));
    expect(await within(dialog).findByText("Imported 2 people")).toBeInTheDocument();
  });

  it("refuses files that are not .xlsx", async () => {
    const { dialog, input } = setup();
    fireEvent.change(input, { target: { files: [new File(["a,b"], "people.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(within(dialog).queryByText("people.csv")).not.toBeInTheDocument());
    expect(within(dialog).getByText(/Drop the .xlsx file here/)).toBeInTheDocument();
  });
});
