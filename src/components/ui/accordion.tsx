import { getRawProps, type SinwanNode } from "sinwan/component";
import { ChevronDown, ChevronUp } from "lucide";

import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import {
  AccordionContent as AccordionContentPrimitive,
  AccordionItem as AccordionItemPrimitive,
  AccordionRoot,
  AccordionTrigger as AccordionTriggerPrimitive,
} from "@/primitives";

type AccordionProps = {
  children?: SinwanNode;
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (v: string | string[]) => void;
  class?: string;
  collapsible?: boolean;
};

function Accordion(props: AccordionProps) {
  const { class: className, ...rest } = getRawProps(props);
  return (
    <AccordionRoot
      class={cn("flex w-full flex-col", className)}
      {...rest}
    />
  );
}

type AccordionItemProps = {
  children?: SinwanNode;
  class?: string;
  value: string;
};

function AccordionItem({ class: className, ...props }: AccordionItemProps) {
  return (
    <AccordionItemPrimitive
      class={cn("not-last:border-b", className)}
      {...props}
    />
  );
}

type AccordionTriggerProps = {
  children?: SinwanNode;
  class?: string;
};

function AccordionTrigger({
  class: className,
  children,
  ...props
}: AccordionTriggerProps) {
  return (
    <div class="flex">
      <AccordionTriggerPrimitive
        class={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
        <Icon
          icon={ChevronDown}
          data-slot="accordion-trigger-icon"
          class="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
        />
        <Icon
          icon={ChevronUp}
          data-slot="accordion-trigger-icon"
          class="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionTriggerPrimitive>
    </div>
  );
}

type AccordionContentProps = {
  children?: SinwanNode;
  class?: string;
};

function AccordionContent({
  class: className,
  children,
  ...props
}: AccordionContentProps) {
  return (
    <AccordionContentPrimitive
      class="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        class={cn(
          "pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
          className,
        )}
      >
        {children}
      </div>
    </AccordionContentPrimitive>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
