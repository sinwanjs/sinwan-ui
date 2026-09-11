import { cva, type VariantProps } from "class-variance-authority";
import type { SinwanNode } from "sinwan/component";

import { Slot } from "../../lib/slot";
import { cn } from "../../lib/utils";

import { Spinner } from "./spinner";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 enabled-only:active:not-aria-[haspopup]:translate-y-px disabled:disabled aria-disabled:disabled aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground enabled-only:hover:bg-primary/80",
        outline:
          "border-border bg-background enabled-only:hover:bg-muted enabled-only:hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:enabled-only:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground enabled-only:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "enabled-only:hover:bg-muted enabled-only:hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:enabled-only:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive enabled-only:hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:enabled-only:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 enabled-only:hover:underline",
        gradient:
          "bg-gradient-brand text-white enabled-only:hover:brightness-95",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = JSX.IntrinsicElements["button"] &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    isLoading?: boolean;
    children?: SinwanNode;
  };

// `pointer-events: none` blocks the mouse, but a focused anchor still activates
// on Enter, so a disabled `asChild` button needs the handler stopped too.
const preventClick = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};

function Button({
  class: className,
  variant = "default",
  size = "default",
  asChild = false,
  isLoading = false,
  disabled,
  onclick,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);

  const shared = {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    class: cn(buttonVariants({ variant, size, className })),
    // `disabled` only exists on form controls: with `asChild` the child is
    // usually an anchor, where it does nothing and `:disabled` never matches.
    // `aria-disabled` carries both the styling and the semantics either way.
    "aria-disabled": isDisabled || undefined,
    "aria-busy": isLoading || undefined,
    onclick: isDisabled ? preventClick : onclick,
    ...props,
  };

  if (asChild) {
    return <Slot {...shared}>{children}</Slot>;
  }

  return (
    <button {...shared} disabled={isDisabled}>
      {isLoading ? (
        <>
          <Spinner />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
