import {
  cc,
  inject,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { For, Show } from "sinwan/component";
import { effect, resolve, signal, type Signal } from "sinwan/reactivity";
import { Slot } from "../lib/slot";
import type { ReactiveProp } from "../lib/types";
import { jsxClass } from "../lib/utils";

function sameStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function toValueList(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : v ? [v] : [];
}

function createReactiveState<T>(
  valueProp: ReactiveProp<T> | undefined,
  defaultValue: T,
  same: (a: T, b: T) => boolean = Object.is,
): Signal<T> {
  const controlled = valueProp !== undefined;
  const state = signal(controlled ? resolve(valueProp) : defaultValue);
  if (controlled) {
    const stop = effect(() => {
      const next = resolve(valueProp);
      if (!same(next, state.value)) {
        state.value = next;
      }
    });
    onUnmounted(stop);
  }
  return state;
}

// ─── Tabs ───────────────────────────────────────────────────

export const TabsKey: InjectionKey<{
  value: Signal<string>;
  setValue: (v: string) => void;
}> = Symbol("sinwan-ui.tabs");

export const TabsRoot = cc<{
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  class?: string;
  orientation?: "horizontal" | "vertical";
}>(({
  children,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  class: className,
  orientation = "horizontal",
}) => {
  const value = signal(valueProp ?? defaultValue);
  if (valueProp !== undefined) value.value = valueProp;
  provide(TabsKey, {
    value,
    setValue: (v: string) => {
      value.value = v;
      onValueChange?.(v);
    },
  });
  return (
    <div
      data-slot="tabs"
      data-orientation={orientation}
      data-horizontal={orientation === "horizontal" ? "" : undefined}
      data-vertical={orientation === "vertical" ? "" : undefined}
      class={className}
    >
      {children}
    </div>
  );
});

export const TabsList = cc<{
  children?: SinwanNode;
  class?: string;
  "data-variant"?: string;
}>(({ children, class: className, "data-variant": dataVariant }) => (
  <div
    role="tablist"
    data-slot="tabs-list"
    data-variant={dataVariant}
    class={className}
  >
    {children}
  </div>
));

export const TabsTrigger = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
  disabled?: boolean;
}>(({ children, class: className, value, disabled }) => {
  const api = inject(TabsKey)!;
  return (
    <button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      data-state={jsxClass(() =>
        api.value.value === value ? "active" : "inactive",
      )}
      aria-selected={jsxClass(() => api.value.value === value)}
      disabled={disabled}
      class={className}
      onclick={() => {
        if (!disabled) api.setValue(value);
      }}
    >
      {children}
    </button>
  );
});

export const TabsContent = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
}>(({ children, class: className, value }) => {
  const api = inject(TabsKey)!;
  return (
    <Show when={() => api.value.value === value}>
      <div
        role="tabpanel"
        data-slot="tabs-content"
        data-state="active"
        class={className}
      >
        {children}
      </div>
    </Show>
  );
});

// ─── Accordion ──────────────────────────────────────────────

export const AccordionKey: InjectionKey<{
  type: "single" | "multiple";
  value: Signal<string[]>;
  toggle: (item: string) => void;
}> = Symbol("sinwan-ui.accordion");

export const AccordionItemKey: InjectionKey<{ value: string }> = Symbol(
  "sinwan-ui.accordion-item",
);

export const AccordionRoot = cc<{
  children?: SinwanNode;
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (v: string | string[]) => void;
  class?: string;
  collapsible?: boolean;
}>(({
  children,
  type = "single",
  value: valueProp,
  defaultValue,
  onValueChange,
  class: className,
  collapsible = true,
}) => {
  const toArr = (v: string | string[] | undefined): string[] => {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  };
  const value = signal(toArr(valueProp ?? defaultValue));
  if (valueProp !== undefined) value.value = toArr(valueProp);

  provide(AccordionKey, {
    type,
    value,
    toggle: (item: string) => {
      let next: string[];
      if (type === "single") {
        const open = value.value.includes(item);
        next = open && collapsible ? [] : [item];
      } else {
        next = value.value.includes(item)
          ? value.value.filter((v) => v !== item)
          : [...value.value, item];
      }
      value.value = next;
      onValueChange?.(type === "single" ? (next[0] ?? "") : next);
    },
  });

  return (
    <div data-slot="accordion" class={className}>
      {children}
    </div>
  );
});

export const AccordionItem = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
}>(({ children, class: className, value }) => {
  provide(AccordionItemKey, { value });
  const api = inject(AccordionKey)!;
  return (
    <div
      data-slot="accordion-item"
      data-state={jsxClass(() =>
        api.value.value.includes(value) ? "open" : "closed",
      )}
      class={className}
    >
      {children}
    </div>
  );
});

export const AccordionTrigger = cc<{
  children?: SinwanNode;
  class?: string;
}>(({ children, class: className }) => {
  const root = inject(AccordionKey)!;
  const item = inject(AccordionItemKey)!;
  return (
    <button
      type="button"
      data-slot="accordion-trigger"
      aria-expanded={jsxClass(() => root.value.value.includes(item.value))}
      class={className}
      onclick={() => root.toggle(item.value)}
    >
      {children}
    </button>
  );
});

export const AccordionContent = cc<{
  children?: SinwanNode;
  class?: string;
}>(({ children, class: className }) => {
  const root = inject(AccordionKey)!;
  const item = inject(AccordionItemKey)!;
  return (
    <Show when={() => root.value.value.includes(item.value)}>
      <div data-slot="accordion-content" class={className}>
        {children}
      </div>
    </Show>
  );
});

// ─── Checkbox / Switch / Radio / Toggle ─────────────────────

export const CheckboxRoot = cc<{
  checked?: ReactiveProp<boolean>;
  indeterminate?: ReactiveProp<boolean>;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
  id?: string;
  name?: string;
  value?: string;
  "aria-label"?: string;
  children?: SinwanNode;
}>(({
  checked: checkedProp,
  indeterminate: indeterminateProp,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  class: className,
  id,
  name,
  value,
  "aria-label": ariaLabel,
  children,
}) => {
  const checked = createReactiveState(checkedProp, defaultChecked);
  const mixed = createReactiveState(indeterminateProp, false);
  return (
    <button
      type="button"
      role="checkbox"
      id={id}
      data-slot="checkbox"
      data-state={jsxClass(() =>
        mixed.value ? "indeterminate" : checked.value ? "checked" : "unchecked",
      )}
      aria-checked={jsxClass(() => (mixed.value ? "mixed" : checked.value))}
      aria-label={ariaLabel}
      disabled={disabled}
      class={className}
      name={name}
      value={value}
      onclick={() => {
        if (disabled) return;
        const next = mixed.value ? true : !checked.value;
        checked.value = next;
        onCheckedChange?.(next);
      }}
    >
      {children}
    </button>
  );
});

export const SwitchRoot = cc<{
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  class?: string;
  id?: string;
  children?: SinwanNode;
  "data-size"?: string;
}>(({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  class: className,
  id,
  children,
  "data-size": dataSize,
}) => {
  const checked = signal(checkedProp ?? defaultChecked);
  if (checkedProp !== undefined) checked.value = checkedProp;
  return (
    <button
      type="button"
      role="switch"
      id={id}
      data-slot="switch"
      data-size={dataSize}
      data-state={jsxClass(() => (checked.value ? "checked" : "unchecked"))}
      aria-checked={jsxClass(() => checked.value)}
      disabled={disabled}
      class={className}
      onclick={() => {
        if (disabled) return;
        const next = !checked.value;
        checked.value = next;
        onCheckedChange?.(next);
      }}
    >
      {children}
    </button>
  );
});

export const RadioGroupKey: InjectionKey<{
  value: Signal<string>;
  setValue: (v: string) => void;
  name?: string;
}> = Symbol("sinwan-ui.radio-group");

export const RadioGroupRoot = cc<{
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  class?: string;
  name?: string;
}>(({
  children,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  class: className,
  name,
}) => {
  const value = signal(valueProp ?? defaultValue);
  if (valueProp !== undefined) value.value = valueProp;
  provide(RadioGroupKey, {
    value,
    name,
    setValue: (v: string) => {
      value.value = v;
      onValueChange?.(v);
    },
  });
  return (
    <div role="radiogroup" data-slot="radio-group" class={className}>
      {children}
    </div>
  );
});

export const RadioGroupItem = cc<{
  value: string;
  class?: string;
  disabled?: boolean;
  id?: string;
  children?: SinwanNode;
}>(({ value, class: className, disabled, id, children }) => {
  const api = inject(RadioGroupKey)!;
  return (
    <button
      type="button"
      role="radio"
      id={id}
      data-slot="radio-group-item"
      data-state={jsxClass(() =>
        api.value.value === value ? "checked" : "unchecked",
      )}
      aria-checked={jsxClass(() => api.value.value === value)}
      disabled={disabled}
      class={className}
      onclick={() => {
        if (!disabled) api.setValue(value);
      }}
    >
      {children}
    </button>
  );
});

export const ToggleRoot = cc<{
  pressed?: ReactiveProp<boolean>;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  disabled?: boolean;
  class?: string;
  children?: SinwanNode;
}>(({
  pressed: pressedProp,
  defaultPressed = false,
  onPressedChange,
  disabled,
  class: className,
  children,
}) => {
  const pressed = createReactiveState(pressedProp, defaultPressed);
  return (
    <button
      type="button"
      data-slot="toggle"
      data-state={jsxClass(() => (pressed.value ? "on" : "off"))}
      aria-pressed={jsxClass(() => pressed.value)}
      disabled={disabled}
      class={className}
      onclick={() => {
        if (disabled) return;
        const next = !pressed.value;
        pressed.value = next;
        onPressedChange?.(next);
      }}
    >
      {children}
    </button>
  );
});

export const ToggleGroupKey: InjectionKey<{
  type: "single" | "multiple";
  value: Signal<string[]>;
  toggle: (v: string) => void;
}> = Symbol("sinwan-ui.toggle-group");

export const ToggleGroupRoot = cc<{
  children?: SinwanNode;
  type?: "single" | "multiple";
  value?: ReactiveProp<string | string[]>;
  defaultValue?: string | string[];
  onValueChange?: (v: string | string[]) => void;
  class?: string;
  style?: Record<string, string> | string;
  "data-variant"?: string;
  "data-size"?: string;
  "data-spacing"?: string | number;
  "data-orientation"?: string;
}>(({
  children,
  type = "single",
  value: valueProp,
  defaultValue,
  onValueChange,
  class: className,
  style,
  "data-variant": dataVariant,
  "data-size": dataSize,
  "data-spacing": dataSpacing,
  "data-orientation": dataOrientation,
}) => {
  const value = createReactiveState(
    valueProp === undefined ? undefined : () => toValueList(resolve(valueProp)),
    toValueList(defaultValue),
    sameStringList,
  );
  provide(ToggleGroupKey, {
    type,
    value,
    toggle: (item: string) => {
      let next: string[];
      if (type === "single") {
        next = value.value.includes(item) ? [] : [item];
      } else {
        next = value.value.includes(item)
          ? value.value.filter((x) => x !== item)
          : [...value.value, item];
      }
      value.value = next;
      onValueChange?.(type === "single" ? (next[0] ?? "") : next);
    },
  });
  return (
    <div
      data-slot="toggle-group"
      role="group"
      class={className}
      style={style}
      data-variant={dataVariant}
      data-size={dataSize}
      data-spacing={dataSpacing}
      data-orientation={dataOrientation}
    >
      {children}
    </div>
  );
});

export const ToggleGroupItem = cc<{
  children?: SinwanNode;
  class?: string;
  value: string;
  disabled?: boolean;
  "data-variant"?: string;
  "data-size"?: string;
  "data-spacing"?: string | number;
}>(({
  children,
  class: className,
  value,
  disabled,
  "data-variant": dataVariant,
  "data-size": dataSize,
  "data-spacing": dataSpacing,
}) => {
  const api = inject(ToggleGroupKey)!;
  return (
    <button
      type="button"
      data-slot="toggle-group-item"
      data-variant={dataVariant}
      data-size={dataSize}
      data-spacing={dataSpacing}
      data-state={jsxClass(() =>
        api.value.value.includes(value) ? "on" : "off",
      )}
      disabled={disabled}
      class={className}
      onclick={() => {
        if (!disabled) api.toggle(value);
      }}
    >
      {children}
    </button>
  );
});

export { For, Show, Slot };
