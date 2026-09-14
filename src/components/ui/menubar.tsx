import { cc, inject, onMounted, onUnmounted, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Check, ChevronRight } from "lucide";

import { Icon } from "../../icons";
import { createLiveState, type Live } from "../../lib/live-state";
import { cn } from "../../lib/utils";
import { Presence, UiPortal, useAnchorPosition, type Align } from "../../primitives";
import { isDismissExemptPointerTarget } from "../../primitives/dismiss";
import {
  createMenuSubApi,
  isInsideMenuSubContent,
  MenuSubContentLayer,
  type MenuSubApi,
} from "../../primitives/menu-sub";

type MenubarApi = {
  openMenu: Signal<string | null>;
  setOpenMenu: (id: string | null) => void;
};

const MenubarKey: InjectionKey<MenubarApi> = Symbol("sinwan-ui.menubar");

type MenuApi = {
  id: string;
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
  triggerEl: Signal<HTMLElement | null>;
};

const MenubarMenuKey: InjectionKey<MenuApi> = Symbol("sinwan-ui.menubar-menu");

const MenubarSubKey: InjectionKey<MenuSubApi> = Symbol("sinwan-ui.menubar-sub");

type MenubarProps = {
  children?: SinwanNode;
  class?: string;
};

const Menubar = cc<MenubarProps>(({ children, class: className }) => {
  const openMenu = signal<string | null>(null);
  provide(MenubarKey, {
    openMenu,
    setOpenMenu: (id: string | null) => {
      openMenu.value = id;
    },
  });
  return (
    <div
      data-slot="menubar"
      role="menubar"
      class={cn(
        "flex h-8 items-center gap-0.5 rounded-lg border p-[3px]",
        className,
      )}
    >
      {children}
    </div>
  );
});

let menuSeq = 0;

type MenubarMenuProps = {
  children?: SinwanNode;
};

const MenubarMenu = cc<MenubarMenuProps>(({ children }) => {
  const bar = inject(MenubarKey)!;
  const id = `menubar-menu-${++menuSeq}`;
  const open = signal(false);
  provide(MenubarMenuKey, {
    id,
    open,
    setOpen: (v: boolean) => {
      open.value = v;
      if (v) bar.setOpenMenu(id);
      else if (bar.openMenu.value === id) bar.setOpenMenu(null);
    },
    triggerEl: signal<HTMLElement | null>(null),
  });
  return <div data-slot="menubar-menu">{children}</div>;
});

type MenubarGroupProps = {
  children?: SinwanNode;
};

function MenubarGroup({ children }: MenubarGroupProps) {
  return (
    <div data-slot="menubar-group" role="group">
      {children}
    </div>
  );
}

type MenubarPortalProps = {
  children?: SinwanNode;
};

function MenubarPortal({ children }: MenubarPortalProps) {
  return <UiPortal>{children}</UiPortal>;
}

type RadioGroupApi = {
  value: Live<string>;
  setValue: (value: string) => void;
};

const MenubarRadioKey: InjectionKey<RadioGroupApi> = Symbol(
  "sinwan-ui.menubar-radio",
);

type MenubarRadioGroupProps = {
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const MenubarRadioGroup = cc<MenubarRadioGroupProps>((props) => {
  const { state: value, set } = createLiveState(
    "value" in props,
    props.defaultValue ?? "",
    () => props.value ?? "",
  );
  provide(MenubarRadioKey, {
    value,
    setValue: (v: string) => {
      set(v);
      props.onValueChange?.(v);
    },
  });
  return (
    <div data-slot="menubar-radio-group" role="group">
      {props.children}
    </div>
  );
});

type MenubarTriggerProps = {
  children?: SinwanNode;
  class?: string;
};

function MenubarTrigger({ class: className, children }: MenubarTriggerProps) {
  const menu = inject(MenubarMenuKey)!;
  const bar = inject(MenubarKey)!;
  return (
    <button
      type="button"
      data-slot="menubar-trigger"
      aria-expanded={() => menu.open.value}
      class={cn(
        "flex items-center rounded-sm px-1.5 py-[2px] text-sm font-medium outline-hidden select-none hover:bg-muted aria-expanded:bg-muted",
        className,
      )}
      onclick={() => menu.setOpen(!menu.open.value)}
      onmouseenter={() => {
        if (bar.openMenu.value) menu.setOpen(true);
      }}
      ref={(el: HTMLElement | null) => {
        menu.triggerEl.value = el;
      }}
    >
      {children}
    </button>
  );
}

type MenubarContentProps = {
  children?: SinwanNode;
  class?: string;
  align?: Align;
  sideOffset?: number;
};

function MenubarContent({
  class: className,
  align = "start",
  sideOffset = 8,
  children,
}: MenubarContentProps) {
  const menu = inject(MenubarMenuKey)!;
  const contentEl = signal<HTMLElement | null>(null);
  const { style, side } = useAnchorPosition({
    open: () => menu.open.value,
    trigger: () => menu.triggerEl.value,
    content: () => contentEl.value,
    placement: "bottom",
    align,
    gap: sideOffset,
    fallbackSize: { width: 180, height: 200 },
  });
  function menubarState() {
    return menu.open.value ? "open" : "closed";
  }

  onMounted(() => {
    function onDoc(e: MouseEvent) {
      if (!menu.open.value) return;
      const t = e.target;
      if (
        (t instanceof Node && menu.triggerEl.value?.contains(t)) ||
        isDismissExemptPointerTarget(t)
      ) {
        return;
      }
      menu.setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") menu.setOpen(false);
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
      present={() => menu.open.value}
    >
      <UiPortal>
        <div
          data-slot="menubar-content"
          data-state={menubarState}
          data-side={() => side.value}
          role="menu"
          class={cn(
            "z-50 min-w-36 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-200 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:!fill-mode-forwards",
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

type MenubarItemProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onclick?: (e: MouseEvent) => void;
};

function MenubarItem({
  class: className,
  inset,
  variant = "default",
  disabled,
  children,
  onclick,
}: MenubarItemProps) {
  const menu = inject(MenubarMenuKey)!;
  return (
    <button
      type="button"
      role="menuitem"
      data-slot="menubar-item"
      data-inset={inset ? "" : undefined}
      data-variant={variant}
      disabled={disabled}
      class={cn(
        "group/menubar-item relative flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onclick={(e: MouseEvent) => {
        onclick?.(e);
        if (e.defaultPrevented || isInsideMenuSubContent(e.currentTarget)) {
          return;
        }
        menu.setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

type MenubarCheckboxItemProps = {
  children?: SinwanNode;
  class?: string;
  checked?: boolean;
  inset?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const MenubarCheckboxItem = cc<MenubarCheckboxItemProps>((props) => {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={() => (props.checked ? "true" : "false")}
      data-slot="menubar-checkbox-item"
      data-inset={props.inset ? "" : undefined}
      disabled={props.disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
        props.class,
      )}
      onclick={() => {
        if (props.disabled) return;
        props.onCheckedChange?.(!Boolean(props.checked));
      }}
    >
      <span class="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <Show when={() => Boolean(props.checked)} fallback={null}>
          <Icon icon={Check} />
        </Show>
      </span>
      {props.children}
    </button>
  );
});

type MenubarRadioItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
  inset?: boolean;
  disabled?: boolean;
};

const MenubarRadioItem = cc<MenubarRadioItemProps>((props) => {
  const radio = inject(MenubarRadioKey)!;
  const selected = () => radio.value.value === props.value;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={() => (selected() ? "true" : "false")}
      data-slot="menubar-radio-item"
      data-inset={props.inset ? "" : undefined}
      disabled={props.disabled}
      class={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        props.class,
      )}
      onclick={() => {
        if (props.disabled) return;
        radio.setValue(props.value);
      }}
    >
      <span class="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        <Show when={() => selected()} fallback={null}>
          <Icon icon={Check} />
        </Show>
      </span>
      {props.children}
    </button>
  );
});

type MenubarLabelProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
};

function MenubarLabel({ class: className, inset, children }: MenubarLabelProps) {
  return (
    <div
      data-slot="menubar-label"
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

type MenubarSeparatorProps = {
  class?: string;
};

function MenubarSeparator({ class: className }: MenubarSeparatorProps) {
  return (
    <div
      data-slot="menubar-separator"
      class={cn("-mx-1 my-1 h-px bg-border", className)}
    />
  );
}

type MenubarShortcutProps = {
  children?: SinwanNode;
  class?: string;
};

function MenubarShortcut({ class: className, children }: MenubarShortcutProps) {
  return (
    <span
      data-slot="menubar-shortcut"
      class={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

type MenubarSubProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const MenubarSub = cc<MenubarSubProps>((props) => {
  provide(
    MenubarSubKey,
    createMenuSubApi({
      controlled: "open" in props,
      defaultOpen: props.defaultOpen,
      readOpen: () => Boolean(props.open),
      onOpenChange: props.onOpenChange,
    }),
  );
  return <div data-slot="menubar-sub">{props.children}</div>;
});

type MenubarSubTriggerProps = {
  children?: SinwanNode;
  class?: string;
  inset?: boolean;
};

function MenubarSubTrigger({
  class: className,
  inset,
  children,
}: MenubarSubTriggerProps) {
  const api = inject(MenubarSubKey)!;
  function openAttr() {
    return api.open.value ? "" : undefined;
  }
  return (
    <button
      type="button"
      data-slot="menubar-sub-trigger"
      data-inset={inset ? "" : undefined}
      data-open={openAttr}
      class={cn(
        "flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent data-inset:ps-7 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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

type MenubarSubContentProps = {
  children?: SinwanNode;
  class?: string;
};

function MenubarSubContent({
  class: className,
  children,
}: MenubarSubContentProps) {
  return (
    <MenuSubContentLayer
      api={inject(MenubarSubKey)!}
      slot="menubar-sub-content"
      class={className}
    >
      {children}
    </MenuSubContentLayer>
  );
}

export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
};
