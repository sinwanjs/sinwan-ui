import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  ThemeProvider,
  ThemeToggle,
  useTheme,
  type ThemeApi,
} from "../src/theme/theme-provider";
import {
  DirectionProvider,
  useDirection,
} from "../src/theme/direction";
import { useIsMobile } from "../src/hooks/use-mobile";
import { toast, Toaster } from "../src/toast";
import { mountUi, setupDom, teardownDom, withSetup } from "./helpers";

beforeEach(() => {
  setupDom();
  document.documentElement.className = "";
  localStorage.clear();
});

afterEach(() => {
  teardownDom();
});

describe("ThemeProvider", () => {
  test("provides theme api and applies dark class", () => {
    let api: ThemeApi | undefined;
    const Child = () => {
      api = useTheme();
      return <span>child</span>;
    };
    const { unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="dark">
        <Child />
      </ThemeProvider>
    ));
    expect(api).toBeDefined();
    api!.setTheme("light");
    expect(api!.theme.value).toBe("light");
    unmount();

    const second = mountUi(() => (
      <ThemeProvider defaultTheme="dark" disableTransitionOnChange>
        <span>x</span>
      </ThemeProvider>
    ));
    expect(second.root.textContent).toContain("x");
    second.unmount();
  });

  test("ThemeToggle flips theme", () => {
    let api: ThemeApi | undefined;
    const Capture = () => {
      api = useTheme();
      return <ThemeToggle />;
    };
    const { click, unmount } = mountUi(() => (
      <ThemeProvider defaultTheme="light">
        <Capture />
      </ThemeProvider>
    ));
    expect(api!.theme.value).toBe("light");
    click('[data-slot="theme-toggle"]');
    expect(api!.theme.value).toBe("dark");
    unmount();
  });

  test("useTheme throws outside provider", () => {
    expect(() => withSetup(() => useTheme())).toThrow(/ThemeProvider/);
  });
});

describe("DirectionProvider", () => {
  test("sets dir and useDirection reads it", () => {
    let seen = "";
    const Child = () => {
      seen = useDirection();
      return <span>{seen}</span>;
    };
    const { root, unmount } = mountUi(() => (
      <DirectionProvider dir="rtl">
        <Child />
      </DirectionProvider>
    ));
    expect(seen).toBe("rtl");
    expect(root.querySelector('[data-slot="direction-provider"]')?.getAttribute("dir")).toBe(
      "rtl",
    );
    unmount();
    expect(withSetup(() => useDirection())).toBe("ltr");
  });
});

describe("useIsMobile", () => {
  test("returns getter during setup", () => {
    withSetup(() => {
      const isMobile = useIsMobile();
      expect(typeof isMobile()).toBe("boolean");
    });
  });
});

describe("toast", () => {
  test("queues and dismisses toasts", async () => {
    toast("hello");
    toast.success("ok");
    toast.error("bad");
    toast.info("info");
    toast.warning("warn");
    const id = toast.loading("load");
    expect(id).toBeTruthy();
    toast.dismiss(id);
    toast.dismiss();
    const { query, unmount } = mountUi(() => <Toaster />);
    expect(query('[data-slot="toaster"]')).toBeTruthy();
    toast.success({ title: "colored", description: "done" });
    toast.error("fail");
    toast.info("note");
    toast.warning("careful");
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('[data-type="success"]')).toBeTruthy();
    expect(document.querySelector('[data-type="error"]')).toBeTruthy();
    expect(document.querySelector('[data-type="info"]')).toBeTruthy();
    expect(document.querySelector('[data-type="warning"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="toast-icon"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="toast-title"]')).toBeTruthy();
    expect(
      document.querySelector('[data-type="success"]')?.className,
    ).toContain("text-success");
    toast.dismiss();
    unmount();
  });
});
