import type { SinwanNode } from "sinwan/component";

import { cn } from "../../lib/utils";

type ScrollAreaProps = {
  children?: SinwanNode;
  class?: string;
  viewportClass?: string;
};

function ScrollArea({
  class: className,
  viewportClass,
  children,
}: ScrollAreaProps) {
  return (
    <div data-slot="scroll-area" class={cn("relative", className)}>
      <div
        data-slot="scroll-area-viewport"
        class={cn(
          "size-full overflow-auto rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClass,
        )}
      >
        {children}
      </div>
    </div>
  );
}

type ScrollBarProps = {
  class?: string;
  orientation?: "vertical" | "horizontal";
};

function ScrollBar({
  class: className,
  orientation = "vertical",
}: ScrollBarProps) {
  return (
    <div
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      data-horizontal={orientation === "horizontal" ? "" : undefined}
      data-vertical={orientation === "vertical" ? "" : undefined}
      class={cn(
        "pointer-events-none absolute flex touch-none bg-transparent p-px transition-colors select-none data-horizontal:inset-x-0 data-horizontal:bottom-0 data-horizontal:h-2.5 data-horizontal:flex-col data-vertical:inset-y-0 data-vertical:right-0 data-vertical:w-2.5",
        className,
      )}
      aria-hidden="true"
    >
      <div
        data-slot="scroll-area-thumb"
        class="relative flex-1 rounded-full bg-primary/50"
      />
    </div>
  );
}

export { ScrollArea, ScrollBar };
