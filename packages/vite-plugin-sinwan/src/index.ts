import type { Plugin } from "vite";
import { transformJSX } from "./compiler/transform.js";

/**
 *
 * @returns
 */
export function sinwan(): Plugin {
  return {
    name: "sinwan",
    enforce: "pre",
    transform(code: string, id: string) {
      if (!/\.[tj]sx$/.test(id)) return;
      return transformJSX(code, id, { hoist: true });
    },
  };
}

export { transformJSX };
