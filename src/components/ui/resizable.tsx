import {
  cc,
  inject,
  onUnmounted,
  provide,
  Show,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { computed, signal, type Signal } from "sinwan/reactivity";
import { GripVertical } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";

type Orientation = "horizontal" | "vertical";

type PanelState = {
  id: string;
  size: Signal<number>;
  minSize: number;
  maxSize: number;
  defaultSize: number;
  snap: boolean;
  collapsed: Signal<boolean>;
};

export type ResizableSizes = number[];

type ResizableResizeHandler = (sizes: ResizableSizes) => void;

type ResizableGroupApi = {
  orientation: Orientation;
  panels: Signal<PanelState[]>;
  registerPanel: (panel: Omit<PanelState, "size" | "collapsed"> & {
    size?: Signal<number>;
    collapsed?: Signal<boolean>;
  }) => { size: Signal<number>; collapsed: Signal<boolean> };
  registerHandle: () => number;
  resizeFromHandle: (
    handleIndex: number,
    deltaPx: number,
    containerSize: number,
  ) => boolean;
  expandPanel: (panelId: string) => boolean;
  snapshotSizes: () => ResizableSizes;
  onResizeStart?: ResizableResizeHandler;
  onResize?: ResizableResizeHandler;
  onResizeEnd?: ResizableResizeHandler;
};

const ResizableGroupKey: InjectionKey<ResizableGroupApi> = Symbol(
  "sinwan-ui.resizable-group",
);

let panelSeq = 0;

function bySizeDescending(a: PanelState, b: PanelState): number {
  return b.size.value - a.size.value;
}

export type ResizablePanelGroupProps = {
  orientation?: Orientation;
  class?: string;
  children?: SinwanNode;
  id?: string;
  onResizeStart?: (startSize: ResizableSizes) => void;
  onResize?: (liveSize: ResizableSizes) => void;
  onResizeEnd?: (endSize: ResizableSizes) => void;
};

export const ResizablePanelGroup = cc<ResizablePanelGroupProps>(
  ({
    orientation = "horizontal",
    class: className,
    children,
    id,
    onResizeStart,
    onResize,
    onResizeEnd,
  }) => {
    const panels = signal<PanelState[]>([]);
    let nextHandleIndex = 0;
    const snapshotSizes = (): ResizableSizes =>
      panels.value.map((panel) => panel.size.value);

    const registerPanel: ResizableGroupApi["registerPanel"] = (panel) => {
      const size = panel.size ?? signal(panel.defaultSize);
      const collapsed = panel.collapsed ?? signal(false);
      const state: PanelState = {
        id: panel.id,
        size,
        minSize: panel.minSize,
        maxSize: panel.maxSize,
        defaultSize: panel.defaultSize,
        snap: panel.snap,
        collapsed,
      };
      panels.value = [...panels.value, state];
      return { size, collapsed };
    };

    const registerHandle = (): number => {
      const index = nextHandleIndex;
      nextHandleIndex += 1;
      return index;
    };

    const collapsePanel = (panel: PanelState, donor: PanelState): void => {
      donor.collapsed.value = false;
      donor.size.value = donor.size.value + panel.size.value;
      panel.size.value = 0;
      panel.collapsed.value = true;
    };

    const expandPanel = (panelId: string): boolean => {
      const list = panels.value;
      const panel = list.find((candidate) => candidate.id === panelId);
      if (!panel || !panel.collapsed.value) return false;

      const donors = list
        .filter(
          (candidate) =>
            candidate.id !== panelId &&
            !candidate.collapsed.value &&
            candidate.size.value > 0,
        )
        .sort(bySizeDescending);
      if (donors.length === 0) return false;

      const target = Math.max(panel.minSize, panel.defaultSize);
      let got = 0;

      for (const donor of donors) {
        if (got >= target) break;
        const take = Math.min(target - got, donor.size.value);
        if (take <= 0) continue;
        donor.size.value -= take;
        got += take;
        if (donor.snap && donor.size.value <= 0) {
          donor.size.value = 0;
          donor.collapsed.value = true;
        }
      }

      panel.size.value = got;
      panel.collapsed.value = false;
      return true;
    };

    const resizeFromHandle = (
      handleIndex: number,
      deltaPx: number,
      containerSize: number,
    ): boolean => {
      const list = panels.value;
      const left = list[handleIndex];
      const right = list[handleIndex + 1];
      if (!left || !right || containerSize <= 0) return false;

      // Collapsed panels stay shut until the expand grip is clicked.
      if (left.collapsed.value || right.collapsed.value) return false;

      const deltaPct = (deltaPx / containerSize) * 100;
      if (deltaPct === 0) return false;

      if (
        left.snap &&
        left.size.value <= left.minSize &&
        deltaPct < 0
      ) {
        collapsePanel(left, right);
        return true;
      }
      if (
        right.snap &&
        right.size.value <= right.minSize &&
        deltaPct > 0
      ) {
        collapsePanel(right, left);
        return true;
      }

      let nextLeft = left.size.value + deltaPct;
      let nextRight = right.size.value - deltaPct;

      nextLeft = Math.min(left.maxSize, Math.max(left.minSize, nextLeft));
      nextRight = Math.min(right.maxSize, Math.max(right.minSize, nextRight));

      const appliedLeft = nextLeft - left.size.value;
      const appliedRight = right.size.value - nextRight;
      const applied = Math.min(Math.abs(appliedLeft), Math.abs(appliedRight));
      if (applied === 0) return false;

      const dir = deltaPct >= 0 ? 1 : -1;
      left.size.value = left.size.value + dir * applied;
      right.size.value = right.size.value - dir * applied;
      return true;
    };

    provide(ResizableGroupKey, {
      orientation,
      panels,
      registerPanel,
      registerHandle,
      resizeFromHandle,
      expandPanel,
      snapshotSizes,
      onResizeStart,
      onResize,
      onResizeEnd,
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
  snap?: boolean;
  id?: string;
};

export const ResizablePanel = cc<ResizablePanelProps>(
  ({
    class: className,
    children,
    defaultSize = 50,
    minSize = 10,
    maxSize = 100,
    snap = false,
    id,
  }) => {
    const api = inject(ResizableGroupKey);
    if (!api) {
      throw new Error("ResizablePanel must be used within ResizablePanelGroup");
    }

    panelSeq += 1;
    const panelId = id ?? `panel-${panelSeq}`;
    const { size, collapsed } = api.registerPanel({
      id: panelId,
      defaultSize,
      minSize,
      maxSize,
      snap,
    });

    const dataSize = computed(() => String(size.value));
    const dataCollapsed = computed(() =>
      collapsed.value ? "true" : undefined,
    );
    const ariaHidden = computed(() => (collapsed.value ? true : undefined));
    const panelStyle = computed(() => ({
      flexBasis: `${size.value}%`,
      flexGrow: 0,
      flexShrink: 0,
    }));
    const panelOpen = computed(() => !collapsed.value);

    return (
      <div
        data-slot="resizable-panel"
        data-panel-id={panelId}
        data-size={dataSize}
        data-collapsed={dataCollapsed}
        aria-hidden={ariaHidden}
        class={cn("min-h-0 min-w-0 overflow-hidden", className)}
        style={panelStyle}
      >
        <Show when={panelOpen} fallback={null}>
          {children}
        </Show>
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

    const handleIndex = api.registerHandle();
    let stopResize: (() => void) | null = null;

    // Neighbors register after this handle in JSX order; collapsed flips later.
    // computed() tracks panels + collapsed so grip/seam state stays live.
    const leftCollapsed = computed(() =>
      Boolean(api.panels.value[handleIndex]?.collapsed.value),
    );
    const rightCollapsed = computed(() =>
      Boolean(api.panels.value[handleIndex + 1]?.collapsed.value),
    );
    const seamInactive = computed(() => {
      if (leftCollapsed.value && rightCollapsed.value) return true;
      // Hide the duplicate stacked handle behind a collapsed left when the
      // previous seam is still active (its left neighbor is open).
      if (handleIndex > 0 && leftCollapsed.value && !rightCollapsed.value) {
        const previousLeft = api.panels.value[handleIndex - 1];
        return Boolean(previousLeft && !previousLeft.collapsed.value);
      }
      return false;
    });
    const showStartExpand = computed(
      () =>
        !seamInactive.value && leftCollapsed.value && !rightCollapsed.value,
    );
    const showEndExpand = computed(
      () =>
        !seamInactive.value && rightCollapsed.value && !leftCollapsed.value,
    );
    const eitherCollapsed = computed(
      () => leftCollapsed.value || rightCollapsed.value,
    );
    const collapsedSeam = computed(() =>
      seamInactive.value ? "true" : undefined,
    );
    const ariaDisabled = computed(() =>
      disabled || seamInactive.value ? true : undefined,
    );
    const tabIndexValue = computed(() =>
      disabled || seamInactive.value ? -1 : 0,
    );
    const handleClass = computed(() =>
      cn(
        "relative flex w-px cursor-col-resize touch-none items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        (disabled || seamInactive.value) && "pointer-events-none opacity-50",
        seamInactive.value &&
        "w-0 overflow-hidden border-0 p-0 after:hidden",
        className,
      ),
    );

    const onExpand = (panelId: string, event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      api.expandPanel(panelId);
      const sizes = api.snapshotSizes();
      api.onResize?.(sizes);
      api.onResizeEnd?.(sizes);
    };

    const onPointerDown = (event: PointerEvent) => {
      // Collapsed seams reopen only via the expand grip click, not drag.
      if (disabled || seamInactive.value || eitherCollapsed.value) return;
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      const group = target.parentElement;
      if (!group || group.getAttribute("data-slot") !== "resizable-panel-group") {
        return;
      }

      stopResize?.();

      const start =
        api.orientation === "horizontal" ? event.clientX : event.clientY;
      const rect = group.getBoundingClientRect();
      const containerSize =
        api.orientation === "horizontal" ? rect.width : rect.height;
      const resizeCursor =
        api.orientation === "horizontal" ? "col-resize" : "row-resize";
      const previousBodyCursor = document.body.style.cursor;
      const previousHtmlCursor = document.documentElement.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = resizeCursor;
      document.documentElement.style.cursor = resizeCursor;
      document.body.style.userSelect = "none";
      group.setAttribute("data-resizing", "");
      target.setAttribute("data-resizing", "");
      api.onResizeStart?.(api.snapshotSizes());

      let last = start;
      const onMoveRelative = (moveEvent: PointerEvent) => {
        const current =
          api.orientation === "horizontal"
            ? moveEvent.clientX
            : moveEvent.clientY;
        if (api.resizeFromHandle(handleIndex, current - last, containerSize)) {
          api.onResize?.(api.snapshotSizes());
        }
        last = current;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMoveRelative);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = previousBodyCursor;
        document.documentElement.style.cursor = previousHtmlCursor;
        document.body.style.userSelect = previousUserSelect;
        group.removeAttribute("data-resizing");
        target.removeAttribute("data-resizing");
        stopResize = null;
        api.onResizeEnd?.(api.snapshotSizes());
      };

      stopResize = onUp;
      window.addEventListener("pointermove", onMoveRelative);
      window.addEventListener("pointerup", onUp);
    };

    onUnmounted(() => {
      stopResize?.();
    });

    return (
      <div
        data-slot="resizable-handle"
        data-collapsed-seam={collapsedSeam}
        role="separator"
        aria-orientation={
          api.orientation === "vertical" ? "horizontal" : "vertical"
        }
        aria-disabled={ariaDisabled}
        tabIndex={tabIndexValue}
        class={handleClass}
        onpointerdown={onPointerDown}
      >
        <Show when={showStartExpand} fallback={null}>
          <button
            type="button"
            data-slot="resizable-panel-expand"
            data-side="start"
            aria-label="Expand panel"
            class="absolute z-20 flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground top-1/2 left-1/2"
            onclick={(event: MouseEvent) => {
              const panel = api.panels.value[handleIndex];
              if (panel) onExpand(panel.id, event);
            }}
          >
            <Icon
              icon={GripVertical}
              class={
                api.orientation === "vertical" ? "size-3.5 rotate-90" : "size-3.5"
              }
            />
          </button>
        </Show>
        <Show when={showEndExpand} fallback={null}>
          <button
            type="button"
            data-slot="resizable-panel-expand"
            data-side="end"
            aria-label="Expand panel"
            class="absolute z-20 flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground top-1/2 left-1/2"
            onclick={(event: MouseEvent) => {
              const panel = api.panels.value[handleIndex + 1];
              if (panel) onExpand(panel.id, event);
            }}
          >
            <Icon
              icon={GripVertical}
              class={
                api.orientation === "vertical" ? "size-3.5 rotate-90" : "size-3.5"
              }
            />
          </button>
        </Show>
        {withHandle ? (
          <div class="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
        ) : null}
      </div>
    );
  },
);
