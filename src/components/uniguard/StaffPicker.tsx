import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Staff, Day, Assignment, Role, Room, roleLabel } from "@/lib/uniguard/types";
import { Check, X, CircleDot, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPickerTiers } from "@/lib/uniguard/constraintEngine";

interface Props {
  trigger: React.ReactNode;
  role: Role;
  day: Day;
  staff: Staff[];
  slotAssignments: Assignment[];
  currentId: string | null;
  onPick: (id: string | null) => void;
  /** Room being staffed — enables hall-gender hints. */
  room?: Room;
  /** Exam subject code — hides people who teach it. */
  subjectCode?: string | null;
}

export function StaffPicker({ trigger, role, day, staff, slotAssignments, currentId, onPick, room, subjectCode }: Props) {
  const [open, setOpen] = useState(false);
  const tiers = useMemo(
    () => getPickerTiers({ role, day, staff, assignments: slotAssignments, currentId, room, subjectCode }),
    [role, day, staff, slotAssignments, currentId, room, subjectCode]
  );
  const totalAvailable = tiers.free.length + tiers.partiallyBusy.length;
  const label = roleLabel(role);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}s...`} />
          <CommandList className="max-h-80">
            <CommandEmpty>No staff matches your search.</CommandEmpty>
            {tiers.free.length > 0 && (
              <CommandGroup heading={<span className="flex items-center gap-1.5 text-success"><CircleDot className="h-3 w-3" /> Free Now ({tiers.free.length})</span>}>
                {tiers.free.slice(0, 25).map((s) => <Item key={s.id} s={s} tone="free" current={currentId === s.id} onPick={() => { onPick(s.id); setOpen(false); }} />)}
              </CommandGroup>
            )}
            {tiers.partiallyBusy.length > 0 && (
              <CommandGroup heading={<span className="flex items-center gap-1.5 text-warning"><Clock className="h-3 w-3" /> Partially Busy ({tiers.partiallyBusy.length})</span>}>
                {tiers.partiallyBusy.slice(0, 15).map((s) => <Item key={s.id} s={s} tone="eligible" current={currentId === s.id} onPick={() => { onPick(s.id); setOpen(false); }} />)}
              </CommandGroup>
            )}
            {tiers.unavailable.length > 0 && (
              <CommandGroup heading={<span className="flex items-center gap-1.5 text-muted-foreground"><Ban className="h-3 w-3" /> Unavailable ({tiers.unavailable.length})</span>}>
                {tiers.unavailable.slice(0, 20).map(({ staff: s, reason }) => (
                  <CommandItem key={s.id} value={`__disabled_${s.name}`} disabled className="opacity-50 cursor-not-allowed flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">{reason}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{s.totalAssignments}×</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {currentId && (
              <CommandGroup>
                <CommandItem value="__clear__" onSelect={() => { onPick(null); setOpen(false); }} className="text-destructive">
                  <X className="mr-2 h-3.5 w-3.5" /> Clear assignment
                </CommandItem>
              </CommandGroup>
            )}
            {totalAvailable === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">No available staff for this time slot.</div>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Item({ s, tone, current, onPick }: { s: Staff; tone: "free" | "eligible"; current: boolean; onPick: () => void }) {
  const dot = tone === "free" ? "bg-success" : "bg-warning";
  return (
    <CommandItem value={s.name} onSelect={onPick} className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{s.name}</span>
          <span className="text-[10px] text-muted-foreground truncate">{s.department}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.totalAssignments}×</span>
        {current && <Check className="h-3.5 w-3.5 text-primary" />}
      </div>
    </CommandItem>
  );
}
