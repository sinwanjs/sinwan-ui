import { type Signal } from "sinwan/reactivity";

import { cn } from "../../lib/utils";

type ProgressValueInput =
  | number
  | null
  | Signal<number>
  | Signal<number | null>
  | (() => number | null);

type ProgressProps = Omit<JSX.IntrinsicElements["div"], "value"> & {
  value?: ProgressValueInput;
};

function readPercent(input: ProgressValueInput): number {
  if (typeof input === "function") {
    return input() ?? 0;
  }
  if (typeof input === "object" && input !== null && "value" in input) {
    return input.value ?? 0;
  }
  return input ?? 0;
}

function Progress({
  class: className,
  value = 0,
  ...props
}: ProgressProps) {
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={() => readPercent(value)}
      class={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        class="size-full flex-1 bg-primary transition-all"
        style={() => `width: ${readPercent(value)}%`}
      />
    </div>
  );
}

export { Progress };
export type { ProgressProps, ProgressValueInput };
