import { AlertCircle, AlertTriangle, CheckCircle2, Clock3, DoorOpen, Download, FileSpreadsheet, LayoutGrid, Loader2, Upload, Users, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";

import type { AllocationSitting, ImportDateOrder, RoomAllocationPreview, RoomAllocationSaved, RoomAllocationStaffed, ScheduleBulkUploadRowError } from "@/api";
import { EmptyState } from "@/components/app/PageState";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/uniguard/AppLayout";
import { FormSelect } from "@/components/uniguard/FormSelect";
import { StatCard } from "@/components/uniguard/StatCard";
import { extractBulkUploadRowErrors } from "@/hooks/useBulkScheduleUpload";
import { usePreviewRoomAllocationMutation, useSaveRoomAllocationMutation, useStaffRoomAllocationMutation } from "@/hooks/useRoomAllocation";
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

const TITLE = "Room Allocation";
const SUBTITLE = "Upload your exam list without rooms: Uni-Guard picks the rooms for every exam.";

async function downloadTemplate() {
  try {
    const { blob, fileName } = unwrapServiceResponse(await roomAllocationService.downloadTemplate());
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
    setRowErrors([]);
    setPreview(null);
    setSaved(null);
    setStaffed(null);
  }

  async function handlePreview() {
    if (!file || !activeGroupId) return;
    setRowErrors([]);
    setPreview(null);
    setSaved(null);
    setStaffed(null);
    try {
      const result = await previewMutation.mutateAsync({ groupId: activeGroupId, file, dateOrder });
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

  async function handleSave() {
    if (!file || !activeGroupId) return;
    setConfirmSave(false);
    try {
      const result = await saveMutation.mutateAsync({ groupId: activeGroupId, file, dateOrder });
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

  const busy = previewMutation.isPending || saveMutation.isPending || staffMutation.isPending;

  return (
    <AppLayout title={TITLE} subtitle={activeGroup ? `${activeGroup.name} · ${SUBTITLE}` : SUBTITLE}>
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="h-4 w-4 text-primary" /> Your exam list</h2>
              <p className="text-sm text-muted-foreground">
                One row per exam: date, time slot, subject name and/or code, and the number of students. No room column:
                Uni-Guard picks the rooms. <b>Leave the time slot empty</b> and Uni-Guard also picks the best time on that date
                (enough free rooms and staff, spread over the day). The date is always required. In the template the time slot is a dropdown of your time slots and the day fills in by itself.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>A room gets only one subject at a time; a big subject is split over several rooms.</li>
                <li>Fewest rooms first, then the fewest empty seats.</li>
                <li><b>Room Type</b> column: empty = a normal room; a type (e.g. Computer Lab) = only rooms of exactly that type.</li>
                <li><b>Gender</b> column: Male / Female = halls of that gender first, then Mixed halls (flagged). Empty = any hall.
                  Men and women of one subject at the same time: two rows.</li>
                <li>Special rooms (labs, studios) never go to normal exams, and nothing spills over when rooms run out.</li>
                <li>Never used: rooms out of service and rooms already booked at that time.</li>
              </ul>
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
          />
        )}
        {preview && <PreviewResult preview={preview} />}

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

function PreviewResult({ preview }: { preview: RoomAllocationPreview }) {
  const seated = preview.students - preview.studentsUnplaced;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Exams seated" value={`${preview.examsFullySeated} / ${preview.exams}`} hint="Every student has a seat" />
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

      {preview.sittings.map((sitting) => <SittingCard key={`${sitting.date}-${sitting.time}`} sitting={sitting} />)}
    </div>
  );
}

function SittingCard({ sitting }: { sitting: AllocationSitting }) {
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
                  <span className="font-medium">{exam.subjectName ?? exam.subjectCode}</span>
                  {exam.subjectName && exam.subjectCode && <span className="ml-2 text-xs text-muted-foreground">{exam.subjectCode}</span>}
                  {exam.roomType && <span className="ml-2 rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary">{exam.roomType}</span>}
                  {exam.gender && (
                    <span className="ml-2 rounded bg-shared-soft px-1.5 text-[10px] font-medium text-shared">{exam.gender}</span>
                  )}
                  {exam.timeChosen && (
                    <span className="ml-2 rounded bg-accent px-1.5 text-[10px] font-medium text-primary" title="The file had no time: Uni-Guard chose it">Time chosen</span>
                  )}
                  <span className="block text-xs text-muted-foreground">Row {exam.row}</span>
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
}: {
  preview: RoomAllocationPreview;
  saved: RoomAllocationSaved | null;
  staffed: RoomAllocationStaffed | null;
  saving: boolean;
  staffing: boolean;
  onSave: () => void;
  onStaff: () => void;
}) {
  const schedulerLink = saved?.firstDate ? `/scheduler?date=${saved.firstDate}` : "/scheduler";
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
        </Step>
      </ol>
      {staffed && staffed.warnings.length > 0 && (
        <div className="mt-4 space-y-1.5 rounded-lg border border-warning/30 bg-warning/5 p-3" aria-label="Staffing warnings">
          <p className="text-sm font-medium">{staffed.warnings.length} seat{staffed.warnings.length === 1 ? "" : "s"} could not be filled (not enough free staff):</p>
          {staffed.warnings.slice(0, 6).map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />{warning}</p>
          ))}
          {staffed.warnings.length > 6 && <p className="text-xs text-muted-foreground">…and {staffed.warnings.length - 6} more. See Reports → coverage gaps.</p>}
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
