import {
  cc,
  getRawProps,
  inject,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import type { VariantProps } from "class-variance-authority";

import { toggleVariants } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { ToggleGroupItem as ToggleGroupItemPrimitive, ToggleGroupRoot } from "@/primitives";

type ToggleGroupStyle = VariantProps<typeof toggleVariants> & {
  spacing?: number;
  orientation?: "horizontal" | "vertical";
};

const ToggleGroupStyleKey: InjectionKey<ToggleGroupStyle> = Symbol(
  "sinwan-ui.toggle-group-style",
);

type ToggleGroupProps = ToggleGroupStyle & {
  children?: SinwanNode;
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (v: string | string[]) => void;
  class?: string;
};

const ToggleGroup = cc<ToggleGroupProps>((props) => {
  const {
    class: className,
    variant: _variant,
    size: _size,
    spacing: _spacing,
    orientation: _orientation,
    children,
    ...rest
  } = getRawProps(props);
  const variant = props.variant ?? "default";
  const size = props.size ?? "default";
  const spacing = props.spacing ?? 2;
  const orientation = props.orientation ?? "horizontal";
  provide(ToggleGroupStyleKey, { variant, size, spacing, orientation });
  return (
    <ToggleGroupRoot
      data-variant={variant ?? undefined}
      data-size={size ?? undefined}
      data-spacing={spacing}
      data-orientation={orientation}
      style={{ "--gap": String(spacing) }}
      class={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
        orientation === "vertical" && "flex-col items-stretch",
        size === "sm" && "rounded-[min(var(--radius-md),10px)]",
        className,
      )}
      {...rest}
    >
      {children}
    </ToggleGroupRoot>
  );
});

type ToggleGroupItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
  disabled?: boolean;
  variant?: VariantProps<typeof toggleVariants>["variant"];
  size?: VariantProps<typeof toggleVariants>["size"];
};

const ToggleGroupItem = cc<ToggleGroupItemProps>((props) => {
  const {
    class: className,
    children,
    variant = "default",
    size = "default",
    ...rest
  } = getRawProps(props);
  const context = inject(ToggleGroupStyleKey) ?? {
    variant: "default" as const,
    size: "default" as const,
    spacing: 2,
    orientation: "horizontal" as const,
  };
  const resolvedVariant = context.variant || variant;
  const resolvedSize = context.size || size;
  const spacing = context.spacing ?? 2;

  return (
    <ToggleGroupItemPrimitive
      data-variant={resolvedVariant ?? undefined}
      data-size={resolvedSize ?? undefined}
      data-spacing={spacing}
      class={cn(
        "shrink-0 focus:z-10 focus-visible:z-10",
        spacing === 0 &&
          "rounded-none px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 first:rounded-l-lg last:rounded-r-lg data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        context.orientation === "vertical" &&
          spacing === 0 &&
          "first:rounded-t-lg first:rounded-l-none last:rounded-b-lg last:rounded-r-none data-[variant=outline]:border-t-0 data-[variant=outline]:border-l data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: resolvedVariant,
          size: resolvedSize,
        }),
        className,
      )}
      {...rest}
    >
      {children}
    </ToggleGroupItemPrimitive>
  );
});

export { ToggleGroup, ToggleGroupItem };
