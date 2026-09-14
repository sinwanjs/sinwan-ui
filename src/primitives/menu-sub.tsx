import { onUnmounted, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";

import { createLiveState, type Live } from "../lib/live-state";
import { cn } from "../lib/utils";
import { Presence, UiPortal } from "./core";
import { useAnchorPosition } from "./floating";

export type MenuSubApi = {
  open: Live<boolean>;
  setOpen: (value: boolean) => void;
  triggerEl: Signal<HTMLElement | null>;
  cancelClose: () => void;
  requestClose: (delayMs?: number) => void;
};

export function createMenuSubApi(options: {
  controlled: boolean;
  defaultOpen?: boolean;
  readOpen: () => boolean;
  onOpenChange?: (open: boolean) => void;
}): MenuSubApi {
  const { state: open, set } = createLiveState(
    options.controlled,
    options.defaultOpen ?? false,
    options.readOpen,
  );
  const triggerEl = signal<HTMLElement | null>(null);
  let closeTimer: number | undefined;
  function cancelClose() {
    if (closeTimer !== undefined) {
      window.clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }
  function setOpen(value: boolean) {
    cancelClose();
    set(value);
    options.onOpenChange?.(value);
  }
  function requestClose(delayMs = 100) {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, delayMs);
  }
  onUnmounted(cancelClose);
  return {
    open,
    setOpen,
    triggerEl,
    cancelClose,
    requestClose,
  };
}

export function isInsideMenuSubContent(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("[data-slot$='-sub-content']") != null
  );
}

export type MenuSubContentLayerProps = {
  api: MenuSubApi;
  slot: string;
  class?: string;
  children?: SinwanNode;
};

export function MenuSubContentLayer(props: MenuSubContentLayerProps) {
  const contentEl = signal<HTMLElement | null>(null);
  const { style, side } = useAnchorPosition({
    open: () => props.api.open.value,
    trigger: () => props.api.triggerEl.value,
    content: () => contentEl.value,
    placement: "right",
    align: "start",
    gap: 4,
    fallbackSize: { width: 128, height: 120 },
  });
  function subState() {
    return props.api.open.value ? "open" : "closed";
  }
  return (
    <Presence
      // @ts-expect-error live open getter
      present={() => props.api.open.value}
    >
      <UiPortal>
        <div
          data-slot={props.slot}
          data-state={subState}
          data-side={() => side.value}
          class={cn(
            "z-50 min-w-[96px] overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:!fill-mode-forwards",
            props.class,
          )}
          style={() => style.value as unknown as string}
          onmouseenter={() => props.api.cancelClose()}
          onmouseleave={() => props.api.requestClose()}
          ref={(el: HTMLElement | null) => {
            contentEl.value = el;
          }}
        >
          {props.children}
        </div>
      </UiPortal>
    </Presence>
  );
}
