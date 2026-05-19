import { cc, Show, Key } from "sinwan/component";
import { signal, computed, effect } from "sinwan/reactivity";
import type { SinwanComponent } from "sinwan/component";

export interface Route {
  path: string;
  component: SinwanComponent<any>;
  loader?: () => Promise<any>;
}

// Current path signal
const currentPath = signal<string>(
  typeof window !== "undefined" ? window.location.pathname : "/",
);

// Route registry
const routes = signal<Route[]>([]);

export function defineRoutes(routeList: Route[]) {
  routes.value = routeList;
}

// Match current path to a route
const matchedRoute = computed(() => {
  const path = currentPath.value;
  return routes.value.find((r) => {
    if (r.path === path) return true;
    const pattern = r.path.replace(/:\w+/g, "[^/]+");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });
});

// Navigate to a new route
export function navigate(to: string, pushState = true) {
  if (typeof window === "undefined") return;
  if (pushState) {
    window.history.pushState({}, "", to);
  }
  currentPath.value = to;
}

// Handle browser back/forward
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    currentPath.value = window.location.pathname;
  });
}

// Link component
export const Link = cc<{ href: string; children: any }>(
  ({ href, children }) => {
    return (
      <a
        href={href}
        onClick={(e: MouseEvent) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) return;
          e.preventDefault();
          navigate(href);
        }}
      >
        {children}
      </a>
    );
  },
);

// Router outlet using Key to force remount on path change
export const RouterOutlet = cc(() => {
  const data = signal<any>(null);

  // Load data on route change
  if (typeof window !== "undefined") {
    effect(() => {
      const r = matchedRoute.value;
      console.log("[Router] Route changed:", r?.path);
      if (r?.loader) {
        r.loader()
          .then((d: any) => {
            console.log("[Router] Data loaded");
            data.value = d;
          })
          .catch((e: any) => {
            console.error("Loader error:", e);
          });
      } else {
        data.value = null;
      }
    });
  }

  return (
    <div class="router-outlet">
      <Key when={currentPath}>
        {() => {
          const r = matchedRoute.value;
          console.log("[Router] Key block rendering:", r?.path);
          if (!r) return <div>404 - Page not found</div>;
          const Comp = r.component;
          return <Comp {...(data.value || {})} />;
        }}
      </Key>
    </div>
  );
});

export function setInitialPath(path: string) {
  currentPath.value = path;
}
