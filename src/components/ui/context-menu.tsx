import { cc, inject, onMounted, onUnmounted, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Check, ChevronRight } from "lucide";

import { Icon } from "../../icons";
import { Slot } from "../../lib/slot";
import { cn } from "../../lib/utils";
import { UiPortal, usePointPosition } from "../../primitives";
import { isDismissExemptPointerTarget } from "../../primitives/dismiss";

type ContextMenuApi = {
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
  point: Signal<{ x: number; y: number }>;
};

const ContextMenuKey: InjectionKey<ContextMenuApi> = Symbol(
  "sinwan-ui.context-menu",
);

type SubApi = {
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
};

const ContextSubKey: InjectionKey<SubApi> = Symbol("sinwan-ui.context-sub");

type ContextMenuProps = {
  children?: SinwanNode;
  onOpenChange?: (open: boolean) => void;
};

const ContextMenu = cc<ContextMenuProps>(({ children, onOpenChange }) => {
  const open = signal(false);
  provide(ContextMenuKey, {
    open,
    setOpen: (v: boolean) => {
      open.value = v;
      onOpenChange?.(v);
    },
    point: signal({ x: 0, y: 0 }),
  });
  return <>{children}</>;
});

type ContextMenuTriggerProps = {
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
};

function ContextMenuTrigger({
  children,
  class: className,
  asChild,
}: ContextMenuTriggerProps) {
  const api = inject(ContextMenuKey)!;
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    api.point.value = { x: e.clientX, y: e.clientY };
    api.setOpen(true);
  };
  if (asChild) {
    return (
      <Slot
        class={cn("select-none", className)}
        oncontextmenu={onContextMenu}
      >
        {children}
      </Slot>
    );
  }
  return (
    <div
      data-slot="context-menu-trigger"
      class={cn("select-none", className)}
      oncontextmenu={onContextMenu}
    >
      {children}
    </div>
  );
}

type ContextMenuPortalProps = {
  children?: SinwanNode;
};

function ContextMenuPortal({ children }: ContextMenuPortalProps) {
  return <UiPortal>{children}</UiPortal>;
}

type ContextMenuGroupProps = {
  children?: SinwanNode;
  class?: string;
};

function ContextMenuGroup({ children, class: className }: ContextMenuGroupProps) {
  return (
    <div data-slot="context-menu-group" role="group" class={className}>
      {children}
    </div>
  );
}

type ContextMenuContentProps = {
  children?: SinwanNode;
  class?: string;
};

function ContextMenuContent({
  class: className,
  children,
}: ContextMenuContentProps) {
  const api = inject(ContextMenuKey)!;
  const contentEl = signal<HTMLElement | null>(null);
  const { style, present, side } = usePointPosition({
    open: () => api.open.value,
    point: () => api.point.value,
    content: () => contentEl.value,
    fallbackSize: { width: 180, height: 200 },
  });

  onMounted(() => {
    function onDoc(e: MouseEvent) {
      if (!api.open.value) return;
      if (isDismissExemptPointerTarget(e.target)) return;
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
          data-slot="context-menu-content"
          data-open=""
          data-side={() => side.value}
          role="menu"
          class={cn(
            "z-50 max-h-96 min-w-36 overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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

type ContextMenuItemProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onclick?: (e: MouseEvent) => void;
};

function ContextMenuItem({
  class: className,
  inset,
  variant = "default",
  disabled,
  children,
  onclick,
}: ContextMenuItemProps) {
  const api = inject(ContextMenuKey)!;
  return (
    <button
      type="button"
      role="menuitem"
      data-slot="context-menu-item"
      data-inset={inset ? "" : undefined}
      data-variant={variant}
      disabled={disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onclick={(e: MouseEvent) => {
        onclick?.(e);
        if (!e.defaultPrevented) api.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

type ContextMenuCheckboxItemProps = {
  children?: SinwanNode;
  class?: string;
  checked?: boolean;
  inset?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

function ContextMenuCheckboxItem({
  class: className,
  children,
  checked = false,
  inset,
  disabled,
  onCheckedChange,
}: ContextMenuCheckboxItemProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      data-slot="context-menu-checkbox-item"
      data-inset={inset ? "" : undefined}
      disabled={disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onclick={() => {
        onCheckedChange?.(!checked);
      }}
    >
      <span class="pointer-events-none absolute right-2 flex items-center justify-center">
        <Show when={() => checked} fallback={null}>
          <Icon icon={Check} />
        </Show>
      </span>
      {children}
    </button>
  );
}

type RadioGroupApi = {
  value: Signal<string>;
  setValue: (value: string) => void;
};

const ContextRadioKey: InjectionKey<RadioGroupApi> = Symbol(
  "sinwan-ui.context-radio",
);

type ContextMenuRadioGroupProps = {
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const ContextMenuRadioGroup = cc<ContextMenuRadioGroupProps>(
  ({ children, value: valueProp, defaultValue = "", onValueChange }) => {
    const value = signal(valueProp ?? defaultValue);
    if (valueProp !== undefined) value.value = valueProp;
    provide(ContextRadioKey, {
      value,
      setValue: (v: string) => {
        value.value = v;
        onValueChange?.(v);
      },
    });
    return (
      <div data-slot="context-menu-radio-group" role="group">
        {children}
      </div>
    );
  },
);

type ContextMenuRadioItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
  inset?: boolean;
  disabled?: boolean;
};

function ContextMenuRadioItem({
  class: className,
  children,
  value,
  inset,
  disabled,
}: ContextMenuRadioItemProps) {
  const radio = inject(ContextRadioKey)!;
  const selected = () => radio.value.value === value;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={() => selected()}
      data-slot="context-menu-radio-item"
      data-inset={inset ? "" : undefined}
      disabled={disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onclick={() => {
        radio.setValue(value);
      }}
    >
      <span class="pointer-events-none absolute right-2 flex items-center justify-center">
        <Show when={() => selected()} fallback={null}>
          <Icon icon={Check} />
        </Show>
      </span>
      {children}
    </button>
  );
}

type ContextMenuLabelProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
};

function ContextMenuLabel({
  class: className,
  inset,
  children,
}: ContextMenuLabelProps) {
  return (
    <div
      data-slot="context-menu-label"
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

type ContextMenuSeparatorProps = {
  class?: string;
};

function ContextMenuSeparator({ class: className }: ContextMenuSeparatorProps) {
  return (
    <div
      data-slot="context-menu-separator"
      class={cn("-mx-1 my-1 h-px bg-border", className)}
    />
  );
}

type ContextMenuShortcutProps = {
  children?: SinwanNode;
  class?: string;
};

function ContextMenuShortcut({
  class: className,
  children,
}: ContextMenuShortcutProps) {
  return (
    <span
      data-slot="context-menu-shortcut"
      class={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

type ContextMenuSubProps = {
  children?: SinwanNode;
};

const ContextMenuSub = cc<ContextMenuSubProps>(({ children }) => {
  const open = signal(false);
  provide(ContextSubKey, {
    open,
    setOpen: (v: boolean) => {
      open.value = v;
    },
  });
  return (
    <div data-slot="context-menu-sub" class="relative">
      {children}
    </div>
  );
});

type ContextMenuSubTriggerProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
};

function ContextMenuSubTrigger({
  class: className,
  inset,
  children,
}: ContextMenuSubTriggerProps) {
  const api = inject(ContextSubKey)!;
  function openSub() {
    api.setOpen(true);
  }
  function toggleSub() {
    api.setOpen(!api.open.value);
  }
  function openAttr() {
    return api.open.value ? "" : undefined;
  }
  return (
    <button
      type="button"
      data-slot="context-menu-sub-trigger"
      data-inset={inset ? "" : undefined}
      data-open={openAttr}
      class={cn(
        "flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-open:bg-accent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onmouseenter={openSub}
      onclick={toggleSub}
    >
      {children}
      <Icon icon={ChevronRight} class="ml-auto" />
    </button>
  );
}

type ContextMenuSubContentProps = {
  children?: SinwanNode;
  class?: string;
};

function ContextMenuSubContent({
  class: className,
  children,
}: ContextMenuSubContentProps) {
  const api = inject(ContextSubKey)!;
  function closeSub() {
    api.setOpen(false);
  }
  return (
    <Show when={() => api.open.value} fallback={null}>
      <div
        data-slot="context-menu-sub-content"
        data-open=""
        class={cn(
          "absolute top-0 left-full z-50 ml-1 min-w-[96px] overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          className,
        )}
        onmouseleave={closeSub}
      >
        {children}
      </div>
    </Show>
  );
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
