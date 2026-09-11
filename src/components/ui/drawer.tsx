import type { SinwanNode } from "sinwan/component";

import { cn } from "../../lib/utils";
import {
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogOverlay as DialogOverlayPrimitive,
  DialogRoot,
  DialogTrigger as DialogTriggerPrimitive,
  UiPortal,
} from "../../primitives";

type DrawerDirection = "top" | "bottom" | "left" | "right";

type DrawerProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  direction?: DrawerDirection;
};

function Drawer({
  children,
  open,
  defaultOpen,
  onOpenChange,
  direction = "bottom",
}: DrawerProps) {
  return (
    <DialogRoot open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <div data-drawer-direction={direction} class="contents">
        {children}
      </div>
    </DialogRoot>
  );
}

type DrawerTriggerProps = {
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
};

function DrawerTrigger(props: DrawerTriggerProps) {
  return <DialogTriggerPrimitive {...props} />;
}

type DrawerPortalProps = {
  children?: SinwanNode;
};

function DrawerPortal({ children }: DrawerPortalProps) {
  return <UiPortal>{children}</UiPortal>;
}

type DrawerCloseProps = {
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
};

function DrawerClose(props: DrawerCloseProps) {
  return <DialogClosePrimitive {...props} />;
}

type DrawerOverlayProps = {
  class?: string;
};

function DrawerOverlay({ class: className }: DrawerOverlayProps) {
  return (
    <DialogOverlayPrimitive
      class={cn(
        "fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
    />
  );
}

type DrawerContentProps = {
  children?: SinwanNode;
  class?: string;
  direction?: DrawerDirection;
  showHandle?: boolean;
};

function DrawerContent({
  class: className,
  children,
  direction = "bottom",
  showHandle = true,
}: DrawerContentProps) {
  return (
    <>
      <DrawerOverlay />
      <DialogContentPrimitive
        data-slot="drawer-content"
        data-vaul-drawer-direction={direction}
        class={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-popover text-sm text-popover-foreground data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:rounded-l-xl data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-xl data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm",
          className,
        )}
      >
        {showHandle ? (
          <div class="mx-auto mt-4 hidden h-1 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        ) : null}
        {children}
      </DialogContentPrimitive>
    </>
  );
}

type DivProps = {
  children?: SinwanNode;
  class?: string;
};

function DrawerHeader({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="drawer-header"
      class={cn(
        "flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-0.5 md:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ class: className, ...props }: DivProps) {
  return (
    <div
      data-slot="drawer-footer"
      class={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({ class: className, children, ...props }: DivProps) {
  return (
    <h2
      data-slot="drawer-title"
      class={cn(
        "font-heading text-base font-medium text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

function DrawerDescription({
  class: className,
  children,
  ...props
}: DivProps) {
  return (
    <p
      data-slot="drawer-description"
      class={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
