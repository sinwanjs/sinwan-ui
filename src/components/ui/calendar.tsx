import { cc, onUnmounted } from "sinwan/component";
import {
  effect,
  resolve,
  signal,
  type Signal,
} from "sinwan/reactivity";
import { ChevronLeft, ChevronRight } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Button } from "./button";

type CalendarDateInput =
  | Date
  | undefined
  | Signal<Date | undefined>
  | (() => Date | undefined);

export type CalendarProps = {
  selected?: CalendarDateInput;
  onSelect?: (date?: Date) => void;
  mode?: "single";
  month?: Date;
  onMonthChange?: (month: Date) => void;
  class?: string;
  showOutsideDays?: boolean;
  disabled?: boolean | ((date: Date) => boolean);
  locale?: string | { code?: string };
  buttonVariant?: "ghost" | "outline" | "default" | "secondary";
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a?: Date, b?: Date): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function localeCode(locale: CalendarProps["locale"]): string | undefined {
  if (!locale) return undefined;
  return typeof locale === "string" ? locale : locale.code;
}

function weekdayLabels(code?: string): string[] {
  const base = new Date(2024, 0, 7); // Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toLocaleDateString(code, { weekday: "short" });
  });
}

type DayCell = {
  date: Date;
  outside: boolean;
  key: string;
};

function buildMonthGrid(view: Date, showOutsideDays: boolean): DayCell[][] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: DayCell[] = [];

  for (let i = 0; i < startOffset; i++) {
    const date = new Date(year, month, 1 - (startOffset - i));
    if (showOutsideDays) {
      cells.push({
        date,
        outside: true,
        key: `o-${date.toISOString()}`,
      });
    } else {
      cells.push({
        date,
        outside: true,
        key: `h-${i}`,
      });
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({
      date,
      outside: false,
      key: `d-${date.toISOString()}`,
    });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!.date;
    const date = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({
      date,
      outside: true,
      key: `t-${date.toISOString()}`,
    });
  }

  if (!showOutsideDays) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]!.outside) {
        cells[i] = {
          ...cells[i]!,
          key: `hidden-${i}`,
        };
      }
    }
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function isDisabled(
  date: Date,
  disabled: CalendarProps["disabled"],
): boolean {
  if (disabled === true) return true;
  if (typeof disabled === "function") return disabled(date);
  return false;
}

export const Calendar = cc<CalendarProps>(
  ({
    selected: selectedProp,
    onSelect,
    mode: _mode = "single",
    month: monthProp,
    onMonthChange,
    class: className,
    showOutsideDays = true,
    disabled,
    locale,
    buttonVariant = "ghost",
  }) => {
    void _mode;
    const today = startOfDay(new Date());
    const controlledSelected = selectedProp !== undefined;
    const selected = signal<Date | undefined>(
      controlledSelected ? resolve(selectedProp) : undefined,
    );
    if (controlledSelected) {
      const stop = effect(() => {
        const next = resolve(selectedProp);
        if (!sameDay(next, selected.value)) {
          selected.value = next;
        }
      });
      onUnmounted(stop);
    }

    const initial =
      monthProp ??
      (selected.value
        ? new Date(selected.value.getFullYear(), selected.value.getMonth(), 1)
        : new Date(today.getFullYear(), today.getMonth(), 1));
    const viewMonth = signal(initial);
    if (monthProp) {
      viewMonth.value = new Date(monthProp.getFullYear(), monthProp.getMonth(), 1);
    }

    const code = localeCode(locale);
    const labels = weekdayLabels(code);

    const setMonth = (next: Date) => {
      const normalized = new Date(next.getFullYear(), next.getMonth(), 1);
      viewMonth.value = normalized;
      onMonthChange?.(normalized);
    };

    const weeks = () => buildMonthGrid(viewMonth.value, showOutsideDays);

    return (
      <div
        data-slot="calendar"
        class={cn(
          "group/calendar bg-background w-fit p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
          className,
        )}
      >
        <div class="relative flex w-full flex-col gap-4">
          <div class="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1">
            <Button
              variant={buttonVariant}
              size="icon"
              class="size-(--cell-size) p-0 select-none"
              aria-label="Previous month"
              onclick={() => {
                const current = viewMonth.value;
                setMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1));
              }}
            >
              <Icon icon={ChevronLeft} class="size-4" />
            </Button>
            <Button
              variant={buttonVariant}
              size="icon"
              class="size-(--cell-size) p-0 select-none"
              aria-label="Next month"
              onclick={() => {
                const current = viewMonth.value;
                setMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1));
              }}
            >
              <Icon icon={ChevronRight} class="size-4" />
            </Button>
          </div>

          <div class="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
            <div class="text-sm font-medium select-none">
              {() =>
                viewMonth.value.toLocaleDateString(code, {
                  month: "long",
                  year: "numeric",
                })
              }
            </div>
          </div>

          <div class="w-full border-collapse">
            <div class="flex">
              {labels.map((label) => (
                <div class="flex-1 rounded-(--cell-radius) text-center text-[0.8rem] font-normal text-muted-foreground select-none">
                  {label}
                </div>
              ))}
            </div>

            {() => {
              const currentSelected = selected.value;
              return weeks().map((week) => (
                <div class="mt-2 flex w-full">
                  {week.map((cell) => {
                    if (!showOutsideDays && cell.outside) {
                      return (
                        <div class="relative aspect-square h-full w-full p-0" />
                      );
                    }
                    const disabledDay = isDisabled(cell.date, disabled);
                    const isSelected = sameDay(currentSelected, cell.date);
                    const isToday = sameDay(today, cell.date);

                    return (
                      <div
                        class="group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none"
                        data-outside={cell.outside ? "" : undefined}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={disabledDay}
                          data-day={cell.date.toLocaleDateString(code)}
                          data-selected-single={isSelected ? "true" : undefined}
                          data-today={isToday ? "" : undefined}
                          class={cn(
                            "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
                            cell.outside && "text-muted-foreground",
                            isToday &&
                              !isSelected &&
                              "rounded-(--cell-radius) bg-muted text-foreground",
                            disabledDay && "opacity-50",
                          )}
                          onclick={() => {
                            if (disabledDay) return;
                            const next = isSelected
                              ? undefined
                              : startOfDay(cell.date);
                            selected.value = next;
                            onSelect?.(next);
                          }}
                        >
                          {cell.date.getDate()}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ));
            }}
          </div>
        </div>
      </div>
    );
  },
);

export type { DayCell };
