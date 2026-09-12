import { cc, getRawProps, inject, onUnmounted, provide, Show, type InjectionKey, type SinwanNode } from "sinwan/component";
import { effect, signal, type Signal } from "sinwan/reactivity";
import { Check, Search } from "lucide";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { InputGroup, InputGroupAddon } from "./input-group";

type CommandApi = {
  query: Signal<string>;
  setQuery: (value: string) => void;
  matchCount: Signal<number>;
  setItemMatch: (id: symbol, matches: boolean) => void;
  clearItemMatch: (id: symbol) => void;
};

const CommandKey: InjectionKey<CommandApi> = Symbol("sinwan-ui.command");

type CommandProps = {
  children?: SinwanNode;
  class?: string;
};

const Command = cc<CommandProps>(({ children, class: className }) => {
  const query = signal("");
  const itemMatch = new Map<symbol, boolean>();
  const matchCount = signal(0);

  const recountMatches = () => {
    let next = 0;
    for (const hit of itemMatch.values()) {
      if (hit) next += 1;
    }
    matchCount.value = next;
  };

  provide(CommandKey, {
    query,
    setQuery: (v: string) => {
      query.value = v;
    },
    matchCount,
    setItemMatch: (id: symbol, matches: boolean) => {
      if (itemMatch.get(id) === matches) return;
      itemMatch.set(id, matches);
      recountMatches();
    },
    clearItemMatch: (id: symbol) => {
      itemMatch.delete(id);
      recountMatches();
    },
  });
  return (
    <div
      data-slot="command"
      class={cn(
        "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
});

type CommandDialogProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  class?: string;
  showCloseButton?: boolean;
};

function CommandDialog(props: CommandDialogProps) {
  const {
    title = "Command Palette",
    description = "Search for a command to run...",
    children,
    class: className,
    showCloseButton = false,
    ...rest
  } = getRawProps(props);
  return (
    <Dialog {...rest}>
      <DialogHeader class="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        class={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
          className,
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

type CommandInputProps = {
  class?: string;
  placeholder?: string;
  value?: string;
  oninput?: (e: Event) => void;
};

function CommandInput({
  class: className,
  placeholder,
  value,
  oninput,
}: CommandInputProps) {
  const api = inject(CommandKey)!;
  return (
    <div data-slot="command-input-wrapper" class="p-1 pb-0">
      <InputGroup class="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <input
          data-slot="command-input"
          class={cn(
            "w-full bg-transparent text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          placeholder={placeholder}
          value={value}
          oninput={(e: Event) => {
            const next = (e.target as HTMLInputElement).value;
            api.setQuery(next);
            oninput?.(e);
          }}
        />
        <InputGroupAddon>
          <Icon icon={Search} class="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

type CommandListProps = {
  children?: SinwanNode;
  class?: string;
};

function CommandList({ class: className, children }: CommandListProps) {
  return (
    <div
      data-slot="command-list"
      class={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className,
      )}
      role="listbox"
    >
      {children}
    </div>
  );
}

type CommandEmptyProps = {
  children?: SinwanNode;
  class?: string;
};

function CommandEmpty({ class: className, children }: CommandEmptyProps) {
  const api = inject(CommandKey)!;
  return (
    <Show when={() => api.matchCount.value === 0} fallback={null}>
      <div
        data-slot="command-empty"
        class={cn("py-6 text-center text-sm", className)}
      >
        {children ?? "No results found."}
      </div>
    </Show>
  );
}

type CommandGroupProps = {
  children?: SinwanNode;
  class?: string;
  heading?: string;
};

function CommandGroup({ class: className, children, heading }: CommandGroupProps) {
  return (
    <div
      data-slot="command-group"
      class={cn(
        "overflow-hidden p-1 text-foreground",
        className,
      )}
      role="group"
    >
      {heading ? (
        <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      ) : null}
      {children}
    </div>
  );
}

type CommandSeparatorProps = {
  class?: string;
};

function CommandSeparator({ class: className }: CommandSeparatorProps) {
  return (
    <div
      data-slot="command-separator"
      class={cn("-mx-1 h-px bg-border", className)}
    />
  );
}

type CommandItemProps = {
  children?: SinwanNode;
  class?: string;
  value?: string;
  keywords?: string[];
  disabled?: boolean;
  checked?: boolean;
  onclick?: (e: MouseEvent) => void;
};

function itemValueText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const CommandItem = cc(function CommandItem(props: CommandItemProps) {
  const api = inject(CommandKey)!;
  const itemId = Symbol();
  const matches = () => {
    const q = api.query.value.trim().toLowerCase();
    if (!q) return true;
    const keywords = Array.isArray(props.keywords) ? props.keywords : [];
    const hay = [itemValueText(props.value), ...keywords]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };
  effect(() => {
    api.setItemMatch(itemId, matches());
  });
  onUnmounted(() => {
    api.clearItemMatch(itemId);
  });
  return (
    <Show when={() => matches()} fallback={null}>
      <button
        type="button"
        role="option"
        data-slot="command-item"
        data-disabled={() => (props.disabled ? "true" : undefined)}
        data-checked={() => (props.checked ? "true" : undefined)}
        disabled={() => Boolean(props.disabled)}
        class={cn(
          "group/command-item relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          props.class,
        )}
        onclick={props.onclick}
      >
        {props.children}
        <Icon
          icon={Check}
          class="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100"
        />
      </button>
    </Show>
  );
});

type CommandShortcutProps = {
  children?: SinwanNode;
  class?: string;
};

function CommandShortcut({ class: className, children }: CommandShortcutProps) {
  return (
    <span
      data-slot="command-shortcut"
      class={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-[checked=true]/command-item:text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
