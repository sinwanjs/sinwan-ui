import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";

import { cn } from "../../lib/utils";

type ScrollOrientation = "vertical" | "horizontal";

type ScrollAreaApi = {
  viewportEl: Signal<HTMLElement | null>;
};

const ScrollAreaKey: InjectionKey<ScrollAreaApi> = Symbol(
  "sinwan-ui.scroll-area",
);

const OVERLAY_MIN_THUMB = 24;
const OVERLAY_TRACK_PAD = 4;
const OVERLAY_HIDE_MS = 700;

type OverlayThumbMetrics = {
  offset: number;
  size: number;
  overflow: boolean;
};

function overlayThumbMetrics(
  viewport: HTMLElement,
  orientation: ScrollOrientation,
): OverlayThumbMetrics {
  const vertical = orientation === "vertical";
  const client = vertical ? viewport.clientHeight : viewport.clientWidth;
  const scroll = vertical ? viewport.scrollHeight : viewport.scrollWidth;
  const pos = vertical ? viewport.scrollTop : viewport.scrollLeft;
  if (client <= 0 || scroll - client <= 1) {
    return { offset: 0, size: 0, overflow: false };
  }
  const track = Math.max(0, client - OVERLAY_TRACK_PAD);
  const size = Math.min(
    track,
    Math.max(OVERLAY_MIN_THUMB, (client / scroll) * track),
  );
  const maxOffset = Math.max(0, track - size);
  const maxScroll = scroll - client;
  const offset = maxOffset === 0 ? 0 : (pos / maxScroll) * maxOffset;
  return { offset, size, overflow: true };
}

function applyOverlayScroll(
  viewport: HTMLElement,
  orientation: ScrollOrientation,
  origin: number,
  pointerOrigin: number,
  pointer: number,
): void {
  const metrics = overlayThumbMetrics(viewport, orientation);
  if (!metrics.overflow) return;
  const vertical = orientation === "vertical";
  const client = vertical ? viewport.clientHeight : viewport.clientWidth;
  const scroll = vertical ? viewport.scrollHeight : viewport.scrollWidth;
  const maxOffset = Math.max(0, client - OVERLAY_TRACK_PAD - metrics.size);
  const maxScroll = scroll - client;
  if (maxOffset <= 0) return;
  const next = origin + ((pointer - pointerOrigin) / maxOffset) * maxScroll;
  if (vertical) viewport.scrollTop = next;
  else viewport.scrollLeft = next;
}

export type ScrollAreaProps = {
  children?: SinwanNode;
  class?: string;
  viewportClass?: string;
};

export const ScrollArea = cc<ScrollAreaProps>(
  ({ class: className, viewportClass, children }) => {
    const viewportEl = signal<HTMLElement | null>(null);
    provide(ScrollAreaKey, { viewportEl });

    return (
      <div
        data-slot="scroll-area"
        class={cn(
          "group/scroll-area relative overflow-hidden",
          className,
        )}
      >
        <div
          data-slot="scroll-area-viewport"
          tabIndex={0}
          class={cn(
            "size-full overflow-auto rounded-[inherit] outline-none scrollbar-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
            viewportClass,
          )}
          ref={(el: HTMLElement | null) => {
            viewportEl.value = el;
          }}
        >
          {children}
        </div>
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
      </div>
    );
  },
);

export type ScrollBarProps = {
  class?: string;
  orientation?: ScrollOrientation;
};

export const ScrollBar = cc<ScrollBarProps>(
  ({ class: className, orientation = "vertical" }) => {
    const api = inject(ScrollAreaKey);
    const overflow = signal(false);
    const offset = signal(0);
    const size = signal(0);
    const scrolling = signal(false);
    const vertical = orientation === "vertical";
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let dragging = false;
    let dragOrigin = 0;
    let scrollOrigin = 0;

    const sync = (): void => {
      const viewport = api?.viewportEl.value;
      if (!viewport) {
        overflow.value = false;
        return;
      }
      const metrics = overlayThumbMetrics(viewport, orientation);
      overflow.value = metrics.overflow;
      offset.value = metrics.offset;
      size.value = metrics.size;
    };

    const markScrolling = (): void => {
      scrolling.value = true;
      if (hideTimer !== null) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        scrolling.value = false;
        hideTimer = null;
      }, OVERLAY_HIDE_MS);
    };

    onMounted(() => {
      sync();
      const viewport = api?.viewportEl.value;
      if (!viewport) return;

      const onScroll = (): void => {
        sync();
        markScrolling();
      };
      viewport.addEventListener("scroll", onScroll, { passive: true });

      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => {
              sync();
            });
      observer?.observe(viewport);
      const content = viewport.firstElementChild;
      if (content) observer?.observe(content);

      sync();

      onUnmounted(() => {
        viewport.removeEventListener("scroll", onScroll);
        observer?.disconnect();
        if (hideTimer !== null) clearTimeout(hideTimer);
      });
    });

    const endDrag = (): void => {
      dragging = false;
    };

    return (
      <div
        data-slot="scroll-area-scrollbar"
        data-orientation={orientation}
        data-horizontal={vertical ? undefined : ""}
        data-vertical={vertical ? "" : undefined}
        data-overflow={() => (overflow.value ? "true" : "false")}
        data-scrolling={() => (scrolling.value ? "true" : "false")}
        class={() =>
          cn(
            "pointer-events-none absolute z-10 flex touch-none p-0.5 transition-opacity duration-200 select-none",
            overflow.value &&
              "pointer-events-auto opacity-0 group-hover/scroll-area:opacity-100",
            overflow.value && scrolling.value && "opacity-100",
            !overflow.value && "opacity-0",
            vertical
              ? "inset-y-0 end-0 w-2.5"
              : "inset-x-0 bottom-0 h-2.5 flex-col",
            className,
          )
        }
        aria-hidden="true"
      >
        <div
          data-slot="scroll-area-thumb"
          class={
            vertical
              ? "relative w-full rounded-full bg-foreground/30 hover:bg-foreground/50"
              : "relative h-full rounded-full bg-foreground/30 hover:bg-foreground/50"
          }
          style={() =>
            vertical
              ? `height: ${size.value}px; transform: translateY(${offset.value}px)`
              : `width: ${size.value}px; transform: translateX(${offset.value}px)`
          }
          onpointerdown={(event) => {
            const viewport = api?.viewportEl.value;
            if (!viewport || !overflow.value) return;
            dragging = true;
            dragOrigin = vertical ? event.clientY : event.clientX;
            scrollOrigin = vertical
              ? viewport.scrollTop
              : viewport.scrollLeft;
            const target = event.currentTarget as HTMLElement;
            if (typeof target.setPointerCapture === "function") {
              target.setPointerCapture(event.pointerId);
            }
            markScrolling();
            event.preventDefault();
          }}
          onpointermove={(event) => {
            if (!dragging) return;
            const viewport = api?.viewportEl.value;
            if (!viewport || !viewport.isConnected) return;
            applyOverlayScroll(
              viewport,
              orientation,
              scrollOrigin,
              dragOrigin,
              vertical ? event.clientY : event.clientX,
            );
            markScrolling();
          }}
          onpointerup={endDrag}
          onpointercancel={endDrag}
        />
      </div>
    );
  },
);
