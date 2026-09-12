import { cc } from "sinwan/component";
import { cn } from "@/lib/utils";
import { createLiveState } from "../../lib/live-state";

type SliderValue = number | number[];

type SliderProps = {
  class?: string;
  defaultValue?: SliderValue;
  value?: SliderValue;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  onValueChange?: (value: number[]) => void;
  id?: string;
  name?: string;
};

function toValues(
  value: SliderValue | undefined,
  fallback: SliderValue | undefined,
  min: number,
): number[] {
  const source = value ?? fallback;
  if (Array.isArray(source) && source.length > 0) {
    return source.map((n) => Number(n));
  }
  if (typeof source === "number") return [source];
  return [min];
}

function sameValues(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function snapValue(
  next: number,
  min: number,
  max: number,
  step: number,
): number {
  if (!(step > 0)) {
    return Math.min(max, Math.max(min, next));
  }
  const snapped = Math.round((next - min) / step) * step + min;
  const decimals = String(step).includes(".")
    ? (String(step).split(".")[1]?.length ?? 0)
    : 0;
  const rounded =
    decimals > 0 ? Number(snapped.toFixed(decimals)) : snapped;
  return Math.min(max, Math.max(min, rounded));
}

const Slider = cc<SliderProps>((props) => {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 1;
  const orientation = props.orientation ?? "horizontal";
  const { state: values, set } = createLiveState(
    "value" in props,
    toValues(undefined, props.defaultValue, min),
    () => toValues(props.value, undefined, min),
  );

  const primary = () => values.value[0] ?? min;
  const percent = () => {
    const span = max - min || 1;
    return ((primary() - min) / span) * 100;
  };

  const commit = (next: number) => {
    const clamped = snapValue(next, min, max, step);
    if (!sameValues([clamped], values.value)) {
      set([clamped]);
    }
    props.onValueChange?.([clamped]);
  };

  return (
    <div
      data-slot="slider"
      data-orientation={orientation}
      data-disabled={props.disabled ? "" : undefined}
      class={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        orientation === "vertical" && "h-full min-h-40 w-auto flex-col",
        props.disabled && "opacity-50",
        props.class,
      )}
    >
      <div
        data-slot="slider-track"
        class={cn(
          "relative grow overflow-hidden rounded-full bg-muted",
          orientation === "vertical" ? "h-full w-1" : "h-1 w-full",
        )}
      >
        <div
          data-slot="slider-range"
          class={cn(
            "absolute bg-primary select-none",
            orientation === "vertical" ? "w-full bottom-0" : "h-full left-0",
          )}
          style={() =>
            orientation === "vertical"
              ? `height: ${percent()}%`
              : `width: ${percent()}%`
          }
        />
      </div>
      <input
        type="range"
        data-slot="slider-input"
        id={props.id}
        name={props.name}
        min={String(min)}
        max={String(max)}
        step={String(step)}
        disabled={props.disabled}
        aria-orientation={orientation}
        value={() => String(primary())}
        class={cn(
          "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:pointer-events-none disabled:cursor-not-allowed",
          orientation === "vertical" && "[writing-mode:vertical-lr]",
        )}
        oninput={(event) => {
          const target = event.currentTarget as HTMLInputElement;
          commit(Number(target.value));
        }}
      />
      <span
        data-slot="slider-thumb"
        aria-hidden="true"
        class="pointer-events-none absolute z-0 size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2"
        style={() =>
          orientation === "vertical"
            ? `left: 50%; bottom: ${percent()}%; transform: translate(-50%, 50%)`
            : `top: 50%; left: ${percent()}%; transform: translate(-50%, -50%)`
        }
      />
    </div>
  );
});

export { Slider };
