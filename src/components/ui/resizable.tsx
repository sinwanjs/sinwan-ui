import {
  cc,
  inject,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";

import { cn, jsxClass } from "../../lib/utils";

type Orientation = "horizontal" | "vertical";

type PanelState = {
  id: string;
  size: Signal<number>;
  minSize: number;
  maxSize: number;
  defaultSize: number;
};

type ResizableGroupApi = {
  orientation: Orientation;
  panels: Signal<PanelState[]>;
  registerPanel: (panel: Omit<PanelState, "size"> & { size?: Signal<number> }) => Signal<number>;
  resizeFromHandle: (handleIndex: number, deltaPx: number, containerSize: number) => void;
};

const ResizableGroupKey: InjectionKey<ResizableGroupApi> = Symbol(
  "sinwan-ui.resizable-group",
);

let panelSeq = 0;

export type ResizablePanelGroupProps = {
  orientation?: Orientation;
  class?: string;
  children?: SinwanNode;
  id?: string;
};

export const ResizablePanelGroup = cc<ResizablePanelGroupProps>(
  ({ orientation = "horizontal", class: className, children, id }) => {
    const panels = signal<PanelState[]>([]);

    const registerPanel: ResizableGroupApi["registerPanel"] = (panel) => {
      const size = panel.size ?? signal(panel.defaultSize);
      const state: PanelState = {
        id: panel.id,
        size,
        minSize: panel.minSize,
        maxSize: panel.maxSize,
        defaultSize: panel.defaultSize,
      };
      panels.value = [...panels.value, state];
      return size;
    };

    const resizeFromHandle = (
      handleIndex: number,
      deltaPx: number,
      containerSize: number,
    ) => {
      const list = panels.value;
      const left = list[handleIndex];
      const right = list[handleIndex + 1];
      if (!left || !right || containerSize <= 0) return;

      const deltaPct = (deltaPx / containerSize) * 100;
      let nextLeft = left.size.value + deltaPct;
      let nextRight = right.size.value - deltaPct;

      nextLeft = Math.min(left.maxSize, Math.max(left.minSize, nextLeft));
      nextRight = Math.min(right.maxSize, Math.max(right.minSize, nextRight));

      const appliedLeft = nextLeft - left.size.value;
      const appliedRight = right.size.value - nextRight;
      const applied = Math.min(Math.abs(appliedLeft), Math.abs(appliedRight));
      if (applied === 0) return;

      const dir = deltaPct >= 0 ? 1 : -1;
      left.size.value = left.size.value + dir * applied;
      right.size.value = right.size.value - dir * applied;
    };

    provide(ResizableGroupKey, {
      orientation,
      panels,
      registerPanel,
      resizeFromHandle,
    });

    return (
      <div
        data-slot="resizable-panel-group"
        data-orientation={orientation}
        id={id}
        class={cn(
          "flex h-full w-full",
          orientation === "vertical" && "flex-col",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

export type ResizablePanelProps = {
  class?: string;
  children?: SinwanNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  id?: string;
};

export const ResizablePanel = cc<ResizablePanelProps>(
  ({
    class: className,
    children,
    defaultSize = 50,
    minSize = 10,
    maxSize = 90,
    id,
  }) => {
    const api = inject(ResizableGroupKey);
    if (!api) {
      throw new Error("ResizablePanel must be used within ResizablePanelGroup");
    }

    panelSeq += 1;
    const panelId = id ?? `panel-${panelSeq}`;
    const size = api.registerPanel({
      id: panelId,
      defaultSize,
      minSize,
      maxSize,
    });

    return (
      <div
        data-slot="resizable-panel"
        data-panel-id={panelId}
        class={cn("min-h-0 min-w-0 overflow-hidden", className)}
        style={jsxClass(() => ({
          flexBasis: `${size.value}%`,
          flexGrow: 0,
          flexShrink: 0,
        }))}
      >
        {children}
      </div>
    );
  },
);

export type ResizableHandleProps = {
  class?: string;
  withHandle?: boolean;
  disabled?: boolean;
};

export const ResizableHandle = cc<ResizableHandleProps>(
  ({ class: className, withHandle = false, disabled }) => {
    const api = inject(ResizableGroupKey);
    if (!api) {
      throw new Error("ResizableHandle must be used within ResizablePanelGroup");
    }

    let handleEl: HTMLElement | null = null;
    let handleIndex = -1;

    const onPointerDown = (event: PointerEvent) => {
      if (disabled) return;
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      handleEl = target;
      const group = target.parentElement;
      if (!group) return;

      const handles = Array.from(
        group.querySelectorAll("[data-slot=resizable-handle]"),
      );
      handleIndex = handles.indexOf(target);
      if (handleIndex < 0) return;

      const start = api.orientation === "horizontal" ? event.clientX : event.clientY;
      const rect = group.getBoundingClientRect();
      const containerSize =
        api.orientation === "horizontal" ? rect.width : rect.height;

      let last = start;
      const onMoveRelative = (moveEvent: PointerEvent) => {
        const current =
          api.orientation === "horizontal"
            ? moveEvent.clientX
            : moveEvent.clientY;
        api.resizeFromHandle(handleIndex, current - last, containerSize);
        last = current;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMoveRelative);
        window.removeEventListener("pointerup", onUp);
        handleEl = null;
      };

      window.addEventListener("pointermove", onMoveRelative);
      window.addEventListener("pointerup", onUp);
    };

    return (
      <div
        data-slot="resizable-handle"
        role="separator"
        aria-orientation={
          api.orientation === "vertical" ? "horizontal" : "vertical"
        }
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        class={cn(
          "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onpointerdown={onPointerDown}
      >
        {withHandle ? (
          <div class="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
        ) : null}
      </div>
    );
  },
);
