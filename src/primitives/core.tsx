import { cc, onMounted, onUnmounted, type SinwanNode } from "sinwan/component";
import { Portal as SinwanPortal, Show } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { jsxClass } from "../lib/utils";

export type PresenceProps = {
  present: boolean | Signal<boolean> | (() => boolean);
  children?: SinwanNode;
};

function readBool(
  value: boolean | Signal<boolean> | (() => boolean) | undefined,
): boolean {
  if (typeof value === "function") return value();
  if (value && typeof value === "object" && "value" in value) {
    return (value as Signal<boolean>).value;
  }
  return Boolean(value);
}

/** Conditionally render children while present is true. */
export const Presence = cc<PresenceProps>(({ present, children }) => {
  return (
    <Show when={() => readBool(present)} fallback={null}>
      {children}
    </Show>
  );
});

export type UiPortalProps = {
  children?: SinwanNode;
  container?: HTMLElement | null | (() => HTMLElement | null);
};

export const UiPortal = cc<UiPortalProps>(({ children, container }) => {
  return (
    <SinwanPortal
      mount={() => {
        if (typeof container === "function") return container();
        return container ?? document.body;
      }}
    >
      {children}
    </SinwanPortal>
  );
});

export function useControllableState<T>(options: {
  value?: T | Signal<T> | (() => T);
  defaultValue: T;
  onChange?: (value: T) => void;
}): [Signal<T>, (value: T | ((prev: T) => T)) => void] {
  const isControlled =
    options.value !== undefined &&
    !(typeof options.value === "function" && options.defaultValue !== undefined
      ? false
      : false);

  const readExternal = (): T | undefined => {
    const v = options.value;
    if (v === undefined) return undefined;
    if (typeof v === "function") return (v as () => T)();
    if (typeof v === "object" && v !== null && "value" in v) {
      return (v as Signal<T>).value;
    }
    return v as T;
  };

  const external = readExternal();
  const state = signal<T>(
    external !== undefined ? external : options.defaultValue,
  );

  const setState = (value: T | ((prev: T) => T)) => {
    const next =
      typeof value === "function"
        ? (value as (prev: T) => T)(state.value)
        : value;
    state.value = next;
    options.onChange?.(next);
  };

  // Sync from controlled value when provided as signal/getter on mount ticks
  onMounted(() => {
    const sync = () => {
      const v = readExternal();
      if (v !== undefined && v !== state.value) state.value = v;
    };
    sync();
    const id = window.setInterval(sync, 16);
    onUnmounted(() => window.clearInterval(id));
  });

  void isControlled;
  return [state, setState];
}

export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );
}

export function trapFocus(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusables = getFocusableElements(root);
  if (focusables.length === 0) return;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export {
  basePlacement,
  computePosition,
  createPointReference,
  createRectReference,
  createSizeFloating,
  estimatePosition,
  readDocumentRtl,
  toFloatingPlacement,
  useAnchorPosition,
  usePointPosition,
  type Align,
  type FloatingPosition,
  type FloatingStyle,
  type Placement,
  type RectLike,
  type UseAnchorPositionOptions,
  type UsePointPositionOptions,
} from "./floating";

export { jsxClass, signal, Show, SinwanPortal };
