import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select cannot hold an empty-string value, so "" (e.g. "Unassigned") travels as this token. */
const EMPTY = "__empty__";

export interface FormSelectOption {
  value: string;
  label: string;
}

/**
 * A form dropdown that looks the same on every device and whose list always stays on screen
 * (native <select> lists are drawn by the browser and can spill past the edge of a phone view).
 */
export function FormSelect({ id, value, onValueChange, options, placeholder, className, "aria-label": ariaLabel }: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Select value={value === "" ? EMPTY : value} onValueChange={(next) => onValueChange(next === EMPTY ? "" : next)}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("h-10 w-full bg-background [&>span]:truncate", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="w-[var(--radix-select-trigger-width)]">
        {options.map((option) => (
          <SelectItem key={option.value || EMPTY} value={option.value === "" ? EMPTY : option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
