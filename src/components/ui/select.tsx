import { cc, inject, onMounted, onUnmounted, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Check, ChevronDown, ChevronUp } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Presence, UiPortal, useAnchorPosition } from "../../primitives";
import { isDismissExemptPointerTarget } from "../../primitives/dismiss";

type SelectApi = {
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
  value: Signal<string>;
  setValue: (value: string, label?: string) => void;
  label: Signal<string>;
  placeholder: string;
  triggerEl: Signal<HTMLElement | null>;
  contentEl: Signal<HTMLElement | null>;
};

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

const Select = cc<SelectProps>(
  ({
    children,
    value: valueProp,
    defaultValue = "",
    onValueChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    placeholder = "",
  }) => {
    const open = signal(openProp ?? defaultOpen);
    const value = signal(valueProp ?? defaultValue);
    const label = signal("");
    if (openProp !== undefined) open.value = openProp;
    if (valueProp !== undefined) value.value = valueProp;

    provide(SelectKey, {
      open,
      setOpen: (v: boolean) => {
        open.value = v;
        onOpenChange?.(v);
      },
      value,
      setValue: (v: string, text?: string) => {
        value.value = v;
        if (text !== undefined) label.value = text;
        onValueChange?.(v);
        open.value = false;
        onOpenChange?.(false);
      },
      label,
      placeholder,
      triggerEl: signal<HTMLElement | null>(null),
      contentEl: signal<HTMLElement | null>(null),
    });

    return <>{children}</>;
  },
);

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

function SelectContent({
  class: className,
  children,
  position = "popper",
  align = "center",
}: SelectContentProps) {
  const api = inject(SelectKey)!;
  const { style, present, side } = useAnchorPosition({
    open: () => api.open.value,
    trigger: () => api.triggerEl.value,
    content: () => api.contentEl.value,
    placement: "bottom",
    align,
    gap: 4,
    fallbackSize: { width: 144, height: 200 },
    extra: (anchor) => ({
      minWidth: `${anchor.width}px`,
    }),
  });

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
    });
  });

  return (
    <Presence present={present}>
      <UiPortal>
        <div
          data-slot="select-content"
          data-side={() => side.value}
          data-align-trigger={position === "item-aligned" ? "" : undefined}
          role="listbox"
          class={cn(
            "relative z-50 max-h-72 min-w-36 overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className,
          )}
          style={() => style.value as unknown as string}
          ref={(el: HTMLElement | null) => {
            api.contentEl.value = el;
          }}
        >
          <SelectScrollUpButton />
          <div data-position={position} class="p-1">
            {children}
          </div>
          <SelectScrollDownButton />
        </div>
      </UiPortal>
    </Presence>
  );
}

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

function SelectItem({
  class: className,
  children,
  value,
  disabled,
}: SelectItemProps) {
  const api = inject(SelectKey)!;
  const selected = () => api.value.value === value;
  return (
    <button
      type="button"
      role="option"
      data-slot="select-item"
      data-disabled={disabled ? "true" : undefined}
      aria-selected={() => selected()}
      disabled={disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onclick={(e: MouseEvent) => {
        const text = (e.currentTarget as HTMLElement).innerText.trim();
        api.setValue(value, text);
      }}
    >
      <span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <Show when={() => selected()} fallback={null}>
          <Icon icon={Check} class="pointer-events-none" />
        </Show>
      </span>
      {children}
    </button>
  );
}

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

function SelectScrollUpButton({ class: className }: SelectScrollButtonProps) {
  return (
    <div
      data-slot="select-scroll-up-button"
      class={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
    >
      <Icon icon={ChevronUp} />
    </div>
  );
}

function SelectScrollDownButton({
  class: className,
}: SelectScrollButtonProps) {
  return (
    <div
      data-slot="select-scroll-down-button"
      class={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
    >
      <Icon icon={ChevronDown} />
    </div>
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
