import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AllocatedExam, AllocationSitting, Room, RoomAllocationPreview } from "@/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormSelect } from "@/components/uniguard/FormSelect";
import { cn } from "@/lib/utils";

/** "09:00–11:00" (as shown) ↔ "09:00-11:00" (as sent). */
const toKey = (time: string) => time.replace("–", "-");

export interface ExamChange {
  /** "yyyy-mm-dd" */
  date: string;
  /** "HH:mm-HH:mm" */
  time: string;
  /** null = Uni-Guard chooses the rooms */
  roomIds: string[] | null;
}

/**
 * Change one exam of the proposal before saving: another time on the same day, and/or its exact rooms.
 * The server applies the change on top of the file and seats the other exams around it.
 */
export function EditExamDialog({
  target,
  preview,
  times,
  rooms,
  pinnedRoomIds,
  onApply,
  onClose,
}: {
  target: { exam: AllocatedExam; sitting: AllocationSitting } | null;
  preview: RoomAllocationPreview;
  /** "HH:mm-HH:mm" of the university's time slots */
  times: string[];
  rooms: Room[];
  /** rooms the user already chose for this exam (null = Uni-Guard chooses) */
  pinnedRoomIds: string[] | null;
  onApply: (change: ExamChange) => void;
  onClose: () => void;
}) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [chooseRooms, setChooseRooms] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!target) return;
    setTime(toKey(target.sitting.time));
    setDate(target.sitting.date);
    setChooseRooms(pinnedRoomIds !== null);
    setSelected(pinnedRoomIds ?? target.exam.rooms.map((room) => room.roomId));
    setSearch("");
  }, [target, pinnedRoomIds]);

  // Rooms another exam of the proposal uses at the chosen time on that day.
  const usedBy = useMemo(() => {
    const map = new Map<string, string>();
    if (!target) return map;
    for (const sitting of preview.sittings) {
      if (sitting.date !== date || toKey(sitting.time) !== time) continue;
      for (const exam of sitting.exams) {
        if (exam.row === target.exam.row) continue;
        for (const room of exam.rooms) map.set(room.roomId, exam.subjectCode ?? exam.subjectName ?? `row ${exam.row}`);
      }
    }
    return map;
  }, [preview, target, time, date]);

  if (!target) return null;
  const { exam, sitting } = target;
  const timeOptions = [...new Set([toKey(sitting.time), ...times])].sort();
  const needle = search.trim().toLowerCase();
  const list = rooms
    .filter((room) => room.active)
    .filter((room) => !needle || room.name.toLowerCase().includes(needle) || (room.building ?? "").toLowerCase() === needle)
    .sort((a, b) => (a.building ?? "~").localeCompare(b.building ?? "~") || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const seats = rooms.filter((room) => selected.includes(room.id)).reduce((sum, room) => sum + room.capacity, 0);
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change {exam.subjectCode ?? exam.subjectName}</DialogTitle>
          <DialogDescription>
            Row {exam.row} · {exam.students} students · {sitting.day} {sitting.date}. Nothing is saved until you click Save rooms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-exam-date">Date</Label>
            <input
              id="edit-exam-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="edit-exam-time">Time</Label>
            <FormSelect
              id="edit-exam-time"
              className="mt-2"
              value={time}
              onValueChange={setTime}
              options={timeOptions.map((value) => ({ value, label: value.replace("-", "–") }))}
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <label htmlFor="edit-exam-choose-rooms" className="text-sm">
              <span className="block font-medium">Choose the rooms myself</span>
              <span className="block text-muted-foreground">Off: Uni-Guard chooses the best rooms at this time.</span>
            </label>
            <Switch id="edit-exam-choose-rooms" checked={chooseRooms} onCheckedChange={setChooseRooms} />
          </div>

          {chooseRooms && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className={cn("font-medium", seats < exam.students ? "text-warning" : "text-success")}>
                  {selected.length} room{selected.length === 1 ? "" : "s"} · {seats} of {exam.students} seats
                </span>
                <div className="relative w-40">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a room" className="h-8 pl-7 text-sm" aria-label="Find a room" />
                </div>
              </div>
              <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border" aria-label="Rooms">
                {list.map((room) => {
                  const other = usedBy.get(room.id);
                  return (
                    <li key={room.id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-accent/40", other && "opacity-60")}>
                        <Checkbox checked={selected.includes(room.id)} onCheckedChange={() => toggle(room.id)} aria-label={`Room ${room.name}`} />
                        <span className="flex-1">
                          <span className="font-medium">{room.name}</span>
                          <span className="ml-1 text-muted-foreground">{room.building ? `· ${room.building} ` : ""}· {room.capacity} seats</span>
                          {room.roomCategorySpecial && <span className="ml-1 text-xs text-primary">· {room.roomCategoryName}</span>}
                        </span>
                        {other && <span className="text-xs text-warning">used by {other}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">A room another exam uses at this time is given to this exam; that exam gets other rooms.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={(chooseRooms && selected.length === 0) || !date}
            onClick={() => onApply({ date, time, roomIds: chooseRooms ? selected : null })}
          >
            Apply change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
