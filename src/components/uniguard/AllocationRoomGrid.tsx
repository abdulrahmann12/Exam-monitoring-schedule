import { type DragEvent, useEffect, useMemo, useState } from "react";

import type { AllocatedExam, AllocationSitting, RoomAllocationPreview, Room } from "@/api";
import { checkDrop, problemReasons, type DropCheck, type Dragged, minutes, movingGroup, overlaps, type Target } from "@/lib/uniguard/dropCheck";
import { cn } from "@/lib/utils";

const isProblem = (exam: AllocatedExam) => exam.unplaced > 0 || exam.mixedHalls;


export type { Dragged, Target as DropTarget, DropCheck };

interface Cell {
  exam: AllocatedExam;
  sitting: AllocationSitting;
  students: number;
  capacity: number;
}

/**
 * Room view of a room allocation proposal: for one day, every room in service down the side (grouped by building)
 * and every time slot across. A cell shows the exam in that room, "Booked" (another saved exam), "In use" (an exam
 * of this plan at an overlapping time) or a free room. Exams can be dragged: a whole exam to another time or day,
 * or one room to another free room at the same time. Only places where it fits accept the drop.
 */
export function AllocationRoomGrid({
  preview,
  rooms,
  times,
  onlyProblems,
  onMove,
}: {
  preview: RoomAllocationPreview;
  rooms: Room[];
  /** The university's time slots, "HH:mm-HH:mm" */
  times: string[];
  onlyProblems: boolean;
  /** Present while the plan can still be changed (before saving). */
  onMove?: (dragged: Dragged, target: Target, check: DropCheck) => void;
}) {
  const days = useMemo(() => [...new Set(preview.sittings.map((sitting) => sitting.date))].sort(), [preview]);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [hover, setHover] = useState<{ key: string; check: DropCheck } | null>(null);
  const day = chosenDay && days.includes(chosenDay) ? chosenDay : days[0];
  const sittings = preview.sittings.filter((sitting) => sitting.date === day);

  // While dragging, a drop outside the grid must never make the browser open the dragged text as a page.
  useEffect(() => {
    if (!dragged) return;
    const stop = (event: Event) => event.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, [dragged]);

  // Every time slot of the university plus any time of this plan on that day, in time order.
  const columns = useMemo(() => {
    const all = new Set(times.map((time) => time.replace("-", "–")));
    sittings.forEach((sitting) => all.add(sitting.time));
    return [...all].sort((a, b) => minutes(a)[0] - minutes(b)[0] || minutes(a)[1] - minutes(b)[1]);
  }, [times, sittings]);

  const cells = useMemo(() => {
    const map = new Map<string, Map<string, Cell>>();
    for (const sitting of sittings) {
      for (const exam of sitting.exams) {
        for (const room of exam.rooms) {
          if (!map.has(room.roomId)) map.set(room.roomId, new Map());
          map.get(room.roomId)!.set(sitting.time, { exam, sitting, students: room.students, capacity: room.capacity });
        }
      }
    }
    return map;
  }, [sittings]);
  const booked = useMemo(() => (preview.booked ?? []).filter((entry) => entry.date === day), [preview, day]);

  const rows = useMemo(() => {
    const byId = new Map<string, Room | { id: string; name: string; building: string | null; capacity: number }>();
    for (const room of rooms.filter((item) => item.active)) byId.set(room.id, room);
    for (const sitting of sittings) {
      for (const exam of sitting.exams) {
        for (const room of exam.rooms) {
          if (!byId.has(room.roomId)) byId.set(room.roomId, { id: room.roomId, name: room.name, building: null, capacity: room.capacity });
        }
      }
    }
    let list = [...byId.values()];
    if (onlyProblems) {
      list = list.filter((room) => [...(cells.get(room.id)?.values() ?? [])].some((cell) => isProblem(cell.exam)));
    }
    return list.sort((a, b) => (a.building ?? "~").localeCompare(b.building ?? "~") || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [rooms, sittings, cells, onlyProblems]);

  /** Rows of the exam being dragged (all its rooms light up: they move together). */
  const movingRows = useMemo(() => (dragged ? new Set(movingGroup(dragged).map((exam) => exam.row)) : new Set<number>()), [dragged]);
  const isMoving = (cell: Cell) =>
    !!dragged && movingRows.has(cell.exam.row) && cell.sitting.date === dragged.sitting.date && cell.sitting.time === dragged.sitting.time;

  /** Why a room is not free at that time: short text for the cell, full text for the tooltip. */
  function blocked(roomId: string, time: string): { text: string; title: string } | null {
    const booking = booked.find((entry) => entry.roomId === roomId && overlaps(entry.time, time));
    if (booking) return { text: booking.label, title: `${booking.label} at ${booking.time} (already saved in Uni-Guard)` };
    for (const [otherTime, cell] of cells.get(roomId) ?? []) {
      if (otherTime !== time && overlaps(otherTime, time)) {
        const subject = cell.exam.subjectCode ?? cell.exam.subjectName;
        return { text: `In use: ${subject}`, title: `In use: ${subject} is in this room at ${otherTime} (this plan), which overlaps ${time}` };
      }
    }
    return null;
  }

  function start(event: DragEvent, value: Dragged) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(value.exam.row));
    setDragged(value);
  }
  function end() {
    setDragged(null);
    setHover(null);
  }
  /** dragover: check the place; only a valid place accepts the drop (preventDefault). */
  const over = (key: string, target: Target) => (event: DragEvent) => {
    if (!dragged) return;
    const check = hover?.key === key ? hover.check : checkDrop(preview, rooms, dragged, target);
    if (hover?.key !== key) setHover({ key, check });
    if (check.ok) event.preventDefault();
  };
  const drop = (key: string, target: Target) => (event: DragEvent) => {
    event.preventDefault();
    const check = hover?.key === key ? hover.check : dragged ? checkDrop(preview, rooms, dragged, target) : null;
    if (dragged && onMove && check?.ok) onMove(dragged, target, check);
    end();
  };
  const tone = (key: string) => (hover?.key === key ? (hover.check.ok ? "bg-success/25 outline outline-2 outline-success" : "bg-destructive/15 outline outline-2 outline-destructive") : "");

  const unseated = sittings.flatMap((sitting) => sitting.exams.filter((exam) => exam.rooms.length === 0).map((exam) => ({ sitting, exam })));

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 shadow-card" aria-label="Rooms by time">
      {onMove && (
        <p className="text-xs text-muted-foreground">
          <b className="font-medium text-foreground">Drag an exam</b> onto a time or day to move the whole exam, or onto a free room at the same
          time to swap only that room. Ctrl+Z undoes. Nothing is saved until Save rooms.
        </p>
      )}
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="What the boxes mean">
        <li className="flex items-center gap-1.5"><span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-foreground">ABC101 20/20</span> Exam (students / seats)</li>
        <li className="flex items-center gap-1.5" title="Some students of this exam have no seat, or a Male/Female exam is in a Mixed hall. Point at the exam to see why.">
          <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-medium text-foreground">ABC101 20/20</span> Needs attention
        </li>
        <li className="flex items-center gap-1.5" title="Taken by an exam already saved in Uni-Guard."><span className="text-muted-foreground/70">Booked</span> Saved before</li>
        <li className="flex items-center gap-1.5" title="Taken by an exam of this plan at an overlapping time."><span className="text-muted-foreground/70">In use</span> Overlapping time</li>
        <li className="flex items-center gap-1.5"><span className="text-muted-foreground/50">–</span> Free</li>
        <li className="text-muted-foreground/80">Point at any box for details.</li>
      </ul>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Day">
        {days.map((value) => {
          const key = `day:${value}`;
          const target: Target | null = dragged ? { date: value, time: dragged.sitting.time } : null;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={value === day}
              onClick={() => setChosenDay(value)}
              onDragOver={(event) => {
                if (!dragged || !target || value === dragged.sitting.date) return;
                over(key, target)(event);
              }}
              onDragLeave={() => setHover(null)}
              onDrop={(event) => target && drop(key, target)(event)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs tabular-nums",
                value === day ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50",
                tone(key),
              )}
            >
              {new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{onlyProblems ? "No problems on this day." : "No rooms."}</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-muted text-left">
              <tr>
                <th className="sticky left-0 z-20 bg-muted px-3 py-2 font-medium">Room</th>
                {columns.map((time) => {
                  const key = `col:${time}`;
                  const target: Target = { date: day, time };
                  return (
                    <th key={time} className={cn("px-3 py-2 font-medium tabular-nums", tone(key))}
                      onDragOver={over(key, target)} onDragLeave={() => setHover(null)} onDrop={drop(key, target)}>
                      {time}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((room, index) => {
                const newBuilding = index > 0 && rows[index - 1].building !== room.building;
                return (
                  <tr key={room.id} className={cn("border-t border-border", newBuilding && "border-t-2 border-t-primary/30")}>
                    <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-1.5 text-left font-medium">
                      {room.name}
                      <span className="ml-1 font-normal text-muted-foreground">{room.building ? `· ${room.building}` : ""} · {room.capacity}</span>
                    </th>
                    {columns.map((time) => {
                      const cell = cells.get(room.id)?.get(time);
                      if (cell) {
                        const problem = isProblem(cell.exam);
                        return (
                          <td key={time} className="px-1.5 py-1">
                            <div
                              draggable={!!onMove}
                              onDragStart={(event) => start(event, { exam: cell.exam, sitting: cell.sitting, fromRoomId: room.id })}
                              onDragEnd={end}
                              className={cn(
                                "rounded px-2 py-1",
                                problem ? "border border-warning/40 bg-warning/10" : "bg-primary/10",
                                onMove && "cursor-grab active:cursor-grabbing",
                                isMoving(cell) && "ring-2 ring-primary",
                              )}
                              title={[
                                `${cell.exam.subjectName ?? cell.exam.subjectCode ?? ""} · row ${cell.exam.row}`,
                                ...problemReasons(cell.exam),
                                onMove ? "Drag to move." : "",
                              ].filter(Boolean).join("\n")}
                              aria-label={`${cell.exam.subjectCode ?? cell.exam.subjectName} in ${room.name} at ${time}`}
                            >
                              <span className="font-medium">{cell.exam.subjectCode ?? cell.exam.subjectName}</span>
                              <span className="ml-1 tabular-nums text-muted-foreground">{cell.students}/{cell.capacity}</span>
                            </div>
                          </td>
                        );
                      }
                      const busy = blocked(room.id, time);
                      if (busy) {
                        return <td key={time} className="px-3 py-1.5 text-[11px] text-muted-foreground/70" title={busy.title}>{busy.text}</td>;
                      }
                      const key = `${room.id}@${time}`;
                      const target: Target = { date: day, time, roomId: room.id };
                      return (
                        <td
                          key={time}
                          className={cn("px-3 py-1.5 text-muted-foreground/50", tone(key))}
                          aria-label={`Free: ${room.name} at ${time}`}
                          onDragOver={over(key, target)}
                          onDragLeave={() => setHover(null)}
                          onDrop={drop(key, target)}
                        >
                          –
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dragged && (
        <p className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 w-max max-w-[min(92vw,40rem)] -translate-x-1/2 rounded-lg border-2 bg-card px-4 py-2.5 text-center text-sm font-medium shadow-lg",
          hover ? (hover.check.ok ? "border-success text-success" : "border-destructive text-destructive") : "border-border text-foreground")}
          role="status" aria-label="Drop check">
          {hover ? hover.check.reason : `Moving ${dragged.exam.subjectCode ?? dragged.exam.subjectName}: its rooms stay together. Point at a place to check it.`}
        </p>
      )}

      {unseated.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-warning">
          <span>No room at all, these students have no seat{onMove ? " (drag to a free room)" : ""}:</span>
          {unseated.map(({ sitting, exam }) => (
            <span
              key={`${sitting.time}-${exam.row}`}
              draggable={!!onMove}
              onDragStart={(event) => start(event, { exam, sitting, fromRoomId: null })}
              onDragEnd={end}
              className={cn("rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-foreground", onMove && "cursor-grab")}
              aria-label={`${exam.subjectCode ?? exam.subjectName} has no room`}
            >
              <span className="font-medium">{exam.subjectCode ?? exam.subjectName}</span> {sitting.time} · {exam.students}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
