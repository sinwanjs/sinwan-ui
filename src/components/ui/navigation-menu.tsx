import { cc, inject, provide, type InjectionKey, type SinwanNode } from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { cva } from "class-variance-authority";
import { ChevronDown } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Presence } from "../../primitives";

type NavMenuApi = {
  openItem: Signal<string | null>;
  setOpenItem: (id: string | null) => void;
  viewport: boolean;
};

const NavMenuKey: InjectionKey<NavMenuApi> = Symbol("sinwan-ui.navigation-menu");

type NavItemApi = {
  id: string;
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
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
    provide(NavMenuKey, {
      openItem,
      setOpenItem: (id: string | null) => {
        openItem.value = id;
      },
      viewport,
    });
    return (
      <nav
        data-slot="navigation-menu"
        data-viewport={viewport ? "true" : "false"}
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

const NavigationMenuItem = cc<NavigationMenuItemProps>(
  ({ children, class: className, value }) => {
    const root = inject(NavMenuKey)!;
    const id = value ?? `nav-item-${++navItemSeq}`;
    const open = signal(false);
    provide(NavItemKey, {
      id,
      open,
      setOpen: (v: boolean) => {
        open.value = v;
        if (v) root.setOpenItem(id);
        else if (root.openItem.value === id) root.setOpenItem(null);
      },
    });
    return (
      <li
        data-slot="navigation-menu-item"
        class={cn("relative", className)}
        onmouseleave={() => {
          open.value = false;
          if (root.openItem.value === id) root.setOpenItem(null);
        }}
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
  return (
    <button
      type="button"
      data-slot="navigation-menu-trigger"
      data-open={() => (item.open.value ? "" : undefined)}
      aria-expanded={() => item.open.value}
      class={cn(navigationMenuTriggerStyle(), "group", className)}
      onclick={() => item.setOpen(!item.open.value)}
      onmouseenter={() => item.setOpen(true)}
    >
      {children}{" "}
      <Icon
        icon={ChevronDown}
        class="relative top-px ml-1 size-3 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180"
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
  return (
    <Presence present={() => item.open.value}>
      <div
        data-slot="navigation-menu-content"
        data-state={() => (item.open.value ? "open" : "closed")}
        class={cn(
          "top-0 left-0 w-full p-1 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-lg group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:ring-1 group-data-[viewport=false]/navigation-menu:ring-foreground/10 group-data-[viewport=false]/navigation-menu:duration-300 md:absolute md:w-auto group-data-[viewport=false]/navigation-menu:data-open:animate-in group-data-[viewport=false]/navigation-menu:data-open:fade-in-0 group-data-[viewport=false]/navigation-menu:data-open:zoom-in-95",
          !root.viewport && "absolute top-full mt-1.5",
          className,
        )}
      >
        {children}
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
    <div class="absolute top-full left-0 isolate z-50 flex justify-center">
      <div
        data-slot="navigation-menu-viewport"
        data-state={() =>
          root.openItem.value ? "open" : "closed"
        }
        class={cn(
          "origin-top-center relative mt-1.5 w-full overflow-hidden rounded-lg bg-popover text-popover-foreground shadow ring-1 ring-foreground/10 duration-100 md:w-auto data-open:animate-in data-open:zoom-in-90 data-closed:animate-out data-closed:zoom-out-90",
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
      "flex items-center gap-2 rounded-lg p-2 text-sm transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-muted/50 data-active:hover:bg-muted data-active:focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
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
    <Presence present={() => root.openItem.value !== null}>
      <div
        data-slot="navigation-menu-indicator"
        data-state="visible"
        class={cn(
          "top-full z-1 flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=visible]:fade-in",
          className,
        )}
      >
        <div class="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
      </div>
    </Presence>
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
