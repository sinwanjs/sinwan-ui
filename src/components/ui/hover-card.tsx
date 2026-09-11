import {
  inject,
  onUnmounted,
  type SinwanNode,
} from "sinwan/component";

import { Slot } from "../../lib/slot";
import { cn, jsxClass } from "../../lib/utils";
import {
  PopoverContent as PopoverContentPrimitive,
  PopoverKey,
  PopoverRoot,
  type Align,
  type Placement,
} from "../../primitives";

type HoverCardProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function HoverCard(props: HoverCardProps) {
  return <PopoverRoot {...props} />;
}

type HoverCardTriggerProps = {
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
};

function HoverCardTrigger({
  children,
  class: className,
  asChild,
}: HoverCardTriggerProps) {
  const api = inject(PopoverKey)!;
  let openTimer: number | undefined;
  const clearOpenTimer = () => {
    if (openTimer !== undefined) {
      window.clearTimeout(openTimer);
      openTimer = undefined;
    }
  };
  const show = () => {
    if (api.isHoverOpenBlocked()) return;
    api.cancelClose();
    clearOpenTimer();
    openTimer = window.setTimeout(() => {
      openTimer = undefined;
      if (api.isHoverOpenBlocked()) return;
      api.setOpen(true);
    }, 100);
  };
  const hide = () => {
    clearOpenTimer();
    api.requestClose(120);
  };
  onUnmounted(clearOpenTimer);
  const ref = (el: HTMLElement | null) => {
    api.triggerEl.value = el;
  };
  const handlers = {
    onmouseenter: () => {
      api.setPointerOverTrigger(true);
      show();
    },
    onmouseleave: () => {
      api.setPointerOverTrigger(false);
      hide();
    },
    onfocus: show,
    onblur: hide,
    ref,
  };
  if (asChild) {
    return (
      <Slot class={className} {...handlers}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      data-slot="hover-card-trigger"
      class={className}
      aria-expanded={jsxClass<boolean>(() => api.open.value)}
      {...handlers}
    >
      {children}
    </button>
  );
}

type HoverCardContentProps = {
  children?: SinwanNode;
  class?: string;
  align?: Align;
  side?: Placement;
  sideOffset?: number;
};

function HoverCardContent({
  class: className,
  align = "center",
  sideOffset = 4,
  side,
  children,
}: HoverCardContentProps) {
  const api = inject(PopoverKey)!;
  return (
    <PopoverContentPrimitive
      align={align}
      side={side}
      sideOffset={sideOffset}
      onmouseenter={() => {
        api.cancelClose();
        api.setOpen(true);
      }}
      onmouseleave={() => {
        api.requestClose(120);
      }}
      class={cn(
        "z-50 w-64 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className,
      )}
    >
      {children}
    </PopoverContentPrimitive>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
