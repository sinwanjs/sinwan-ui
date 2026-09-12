import { signal, type Signal } from "sinwan/reactivity";

/** Readable store: live parent prop, or a local signal. */
export type Live<T> = { readonly value: T };

export function createLiveState<T>(
  controlled: boolean,
  defaultValue: T,
  read: () => T,
): {
  state: Live<T>;
  local: Signal<T>;
  set: (next: T) => void;
} {
  const local = signal(defaultValue);
  return {
    local,
    state: {
      get value() {
        return controlled ? read() : local.value;
      },
    },
    set(next: T) {
      if (!controlled) local.value = next;
    },
  };
}
