import { AlertCircle, AlertTriangle, CheckCircle2, Clock3, DoorOpen, History, Lightbulb, PencilLine, Printer, Undo2, Download, FileSpreadsheet, LayoutGrid, Loader2, Upload, Users, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  AllocatedExam, AllocationSitting, ImportDateOrder, RoomAllocationAdjustments, RoomAllocationBatch, RoomAllocationPreview, RoomAllocationSaved, RoomAllocationStaffed, ScheduleBulkUploadRowError,
} from "@/api";
import {
  MAX_DRAFT_FILE_BYTES, base64ToFile, clearDraft, fileToBase64, loadDraft, planChanges, saveDraft,
} from "@/lib/uniguard/allocationDraft";
import { EmptyState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { FormSelect } from "@/components/uniguard/FormSelect";
import { StatCard } from "@/components/uniguard/StatCard";
import { AllocationRoomGrid, type DropCheck, type DropTarget, type Dragged } from "@/components/uniguard/AllocationRoomGrid";
import { Switch } from "@/components/ui/switch";
import { useRoomsQuery } from "@/hooks/useRooms";
import { useTimeSlotsQuery } from "@/hooks/useTimeSlots";
import { EditExamDialog, type ExamChange } from "@/components/uniguard/EditExamDialog";
import { extractBulkUploadRowErrors } from "@/hooks/useBulkScheduleUpload";
import {
  usePreviewRoomAllocationMutation, useRoomAllocationBatchesQuery, useSaveRoomAllocationMutation, useStaffRoomAllocationMutation,
  useUndoRoomAllocationMutation,
} from "@/hooks/useRoomAllocation";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useScheduleGroup } from "@/state/scheduleGroup";
import { showErrorToast } from "@/utils/error";
import { roomAllocationService } from "@/api/services/roomAllocationService";
import { unwrapServiceResponse } from "@/api/utils/serviceResponse";

/** One look for every small label next to an exam name; it never breaks onto two lines. */
const BADGE = "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-none";
const TITLE = "Room Allocation";
const SUBTITLE = "Upload your exam list without rooms: Uni-Guard picks the rooms for every exam.";

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Door sheets (PDF) or the Excel file of a saved allocation. */
async function downloadBatch(id: string, kind: "door-sheets" | "export") {
  try {
    const { blob, fileName } = unwrapServiceResponse(await roomAllocationService.downloadBatchFile(id, kind));
    saveBlob(blob, fileName);
  } catch (error) {
    showErrorToast(error, { fallbackMessage: kind === "door-sheets" ? "The door sheets could not be made." : "The Excel file could not be made." });
  }
}

/** The two download buttons of a saved allocation. */
function BatchDownloads({ batchId, size = "default" }: { batchId: string; size?: "default" | "sm" }) {
  return (
    <>
      <Button variant="outline" size={size} className="gap-2" onClick={() => void downloadBatch(batchId, "door-sheets")}>
        <Printer className="h-4 w-4" /> Door sheets (PDF)
      </Button>
      <Button variant="outline" size={size} className="gap-2" onClick={() => void downloadBatch(batchId, "export")}>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
    </>
  );
}

async function downloadTemplate() {
  try {
    const { blob, fileName } = unwrapServiceResponse(await roomAllocationService.downloadTemplate());
    saveBlob(blob, fileName);
  } catch (error) {
    showErrorToast(error, { fallbackMessage: "The template could not be downloaded." });
  }
}

function formatDate(iso: string, day: string) {
  const [year, month, date] = iso.split("-").map(Number);
  const label = new Date(year, month - 1, date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${day} ${label}`;
}

export default function RoomAllocation() {
  const { activeGroup, activeGroupId } = useScheduleGroup();
  const previewMutation = usePreviewRoomAllocationMutation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dateOrder, setDateOrder] = useState<ImportDateOrder>("AUTO");
  const [rowErrors, setRowErrors] = useState<ScheduleBulkUploadRowError[]>([]);
  const [preview, setPreview] = useState<RoomAllocationPreview | null>(null);
  const [saved, setSaved] = useState<RoomAllocationSaved | null>(null);
  const [staffed, setStaffed] = useState<RoomAllocationStaffed | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const saveMutation = useSaveRoomAllocationMutation();
  const staffMutation = useStaffRoomAllocationMutation();
  const undoMutation = useUndoRoomAllocationMutation();
  const [undoTarget, setUndoTarget] = useState<RoomAllocationBatch | null>(null);
  const NO_CHANGES: RoomAllocationAdjustments = { times: {}, rooms: {} };
  const [adjustments, setAdjustments] = useState<RoomAllocationAdjustments>(NO_CHANGES);
  const [editing, setEditing] = useState<{ exam: AllocatedExam; sitting: AllocationSitting } | null>(null);
  const [replanning, setReplanning] = useState(false);
  /** Earlier versions of the changes, newest last (Undo last move / Ctrl+Z). */
  const [history, setHistory] = useState<RoomAllocationAdjustments[]>([]);
  const undoRef = useRef<() => boolean>(() => false);
  // Ctrl+Z (Cmd+Z on a Mac): undo the last move, unless a text field has the focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (undoRef.current()) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const roomsQuery = useRoomsQuery();
  const slotsQuery = useTimeSlotsQuery({ page: 0, size: 100, sortBy: "sortOrder", direction: "ASC", activeOnly: true });
  const slotTimes = (slotsQuery.data?.items ?? []).filter((slot) => slot.active).map((slot) => `${slot.startTime.slice(0, 5)}-${slot.endTime.slice(0, 5)}`);
  const changedRows = new Set([
    ...Object.keys(adjustments.times), ...Object.keys(adjustments.rooms),
    ...Object.keys(adjustments.dates ?? {}), ...Object.keys(adjustments.anchors ?? {}),
  ]).size;
  const restoredGroup = useRef<string | null>(null);

  // A page refresh brings back the file, the proposal and the results (kept in this browser, per exam period).
  useEffect(() => {
    if (!activeGroupId || restoredGroup.current === activeGroupId) return;
    restoredGroup.current = activeGroupId;
    const draft = loadDraft(activeGroupId);
    setRowErrors([]);
    if (draft) {
      setFile(base64ToFile(draft.fileBase64, draft.fileName, draft.fileType));
      setDateOrder(draft.dateOrder);
      setAdjustments({ times: {}, rooms: {}, dates: {}, anchors: {}, ...draft.adjustments });
      setPreview(draft.preview);
      setSaved(draft.saved);
      setStaffed(draft.staffed);
    } else {
      setFile(null);
      setPreview(null);
      setSaved(null);
      setStaffed(null);
    }
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId || restoredGroup.current !== activeGroupId) return;
    if (!file || !preview) {
      clearDraft(activeGroupId);
      return;
    }
    if (file.size > MAX_DRAFT_FILE_BYTES) return;
    let cancelled = false;
    void fileToBase64(file).then((fileBase64) => {
      if (!cancelled) {
        saveDraft(activeGroupId, { fileName: file.name, fileType: file.type, fileBase64, dateOrder, preview, saved, staffed, adjustments });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeGroupId, file, dateOrder, preview, saved, staffed, adjustments]);

  if (!activeGroupId) {
    return (
      <AppLayout title={TITLE} subtitle={SUBTITLE}>
        <EmptyState title="No exam period selected" description="Create or choose an exam period first (top of the page)." />
      </AppLayout>
    );
  }

  function acceptFile(picked: File | null | undefined) {
    if (!picked) return;
    const name = picked.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      toast.error("Upload an Excel (.xlsx) or CSV (.csv) file.");
      return;
    }
    setFile(picked);
    setAdjustments({ times: {}, rooms: {} }); // changes belong to the old file's rows
    setHistory([]); // and so do the moves Undo last move could bring back
    setRowErrors([]);
    setPreview(null);
    setSaved(null);
    setStaffed(null);
  }

  async function handlePreview(changes: RoomAllocationAdjustments = adjustments) {
    if (!file || !activeGroupId) return;
    setRowErrors([]);
    setPreview(null);
    setSaved(null);
    setStaffed(null);
    try {
      const result = await previewMutation.mutateAsync({ groupId: activeGroupId, file, dateOrder, adjustments: changes });
      setPreview(result);
      if (result.studentsUnplaced > 0) {
        toast.warning(`${result.studentsUnplaced.toLocaleString()} students have no seat.`, { description: "Not enough free rooms: see the warnings." });
      } else {
        toast.success(`Rooms chosen for all ${result.exams} exams.`);
      }
    } catch (error) {
      const extracted = extractBulkUploadRowErrors(error);
      if (extracted.length > 0) {
        setRowErrors(extracted);
      } else {
        showErrorToast(error, { fallbackMessage: "The rooms could not be chosen. Please try again." });
      }
    }
  }

  /**
   * Plans again after a change on the page (Change dialog, drag and drop, Undo my changes) WITHOUT clearing the
   * screen: the current plan stays visible (same view, same day, same scroll) until the new one arrives. The
   * change is only kept when the server accepts it; otherwise the plan stays as it was.
   */
  async function replan(next: RoomAllocationAdjustments, options: { guard?: boolean; record?: boolean } = {}) {
    if (!file || !activeGroupId) return;
    setReplanning(true);
    try {
      const result = await previewMutation.mutateAsync({ groupId: activeGroupId, file, dateOrder, adjustments: next });
      // A drop may never make the plan worse: more students without a seat, or more exams in Mixed halls.
      const mixed = (plan: RoomAllocationPreview) => plan.sittings.reduce((sum, sitting) => sum + sitting.exams.filter((exam) => exam.mixedHalls).length, 0);
      if (options.guard && preview && (result.studentsUnplaced > preview.studentsUnplaced || mixed(result) > mixed(preview))) {
        const more = result.studentsUnplaced - preview.studentsUnplaced;
        toast.error("Not moved: the plan would get worse.", {
          description: more > 0
            ? `${more.toLocaleString()} more student${more === 1 ? "" : "s"} would have no seat. The plan stays as it was.`
            : "An exam would need Mixed halls. The plan stays as it was.",
        });
        return;
      }
      if (options.record !== false) {
        setHistory((past) => [...past.slice(-49), adjustments]); // for Undo last move / Ctrl+Z
      }
      setAdjustments(next);
      setPreview(result);
      setRowErrors([]);
    } catch (error) {
      const extracted = extractBulkUploadRowErrors(error);
      toast.error("That change was not applied.", {
        description: extracted.length > 0 ? extracted.map((item) => `Row ${item.row}: ${item.message}`).join(" ") : undefined,
      });
      if (extracted.length === 0) {
        showErrorToast(error, { fallbackMessage: "The plan could not be updated. Please try again." });
      }
    } finally {
      setReplanning(false);
    }
  }

  async function handleSave() {
    if (!file || !activeGroupId) return;
    setConfirmSave(false);
    try {
      const result = await saveMutation.mutateAsync({ groupId: activeGroupId, file, dateOrder, adjustments });
      setSaved(result);
      toast.success(`${result.roomAssignmentsCreated} exam room${result.roomAssignmentsCreated === 1 ? "" : "s"} saved.`, {
        description: "Next: Create schedule to assign chiefs and invigilators.",
      });
    } catch (error) {
      const extracted = extractBulkUploadRowErrors(error);
      if (extracted.length > 0) {
        setRowErrors(extracted);
      } else {
        showErrorToast(error, { fallbackMessage: "The rooms could not be saved. Please try again." });
      }
    }
  }

  async function handleStaff() {
    if (!saved || !activeGroupId) return;
    try {
      const result = await staffMutation.mutateAsync({ groupId: activeGroupId, assignmentIds: saved.assignmentIds });
      setStaffed(result);
      const complete = result.chiefSlotsFilled === result.chiefSlotsTotal && result.invigilatorSlotsFilled === result.invigilatorSlotsTotal;
      (complete ? toast.success : toast.warning)("Schedule created.", {
        description: `Chiefs ${result.chiefSlotsFilled}/${result.chiefSlotsTotal}, invigilators ${result.invigilatorSlotsFilled}/${result.invigilatorSlotsTotal}.`,
      });
    } catch (error) {
      showErrorToast(error, { fallbackMessage: "The schedule could not be created. Please try again." });
    }
  }

  async function handleUndo() {
    if (!undoTarget) return;
    const target = undoTarget;
    setUndoTarget(null);
    try {
      const result = await undoMutation.mutateAsync(target.id);
      toast.success(`Undone: ${result.examRoomsDeleted} exam room${result.examRoomsDeleted === 1 ? "" : "s"} deleted.`, {
        description: "Their staff were removed too. You can choose rooms and save again.",
      });
      if (saved?.batchId === target.id) {
        setSaved(null);
        setStaffed(null);
      }
    } catch (error) {
      showErrorToast(error, { fallbackMessage: "The allocation could not be undone. Please try again." });
    }
  }

  const copyChanges = (): Required<RoomAllocationAdjustments> => ({
    times: { ...adjustments.times }, rooms: { ...adjustments.rooms },
    dates: { ...(adjustments.dates ?? {}) }, anchors: { ...(adjustments.anchors ?? {}) },
  });

  /** Applies one change from the Edit dialog and plans again with it. */
  function applyChange(change: ExamChange) {
    if (!editing) return;
    const row = String(editing.exam.row);
    const next = copyChanges();
    const shownTime = editing.sitting.time.replace("–", "-");
    if (change.time !== shownTime || change.roomIds !== null || next.times[row] !== undefined || change.date !== editing.sitting.date) {
      next.times[row] = change.time; // chosen rooms or another day always come with a fixed time
    }
    if (change.date !== editing.sitting.date || next.dates[row] !== undefined) {
      next.dates[row] = change.date;
    }
    delete next.anchors[row];
    if (change.roomIds) {
      next.rooms[row] = change.roomIds;
    } else {
      delete next.rooms[row];
    }
    setEditing(null);
    void replan(next);
  }

  /**
   * Drag and drop in the room view: the exam (and the other rows of the same subject on that day, e.g. its Male and
   * Female rows) moves to the day/time; dropped on a room, that room goes first and Uni-Guard adds more if needed.
   */
  function moveExam(dragged: Dragged, target: DropTarget, check: DropCheck) {
    const { exam, sitting } = dragged;
    const next = copyChanges();
    if (check.swapRooms) { // same time, one room swapped: the exam keeps its other rooms
      const row = String(exam.row);
      next.times[row] = sitting.time.replace("–", "-");
      next.rooms[row] = check.swapRooms;
      delete next.anchors[row];
      void replan(next, { guard: true });
      return;
    }
    const time = target.time.replace("–", "-");
    const subject = exam.subjectCode ?? exam.subjectName;
    const together = (preview?.sittings ?? [])
      .filter((other) => other.date === sitting.date && other.time === sitting.time)
      .flatMap((other) => other.exams)
      .filter((other) => other.row === exam.row || (subject !== null && (other.subjectCode ?? other.subjectName) === subject));
    for (const member of together) {
      const row = String(member.row);
      next.times[row] = time;
      if (target.date !== sitting.date || next.dates[row] !== undefined) next.dates[row] = target.date;
      delete next.rooms[row];
      delete next.anchors[row];
    }
    if (target.roomId) next.anchors[String(exam.row)] = target.roomId;
    void replan(next, { guard: true });
  }

  function undoLastMove() {
    const previous = history[history.length - 1];
    if (!previous || busy) return;
    setHistory((past) => past.slice(0, -1));
    void replan(previous, { record: false });
  }

  function undoChanges() {
    void replan({ times: {}, rooms: {} });
  }

  // Ctrl+Z (see the listener at the top) calls the latest version of this.
  undoRef.current = () => {
    if (!preview || saved || history.length === 0 || busy) return false;
    undoLastMove();
    return true;
  };

  function startOver() {
    setHistory([]);
    setAdjustments({ times: {}, rooms: {} });
    setFile(null);
    setPreview(null);
    setSaved(null);
    setStaffed(null);
    setRowErrors([]);
  }

  const busy = previewMutation.isPending || saveMutation.isPending || staffMutation.isPending || undoMutation.isPending;

  return (
    <AppLayout title={TITLE} subtitle={activeGroup ? `${activeGroup.name} · ${SUBTITLE}` : SUBTITLE}>
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4 text-primary" /> Your exam list</h2>
              <ol className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3" aria-label="How it works">
                {[
                  ["1", "Download the template", "Time slots and room types are dropdowns."],
                  ["2", "One row per exam", "No rooms: Uni-Guard picks them."],
                  ["3", "Upload and choose rooms", "Nothing is saved until you say so."],
                ].map(([step, title, text]) => (
                  <li key={step} className="flex gap-2 rounded-lg border border-border bg-background/60 p-2.5">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{step}</span>
                    <span>
                      <span className="block font-medium leading-tight">{title}</span>
                      <span className="block text-xs text-muted-foreground">{text}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => void downloadTemplate()}>
                  <Download className="h-4 w-4" /> Download template (.xlsx)
                </Button>
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Dates like 03/04/2027 mean:</span>
                  <FormSelect
                    className="h-9 w-52 max-w-full"
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
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm" aria-label="Columns">
                {[
                  ["Date", "The day of the exam.", true],
                  ["Time Slot", "Empty = Uni-Guard picks the best time that day.", false],
                  ["Subject", "Name and/or code.", true],
                  ["Students", "How many sit the exam.", true],
                  ["Room Type", "Empty = normal room; e.g. Computer Lab = only that type.", false],
                  ["Gender", "Male / Female = halls of that gender first; empty = any hall.", false],
                ].map(([name, text, required]) => (
                  <div key={String(name)} className="contents">
                    <dt className="flex items-center gap-1.5 font-medium">
                      {name}
                      <span className={cn("rounded px-1 text-[10px] font-normal", required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        {required ? "required" : "optional"}
                      </span>
                    </dt>
                    <dd className="text-muted-foreground">{text}</dd>
                  </div>
                ))}
              </dl>
              <details className="group rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
                <summary className="cursor-pointer select-none font-medium text-foreground marker:text-muted-foreground">How Uni-Guard picks rooms</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>A room holds one subject at a time; a big subject is split over several rooms, in one building when it can.</li>
                  <li>Fewest rooms first, then the fewest empty seats.</li>
                  <li>Special rooms (labs, studios) only go to exams that ask for that type; nothing spills over when they run out.</li>
                  <li>Male / Female exams use halls of that gender first, then Mixed halls (shown in yellow). Men and women of one subject: two rows.</li>
                  <li>Never used: rooms out of service and rooms already booked at that time.</li>
                </ul>
              </details>
            </div>

            <div className="space-y-3">
              <div
                className={cn(
                  "cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                  dragActive ? "border-primary bg-primary/5" : "border-border bg-background/60 hover:border-primary/50",
                )}
                onDragOver={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragActive(false); }}
                onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragActive(false); acceptFile(event.dataTransfer.files[0]); }}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Choose the exam list file"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  aria-label="Exam list file"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => { acceptFile(event.target.files?.[0]); event.target.value = ""; }}
                />
                <div className="pointer-events-none mx-auto mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Upload className="h-5 w-5" /></div>
                {file ? (
                  <>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB · click to choose another file</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">{dragActive ? "Drop the file here" : "Drag your Excel or CSV file here"}</p>
                    <p className="text-sm text-muted-foreground">or click to choose it</p>
                  </>
                )}
              </div>
              <Button className="w-full gap-2 sm:w-auto" disabled={!file || busy} onClick={() => void handlePreview()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
                {busy ? "Choosing rooms…" : "Choose rooms"}
              </Button>
            </div>
          </div>
        </section>

        {rowErrors.length > 0 && (
          <section className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" aria-live="polite" aria-label="Problems in the file">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-semibold">{rowErrors.length} problem{rowErrors.length === 1 ? "" : "s"} in the file</span>
            </div>
            <p className="text-sm text-muted-foreground">Fix these rows in your file and upload it again.</p>
            <div className="overflow-hidden rounded-lg border border-destructive/20 bg-card">
              <table className="w-full text-sm">
                <thead className="bg-destructive/10 text-left text-xs uppercase tracking-wide text-destructive/70">
                  <tr><th className="w-20 px-4 py-2 font-semibold">Row</th><th className="px-4 py-2 font-semibold">Problem</th></tr>
                </thead>
                <tbody>
                  {rowErrors.map((error, index) => (
                    <tr key={`${error.row}-${index}`} className="border-t border-destructive/10 align-top">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{error.row}</td>
                      <td className="px-4 py-2 text-destructive"><X className="mr-1.5 inline h-3.5 w-3.5" />{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {preview && (
          <AllocationSteps
            preview={preview}
            saved={saved}
            staffed={staffed}
            saving={saveMutation.isPending}
            staffing={staffMutation.isPending}
            onSave={() => (preview.studentsUnplaced > 0 ? setConfirmSave(true) : void handleSave())}
            onStaff={() => void handleStaff()}
            onUndo={() => saved && setUndoTarget({
              id: saved.batchId, createdAt: "", createdBy: null, fileName: file?.name ?? null, exams: saved.examsSaved,
              examRooms: saved.roomAssignmentsCreated, studentsUnplaced: saved.studentsUnplaced, remaining: saved.roomAssignmentsCreated, undoneAt: null,
            })}
            onStartOver={startOver}
          />
        )}
        {preview && replanning && (
          <div className="sticky top-2 z-30 flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-4 py-2 text-sm shadow-card" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Updating the plan…
          </div>
        )}
        {preview && changedRows > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
            <span>You changed {changedRows} exam{changedRows === 1 ? "" : "s"} on this page. They are used when you save.</span>
            <span className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={busy || saved !== null || history.length === 0} onClick={undoLastMove} title="Ctrl+Z">
                Undo last move
              </Button>
              <Button variant="ghost" size="sm" disabled={busy || saved !== null} onClick={undoChanges}>Undo my changes</Button>
            </span>
          </div>
        )}
        {preview && (
          <PreviewResult
            preview={preview}
            onEdit={saved || busy ? undefined : (exam, sitting) => setEditing({ exam, sitting })}
            onMove={saved || busy ? undefined : moveExam}
            times={slotTimes}
          />
        )}
        {preview && (
          <EditExamDialog
            target={editing}
            preview={preview}
            times={slotTimes}
            rooms={roomsQuery.data?.items ?? []}
            pinnedRoomIds={editing ? adjustments.rooms[String(editing.exam.row)] ?? null : null}
            onApply={applyChange}
            onClose={() => setEditing(null)}
          />
        )}

        <SavedAllocations groupId={activeGroupId} onUndo={setUndoTarget} />

        <AlertDialog open={undoTarget !== null} onOpenChange={(open) => { if (!open) setUndoTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Undo this saved allocation?</AlertDialogTitle>
              <AlertDialogDescription>
                Deletes the {undoTarget?.remaining.toLocaleString()} exam room{undoTarget?.remaining === 1 ? "" : "s"} saved
                {undoTarget?.fileName ? ` from “${undoTarget.fileName}”` : ""} and the chiefs and invigilators assigned to them, also if they were
                changed in the Scheduler since. Other exam rooms and new time slots stay. This cannot be reversed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void handleUndo()}>
                Undo allocation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save with students still without a seat?</AlertDialogTitle>
              <AlertDialogDescription>
                {preview?.studentsUnplaced.toLocaleString()} students have no seat (not enough free rooms of the right type). Only the seated part
                of those exams is saved. You can add rooms by hand in the Scheduler later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleSave()}>Save anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function PreviewResult({ preview, onEdit, onMove, times }: {
  preview: RoomAllocationPreview;
  onEdit?: (exam: AllocatedExam, sitting: AllocationSitting) => void;
  onMove?: (dragged: Dragged, target: DropTarget, check: DropCheck) => void;
  times: string[];
}) {
  const seated = preview.students - preview.studentsUnplaced;
  const [view, setView] = useState<"exams" | "rooms">("exams");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const roomsQuery = useRoomsQuery();
  const problems = preview.sittings.reduce((sum, sitting) => sum + sitting.exams.filter(isProblem).length, 0);
  const sittings = onlyProblems
    ? preview.sittings
      .map((sitting) => ({ ...sitting, exams: sitting.exams.filter(isProblem) }))
      .filter((sitting) => sitting.exams.length > 0)
    : preview.sittings;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Exams seated" value={`${preview.examsFullySeated} / ${preview.exams}`}
          tone={preview.examsFullySeated < preview.exams ? "warning" : "primary"}
          hint={preview.examsFullySeated < preview.exams
            ? `${preview.exams - preview.examsFullySeated} exam${preview.exams - preview.examsFullySeated === 1 ? "" : "s"} short of seats`
            : "Every student has a seat"} />
        <StatCard icon={Users} label="Students" value={seated.toLocaleString()} tone={preview.studentsUnplaced > 0 ? "warning" : "primary"}
          hint={preview.studentsUnplaced > 0 ? `${preview.studentsUnplaced.toLocaleString()} without a seat` : `All ${preview.students.toLocaleString()} seated`} />
        <StatCard icon={DoorOpen} label="Rooms used" value={preview.roomsUsed} hint={`${preview.sittings.length} date${preview.sittings.length === 1 ? "" : "s"} and time${preview.sittings.length === 1 ? "" : "s"}`} />
        <StatCard icon={LayoutGrid} label="Empty seats" value={preview.emptySeats.toLocaleString()} hint={`of ${preview.seats.toLocaleString()} seats in the rooms used`} />
      </div>

      {(preview.warnings.length > 0 || preview.timeSlotsToCreate.length > 0) && (
        <section className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-4" aria-label="Warnings">
          {preview.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{warning}</p>
          ))}
          {preview.timeSlotsToCreate.length > 0 && (
            <p className="text-sm text-muted-foreground">New time slots will be created when you save: {preview.timeSlotsToCreate.join(", ")}.</p>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1" role="tablist" aria-label="View">
          {([["exams", "By exam"], ["rooms", "By room"]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn("rounded-md px-3 py-1.5 text-sm", view === value ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={onlyProblems} onCheckedChange={setOnlyProblems} aria-label="Show only problems" />
          Show only problems <span className="text-muted-foreground">({problems})</span>
        </label>
      </div>

      {view === "rooms" ? (
        <AllocationRoomGrid preview={preview} rooms={roomsQuery.data?.items ?? []} times={times} onlyProblems={onlyProblems} onMove={onMove} />
      ) : sittings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No problems: every exam is fine.</p>
      ) : (
        sittings.map((sitting) => <SittingCard key={`${sitting.date}-${sitting.time}`} sitting={sitting} onEdit={onEdit} />)
      )}
    </div>
  );
}

const isProblem = (exam: { unplaced: number; mixedHalls: boolean }) => exam.unplaced > 0 || exam.mixedHalls;

function SittingCard({ sitting, onEdit }: {
  sitting: AllocationSitting;
  onEdit?: (exam: AllocatedExam, sitting: AllocationSitting) => void;
}) {
  const roomsUsed = sitting.exams.filter((exam) => !exam.roomType).reduce((sum, exam) => sum + exam.rooms.length, 0);
  const incomplete = sitting.exams.filter((exam) => exam.unplaced > 0).length;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-5 py-3">
        <h3 className="font-semibold">{formatDate(sitting.date, sitting.day)} · {sitting.time}</h3>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {roomsUsed} of {sitting.freeRooms} free normal room{sitting.freeRooms === 1 ? "" : "s"} used
          {incomplete > 0 && <StatusBadge ok={false} label={`${incomplete} incomplete`} />}
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="stack-table w-full min-w-[640px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-2 font-medium">Subject</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Students</th>
              <th className="px-3 py-2 font-medium">Rooms (students / seats)</th>
            </tr>
          </thead>
          <tbody>
            {sitting.exams.map((exam) => (
              <tr key={exam.row} className="border-t border-border align-top">
                <td data-stack="title" className="px-5 py-3">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{exam.subjectName ?? exam.subjectCode}</span>
                    {exam.subjectName && exam.subjectCode && <span className="text-xs text-muted-foreground">{exam.subjectCode}</span>}
                    {exam.roomType && <span className={BADGE + " bg-primary/10 text-primary"}>{exam.roomType}</span>}
                    {exam.gender && <span className={BADGE + " bg-shared-soft text-shared"}>{exam.gender}</span>}
                    {exam.timeChosen && (
                      <span className={BADGE + " bg-accent text-primary"} title="The file had no time: Uni-Guard chose it">
                        <Clock3 className="h-3 w-3" aria-hidden /> Time chosen
                      </span>
                    )}
                    {exam.edited && (
                      <span className={BADGE + " border border-primary/40 bg-primary/5 text-primary"} title="You moved or changed this exam on this page">
                        <PencilLine className="h-3 w-3" aria-hidden /> Changed by you
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Row {exam.row}
                    {onEdit && (
                      <button type="button" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                        onClick={() => onEdit(exam, sitting)} aria-label={`Change ${exam.subjectCode ?? exam.subjectName} (row ${exam.row})`}>
                        <PencilLine className="h-3 w-3" /> Change
                      </button>
                    )}
                  </span>
                </td>
                <td data-label="Status" className="px-3 py-3">
                  {exam.unplaced > 0 ? (
                    <>
                      <StatusBadge ok={false} label="Incomplete" />
                      <span className="mt-1 flex items-start gap-1 text-xs text-warning">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {exam.unplaced.toLocaleString()} without a seat: {exam.roomType
                          ? `only ${exam.freeOfType ?? 0} free “${exam.roomType}” room${exam.freeOfType === 1 ? "" : "s"}`
                          : "not enough free normal rooms"}.
                      </span>
                    </>
                  ) : exam.mixedHalls ? (
                    <>
                      <StatusBadge ok={false} label="Mixed halls" />
                      <span className="mt-1 flex items-start gap-1 text-xs text-warning">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        Not enough free {exam.gender} halls: some students are in Mixed halls.
                      </span>
                    </>
                  ) : (
                    <StatusBadge ok label="Valid" />
                  )}
                  <FixHints hints={exam.hints} />
                </td>
                <td data-label="Students" className="px-3 py-3 tabular-nums">
                  {exam.students.toLocaleString()}
                </td>
                <td data-label="Rooms" data-stack="full" className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {exam.rooms.map((room) => (
                      <span key={room.roomId} className="rounded-md border border-border bg-background px-2 py-0.5 text-xs">
                        <span className="font-medium">{room.name}</span>
                        <span className="ml-1 tabular-nums text-muted-foreground">{room.students}/{room.capacity}</span>
                      </span>
                    ))}
                    {exam.rooms.length === 0 && <span className="text-xs text-destructive">{exam.roomType ? `No free “${exam.roomType}” room` : "No free room"}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Same look as the Scheduler's room flags: green "Valid", amber "Incomplete". */
function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ok ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
      {label}
    </span>
  );
}

/** 1 Choose rooms → 2 Save rooms → 3 Create schedule. */
function AllocationSteps({
  preview,
  saved,
  staffed,
  saving,
  staffing,
  onSave,
  onStaff,
  onUndo,
  onStartOver,
}: {
  preview: RoomAllocationPreview;
  saved: RoomAllocationSaved | null;
  staffed: RoomAllocationStaffed | null;
  saving: boolean;
  staffing: boolean;
  onSave: () => void;
  onStaff: () => void;
  onUndo: () => void;
  onStartOver: () => void;
}) {
  const schedulerLink = saved?.firstDate ? `/scheduler?date=${saved.firstDate}` : "/scheduler";
  const changes = saved?.plan ? planChanges(preview, saved.plan) : [];
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-5" aria-label="Next steps">
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Step number={1} done title="Rooms chosen" text={`${preview.roomsUsed} rooms for ${preview.exams} exams. Nothing saved yet.`} />
        <Step number={2} done={saved !== null} title="Save rooms" text={saved
          ? `${saved.roomAssignmentsCreated} exam rooms saved${saved.timeSlotsCreated.length > 0 ? `, new time slots: ${saved.timeSlotsCreated.join(", ")}` : ""}.`
          : "Saves the exam rooms (without staff). The plan is checked again, so nothing is double-booked."}>
          {!saved && (
            <Button className="gap-2" disabled={saving || preview.roomsUsed === 0} onClick={onSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
              {saving ? "Saving…" : "Save rooms"}
            </Button>
          )}
        </Step>
        <Step number={3} done={staffed !== null} title="Create schedule" text={staffed
          ? `Chiefs ${staffed.chiefSlotsFilled}/${staffed.chiefSlotsTotal}, invigilators ${staffed.invigilatorSlotsFilled}/${staffed.invigilatorSlotsTotal}.`
          : "Assigns chiefs and invigilators to the saved rooms: no double booking, leave and daily limits respected, fair hours."}>
          {saved && !staffed && (
            <Button className="gap-2" disabled={staffing || saved.assignmentIds.length === 0} onClick={onStaff}>
              {staffing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              {staffing ? "Creating…" : "Create schedule"}
            </Button>
          )}
          {saved && (
            <Button asChild variant="outline" className="gap-2"><Link to={schedulerLink}>Open in Scheduler</Link></Button>
          )}
          {saved && <BatchDownloads batchId={saved.batchId} />}
          {saved && (
            <Button variant="ghost" className="gap-2 text-destructive hover:text-destructive" onClick={onUndo}>
              <Undo2 className="h-4 w-4" /> Undo this save
            </Button>
          )}
        </Step>
      </ol>
      {changes.length > 0 && (
        <div className="mt-4 space-y-1.5 rounded-lg border border-warning/30 bg-warning/5 p-3" aria-label="Saved plan differs from the preview">
          <p className="flex items-start gap-2 text-sm font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            The saved plan differs from the preview for {changes.length} exam{changes.length === 1 ? "" : "s"}: rooms were booked in the
            meantime. Check these in the Scheduler.
          </p>
          {changes.slice(0, 8).map((change) => <p key={change} className="pl-6 text-sm text-muted-foreground">{change}</p>)}
          {changes.length > 8 && <p className="pl-6 text-xs text-muted-foreground">…and {changes.length - 8} more.</p>}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onStartOver}>Start over with another file</Button>
      </div>
      {staffed && staffed.warnings.length > 0 && (
        <div className="mt-4 space-y-1.5 rounded-lg border border-warning/30 bg-warning/5 p-3" aria-label="Staffing warnings">
          <p className="text-sm font-medium">{staffed.warnings.length} seat{staffed.warnings.length === 1 ? "" : "s"} could not be filled (not enough free staff):</p>
          {staffed.warnings.slice(0, 6).map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{warning}</p>
          ))}
          {staffed.warnings.length > 6 && <p className="text-xs text-muted-foreground">…and {staffed.warnings.length - 6} more. See Reports → coverage gaps.</p>}
          <FixHints hints={staffed.hints ?? []} />
        </div>
      )}
    </section>
  );
}

function Step({ number, done, title, text, children }: { number: number; done: boolean; title: string; text: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
        done ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground",
      )}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : number}
      </span>
      <div className="min-w-0 space-y-2">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </li>
  );
}

/** Earlier saves of this exam period, each with Undo. */
function SavedAllocations({ groupId, onUndo }: { groupId: string; onUndo: (batch: RoomAllocationBatch) => void }) {
  const batchesQuery = useRoomAllocationBatchesQuery(groupId);
  const batches = batchesQuery.data ?? [];
  if (batches.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card" aria-label="Saved allocations">
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-primary" /> Saved allocations</h2>
      <ul className="divide-y divide-border">
        {batches.map((batch) => {
          const undone = batch.undoneAt !== null;
          return (
            <li key={batch.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn("min-w-0 text-sm", undone && "text-muted-foreground")}>
                <p className="truncate font-medium">{batch.fileName ?? "Exam list"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(batch.createdAt).toLocaleString()}{batch.createdBy ? ` · ${batch.createdBy}` : ""} · {batch.examRooms} exam rooms
                  {!undone && batch.remaining !== batch.examRooms ? ` (${batch.remaining} still there)` : ""}
                  {batch.studentsUnplaced > 0 ? ` · ${batch.studentsUnplaced} without a seat` : ""}
                </p>
              </div>
              {undone ? (
                <span className="text-xs text-muted-foreground">Undone {new Date(batch.undoneAt as string).toLocaleString()}</span>
              ) : (
                <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                  {batch.remaining > 0 && <BatchDownloads batchId={batch.id} size="sm" />}
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive"
                    disabled={batch.remaining === 0} onClick={() => onUndo(batch)} aria-label={`Undo ${batch.fileName ?? "allocation"}`}>
                    <Undo2 className="h-4 w-4" /> Undo
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "How to fix": concrete suggestions from the server for a problem. */
function FixHints({ hints }: { hints: string[] }) {
  if (hints.length === 0) return null;
  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs" aria-label="How to fix">
      <p className="mb-1 flex items-center gap-1 font-semibold text-primary"><Lightbulb className="h-3.5 w-3.5" /> How to fix</p>
      <ul className="list-disc space-y-1 pl-4 text-foreground/90">
        {hints.map((hint) => <li key={hint}>{hint}</li>)}
      </ul>
    </div>
  );
}
