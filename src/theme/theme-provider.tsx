import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { batch, computed, signal, type Signal } from "sinwan/reactivity";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type ThemeApi = {
  theme: Signal<Theme>;
  resolved: Signal<ResolvedTheme>;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
};

export const ThemeKey: InjectionKey<ThemeApi> = Symbol("sinwan-ui.theme");

export type ThemeProviderProps = {
  children?: SinwanNode;
  defaultTheme?: Theme;
  forcedTheme?: Theme;
  storageKey?: string;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  attribute?: "class" | "data-theme";
};

function readStored(storageKey: string, fallback: Theme): Theme {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const value = localStorage.getItem(storageKey);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* ignore */
  }
  return fallback;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function disableTransitionsTemporarily(): () => void {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important;animation:none!important}",
    ),
  );
  document.head.appendChild(style);
  return () => {
    window.getComputedStyle(document.body);
    requestAnimationFrame(() => {
      style.parentNode?.removeChild(style);
    });
  };
}

function writeDomTheme(
  next: ResolvedTheme,
  attribute: "class" | "data-theme",
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(next);
  } else {
    root.setAttribute("data-theme", next);
  }
  root.style.colorScheme = next;
}

export const ThemeProvider = cc<ThemeProviderProps>(
  ({
    children,
    defaultTheme = "system",
    forcedTheme,
    storageKey = "sinwan-ui-theme",
    disableTransitionOnChange = true,
    enableSystem = true,
    attribute = "class",
  }) => {
    const initial = forcedTheme ?? readStored(storageKey, defaultTheme);
    const theme = signal<Theme>(initial);
    const resolved = signal<ResolvedTheme>(
      initial === "system" ? getSystemTheme() : (initial as ResolvedTheme),
    );

    const resolve = (value: Theme): ResolvedTheme => {
      if (forcedTheme === "light" || forcedTheme === "dark") return forcedTheme;
      if (forcedTheme === "system") return getSystemTheme();
      if (value === "system") return enableSystem ? getSystemTheme() : "light";
      return value;
    };

    const commit = (value: Theme, nextTheme?: Theme) => {
      const next = resolve(value);
      const restore =
        disableTransitionOnChange && typeof document !== "undefined"
          ? disableTransitionsTemporarily()
          : null;
      writeDomTheme(next, attribute);
      batch(() => {
        if (nextTheme !== undefined) {
          theme.value = nextTheme;
        }
        resolved.value = next;
      });
      restore?.();
    };

    const setTheme = (value: Theme) => {
      if (forcedTheme) return;
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        /* ignore */
      }
      commit(value, value);
    };

    onMounted(() => {
      commit(theme.value);
      if (!enableSystem) return;
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => {
        if (theme.value === "system" || forcedTheme === "system") {
          commit("system");
        }
      };
      mq.addEventListener("change", onChange);
      onUnmounted(() => mq.removeEventListener("change", onChange));
    });

    provide(ThemeKey, {
      theme,
      resolved,
      setTheme,
      themes: enableSystem
        ? (["light", "dark", "system"] as Theme[])
        : (["light", "dark"] as Theme[]),
    });

    // Touch computed so consumers can depend on resolved updates in templates.
    void computed(() => resolved.value);

    return <>{children}</>;
  },
);

export function useTheme(): ThemeApi {
  const api = inject(ThemeKey);
  if (!api) {
    throw new Error("useTheme() must be used within a ThemeProvider");
  }
  return api;
}

export const ThemeToggle = cc<{ class?: string }>(({ class: className }) => {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <button
      type="button"
      class={className}
      data-slot="theme-toggle"
      aria-label="Toggle color theme"
      onclick={() => {
        const next =
          theme.value === "system"
            ? resolved.value === "dark"
              ? "light"
              : "dark"
            : theme.value === "dark"
              ? "light"
              : "dark";
        setTheme(next);
      }}
    >
      {() => (resolved.value === "dark" ? "Light" : "Dark")}
    </button>
  );
});
