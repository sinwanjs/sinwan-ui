import { cc, inject, provide, type InjectionKey, type SinwanComponent, type SinwanNode } from "sinwan/component";
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

export type CarouselContentProps = JSX.IntrinsicElements["div"];

export const CarouselContent: SinwanComponent<CarouselContentProps> = cc(
  ({ class: className, ...props }) => {
    const { orientation, index } = useCarousel();

    return (
      <div class="overflow-hidden" data-slot="carousel-content">
        <div
          class={cn(
            "flex transition-transform duration-300 ease-out",
            orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
            className,
          )}
          style={() =>
            orientation === "horizontal"
              ? { transform: `translateX(-${index.value * 100}%)` }
              : { transform: `translateY(-${index.value * 100}%)` }
          }
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
