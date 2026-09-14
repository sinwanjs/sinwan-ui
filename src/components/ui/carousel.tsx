import {
  cc,
  inject,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanComponent,
  type SinwanNode,
} from "sinwan/component";
import { computed, signal, type Signal } from "sinwan/reactivity";
import { ChevronLeft, ChevronRight } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "./button";

export type CarouselApi = {
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  index: Signal<number>;
  canScrollPrev: () => boolean;
  canScrollNext: () => boolean;
};

type CarouselContext = {
  orientation: "horizontal" | "vertical";
  index: Signal<number>;
  slideCount: Signal<number>;
  registerSlide: () => number;
  scrollPrev: () => void;
  scrollNext: () => void;
  scrollTo: (index: number) => void;
  canScrollPrev: () => boolean;
  canScrollNext: () => boolean;
};

const CarouselKey: InjectionKey<CarouselContext> = Symbol("sinwan-ui.carousel");

function useCarousel(): CarouselContext {
  const context = inject(CarouselKey);
  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }
  return context;
}

export type CarouselProps = {
  orientation?: "horizontal" | "vertical";
  class?: string;
  children?: SinwanNode;
  setApi?: (api: CarouselApi) => void;
  opts?: { startIndex?: number; loop?: boolean };
};

export const Carousel: SinwanComponent<CarouselProps> = cc(
  ({
    orientation = "horizontal",
    class: className,
    children,
    setApi,
    opts,
  }) => {
    const index = signal(opts?.startIndex ?? 0);
    const slideCount = signal(0);
    const loop = opts?.loop ?? false;
    let slideSeq = 0;

    const canScrollPrev = () => loop || index.value > 0;
    const canScrollNext = () => loop || index.value < slideCount.value - 1;

    const scrollTo = (next: number) => {
      const count = slideCount.value;
      if (count <= 0) return;
      if (loop) {
        index.value = ((next % count) + count) % count;
        return;
      }
      index.value = Math.min(count - 1, Math.max(0, next));
    };

    const scrollPrev = () => scrollTo(index.value - 1);
    const scrollNext = () => scrollTo(index.value + 1);

    const registerSlide = () => {
      const current = slideSeq;
      slideSeq += 1;
      slideCount.value = slideSeq;
      return current;
    };

    const api: CarouselApi = {
      scrollPrev,
      scrollNext,
      scrollTo,
      index,
      canScrollPrev,
      canScrollNext,
    };
    setApi?.(api);

    provide(CarouselKey, {
      orientation,
      index,
      slideCount,
      registerSlide,
      scrollPrev,
      scrollNext,
      scrollTo,
      canScrollPrev,
      canScrollNext,
    });

    void computed(() => index.value);

    return (
      <div
        data-slot="carousel"
        role="region"
        aria-roledescription="carousel"
        class={cn("relative", className)}
        onkeydown={(event: KeyboardEvent) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            scrollPrev();
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            scrollNext();
          }
        }}
      >
        {children}
      </div>
    );
  },
);

const SWIPE_LOCK_PX = 8;
const SWIPE_COMMIT_PX = 48;
const SWIPE_EDGE_RESIST = 0.35;

function pointerClientPoint(
  event: Event,
): { clientX: number; clientY: number } | null {
  if (!("clientX" in event) || !("clientY" in event)) return null;
  const point = event as { clientX: number; clientY: number };
  return { clientX: point.clientX, clientY: point.clientY };
}

function swipeAxis(
  point: { clientX: number; clientY: number },
  orientation: "horizontal" | "vertical",
): { main: number; cross: number } {
  return orientation === "horizontal"
    ? { main: point.clientX, cross: point.clientY }
    : { main: point.clientY, cross: point.clientX };
}

function resistedSwipeDelta(
  raw: number,
  canScrollPrev: boolean,
  canScrollNext: boolean,
): number {
  if (raw > 0 && !canScrollPrev) return raw * SWIPE_EDGE_RESIST;
  if (raw < 0 && !canScrollNext) return raw * SWIPE_EDGE_RESIST;
  return raw;
}

export type CarouselContentProps = JSX.IntrinsicElements["div"];

export const CarouselContent: SinwanComponent<CarouselContentProps> = cc(
  ({ class: className, ...props }) => {
    const {
      orientation,
      index,
      scrollPrev,
      scrollNext,
      canScrollPrev,
      canScrollNext,
    } = useCarousel();
    const dragOffset = signal(0);
    const isDragging = signal(false);
    let stopSwipe: (() => void) | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if ("button" in event && event.button !== 0) return;
      const startPoint = pointerClientPoint(event);
      if (!startPoint) return;
      const start = swipeAxis(startPoint, orientation);
      let locked: boolean | null = null;
      let rawDelta = 0;

      const finish = (commit: boolean) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        if (
          commit &&
          locked &&
          Math.abs(rawDelta) >= SWIPE_COMMIT_PX
        ) {
          if (rawDelta < 0) {
            if (canScrollNext()) scrollNext();
          } else if (canScrollPrev()) {
            scrollPrev();
          }
        }
        dragOffset.value = 0;
        isDragging.value = false;
        stopSwipe = null;
      };

      const onMove = (moveEvent: Event) => {
        const point = pointerClientPoint(moveEvent);
        if (!point) return;
        const pos = swipeAxis(point, orientation);
        const dMain = pos.main - start.main;
        const dCross = pos.cross - start.cross;
        if (locked === null) {
          if (
            Math.abs(dMain) < SWIPE_LOCK_PX &&
            Math.abs(dCross) < SWIPE_LOCK_PX
          ) {
            return;
          }
          locked = Math.abs(dMain) >= Math.abs(dCross);
          if (!locked) return;
          isDragging.value = true;
        }
        if (!locked) return;
        if (moveEvent.cancelable) moveEvent.preventDefault();
        rawDelta = dMain;
        dragOffset.value = resistedSwipeDelta(
          dMain,
          canScrollPrev(),
          canScrollNext(),
        );
      };

      const onUp = () => finish(true);
      const onCancel = () => finish(false);

      stopSwipe?.();
      stopSwipe = () => finish(false);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    };

    onUnmounted(() => {
      stopSwipe?.();
    });

    return (
      <div
        class={cn(
          "overflow-hidden touch-manipulation select-none",
          orientation === "horizontal" ? "touch-pan-y" : "touch-pan-x",
        )}
        data-slot="carousel-content"
        data-dragging={() => (isDragging.value ? "" : undefined)}
        onpointerdown={onPointerDown}
      >
        <div
          class={() =>
            cn(
              "flex ease-out",
              isDragging.value
                ? "transition-none"
                : "transition-transform duration-300",
              orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
              className,
            )
          }
          style={() => {
            const percent = -index.value * 100;
            const drag = dragOffset.value;
            const translate =
              drag === 0
                ? `${percent}%`
                : `calc(${percent}% + ${drag}px)`;
            return orientation === "horizontal"
              ? { transform: `translateX(${translate})` }
              : { transform: `translateY(${translate})` };
          }}
          {...props}
        />
      </div>
    );
  },
);

export type CarouselItemProps = JSX.IntrinsicElements["div"];

export const CarouselItem: SinwanComponent<CarouselItemProps> = cc(
  ({ class: className, ...props }) => {
    const { orientation, registerSlide } = useCarousel();
    registerSlide();

    return (
      <div
        role="group"
        aria-roledescription="slide"
        data-slot="carousel-item"
        class={cn(
          "min-w-0 shrink-0 grow-0 basis-full",
          orientation === "horizontal" ? "pl-4" : "pt-4",
          className,
        )}
        {...props}
      />
    );
  },
);

export type CarouselControlProps = ButtonProps;

export const CarouselPrevious: SinwanComponent<CarouselControlProps> = cc(
  ({
    class: className,
    variant = "outline",
    size = "icon-sm",
    ...props
  }) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();

    return (
      <Button
        data-slot="carousel-previous"
        variant={variant}
        size={size}
        class={cn(
          "absolute touch-manipulation rounded-full data-disabled:pointer-events-none data-disabled:opacity-50",
          orientation === "horizontal"
            ? "inset-y-0 -left-12 my-auto"
            : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        data-disabled={() => (!canScrollPrev() ? "" : undefined)}
        onclick={() => {
          if (canScrollPrev()) scrollPrev();
        }}
        {...(props as ButtonProps)}
      >
        <Icon icon={ChevronLeft} />
        <span class="sr-only">Previous slide</span>
      </Button>
    );
  },
);

export const CarouselNext: SinwanComponent<CarouselControlProps> = cc(
  ({
    class: className,
    variant = "outline",
    size = "icon-sm",
    ...props
  }) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    return (
      <Button
        data-slot="carousel-next"
        variant={variant}
        size={size}
        class={cn(
          "absolute touch-manipulation rounded-full data-disabled:pointer-events-none data-disabled:opacity-50",
          orientation === "horizontal"
            ? "inset-y-0 -right-12 my-auto"
            : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        )}
        data-disabled={() => (!canScrollNext() ? "" : undefined)}
        onclick={() => {
          if (canScrollNext()) scrollNext();
        }}
        {...(props as ButtonProps)}
      >
        <Icon icon={ChevronRight} />
        <span class="sr-only">Next slide</span>
      </Button>
    );
  },
);

export { useCarousel };
