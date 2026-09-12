import type { SinwanNode } from "sinwan/component";

import { cn } from "../../lib/utils";
import {
  TooltipContent as TooltipContentPrimitive,
  TooltipProvider as TooltipProviderPrimitive,
  TooltipRoot,
  TooltipTrigger as TooltipTriggerPrimitive,
  type Placement,
} from "../../primitives";

type TooltipProviderProps = {
  children?: SinwanNode;
  delayDuration?: number;
};

function TooltipProvider(props: TooltipProviderProps) {
  return <TooltipProviderPrimitive {...props} />;
}

type TooltipProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Tooltip(props: TooltipProps) {
  return <TooltipRoot {...props} />;
}

type TooltipTriggerProps = {
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
};

function TooltipTrigger(props: TooltipTriggerProps) {
  return <TooltipTriggerPrimitive {...props} />;
}

type TooltipContentProps = {
  children?: SinwanNode;
  class?: string;
  side?: Placement;
  sideOffset?: number;
};

function TooltipContent({
  class: className,
  side = "top",
  children,
}: TooltipContentProps) {
  return (
    <TooltipContentPrimitive
      side={side}
      class={cn(
        "z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:!fill-mode-forwards",
        className,
      )}
    >
      {children}
      <span class="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
    </TooltipContentPrimitive>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
