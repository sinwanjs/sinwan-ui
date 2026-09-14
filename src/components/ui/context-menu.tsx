import { cc, inject, onMounted, onUnmounted, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Check, ChevronRight } from "lucide";

import { Icon } from "../../icons";
import { createLiveState, type Live } from "../../lib/live-state";
import { Slot } from "../../lib/slot";
import { cn } from "../../lib/utils";
import { Presence, UiPortal, usePointPosition } from "../../primitives";
import { isDismissExemptPointerTarget } from "../../primitives/dismiss";
import {
  createMenuSubApi,
  isInsideMenuSubContent,
  MenuSubContentLayer,
  type MenuSubApi,
} from "../../primitives/menu-sub";

type ContextMenuApi = {
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
  point: Signal<{ x: number; y: number }>;
};

const ContextMenuKey: InjectionKey<ContextMenuApi> = Symbol(
  "sinwan-ui.context-menu",
);

const ContextSubKey: InjectionKey<MenuSubApi> = Symbol("sinwan-ui.context-sub");

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
  const { style, side } = usePointPosition({
    open: () => api.open.value,
    point: () => api.point.value,
    content: () => contentEl.value,
    fallbackSize: { width: 180, height: 200 },
  });
  function contextState() {
    return api.open.value ? "open" : "closed";
  }

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
    <Presence
      // @ts-expect-error live open getter
      present={() => api.open.value}
    >
      <UiPortal>
        <div
          data-slot="context-menu-content"
          data-state={contextState}
          data-side={() => side.value}
          role="menu"
          class={cn(
            "z-50 max-h-96 min-w-36 overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:!fill-mode-forwards",
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
    </Presence>
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
        if (e.defaultPrevented || isInsideMenuSubContent(e.currentTarget)) {
          return;
        }
        api.setOpen(false);
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

const ContextMenuCheckboxItem = cc<ContextMenuCheckboxItemProps>((props) => {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={() => (props.checked ? "true" : "false")}
      data-slot="context-menu-checkbox-item"
      data-inset={props.inset ? "" : undefined}
      disabled={props.disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pe-8 ps-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:ps-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.class,
      )}
      onclick={() => {
        if (props.disabled) return;
        props.onCheckedChange?.(!Boolean(props.checked));
      }}
    >
      <span
        class="pointer-events-none absolute end-2 flex items-center justify-center"
        data-slot="context-menu-checkbox-item-indicator"
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

const ContextRadioKey: InjectionKey<RadioGroupApi> = Symbol(
  "sinwan-ui.context-radio",
);

type ContextMenuRadioGroupProps = {
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const ContextMenuRadioGroup = cc<ContextMenuRadioGroupProps>((props) => {
  const { state: value, set } = createLiveState(
    "value" in props,
    props.defaultValue ?? "",
    () => props.value ?? "",
  );
  provide(ContextRadioKey, {
    value,
    setValue: (v: string) => {
      set(v);
      props.onValueChange?.(v);
    },
  });
  return (
    <div data-slot="context-menu-radio-group" role="group">
      {props.children}
    </div>
  );
});

type ContextMenuRadioItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
  inset?: boolean;
  disabled?: boolean;
};

const ContextMenuRadioItem = cc<ContextMenuRadioItemProps>((props) => {
  const radio = inject(ContextRadioKey)!;
  const selected = () => radio.value.value === props.value;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={() => (selected() ? "true" : "false")}
      data-slot="context-menu-radio-item"
      data-inset={props.inset ? "" : undefined}
      disabled={props.disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pe-8 ps-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:ps-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.class,
      )}
      onclick={() => {
        if (props.disabled) return;
        radio.setValue(props.value);
      }}
    >
      <span
        class="pointer-events-none absolute end-2 flex items-center justify-center"
        data-slot="context-menu-radio-item-indicator"
      >
        <Show when={() => selected()} fallback={null}>
          <Icon icon={Check} />
        </Show>
      </span>
      {props.children}
    </button>
  );
});

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
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const ContextMenuSub = cc<ContextMenuSubProps>((props) => {
  provide(
    ContextSubKey,
    createMenuSubApi({
      controlled: "open" in props,
      defaultOpen: props.defaultOpen,
      readOpen: () => Boolean(props.open),
      onOpenChange: props.onOpenChange,
    }),
  );
  return <div data-slot="context-menu-sub">{props.children}</div>;
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
        "flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:ps-7 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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
      <Icon icon={ChevronRight} class="ms-auto rtl:rotate-180" />
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
  return (
    <MenuSubContentLayer
      api={inject(ContextSubKey)!}
      slot="context-menu-sub-content"
      class={className}
    >
      {children}
    </MenuSubContentLayer>
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
