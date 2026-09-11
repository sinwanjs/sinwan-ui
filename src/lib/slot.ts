import type { SinwanElement, SinwanNode } from "sinwan/component";
import { flattenChildren, isSinwanElement } from "./types";

type AnyProps = Record<string, unknown>;

function mergeClass(a: unknown, b: unknown): string | undefined {
  const parts = [a, b].filter((v) => typeof v === "string" && v.length > 0);
  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...childProps, ...slotProps };
  const className = mergeClass(childProps.class, slotProps.class);
  if (className !== undefined) merged.class = className;
  else {
    delete merged.class;
  }

  for (const key of Object.keys(slotProps)) {
    if (!key.startsWith("on")) continue;
    const slotHandler = slotProps[key];
    const childHandler = childProps[key];
    if (typeof slotHandler === "function" && typeof childHandler === "function") {
      merged[key] = (...args: unknown[]) => {
        (childHandler as (...a: unknown[]) => void)(...args);
        (slotHandler as (...a: unknown[]) => void)(...args);
      };
    }
  }

  return merged;
}

/**
 * Merge Slot props onto a single Sinwan element child (asChild pattern).
 */
export function Slot(props: {
  children?: unknown;
  [key: string]: unknown;
}): SinwanNode {
  const { children, ...slotProps } = props;
  const flat = flattenChildren(children as SinwanNode | undefined).filter(
    (c) => c != null && c !== false && c !== true,
  );
  if (flat.length !== 1 || !isSinwanElement(flat[0])) {
    throw new Error("Slot expects exactly one Sinwan element child");
  }
  const child = flat[0] as SinwanElement;
  return {
    tag: child.tag,
    props: mergeProps(slotProps as AnyProps, child.props as AnyProps),
    children: child.children,
  };
}
