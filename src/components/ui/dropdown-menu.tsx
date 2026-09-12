import { cc, inject, onMounted, onUnmounted, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Check, ChevronRight } from "lucide";

import { Icon } from "../../icons";
import { createLiveState, type Live } from "../../lib/live-state";
import { Slot } from "../../lib/slot";
import { cn } from "../../lib/utils";
import { UiPortal, useAnchorPosition, type Align } from "../../primitives";
import { isDismissExemptPointerTarget } from "../../primitives/dismiss";

type MenuApi = {
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
  triggerEl: Signal<HTMLElement | null>;
};

const DropdownMenuKey: InjectionKey<MenuApi> = Symbol("sinwan-ui.dropdown-menu");

type SubApi = {
  open: Live<boolean>;
  setOpen: (value: boolean) => void;
  triggerEl: Signal<HTMLElement | null>;
  cancelClose: () => void;
  requestClose: (delayMs?: number) => void;
};

const DropdownSubKey: InjectionKey<SubApi> = Symbol("sinwan-ui.dropdown-sub");

type DropdownMenuProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DropdownMenu = cc<DropdownMenuProps>(
  ({ children, open: openProp, defaultOpen = false, onOpenChange }) => {
    const open = signal(openProp ?? defaultOpen);
    if (openProp !== undefined) open.value = openProp;
    provide(DropdownMenuKey, {
      open,
      setOpen: (v: boolean) => {
        open.value = v;
        onOpenChange?.(v);
      },
      triggerEl: signal<HTMLElement | null>(null),
    });
    return <>{children}</>;
  },
);

type DropdownMenuPortalProps = {
  children?: SinwanNode;
};

function DropdownMenuPortal({ children }: DropdownMenuPortalProps) {
  return <UiPortal>{children}</UiPortal>;
}

type DropdownMenuTriggerProps = {
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
};

function DropdownMenuTrigger({
  children,
  class: className,
  asChild,
}: DropdownMenuTriggerProps) {
  const api = inject(DropdownMenuKey)!;
  const onClick = () => api.setOpen(!api.open.value);
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
      data-slot="dropdown-menu-trigger"
      class={className}
      aria-expanded={() => api.open.value}
      onclick={onClick}
      ref={ref}
    >
      {children}
    </button>
  );
}

type DropdownMenuContentProps = {
  children?: SinwanNode;
  class?: string;
  align?: Align;
  sideOffset?: number;
};

function DropdownMenuContent({
  class: className,
  align = "start",
  sideOffset = 4,
  children,
}: DropdownMenuContentProps) {
  const api = inject(DropdownMenuKey)!;
  const contentEl = signal<HTMLElement | null>(null);
  const { style, present, side } = useAnchorPosition({
    open: () => api.open.value,
    trigger: () => api.triggerEl.value,
    content: () => contentEl.value,
    placement: "bottom",
    align,
    gap: sideOffset,
    fallbackSize: { width: 180, height: 200 },
    extra: (anchor) => ({
      minWidth: `${Math.max(anchor.width, 128)}px`,
    }),
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
      if (e.key === "Escape") api.setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    onUnmounted(() => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    });
  });

  return (
    <Show when={() => present.value} fallback={null}>
      <UiPortal>
        <div
          data-slot="dropdown-menu-content"
          data-open=""
          data-side={() => side.value}
          role="menu"
          class={cn(
            "z-50 max-h-96 min-w-32 overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          style={() => style.value as unknown as string}
          ref={(el: HTMLElement | null) => {
            contentEl.value = el;
          }}
        >
          {children}
        </div>
      </UiPortal>
    </Show>
  );
}

type DropdownMenuGroupProps = {
  children?: SinwanNode;
  class?: string;
};

function DropdownMenuGroup({ children, class: className }: DropdownMenuGroupProps) {
  return (
    <div data-slot="dropdown-menu-group" role="group" class={className}>
      {children}
    </div>
  );
}

type DropdownMenuItemProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onclick?: (e: MouseEvent) => void;
};

function DropdownMenuItem({
  class: className,
  inset,
  variant = "default",
  disabled,
  children,
  onclick,
}: DropdownMenuItemProps) {
  const api = inject(DropdownMenuKey)!;
  return (
    <button
      type="button"
      role="menuitem"
      data-slot="dropdown-menu-item"
      data-inset={inset ? "" : undefined}
      data-variant={variant}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      class={cn(
        "group/dropdown-menu-item relative flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      onclick={(e: MouseEvent) => {
        onclick?.(e);
        if (e.defaultPrevented) return;
        const target = e.currentTarget;
        if (
          target instanceof Element &&
          target.closest("[data-slot$='-sub-content']") != null
        ) {
          return;
        }
        api.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

type DropdownMenuCheckboxItemProps = {
  children?: SinwanNode;
  class?: string;
  checked?: boolean;
  inset?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const DropdownMenuCheckboxItem = cc<DropdownMenuCheckboxItemProps>((props) => {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={() => (props.checked ? "true" : "false")}
      data-slot="dropdown-menu-checkbox-item"
      data-inset={props.inset ? "" : undefined}
      disabled={props.disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.class,
      )}
      onclick={() => {
        if (props.disabled) return;
        props.onCheckedChange?.(!Boolean(props.checked));
      }}
    >
      <span
        class="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <Show when={() => Boolean(props.checked)} fallback={null}>
          <Icon icon={Check} />
        </Show>
      </span>
      {props.children}
    </button>
  );
});

type RadioGroupApi = {
  value: Live<string>;
  setValue: (value: string) => void;
};

const DropdownRadioKey: InjectionKey<RadioGroupApi> = Symbol(
  "sinwan-ui.dropdown-radio",
);

type DropdownMenuRadioGroupProps = {
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const DropdownMenuRadioGroup = cc<DropdownMenuRadioGroupProps>((props) => {
  const { state: value, set } = createLiveState(
    "value" in props,
    props.defaultValue ?? "",
    () => props.value ?? "",
  );
  provide(DropdownRadioKey, {
    value,
    setValue: (v: string) => {
      set(v);
      props.onValueChange?.(v);
    },
  });
  return (
    <div data-slot="dropdown-menu-radio-group" role="group">
      {props.children}
    </div>
  );
});

type DropdownMenuRadioItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
  inset?: boolean;
  disabled?: boolean;
};

const DropdownMenuRadioItem = cc<DropdownMenuRadioItemProps>((props) => {
  const radio = inject(DropdownRadioKey)!;
  const selected = () => radio.value.value === props.value;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={() => (selected() ? "true" : "false")}
      data-slot="dropdown-menu-radio-item"
      data-inset={props.inset ? "" : undefined}
      disabled={props.disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.class,
      )}
      onclick={() => {
        if (props.disabled) return;
        radio.setValue(props.value);
      }}
    >
      <span
        class="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <Show when={() => selected()} fallback={null}>
          <Icon icon={Check} />
        </Show>
      </span>
      {props.children}
    </button>
  );
});

type DropdownMenuLabelProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
};

function DropdownMenuLabel({
  class: className,
  inset,
  children,
}: DropdownMenuLabelProps) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset ? "" : undefined}
      class={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className,
      )}
    >
      {children}
    </div>
  );
}

type DropdownMenuSeparatorProps = {
  class?: string;
};

function DropdownMenuSeparator({ class: className }: DropdownMenuSeparatorProps) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      class={cn("-mx-1 my-1 h-px bg-border", className)}
    />
  );
}

type DropdownMenuShortcutProps = {
  children?: SinwanNode;
  class?: string;
};

function DropdownMenuShortcut({
  class: className,
  children,
}: DropdownMenuShortcutProps) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      class={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

type DropdownMenuSubProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DropdownMenuSub = cc<DropdownMenuSubProps>((props) => {
  const { state: open, set } = createLiveState(
    "open" in props,
    props.defaultOpen ?? false,
    () => Boolean(props.open),
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
    props.onOpenChange?.(value);
  }
  function requestClose(delayMs = 100) {
    cancelClose();
    closeTimer = window.setTimeout(() => {
      closeTimer = undefined;
      setOpen(false);
    }, delayMs);
  }
  onUnmounted(cancelClose);
  provide(DropdownSubKey, {
    open,
    setOpen,
    triggerEl,
    cancelClose,
    requestClose,
  });
  return <div data-slot="dropdown-menu-sub">{props.children}</div>;
});

type DropdownMenuSubTriggerProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
};

function DropdownMenuSubTrigger({
  class: className,
  inset,
  children,
}: DropdownMenuSubTriggerProps) {
  const api = inject(DropdownSubKey)!;
  function openAttr() {
    return api.open.value ? "" : undefined;
  }
  return (
    <button
      type="button"
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset ? "" : undefined}
      data-open={openAttr}
      class={cn(
        "flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onmouseenter={() => {
        api.cancelClose();
        api.setOpen(true);
      }}
      onmouseleave={() => api.requestClose()}
      onclick={() => api.setOpen(!api.open.value)}
      ref={(el: HTMLElement | null) => {
        api.triggerEl.value = el;
      }}
    >
      {children}
      <Icon icon={ChevronRight} class="ml-auto" />
    </button>
  );
}

type DropdownMenuSubContentProps = {
  children?: SinwanNode;
  class?: string;
};

function DropdownMenuSubContent({
  class: className,
  children,
}: DropdownMenuSubContentProps) {
  const api = inject(DropdownSubKey)!;
  const contentEl = signal<HTMLElement | null>(null);
  const { style, present, side } = useAnchorPosition({
    open: () => api.open.value,
    trigger: () => api.triggerEl.value,
    content: () => contentEl.value,
    placement: "right",
    align: "start",
    gap: 4,
    fallbackSize: { width: 128, height: 120 },
  });
  return (
    <Show when={() => present.value} fallback={null}>
      <UiPortal>
        <div
          data-slot="dropdown-menu-sub-content"
          data-open=""
          data-side={() => side.value}
          class={cn(
            "z-50 min-w-[96px] overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
            className,
          )}
          style={() => style.value as unknown as string}
          onmouseenter={() => api.cancelClose()}
          onmouseleave={() => api.requestClose()}
          ref={(el: HTMLElement | null) => {
            contentEl.value = el;
          }}
        >
          {children}
        </div>
      </UiPortal>
    </Show>
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
