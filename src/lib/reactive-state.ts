import { onUnmounted } from "sinwan/component";
import { effect, resolve, signal, type Signal } from "sinwan/reactivity";

import type { ReactiveProp } from "./types";

export function createReactiveState<T>(
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
