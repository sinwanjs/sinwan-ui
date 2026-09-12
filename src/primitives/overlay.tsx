import { cc, inject, onMounted, onUnmounted, provide, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, effect, resolve, type Signal } from "sinwan/reactivity";
import { Slot } from "../lib/slot";
import type { ReactiveProp } from "../lib/types";

import { Presence, UiPortal, useAnchorPosition, trapFocus, type Align, type Placement } from "./core";
import { isDismissExemptPointerTarget } from "./dismiss";

export type OpenApi = {
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
  triggerEl: Signal<HTMLElement | null>;
  requestClose: (delayMs?: number) => void;
  cancelClose: () => void;
  isHoverOpenBlocked: () => boolean;
  setPointerOverTrigger: (over: boolean) => void;
};

function createOpenState(
  openProp: ReactiveProp<boolean> | undefined,
  defaultOpen: boolean,
  onOpenChange?: (open: boolean) => void,
): OpenApi {
  const controlled = openProp !== undefined;
  const open = signal(controlled ? resolve(openProp) : defaultOpen);
  if (controlled) {
    const stop = effect(() => {
      const next = resolve(openProp);
      if (next !== open.value) open.value = next;
    });
    onUnmounted(stop);
  }
  let closeTimer: number | undefined;
  let pointerOverTrigger = false;
  let hoverOpenBlocked = false;

  function cancelClose() {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }

  function setOpen(value: boolean) {
    cancelClose();
    if (!value && pointerOverTrigger) hoverOpenBlocked = true;
    open.value = value;
    onOpenChange?.(value);
  }

  function requestClose(delayMs = 0) {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, delayMs);
  }

  function isHoverOpenBlocked() {
    return hoverOpenBlocked;
  }

  function setPointerOverTrigger(over: boolean) {
    pointerOverTrigger = over;
    if (!over) hoverOpenBlocked = false;
  }

  onUnmounted(cancelClose);

  return {
    open,
    setOpen,
    triggerEl: signal<HTMLElement | null>(null),
    requestClose,
    cancelClose,
    isHoverOpenBlocked,
    setPointerOverTrigger,
  };
}

// ─── Dialog ─────────────────────────────────────────────────

export const DialogKey: InjectionKey<OpenApi> = Symbol("sinwan-ui.dialog");

export type DialogRootProps = {
  children?: SinwanNode;
  open?: ReactiveProp<boolean>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const DialogRoot = cc<DialogRootProps>(
  ({ children, open: openProp, defaultOpen = false, onOpenChange }) => {
    const api = createOpenState(openProp, defaultOpen, onOpenChange);
    provide(DialogKey, api);
    return <>{children}</>;
  },
);

export const DialogTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(DialogKey)!;
  const onClick = () => {
    api.setOpen(true);
  };
  const ref = (el: HTMLElement | null) => {
    api.triggerEl.value = el;
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={onClick} ref={ref}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="dialog-trigger"
      onclick={onClick}
      ref={ref}
    >
      {children}
    </button>
  );
});

export const DialogClose = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(DialogKey)!;
  const onClick = () => {
    api.setOpen(false);
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={onClick}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="dialog-close"
      onclick={onClick}
    >
      {children}
    </button>
  );
});

export const DialogOverlay = cc<{ class?: string }>(({ class: className }) => {
  const api = inject(DialogKey)!;
  function isOpen() {
    return api.open.value;
  }
  function dismiss() {
    api.setOpen(false);
  }
  return (
    <Presence present={isOpen}>
      <UiPortal>
        <div
          data-slot="dialog-overlay"
          data-open=""
          class={className}
          onclick={dismiss}
        />
      </UiPortal>
    </Presence>
  );
});

export const DialogContent = cc<{
  children?: SinwanNode;
  class?: string;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
  "data-side"?: string;
  "data-size"?: string;
  "data-vaul-drawer-direction"?: string;
  "data-slot"?: string;
}>(({
  children,
  class: className,
  onEscapeKeyDown,
  "data-side": dataSide,
  "data-size": dataSize,
  "data-vaul-drawer-direction": dataDrawerDirection,
  "data-slot": dataSlot = "dialog-content",
}) => {
  const api = inject(DialogKey)!;
  let contentEl: HTMLElement | null = null;
  let previousFocus: HTMLElement | null = null;

  onMounted(() => {
    function onKey(e: KeyboardEvent) {
      if (!api.open.value) return;
      if (e.key === "Escape") {
        onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) api.setOpen(false);
      }
      if (contentEl) trapFocus(e, contentEl);
    }
    function cleanup() {
      document.removeEventListener("keydown", onKey);
    }
    document.addEventListener("keydown", onKey);
    onUnmounted(cleanup);
  });

  return (
    <Presence present={function presentOpen() {
      return api.open.value;
    }}>
      <UiPortal>
        <div
          role="dialog"
          aria-modal="true"
          data-slot={dataSlot}
          data-open=""
          data-side={dataSide}
          data-size={dataSize}
          data-vaul-drawer-direction={dataDrawerDirection}
          class={className}
          ref={function contentRef(el: HTMLElement | null) {
            contentEl = el;
            if (el) {
              previousFocus = document.activeElement as HTMLElement | null;
              el.focus?.();
            } else if (previousFocus) {
              previousFocus.focus?.();
            }
          }}
          tabIndex={-1}
          onclick={function stopBubble(e: MouseEvent) {
            e.stopPropagation();
          }}
        >
          {children}
        </div>
      </UiPortal>
    </Presence>
  );
});

// ─── Collapsible ────────────────────────────────────────────

export const CollapsibleKey: InjectionKey<{
  open: Signal<boolean>;
  setOpen: (v: boolean) => void;
}> = Symbol("sinwan-ui.collapsible");

export const CollapsibleRoot = cc<{
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  class?: string;
}>(({ children, open: openProp, defaultOpen = false, onOpenChange, class: className }) => {
  const open = signal(openProp ?? defaultOpen);
  if (openProp !== undefined) open.value = openProp;
  provide(CollapsibleKey, {
    open,
    setOpen: function setOpen(v: boolean) {
      open.value = v;
      onOpenChange?.(v);
    },
  });
  return (
    <div
      data-slot="collapsible"
      data-state={function stateAttr() {
        return open.value ? "open" : "closed";
      }}
      class={className}
    >
      {children}
    </div>
  );
});

export const CollapsibleTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(CollapsibleKey)!;
  const toggle = () => {
    api.setOpen(!api.open.value);
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={toggle}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="collapsible-trigger"
      aria-expanded={function expanded() {
        return api.open.value;
      }}
      onclick={toggle}
    >
      {children}
    </button>
  );
});

export const CollapsibleContent = cc<{
  children?: SinwanNode;
  class?: string;
}>(({ children, class: className }) => {
  const api = inject(CollapsibleKey)!;
  function isOpen() {
    return api.open.value;
  }
  function stateAttr() {
    return api.open.value ? "open" : "closed";
  }
  return (
    <Presence present={isOpen}>
      <div
        data-slot="collapsible-content"
        data-state={stateAttr}
        class={className}
      >
        {children}
      </div>
    </Presence>
  );
});

// ─── Popover / floating ─────────────────────────────────────

export const PopoverKey: InjectionKey<
  OpenApi & { placement: Placement; align: Align }
> = Symbol("sinwan-ui.popover");

export const PopoverRoot = cc<{
  children?: SinwanNode;
  open?: ReactiveProp<boolean>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  align?: Align;
}>(({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom",
  align = "center",
}) => {
  const api = createOpenState(openProp, defaultOpen, onOpenChange);
  provide(PopoverKey, { ...api, placement, align });
  return <>{children}</>;
});

export const PopoverTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(PopoverKey)!;
  function onClick() {
    api.setOpen(!api.open.value);
  }
  const ref = (el: HTMLElement | null) => {
    api.triggerEl.value = el;
  };
  if (asChild) {
    return (
      <Slot class={className} onclick={onClick} ref={ref}>
        {children}
      </Slot>
    );
  }
  return (
    <button
      type="button"
      class={className}
      data-slot="popover-trigger"
      aria-expanded={function expanded() {
        return api.open.value;
      }}
      onclick={onClick}
      ref={ref}
    >
      {children}
    </button>
  );
});

export const PopoverContent = cc<{
  children?: SinwanNode;
  class?: string;
  side?: Placement;
  align?: Align;
  sideOffset?: number;
  onmouseenter?: (event: MouseEvent) => void;
  onmouseleave?: (event: MouseEvent) => void;
}>(({
  children,
  class: className,
  side,
  align,
  sideOffset = 8,
  onmouseenter,
  onmouseleave,
}) => {
  const api = inject(PopoverKey)!;
  const contentEl = signal<HTMLElement | null>(null);
  const { style, present, side: resolvedSide } = useAnchorPosition({
    open: () => api.open.value,
    trigger: () => api.triggerEl.value,
    content: () => contentEl.value,
    placement: side ?? api.placement,
    align: align ?? api.align,
    gap: sideOffset,
    fallbackSize: { width: 240, height: 160 },
  });

  onMounted(() => {
    function onDoc(e: MouseEvent) {
      if (!api.open.value) return;
      const t = e.target;
      if (
        (t instanceof Node && api.triggerEl.value?.contains(t)) ||
        isDismissExemptPointerTarget(t)
      ) {
        return;
      }
      api.setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        api.setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    onUnmounted(() => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <Presence present={present}>
      <UiPortal>
        <div
          data-slot="popover-content"
          data-open=""
          data-side={() => resolvedSide.value}
          class={className}
          style={function styleValue() {
            return style.value as unknown as string;
          }}
          role="dialog"
          onmouseenter={onmouseenter}
          onmouseleave={onmouseleave}
          ref={(el: HTMLElement | null) => {
            contentEl.value = el;
          }}
        >
          {children}
        </div>
      </UiPortal>
    </Presence>
  );
});

// ─── Tooltip ────────────────────────────────────────────────

export const TooltipKey: InjectionKey<OpenApi> = Symbol("sinwan-ui.tooltip");

export const TooltipProvider = cc<{
  children?: SinwanNode;
  delayDuration?: number;
}>(({ children, delayDuration }) => {
  void delayDuration;
  return children ?? null;
});

export const TooltipRoot = cc<{
  children?: SinwanNode;
  open?: ReactiveProp<boolean>;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>(({ children, open: openProp, defaultOpen = false, onOpenChange }) => {
  const api = createOpenState(openProp, defaultOpen, onOpenChange);
  provide(TooltipKey, api);
  return <>{children}</>;
});

export const TooltipTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
}>(({ children, class: className, asChild }) => {
  const api = inject(TooltipKey)!;
  const show = () => {
    api.setOpen(true);
  };
  const hide = () => {
    api.setOpen(false);
  };
  const ref = (el: HTMLElement | null) => {
    api.triggerEl.value = el;
  };
  const handlers = {
    onmouseenter: show,
    onmouseleave: hide,
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
    <button type="button" class={className} data-slot="tooltip-trigger" {...handlers}>
      {children}
    </button>
  );
});

export const TooltipContent = cc<{
  children?: SinwanNode;
  class?: string;
  side?: Placement;
}>(({ children, class: className, side = "top" }) => {
  const api = inject(TooltipKey)!;
  const contentEl = signal<HTMLElement | null>(null);
  const { style, present, side: resolvedSide } = useAnchorPosition({
    open: () => api.open.value,
    trigger: () => api.triggerEl.value,
    content: () => contentEl.value,
    placement: side,
    align: "center",
    gap: 6,
    fallbackSize: { width: 120, height: 32 },
  });

  return (
    <Presence present={present}>
      <UiPortal>
        <div
          role="tooltip"
          data-slot="tooltip-content"
          data-side={() => resolvedSide.value}
          class={className}
          style={function styleValue() {
            return style.value as unknown as string;
          }}
          ref={(el: HTMLElement | null) => {
            contentEl.value = el;
          }}
        >
          {children}
        </div>
      </UiPortal>
    </Presence>
  );
});
