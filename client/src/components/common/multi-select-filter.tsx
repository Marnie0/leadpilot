import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  /** Optional leading swatch or avatar. */
  adornment?: React.ReactNode;
}

/**
 * Checkbox-style multi-select in a popover.
 *
 * A single component backs every list filter (stage, source, priority,
 * assignee) so they all behave identically — same keyboard handling, same
 * "3 selected" summary, same clear affordance.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  className,
  align = 'start',
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
  className?: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const visible = searchable
    ? options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value],
    );
  };

  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? '1')
        : String(selected.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-1.5 border-dashed',
            selected.length > 0 && 'border-solid',
            className,
          )}
        >
          {label}
          {summary && (
            <Badge variant="secondary" className="ml-0.5 max-w-24 truncate px-1.5 py-0 text-xs">
              {summary}
            </Badge>
          )}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent align={align} className="w-60 p-0">
        {searchable && (
          <div className="border-b p-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="h-8"
              aria-label={`Search ${label}`}
            />
          </div>
        )}

        {/* Native scrolling for the same reason as the lead form dialog: a Radix
            ScrollArea viewport does not size against a `max-height` parent. */}
        <div className="scrollbar-slim max-h-64 overflow-y-auto overscroll-contain">
          <div className="p-1" role="listbox" aria-multiselectable aria-label={label}>
            {visible.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</p>
            )}
            {visible.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                  {option.adornment}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={() => onChange([])}
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
