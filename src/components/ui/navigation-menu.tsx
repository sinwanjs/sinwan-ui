import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  Show,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { effect, signal, type Signal } from "sinwan/reactivity";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Presence } from "../../primitives";
import { isDismissExemptPointerTarget } from "../../primitives/dismiss";
import { DirectionKey } from "../../theme/direction";

type NavMenuApi = {
  openItem: Signal<string | null>;
  pinned: Signal<boolean>;
  setOpenItem: (id: string | null, pin?: boolean) => void;
  closeAll: () => void;
  viewport: boolean;
};

const NavMenuKey: InjectionKey<NavMenuApi> = Symbol("sinwan-ui.navigation-menu");

type NavItemApi = {
  id: string;
  open: Signal<boolean>;
  setOpen: (value: boolean, pin?: boolean) => void;
};

const NavItemKey: InjectionKey<NavItemApi> = Symbol(
  "sinwan-ui.navigation-menu-item",
);

type NavigationMenuProps = {
  children?: SinwanNode;
  class?: string;
  viewport?: boolean;
};

let navItemSeq = 0;

const NavigationMenu = cc<NavigationMenuProps>(
  ({ children, class: className, viewport = false }) => {
    const openItem = signal<string | null>(null);
    const pinned = signal(false);
    const direction = inject(DirectionKey, undefined);
    let navEl: HTMLElement | null = null;

    function setOpenItem(id: string | null, pin = false) {
      openItem.value = id;
      if (id == null) {
        pinned.value = false;
        return;
      }
      if (pin) pinned.value = true;
    }

    function closeAll() {
      setOpenItem(null);
    }

    provide(NavMenuKey, {
      openItem,
      pinned,
      setOpenItem,
      closeAll,
      viewport,
    });

    onMounted(() => {
      function onDoc(e: PointerEvent) {
        if (openItem.value == null) return;
        const t = e.target;
        if (t instanceof Node && navEl?.contains(t)) return;
        if (isDismissExemptPointerTarget(t)) return;
        closeAll();
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") closeAll();
      }
      document.addEventListener("pointerdown", onDoc);
      document.addEventListener("keydown", onKey);
      onUnmounted(() => {
        document.removeEventListener("pointerdown", onDoc);
        document.removeEventListener("keydown", onKey);
      });
    });

    return (
      <nav
        ref={(el: HTMLElement | null) => {
          navEl = el;
        }}
        data-slot="navigation-menu"
        data-viewport={viewport ? "true" : "false"}
        data-pinned={() => (pinned.value ? "" : undefined)}
        dir={() => direction?.dir.value ?? "ltr"}
        class={cn(
          "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
          className,
        )}
      >
        {children}
        {viewport ? <NavigationMenuViewport /> : null}
      </nav>
    );
  },
);

type NavigationMenuListProps = {
  children?: SinwanNode;
  class?: string;
};

function NavigationMenuList({
  class: className,
  children,
}: NavigationMenuListProps) {
  return (
    <ul
      data-slot="navigation-menu-list"
      class={cn(
        "group flex flex-1 list-none items-center justify-center gap-0",
        className,
      )}
    >
      {children}
    </ul>
  );
}

type NavigationMenuItemProps = {
  children?: SinwanNode;
  class?: string;
  value?: string;
};

const NAV_ITEM_CLOSE_MS = 120;

const NavigationMenuItem = cc<NavigationMenuItemProps>(
  ({ children, class: className, value }) => {
    const root = inject(NavMenuKey)!;
    const id = value ?? `nav-item-${++navItemSeq}`;
    const open = signal(false);
    let closeTimer: number | undefined;
    function cancelClose() {
      if (closeTimer !== undefined) {
        window.clearTimeout(closeTimer);
        closeTimer = undefined;
      }
    }
    function setOpen(next: boolean, pin = false) {
      cancelClose();
      open.value = next;
      if (next) root.setOpenItem(id, pin);
      else if (root.openItem.value === id) root.setOpenItem(null);
    }
    function requestClose() {
      if (root.pinned.value) return;
      cancelClose();
      closeTimer = window.setTimeout(() => {
        closeTimer = undefined;
        setOpen(false);
      }, NAV_ITEM_CLOSE_MS);
    }
    effect(() => {
      const current = root.openItem.value;
      if (current !== id && open.value) {
        cancelClose();
        open.value = false;
      }
    });
    onUnmounted(cancelClose);
    provide(NavItemKey, {
      id,
      open,
      setOpen,
    });
    return (
      <li
        data-slot="navigation-menu-item"
        class={cn("relative", className)}
        onmouseenter={cancelClose}
        onmouseleave={requestClose}
      >
        {children}
      </li>
    );
  },
);

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-muted/50 data-popup-open:hover:bg-muted data-open:bg-muted/50 data-open:hover:bg-muted data-open:focus:bg-muted",
);

type NavigationMenuTriggerProps = {
  children?: SinwanNode;
  class?: string;
};

function NavigationMenuTrigger({
  class: className,
  children,
}: NavigationMenuTriggerProps) {
  const item = inject(NavItemKey)!;
  const root = inject(NavMenuKey)!;
  function onClick() {
    const pinnedHere =
      item.open.value &&
      root.pinned.value &&
      root.openItem.value === item.id;
    if (pinnedHere) item.setOpen(false);
    else item.setOpen(true, true);
  }
  return (
    <button
      type="button"
      data-slot="navigation-menu-trigger"
      data-open={() => (item.open.value ? "" : undefined)}
      aria-expanded={() => item.open.value}
      class={cn(navigationMenuTriggerStyle(), "group", className)}
      onclick={onClick}
      onmouseenter={() => item.setOpen(true)}
    >
      {children}{" "}
      <Icon
        icon={ChevronDown}
        class="relative top-px ms-1 size-3 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180"
        aria-hidden="true"
      />
    </button>
  );
}

type NavigationMenuContentProps = {
  children?: SinwanNode;
  class?: string;
};

function NavigationMenuContent({
  class: className,
  children,
}: NavigationMenuContentProps) {
  const item = inject(NavItemKey)!;
  const root = inject(NavMenuKey)!;
  const detached = !root.viewport;
  return (
    <Presence
      // @ts-expect-error live open getter
      present={() => item.open.value}
    >
      <div
        data-slot="navigation-menu-content"
        data-state={() => (item.open.value ? "open" : "closed")}
        style="inset-inline-start:0;inset-inline-end:auto"
        class={cn(
          "top-0 start-0 w-full text-start ease-[cubic-bezier(0.22,1,0.36,1)] md:absolute md:w-auto",
          detached &&
            "absolute top-full pt-3 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:!fill-mode-forwards",
          className,
        )}
      >
        <div
          data-slot="navigation-menu-content-panel"
          class="overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow ring-1 ring-foreground/10 duration-200"
        >
          {children}
        </div>
      </div>
    </Presence>
  );
}

type NavigationMenuViewportProps = {
  class?: string;
};

function NavigationMenuViewport({ class: className }: NavigationMenuViewportProps) {
  const root = inject(NavMenuKey)!;
  return (
    <div
      class="absolute top-full start-0 isolate z-50 flex justify-center"
      style="inset-inline-start:0;inset-inline-end:auto"
    >
      <div
        data-slot="navigation-menu-viewport"
        data-state={() =>
          root.openItem.value ? "open" : "closed"
        }
        class={cn(
          "origin-top-center relative mt-1.5 w-full overflow-hidden rounded-lg bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 duration-200 md:w-auto data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:!fill-mode-forwards",
          className,
        )}
      />
    </div>
  );
}

type NavigationMenuLinkProps = {
  children?: SinwanNode;
  class?: string;
  href?: string;
  active?: boolean;
  onclick?: (e: MouseEvent) => void;
};

function NavigationMenuLink({
  class: className,
  children,
  href,
  active,
  onclick,
}: NavigationMenuLinkProps) {
  const shared = {
    "data-slot": "navigation-menu-link",
    "data-active": active ? "" : undefined,
    class: cn(
      "flex items-center gap-2 rounded-lg p-2 text-start text-sm transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
      className,
    ),
    onclick,
  };
  if (href) {
    return (
      <a href={href} {...shared}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" {...shared}>
      {children}
    </button>
  );
}

type NavigationMenuIndicatorProps = {
  class?: string;
};

function NavigationMenuIndicator({
  class: className,
}: NavigationMenuIndicatorProps) {
  const root = inject(NavMenuKey)!;
  return (
    <Show when={() => root.openItem.value !== null} fallback={null}>
      <div
        data-slot="navigation-menu-indicator"
        data-state="visible"
        class={cn(
          "top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=visible]:fade-in",
          className,
        )}
      >
        <div class="relative top-[60%] h-2 w-2 rotate-45 rounded-ss-sm bg-border shadow-md" />
      </div>
    </Show>
  );
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
};
