import type { SinwanNode } from "sinwan/component";
import {
  CollapsibleContent as CollapsibleContentPrimitive,
  CollapsibleRoot,
  CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from "@/primitives";

type CollapsibleProps = {
  children?: SinwanNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  class?: string;
};

function Collapsible(props: CollapsibleProps) {
  return <CollapsibleRoot {...props} />;
}

type CollapsibleTriggerProps = {
  children?: SinwanNode;
  class?: string;
  asChild?: boolean;
};

function CollapsibleTrigger(props: CollapsibleTriggerProps) {
  return <CollapsibleTriggerPrimitive {...props} />;
}

type CollapsibleContentProps = {
  children?: SinwanNode;
  class?: string;
};

function CollapsibleContent(props: CollapsibleContentProps) {
  return <CollapsibleContentPrimitive {...props} />;
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
