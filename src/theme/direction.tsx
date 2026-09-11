import {
  cc,
  inject,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { signal, type Signal } from "sinwan/reactivity";
import { jsxClass } from "../lib/utils";

export type Direction = "ltr" | "rtl";

export type DirectionApi = {
  dir: Signal<Direction>;
  setDir: (dir: Direction) => void;
};

export const DirectionKey: InjectionKey<DirectionApi> = Symbol(
  "sinwan-ui.direction",
);

export type DirectionProviderProps = {
  children?: SinwanNode;
  dir?: Direction;
};

export const DirectionProvider = cc<DirectionProviderProps>(
  ({ children, dir: initial = "ltr" }) => {
    const dir = signal<Direction>(initial);
    provide(DirectionKey, {
      dir,
      setDir: (value: Direction) => {
        dir.value = value;
      },
    });
    return (
      <div
        dir={jsxClass(() => dir.value)}
        data-slot="direction-provider"
      >
        {children}
      </div>
    );
  },
);

export function useDirection(): Direction {
  const api = inject(DirectionKey);
  return api?.dir.value ?? "ltr";
}
