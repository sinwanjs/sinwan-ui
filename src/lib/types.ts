import type { SinwanElement, SinwanNode } from "sinwan/component";
import type { Signal } from "sinwan/reactivity";

export type ReactiveProp<T> = T | Signal<T> | (() => T);

export type DivProps = JSX.IntrinsicElements["div"];
export type ButtonHTMLProps = JSX.IntrinsicElements["button"];
export type InputHTMLProps = JSX.IntrinsicElements["input"];
export type TextareaHTMLProps = JSX.IntrinsicElements["textarea"];
export type LabelHTMLProps = JSX.IntrinsicElements["label"];
export type AnchorHTMLProps = JSX.IntrinsicElements["a"];
export type SpanProps = JSX.IntrinsicElements["span"];
export type SVGProps = JSX.IntrinsicElements["svg"];

export function isSinwanElement(node: SinwanNode): node is SinwanElement {
  return (
    typeof node === "object" &&
    node !== null &&
    !Array.isArray(node) &&
    "tag" in node &&
    "props" in node
  );
}

export function flattenChildren(
  children: SinwanNode | undefined,
): SinwanNode[] {
  if (children == null || children === false || children === true) return [];
  if (Array.isArray(children)) {
    return children.flatMap((child) => flattenChildren(child));
  }
  return [children];
}
