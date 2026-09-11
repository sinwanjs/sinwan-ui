import {
  cc,
  inject,
  provide,
  Show,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { Check, ChevronDown, X } from "lucide";

import { Icon } from "../../icons";
import { cn, jsxClass } from "../../lib/utils";
import {
  PopoverContent as PopoverContentPrimitive,
  PopoverKey,
  PopoverRoot,
  type Align,
  type Placement,
} from "../../primitives";
import { Button } from "./button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group";

type ComboboxApi = {
  open: Signal<boolean>;
  setOpen: (value: boolean) => void;
  value: Signal<string>;
  setValue: (value: string, label?: string) => void;
  label: Signal<string>;
  query: Signal<string>;
  setQuery: (value: string) => void;
  multiple: boolean;
  values: Signal<string[]>;
  setValues: (values: string[]) => void;
};

const ComboboxKey: InjectionKey<ComboboxApi> = Symbol("sinwan-ui.combobox");

type ComboboxProps = {
  children?: SinwanNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  multiple?: boolean;
};

const Combobox = cc<ComboboxProps>(
  ({
    children,
    value: valueProp,
    defaultValue = "",
    onValueChange,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    multiple = false,
  }) => {
    const open = signal(openProp ?? defaultOpen);
    const value = signal(valueProp ?? defaultValue);
    const label = signal("");
    const query = signal("");
    const values = signal<string[]>([]);
    if (openProp !== undefined) open.value = openProp;
    if (valueProp !== undefined) value.value = valueProp;

    const api: ComboboxApi = {
      open,
      setOpen: (v: boolean) => {
        open.value = v;
        onOpenChange?.(v);
      },
      value,
      setValue: (v: string, text?: string) => {
        value.value = v;
        if (text !== undefined) label.value = text;
        onValueChange?.(v);
        open.value = false;
        onOpenChange?.(false);
      },
      label,
      query,
      setQuery: (v: string) => {
        query.value = v;
      },
      multiple,
      values,
      setValues: (next) => {
        values.value = next;
      },
    };

    provide(ComboboxKey, api);

    return (
      <PopoverRoot
        open={undefined}
        defaultOpen={defaultOpen}
        onOpenChange={(v) => {
          open.value = v;
          onOpenChange?.(v);
        }}
      >
        {children}
      </PopoverRoot>
    );
  },
);

type ComboboxValueProps = {
  placeholder?: string;
  class?: string;
};

function ComboboxValue({ placeholder, class: className }: ComboboxValueProps) {
  const api = inject(ComboboxKey)!;
  return (
    <span data-slot="combobox-value" class={className}>
      {jsxClass(
        () => api.label.value || api.value.value || placeholder || "",
      )}
    </span>
  );
}

type ComboboxTriggerProps = {
  children?: SinwanNode;
  class?: string;
};

function ComboboxTrigger({ class: className, children }: ComboboxTriggerProps) {
  const api = inject(ComboboxKey)!;
  const popover = inject(PopoverKey);
  return (
    <button
      type="button"
      data-slot="combobox-trigger"
      class={cn("[&_svg:not([class*='size-'])]:size-4", className)}
      ref={(el: HTMLElement | null) => {
        if (popover) popover.triggerEl.value = el;
      }}
      onclick={() => {
        const next = !api.open.value;
        api.setOpen(next);
        popover?.setOpen(next);
      }}
    >
      {children}
      <Icon
        icon={ChevronDown}
        class="pointer-events-none size-4 text-muted-foreground"
      />
    </button>
  );
}

type ComboboxInputProps = {
  class?: string;
  placeholder?: string;
  disabled?: boolean;
  showTrigger?: boolean;
  showClear?: boolean;
  children?: SinwanNode;
  oninput?: (e: Event) => void;
};

function ComboboxInput({
  class: className,
  placeholder,
  disabled = false,
  showTrigger = true,
  showClear = false,
  children,
  oninput,
}: ComboboxInputProps) {
  const api = inject(ComboboxKey)!;
  const popover = inject(PopoverKey);
  return (
    <InputGroup
      class={cn("w-auto", className)}
      ref={(el: HTMLElement | null) => {
        if (popover) popover.triggerEl.value = el;
      }}
    >
      <InputGroupInput
        disabled={disabled}
        placeholder={placeholder}
        value={jsxClass(() => api.query.value || api.label.value)}
        oninput={(e: Event) => {
          const next = (e.target as HTMLInputElement).value;
          api.setQuery(next);
          api.setOpen(true);
          popover?.setOpen(true);
          oninput?.(e);
        }}
        onfocus={() => {
          api.setOpen(true);
          popover?.setOpen(true);
        }}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger ? (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            data-slot="input-group-button"
            class="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={disabled}
            onclick={() => {
              const next = !api.open.value;
              api.setOpen(next);
              popover?.setOpen(next);
            }}
          >
            <Icon
              icon={ChevronDown}
              class="pointer-events-none size-4 text-muted-foreground"
            />
          </InputGroupButton>
        ) : null}
        {showClear ? <ComboboxClear disabled={disabled} /> : null}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

type ComboboxClearProps = {
  class?: string;
  disabled?: boolean;
};

function ComboboxClear({ class: className, disabled }: ComboboxClearProps) {
  const api = inject(ComboboxKey)!;
  return (
    <InputGroupButton
      data-slot="combobox-clear"
      variant="ghost"
      size="icon-xs"
      class={cn(className)}
      disabled={disabled}
      onclick={() => {
        api.setValue("");
        api.label.value = "";
        api.setQuery("");
      }}
    >
      <Icon icon={X} class="pointer-events-none" />
    </InputGroupButton>
  );
}

type ComboboxContentProps = {
  children?: SinwanNode;
  class?: string;
  side?: Placement;
  sideOffset?: number;
  align?: Align;
};

function ComboboxContent({
  class: className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  children,
}: ComboboxContentProps) {
  return (
    <PopoverContentPrimitive
      side={side}
      sideOffset={sideOffset}
      align={align}
      class={cn(
        "group/combobox-content relative max-h-72 min-w-[12rem] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className,
      )}
    >
      {children}
    </PopoverContentPrimitive>
  );
}

type ComboboxListProps = {
  children?: SinwanNode;
  class?: string;
};

function ComboboxList({ class: className, children }: ComboboxListProps) {
  return (
    <div
      data-slot="combobox-list"
      role="listbox"
      class={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

type ComboboxItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
  disabled?: boolean;
};

function ComboboxItem({
  class: className,
  children,
  value,
  disabled,
}: ComboboxItemProps) {
  const api = inject(ComboboxKey)!;
  const selected = () =>
    api.multiple
      ? api.values.value.includes(value)
      : api.value.value === value;
  const matches = () => {
    const q = api.query.value.trim().toLowerCase();
    if (!q) return true;
    return value.toLowerCase().includes(q);
  };
  return (
    <Show when={() => matches()} fallback={null}>
      <button
        type="button"
        role="option"
        data-slot="combobox-item"
        data-highlighted={undefined}
        aria-selected={jsxClass<boolean>(() => selected())}
        disabled={disabled}
        class={cn(
          "relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        onclick={(e: MouseEvent) => {
          const text = (e.currentTarget as HTMLElement).innerText.trim();
          if (api.multiple) {
            const next = selected()
              ? api.values.value.filter((v) => v !== value)
              : [...api.values.value, value];
            api.setValues(next);
          } else {
            api.setValue(value, text);
            api.setQuery("");
          }
        }}
      >
        {children}
        <span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
          <Show when={() => selected()} fallback={null}>
            <Icon icon={Check} class="pointer-events-none" />
          </Show>
        </span>
      </button>
    </Show>
  );
}

type ComboboxGroupProps = {
  children?: SinwanNode;
  class?: string;
};

function ComboboxGroup({ class: className, children }: ComboboxGroupProps) {
  return (
    <div data-slot="combobox-group" class={cn(className)} role="group">
      {children}
    </div>
  );
}

type ComboboxLabelProps = {
  children?: SinwanNode;
  class?: string;
};

function ComboboxLabel({ class: className, children }: ComboboxLabelProps) {
  return (
    <div
      data-slot="combobox-label"
      class={cn("px-2 py-1.5 text-xs text-muted-foreground", className)}
    >
      {children}
    </div>
  );
}

type ComboboxCollectionProps = {
  children?: SinwanNode;
};

function ComboboxCollection({ children }: ComboboxCollectionProps) {
  return <div data-slot="combobox-collection">{children}</div>;
}

type ComboboxEmptyProps = {
  children?: SinwanNode;
  class?: string;
};

function ComboboxEmpty({ class: className, children }: ComboboxEmptyProps) {
  return (
    <div
      data-slot="combobox-empty"
      class={cn(
        "w-full justify-center py-2 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children ?? "No results."}
    </div>
  );
}

type ComboboxSeparatorProps = {
  class?: string;
};

function ComboboxSeparator({ class: className }: ComboboxSeparatorProps) {
  return (
    <div
      data-slot="combobox-separator"
      class={cn("-mx-1 my-1 h-px bg-border", className)}
    />
  );
}

type ComboboxChipsProps = {
  children?: SinwanNode;
  class?: string;
};

function ComboboxChips({ class: className, children }: ComboboxChipsProps) {
  const popover = inject(PopoverKey);
  return (
    <div
      data-slot="combobox-chips"
      class={cn(
        "flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-data-[slot=combobox-chip]:px-1 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40",
        className,
      )}
      ref={(el: HTMLElement | null) => {
        if (popover) popover.triggerEl.value = el;
      }}
    >
      {children}
    </div>
  );
}

type ComboboxChipProps = {
  children?: SinwanNode;
  class?: string;
  value?: string;
  showRemove?: boolean;
};

function ComboboxChip({
  class: className,
  children,
  value,
  showRemove = true,
}: ComboboxChipProps) {
  const api = inject(ComboboxKey)!;
  return (
    <span
      data-slot="combobox-chip"
      class={cn(
        "flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className,
      )}
    >
      {children}
      {showRemove ? (
        <Button
          variant="ghost"
          size="icon-xs"
          data-slot="combobox-chip-remove"
          class="-ml-1 opacity-50 hover:opacity-100"
          onclick={() => {
            if (!value) return;
            api.setValues(api.values.value.filter((v) => v !== value));
          }}
        >
          <Icon icon={X} class="pointer-events-none" />
        </Button>
      ) : null}
    </span>
  );
}

type ComboboxChipsInputProps = {
  class?: string;
  placeholder?: string;
  oninput?: (e: Event) => void;
};

function ComboboxChipsInput({
  class: className,
  placeholder,
  oninput,
}: ComboboxChipsInputProps) {
  const api = inject(ComboboxKey)!;
  const popover = inject(PopoverKey);
  return (
    <input
      data-slot="combobox-chip-input"
      class={cn("min-w-16 flex-1 bg-transparent outline-none", className)}
      placeholder={placeholder}
      oninput={(e: Event) => {
        const next = (e.target as HTMLInputElement).value;
        api.setQuery(next);
        api.setOpen(true);
        popover?.setOpen(true);
        oninput?.(e);
      }}
    />
  );
}

function useComboboxAnchor(): Signal<HTMLElement | null> {
  return signal<HTMLElement | null>(null);
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
