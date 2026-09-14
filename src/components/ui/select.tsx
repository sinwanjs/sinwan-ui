import { cc, inject, onMounted, onUnmounted, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Check, ChevronDown, ChevronUp, type IconNode } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { createLiveState, type Live } from "../../lib/live-state";
import { Presence, UiPortal, useAnchorPosition } from "../../primitives";
import { isDismissExemptPointerTarget } from "../../primitives/dismiss";

type SelectApi = {
  open: Live<boolean>;
  setOpen: (value: boolean) => void;
  value: Live<string>;
  setValue: (value: string, label?: string) => void;
  label: Signal<string>;
  placeholder: string;
  triggerEl: Signal<HTMLElement | null>;
  contentEl: Signal<HTMLElement | null>;
  viewportEl: Signal<HTMLElement | null>;
  canScrollUp: Signal<boolean>;
  canScrollDown: Signal<boolean>;
};

const SELECT_SCROLL_PX = 8;

let selectAutoScrollFrame = 0;
let selectAutoScrollApi: SelectApi | null = null;
let selectAutoScrollDirection: 1 | -1 = 1;

function selectContentMinWidth(anchor: DOMRect): Record<string, string> {
  return { minWidth: `${anchor.width}px` };
}

function stopSelectAutoScroll(): void {
  if (selectAutoScrollFrame === 0) return;
  cancelAnimationFrame(selectAutoScrollFrame);
  selectAutoScrollFrame = 0;
}

function stepSelectAutoScroll(): void {
  const api = selectAutoScrollApi;
  const viewport = api?.viewportEl.value;
  if (!api || !viewport) {
    stopSelectAutoScroll();
    return;
  }
  viewport.scrollTop += selectAutoScrollDirection * SELECT_SCROLL_PX;
  selectAutoScrollFrame = requestAnimationFrame(stepSelectAutoScroll);
}

function endSelectAutoScroll(): void {
  stopSelectAutoScroll();
  window.removeEventListener("pointerup", endSelectAutoScroll);
  window.removeEventListener("pointercancel", endSelectAutoScroll);
}

function startSelectAutoScroll(api: SelectApi, direction: 1 | -1): void {
  stopSelectAutoScroll();
  selectAutoScrollApi = api;
  selectAutoScrollDirection = direction;
  selectAutoScrollFrame = requestAnimationFrame(stepSelectAutoScroll);
  window.addEventListener("pointerup", endSelectAutoScroll);
  window.addEventListener("pointercancel", endSelectAutoScroll);
}

function holdSelectScroll(
  event: PointerEvent,
  api: SelectApi,
  direction: 1 | -1,
): void {
  event.preventDefault();
  startSelectAutoScroll(api, direction);
}

function holdSelectScrollFromTarget(event: PointerEvent, api: SelectApi): void {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue;
    const slot = node.getAttribute("data-slot");
    const shown = node.getAttribute("data-state") === "visible";
    if (slot === "select-scroll-up-button") {
      if (shown) holdSelectScroll(event, api, -1);
      return;
    }
    if (slot === "select-scroll-down-button") {
      if (shown) holdSelectScroll(event, api, 1);
      return;
    }
  }
}

function syncSelectViewportScroll(api: SelectApi, viewport: HTMLElement | null): void {
  if (!viewport) {
    api.canScrollUp.value = false;
    api.canScrollDown.value = false;
    return;
  }
  const max = viewport.scrollHeight - viewport.clientHeight;
  api.canScrollUp.value = viewport.scrollTop > 1;
  api.canScrollDown.value = max > 1 && viewport.scrollTop < max - 1;
}

const SelectKey: InjectionKey<SelectApi> = Symbol("sinwan-ui.select");

type SelectProps = {
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
};

const Select = cc<SelectProps>((props) => {
  const { state: open, set: setOpenLocal } = createLiveState(
    "open" in props,
    props.defaultOpen ?? false,
    () => Boolean(props.open),
  );
  const { state: value, set: setValueLocal } = createLiveState(
    "value" in props,
    props.defaultValue ?? "",
    () => props.value ?? "",
  );
  const label = signal("");

  provide(SelectKey, {
    open,
    setOpen: (v: boolean) => {
      setOpenLocal(v);
      props.onOpenChange?.(v);
    },
    value,
    setValue: (v: string, text?: string) => {
      setValueLocal(v);
      if (text !== undefined) label.value = text;
      props.onValueChange?.(v);
      setOpenLocal(false);
      props.onOpenChange?.(false);
    },
    label,
    placeholder: props.placeholder ?? "",
    triggerEl: signal<HTMLElement | null>(null),
    contentEl: signal<HTMLElement | null>(null),
    viewportEl: signal<HTMLElement | null>(null),
    canScrollUp: signal(false),
    canScrollDown: signal(false),
  });

  return <>{props.children}</>;
});

type SelectGroupProps = {
  children?: SinwanNode;
  class?: string;
};

function SelectGroup({ class: className, children }: SelectGroupProps) {
  return (
    <div data-slot="select-group" class={cn("scroll-my-1 p-1", className)}>
      {children}
    </div>
  );
}

type SelectValueProps = {
  placeholder?: string;
  class?: string;
};

function SelectValue({ placeholder, class: className }: SelectValueProps) {
  const api = inject(SelectKey)!;
  return (
    <span
      data-slot="select-value"
      data-placeholder={() => (api.value.value ? undefined : "")}
      class={className}
    >
      {() => api.label.value || placeholder || api.placeholder || ""}
    </span>
  );
}

type SelectTriggerProps = {
  children?: SinwanNode;
  class?: string;
  size?: "sm" | "default";
};

function SelectTrigger({
  class: className,
  size = "default",
  children,
}: SelectTriggerProps) {
  const api = inject(SelectKey)!;
  return (
    <button
      type="button"
      data-slot="select-trigger"
      data-size={size}
      aria-expanded={() => api.open.value}
      class={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onclick={() => api.setOpen(!api.open.value)}
      ref={(el: HTMLElement | null) => {
        api.triggerEl.value = el;
      }}
    >
      {children}
      <Icon
        icon={ChevronDown}
        class="pointer-events-none size-4 text-muted-foreground"
      />
    </button>
  );
}

type SelectContentProps = {
  children?: SinwanNode;
  class?: string;
  position?: "item-aligned" | "popper";
  align?: "start" | "center" | "end";
};

const SelectContent = cc<SelectContentProps>((props) => {
  const className = props.class;
  const children = props.children;
  const position = props.position ?? "popper";
  const align = props.align ?? "center";
  const api = inject(SelectKey)!;
  let viewportNode: HTMLElement | null = null;
  let viewportObserver: ResizeObserver | null = null;
  const { style, side } = useAnchorPosition({
    open: () => api.open.value,
    trigger: () => api.triggerEl.value,
    content: () => api.contentEl.value,
    placement: "bottom",
    align,
    gap: 4,
    fallbackSize: { width: 144, height: 200 },
    extra: selectContentMinWidth,
  });
  function selectState() {
    return api.open.value ? "open" : "closed";
  }
  const onViewportScroll = () => {
    syncSelectViewportScroll(api, viewportNode);
  };
  const unbindViewport = () => {
    if (viewportNode) {
      viewportNode.removeEventListener("scroll", onViewportScroll);
    }
    viewportObserver?.disconnect();
    viewportObserver = null;
    viewportNode = null;
  };
  const bindViewport = (el: HTMLElement | null) => {
    unbindViewport();
    api.viewportEl.value = el;
    if (!el) {
      syncSelectViewportScroll(api, null);
      stepSelectAutoScroll();
      return;
    }
    viewportNode = el;
    el.addEventListener("scroll", onViewportScroll, { passive: true });
    viewportObserver = new ResizeObserver(onViewportScroll);
    viewportObserver.observe(el);
    const inner = el.firstElementChild;
    if (inner) viewportObserver.observe(inner);
    syncSelectViewportScroll(api, el);
    requestAnimationFrame(onViewportScroll);
  };
  function onContentPointerDown(event: PointerEvent) {
    holdSelectScrollFromTarget(event, api);
  }

  onMounted(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!api.open.value) return;
      const root = api.contentEl.value;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('[data-slot="select-item"]'),
      ).filter((el) => el.getAttribute("data-disabled") !== "true");
      if (items.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = items.findIndex((el) => el === active);
      if (e.key === "Escape") {
        e.preventDefault();
        api.setOpen(false);
        api.triggerEl.value?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = items[Math.min(idx + 1, items.length - 1)] ?? items[0]!;
        next.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = items[Math.max(idx - 1, 0)] ?? items[items.length - 1]!;
        prev.focus();
      } else if (e.key === "Enter" && active?.dataset.slot === "select-item") {
        e.preventDefault();
        active.click();
      }
    };

    const onDoc = (e: MouseEvent) => {
      if (!api.open.value) return;
      const t = e.target;
      if (
        (t instanceof Node && api.triggerEl.value?.contains(t)) ||
        (t instanceof Node && api.contentEl.value?.contains(t)) ||
        isDismissExemptPointerTarget(t)
      ) {
        return;
      }
      api.setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDoc);
    onUnmounted(() => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDoc);
      unbindViewport();
      stopSelectAutoScroll();
    });
  });

  return (
    <Presence
      // @ts-expect-error live open getter
      present={() => api.open.value}
    >
      <UiPortal>
        <div
          data-slot="select-content"
          data-state={selectState}
          data-side={() => side.value}
          data-align-trigger={position === "item-aligned" ? "" : undefined}
          role="listbox"
          class={cn(
            "relative z-50 isolate flex max-h-72 min-w-36 flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:!fill-mode-forwards",
            className,
          )}
          style={() => style.value as unknown as string}
          onpointerdown={onContentPointerDown}
          ref={(el: HTMLElement | null) => {
            api.contentEl.value = el;
          }}
        >
          <SelectScrollUpButton />
          <div
            data-slot="select-viewport"
            data-position={position}
            class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-1"
            ref={bindViewport}
          >
            <div>{children}</div>
          </div>
          <SelectScrollDownButton />
        </div>
      </UiPortal>
    </Presence>
  );
});

type SelectLabelProps = {
  children?: SinwanNode;
  class?: string;
};

function SelectLabel({ class: className, children }: SelectLabelProps) {
  return (
    <div
      data-slot="select-label"
      class={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
    >
      {children}
    </div>
  );
}

type SelectItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
  disabled?: boolean;
};

const SelectItem = cc(function SelectItem(props: SelectItemProps) {
  const api = inject(SelectKey)!;
  const selected = () => api.value.value === props.value;
  return (
    <button
      type="button"
      role="option"
      data-slot="select-item"
      data-disabled={() => (props.disabled ? "true" : undefined)}
      aria-selected={() => selected()}
      disabled={() => Boolean(props.disabled)}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.class,
      )}
      onclick={(e: MouseEvent) => {
        const text = (e.currentTarget as HTMLElement).innerText.trim();
        api.setValue(props.value, text);
      }}
    >
      <span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <Show when={() => selected()} fallback={null}>
          <Icon icon={Check} class="pointer-events-none" />
        </Show>
      </span>
      {props.children}
    </button>
  );
});

type SelectSeparatorProps = {
  class?: string;
};

function SelectSeparator({ class: className }: SelectSeparatorProps) {
  return (
    <div
      data-slot="select-separator"
      class={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
    />
  );
}

type SelectScrollButtonProps = {
  class?: string;
};

function SelectScrollButton(props: {
  class?: string;
  slot: "select-scroll-up-button" | "select-scroll-down-button";
  icon: IconNode;
  visible: Signal<boolean>;
}) {
  const className = props.class;
  const visible = props.visible;
  return (
    <div
      data-slot={props.slot}
      data-state={() => (visible.value ? "visible" : "hidden")}
      aria-hidden="true"
      class={cn(
        "absolute inset-x-0 z-10 flex cursor-default items-center justify-center py-1.5 opacity-0 pointer-events-none transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] data-[slot=select-scroll-up-button]:top-0 data-[slot=select-scroll-up-button]:bg-gradient-to-b data-[slot=select-scroll-up-button]:from-popover data-[slot=select-scroll-up-button]:to-transparent data-[slot=select-scroll-down-button]:bottom-0 data-[slot=select-scroll-down-button]:bg-gradient-to-t data-[slot=select-scroll-down-button]:from-popover data-[slot=select-scroll-down-button]:to-transparent data-[state=visible]:pointer-events-auto data-[state=visible]:opacity-100 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
    >
      <Icon icon={props.icon} />
    </div>
  );
}

function SelectScrollUpButton({ class: className }: SelectScrollButtonProps) {
  const api = inject(SelectKey)!;
  return (
    <SelectScrollButton
      class={className}
      slot="select-scroll-up-button"
      icon={ChevronUp}
      visible={api.canScrollUp}
    />
  );
}

function SelectScrollDownButton({
  class: className,
}: SelectScrollButtonProps) {
  const api = inject(SelectKey)!;
  return (
    <SelectScrollButton
      class={className}
      slot="select-scroll-down-button"
      icon={ChevronDown}
      visible={api.canScrollDown}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
