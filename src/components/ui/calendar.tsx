import { cc } from "sinwan/component";
import { ChevronLeft, ChevronRight } from "lucide";
import type { SinwanNode } from "sinwan/component";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { createLiveState } from "../../lib/live-state";
import { Button, type ButtonProps } from "./button";
import { NativeSelect, NativeSelectOption } from "./native-select";

export type DateRange = {
  from?: Date;
  to?: Date;
};

export type CalendarMode = "single" | "range" | "multiple";

export type CalendarDayContext = {
  date: Date;
  outside: boolean;
  selected: boolean;
  today: boolean;
  disabled: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  rangeMiddle: boolean;
};

export type CalendarProps = {
  selected?: Date | Date[] | DateRange;
  onSelect?: (value?: Date | Date[] | DateRange) => void;
  mode?: CalendarMode;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  numberOfMonths?: number;
  captionLayout?: "label" | "dropdown";
  showWeekNumber?: boolean;
  showOutsideDays?: boolean;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  fromYear?: number;
  toYear?: number;
  dir?: "ltr" | "rtl";
  timeZone?: string;
  class?: string;
  disabled?: boolean | Date[] | ((date: Date) => boolean);
  locale?: string | { code?: string };
  buttonVariant?: ButtonProps["variant"];
  calendar?: string;
  modifiers?: Record<string, Date[] | ((date: Date) => boolean)>;
  modifiersClassNames?: Record<string, string>;
  renderDay?: (ctx: CalendarDayContext) => SinwanNode;
};

export type DayCell = {
  date: Date;
  outside: boolean;
  key: string;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function addDays(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
}

function resolvedCalendar(calendar?: string): string {
  return calendar && calendar !== "iso8601" ? calendar : "gregory";
}

function isGregory(calendar: string): boolean {
  return calendar === "gregory";
}

function calendarParts(
  date: Date,
  calendar: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    calendar,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return Number(part?.value ?? "0");
  };
  return { year: read("year"), month: read("month"), day: read("day") };
}

function formatCalendarOptions(
  calendar: string,
): Intl.DateTimeFormatOptions {
  return { calendar };
}

function formatDayLabel(
  date: Date,
  locale: string | undefined,
  calendar: string,
): string {
  return date.toLocaleDateString(locale, {
    ...formatCalendarOptions(calendar),
    day: "numeric",
  });
}

function formatCaption(
  date: Date,
  locale: string | undefined,
  calendar: string,
): string {
  return date.toLocaleDateString(locale, {
    ...formatCalendarOptions(calendar),
    month: "long",
    year: "numeric",
  });
}

function formatNumber(value: number, locale: string | undefined): string {
  return new Intl.NumberFormat(locale).format(value);
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

function zonedToday(timeZone?: string): Date {
  if (!timeZone) return startOfDay(new Date());
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    return Number(part?.value ?? "0");
  };
  return new Date(read("year"), read("month") - 1, read("day"));
}

function weekdayLabels(
  code: string | undefined,
  weekStartsOn: number,
  calendar: string,
): string[] {
  const base = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + ((weekStartsOn + i) % 7));
    return d.toLocaleDateString(code, {
      ...formatCalendarOptions(calendar),
      weekday: "short",
    });
  });
}

function isoWeekNumber(date: Date): number {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function startOfCalendarMonth(date: Date, calendar: string): Date {
  if (isGregory(calendar)) return startOfMonth(date);
  const { day } = calendarParts(date, calendar);
  return addDays(startOfDay(date), 1 - day);
}

function addCalendarMonths(date: Date, count: number, calendar: string): Date {
  if (isGregory(calendar)) return addMonths(date, count);
  let cursor = startOfCalendarMonth(date, calendar);
  const step = count >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(count); i++) {
    cursor = startOfCalendarMonth(addDays(cursor, step > 0 ? 32 : -1), calendar);
  }
  return cursor;
}

function daysInCalendarMonth(start: Date, calendar: string): number {
  if (isGregory(calendar)) {
    return new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  }
  const { year, month } = calendarParts(start, calendar);
  let count = 0;
  let cursor = start;
  while (count < 32) {
    const parts = calendarParts(cursor, calendar);
    if (parts.year !== year || parts.month !== month) break;
    count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

function cellKey(prefix: string, date: Date): string {
  return `${prefix}-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function buildMonthGrid(
  view: Date,
  showOutsideDays: boolean,
  weekStartsOn: number,
  calendar: string,
): DayCell[][] {
  const start = startOfCalendarMonth(view, calendar);
  const startOffset = (start.getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = daysInCalendarMonth(start, calendar);
  const cells: DayCell[] = [];

  for (let i = 0; i < startOffset; i++) {
    const date = addDays(start, i - startOffset);
    cells.push({
      date,
      outside: true,
      key: showOutsideDays ? cellKey("o", date) : `h-${cellKey("x", start)}-${i}`,
    });
  }

  for (let day = 0; day < daysInMonth; day++) {
    const date = addDays(start, day);
    cells.push({
      date,
      outside: false,
      key: cellKey("d", date),
    });
  }

  while (cells.length % 7 !== 0) {
    const date = addDays(cells[cells.length - 1]!.date, 1);
    cells.push({
      date,
      outside: true,
      key: showOutsideDays ? cellKey("t", date) : `e-${cellKey("x", start)}-${cells.length}`,
    });
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
  if (Array.isArray(disabled)) {
    return disabled.some((entry) => sameDay(entry, date));
  }
  return false;
}

function modifierMatch(
  date: Date,
  spec: Date[] | ((date: Date) => boolean),
): boolean {
  if (typeof spec === "function") return spec(date);
  return spec.some((entry) => sameDay(entry, date));
}

function asSingle(value: CalendarProps["selected"]): Date | undefined {
  return value instanceof Date ? value : undefined;
}

function asDates(value: CalendarProps["selected"]): Date[] {
  return Array.isArray(value) ? value : [];
}

function asRange(value: CalendarProps["selected"]): DateRange {
  if (!value || value instanceof Date || Array.isArray(value)) return {};
  return value;
}

function inRange(date: Date, from?: Date, to?: Date): boolean {
  if (!from || !to) return false;
  const time = startOfDay(date).getTime();
  return time > startOfDay(from).getTime() && time < startOfDay(to).getTime();
}

function nextRange(current: DateRange, date: Date): DateRange {
  const picked = startOfDay(date);
  if (!current.from || current.to) {
    return { from: picked };
  }
  if (picked.getTime() < startOfDay(current.from).getTime()) {
    return { from: picked, to: current.from };
  }
  return { from: current.from, to: picked };
}

function toggleDate(list: Date[], date: Date): Date[] {
  const exists = list.some((entry) => sameDay(entry, date));
  if (exists) return list.filter((entry) => !sameDay(entry, date));
  return [...list, startOfDay(date)];
}

function yearsBetween(fromYear: number, toYear: number): number[] {
  const years: number[] = [];
  for (let year = fromYear; year <= toYear; year++) years.push(year);
  return years;
}

export const Calendar = cc<CalendarProps>((props) => {
  const mode = () => props.mode ?? "single";
  const weekStartsOn = () => props.weekStartsOn ?? 0;
  const showOutsideDays = () => props.showOutsideDays ?? true;
  const numberOfMonths = () => Math.max(1, props.numberOfMonths ?? 1);
  const today = () => zonedToday(props.timeZone);
  const code = () => localeCode(props.locale);
  const calendar = () => resolvedCalendar(props.calendar);
  const { state: selected, set: setSelected } = createLiveState<
    Date | Date[] | DateRange | undefined
  >("selected" in props, undefined, () => props.selected);

  const fallbackMonth = startOfCalendarMonth(today(), calendar());
  const { state: viewMonth, set: setViewMonth } = createLiveState(
    "month" in props,
    props.month ? startOfCalendarMonth(props.month, calendar()) : fallbackMonth,
    () => startOfCalendarMonth(props.month ?? fallbackMonth, calendar()),
  );

  const setMonth = (next: Date) => {
    const normalized = startOfCalendarMonth(next, calendar());
    setViewMonth(normalized);
    props.onMonthChange?.(normalized);
  };

  const commit = (next: Date | Date[] | DateRange | undefined) => {
    setSelected(next);
    props.onSelect?.(next);
  };

  const pick = (date: Date) => {
    const kind = mode();
    if (kind === "range") {
      commit(nextRange(asRange(selected.value), date));
      return;
    }
    if (kind === "multiple") {
      commit(toggleDate(asDates(selected.value), date));
      return;
    }
    const current = asSingle(selected.value);
    commit(sameDay(current, date) ? undefined : startOfDay(date));
  };

  const monthList = () =>
    Array.from({ length: numberOfMonths() }, (_, index) =>
      addCalendarMonths(viewMonth.value, index, calendar()),
    );

  const yearNow = () => {
    const cal = calendar();
    return isGregory(cal)
      ? today().getFullYear()
      : calendarParts(today(), cal).year;
  };
  const fromYear = () => props.fromYear ?? yearNow() - 10;
  const toYear = () => props.toYear ?? yearNow() + 10;

  return (
    <div
      data-slot="calendar"
      data-calendar={calendar}
      data-locale={() => code() ?? ""}
      lang={() => code() ?? ""}
      dir={props.dir}
      class={cn(
        "group/calendar bg-background w-fit p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        props.class,
      )}
    >
      <div class="relative flex w-full flex-col gap-4 md:flex-row">
        <div
          data-slot="calendar-nav"
          class="pointer-events-none absolute inset-x-0 top-0 z-20 flex w-full items-center justify-between gap-1"
        >
          <Button
            type="button"
            variant={props.buttonVariant ?? "ghost"}
            size="icon"
            class="pointer-events-auto size-(--cell-size) p-0 select-none aria-disabled:opacity-50"
            aria-label="Previous month"
            onclick={() => {
              setMonth(addCalendarMonths(viewMonth.value, -1, calendar()));
            }}
          >
            <Icon icon={ChevronLeft} class="size-4 rtl:rotate-180" />
          </Button>
          <Button
            type="button"
            variant={props.buttonVariant ?? "ghost"}
            size="icon"
            class="pointer-events-auto size-(--cell-size) p-0 select-none aria-disabled:opacity-50"
            aria-label="Next month"
            onclick={() => {
              setMonth(addCalendarMonths(viewMonth.value, 1, calendar()));
            }}
          >
            <Icon icon={ChevronRight} class="size-4 rtl:rotate-180" />
          </Button>
        </div>

        {() =>
          monthList().map((monthDate, monthIndex) => {
            const labels = weekdayLabels(code(), weekStartsOn(), calendar());
            const weeks = buildMonthGrid(
              monthDate,
              showOutsideDays(),
              weekStartsOn(),
              calendar(),
            );
            const currentSelected = selected.value;
            const single = asSingle(currentSelected);
            const dates = asDates(currentSelected);
            const range = asRange(currentSelected);
            const captionLayout = props.captionLayout ?? "label";
            const showDropdowns = captionLayout === "dropdown" && monthIndex === 0;
            const cal = calendar();
            const locale = code();
            const gregory = isGregory(cal);
            const viewParts = gregory
              ? {
                  year: monthDate.getFullYear(),
                  month: monthDate.getMonth(),
                }
              : calendarParts(monthDate, cal);

            return (
              <div class="flex w-full flex-col gap-4">
                <div class="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)">
                  {showDropdowns ? (
                    <div class="flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium">
                      <NativeSelect
                        aria-label="Month"
                        size="sm"
                        class="min-w-20"
                        value={String(viewParts.month)}
                        onchange={(event: Event) => {
                          const next = Number(
                            (event.currentTarget as HTMLSelectElement).value,
                          );
                          if (isGregory(calendar())) {
                            setMonth(
                              new Date(monthDate.getFullYear(), next, 1),
                            );
                            return;
                          }
                          setMonth(
                            addCalendarMonths(
                              monthDate,
                              next - calendarParts(monthDate, calendar()).month,
                              calendar(),
                            ),
                          );
                        }}
                      >
                        {gregory
                          ? Array.from({ length: 12 }, (_, month) => (
                              <NativeSelectOption value={String(month)}>
                                {new Date(2024, month, 1).toLocaleDateString(
                                  locale,
                                  {
                                    ...formatCalendarOptions(cal),
                                    month: "short",
                                  },
                                )}
                              </NativeSelectOption>
                            ))
                          : Array.from({ length: 12 }, (_, index) => {
                              const optionDate = addCalendarMonths(
                                monthDate,
                                index + 1 - viewParts.month,
                                cal,
                              );
                              return (
                                <NativeSelectOption value={String(index + 1)}>
                                  {optionDate.toLocaleDateString(locale, {
                                    ...formatCalendarOptions(cal),
                                    month: "short",
                                  })}
                                </NativeSelectOption>
                              );
                            })}
                      </NativeSelect>
                      <NativeSelect
                        aria-label="Year"
                        size="sm"
                        class="min-w-20"
                        value={String(viewParts.year)}
                        onchange={(event: Event) => {
                          const next = Number(
                            (event.currentTarget as HTMLSelectElement).value,
                          );
                          if (isGregory(calendar())) {
                            setMonth(new Date(next, monthDate.getMonth(), 1));
                            return;
                          }
                          setMonth(
                            addCalendarMonths(
                              monthDate,
                              (next - calendarParts(monthDate, calendar()).year) *
                                12,
                              calendar(),
                            ),
                          );
                        }}
                      >
                        {yearsBetween(fromYear(), toYear()).map((year) => (
                          <NativeSelectOption value={String(year)}>
                            {formatNumber(year, locale)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  ) : (
                    <div class="text-sm font-medium select-none">
                      {formatCaption(monthDate, locale, cal)}
                    </div>
                  )}
                </div>

                <div class="w-full border-collapse">
                  <div class="flex">
                    {props.showWeekNumber ? (
                      <div class="w-(--cell-size) select-none" />
                    ) : null}
                    {labels.map((label) => (
                      <div class="flex-1 rounded-(--cell-radius) text-center text-[0.8rem] font-normal text-muted-foreground select-none">
                        {label}
                      </div>
                    ))}
                  </div>

                  {weeks.map((week) => (
                    <div class="mt-2 flex w-full">
                      {props.showWeekNumber ? (
                        <div class="flex w-(--cell-size) items-center justify-center text-[0.8rem] text-muted-foreground select-none">
                          {formatNumber(isoWeekNumber(week[0]!.date), locale)}
                        </div>
                      ) : null}
                      {week.map((cell) => {
                        if (!showOutsideDays() && cell.outside) {
                          return (
                            <div class="relative flex-1 aspect-square h-full w-full min-w-0 p-0 invisible" />
                          );
                        }
                        const disabledDay = isDisabled(cell.date, props.disabled);
                        const isSelected =
                          sameDay(single, cell.date) ||
                          dates.some((entry) => sameDay(entry, cell.date)) ||
                          sameDay(range.from, cell.date) ||
                          sameDay(range.to, cell.date);
                        const rangeStart = sameDay(range.from, cell.date);
                        const rangeEnd = sameDay(range.to, cell.date);
                        const rangeMiddle = inRange(
                          cell.date,
                          range.from,
                          range.to,
                        );
                        const isToday = sameDay(today(), cell.date);
                        const extraClass = Object.entries(
                          props.modifiersClassNames ?? {},
                        )
                          .filter(([name]) => {
                            const spec = props.modifiers?.[name];
                            return spec ? modifierMatch(cell.date, spec) : false;
                          })
                          .map(([, className]) => className)
                          .join(" ");
                        const ctx: CalendarDayContext = {
                          date: cell.date,
                          outside: cell.outside,
                          selected: isSelected,
                          today: isToday,
                          disabled: disabledDay,
                          rangeStart,
                          rangeEnd,
                          rangeMiddle,
                        };

                        return (
                          <div
                            class={cn(
                              "group/day relative flex-1 aspect-square h-full w-full min-w-0 rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-e-(--cell-radius)",
                              props.showWeekNumber
                                ? "[&:nth-child(2)[data-selected=true]_button]:rounded-s-(--cell-radius)"
                                : "[&:first-child[data-selected=true]_button]:rounded-s-(--cell-radius)",
                              rangeStart &&
                                "relative isolate z-0 rounded-s-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:end-0 after:w-4 after:bg-muted",
                              rangeMiddle && "rounded-none",
                              rangeEnd &&
                                "relative isolate z-0 rounded-e-(--cell-radius) bg-muted after:absolute after:inset-y-0 after:start-0 after:w-4 after:bg-muted",
                            )}
                            data-outside={cell.outside ? "" : undefined}
                            data-selected={isSelected ? "true" : undefined}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={disabledDay}
                              data-day={cell.date.toLocaleDateString(locale, {
                                ...formatCalendarOptions(cal),
                              })}
                              data-selected-single={
                                isSelected && !rangeStart && !rangeEnd && !rangeMiddle
                                  ? "true"
                                  : undefined
                              }
                              data-range-start={rangeStart ? "true" : undefined}
                              data-range-end={rangeEnd ? "true" : undefined}
                              data-range-middle={rangeMiddle ? "true" : undefined}
                              data-today={isToday ? "" : undefined}
                              class={cn(
                                "relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-e-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-s-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70",
                                cell.outside && "text-muted-foreground",
                                isToday &&
                                  !isSelected &&
                                  "rounded-(--cell-radius) bg-muted text-foreground",
                                disabledDay && "text-muted-foreground opacity-50",
                                extraClass,
                              )}
                              onclick={() => {
                                pick(cell.date);
                              }}
                            >
                              {formatDayLabel(cell.date, locale, cal)}
                              {props.renderDay?.(ctx)}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
});
