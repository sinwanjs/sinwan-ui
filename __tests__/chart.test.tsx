import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { cc } from "sinwan/component";
import { signal } from "sinwan/reactivity";
import * as echarts from "echarts";
import {
  Chart,
  ChartContainer,
  ChartStyle,
  THEMES,
  echarts as chartEcharts,
  useChart,
  type EChartsOption,
} from "../src/components/ui/chart";
import {
  lastResizeObserver,
  mountUi,
  setupDom,
  teardownDom,
  withSetup,
} from "./helpers";

const barOption: EChartsOption = {
  xAxis: { type: "category", data: ["A", "B"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", name: "sales", data: [10, 20] }],
};

const chartSize = { width: "320px", height: "180px" };

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  setupDom();
});

afterEach(() => {
  teardownDom();
});

describe("ECharts Chart", () => {
  test("renders a chart view inside ChartContainer and exposes the instance", async () => {
    let ready: unknown;
    const Probe = cc(() => {
      const api = useChart();
      return (
        <span data-slot="chart-id">
          {() => {
            void api.instance();
            return api.chartId;
          }}
        </span>
      );
    });
    const { root, unmount } = mountUi(() => (
      <ChartContainer
        id="sales"
        config={{
          sales: { label: "Sales", color: "#3366ff" },
          visitors: { theme: { light: "#111", dark: "#eee" } },
        }}
        class="max-w-lg"
      >
        <Probe />
        <Chart
          option={barOption}
          renderer="svg"
          style={chartSize}
          onReady={(chart) => {
            ready = chart;
          }}
        />
      </ChartContainer>
    ));
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelector('[data-slot="chart"]')).toBeTruthy();
    expect(root.querySelector('[data-slot="chart-view"]')).toBeTruthy();
    expect(root.querySelector('[data-chart="chart-sales"]')).toBeTruthy();
    expect(root.querySelector('[data-slot="chart-id"]')?.textContent).toBe(
      "chart-sales",
    );
    expect(ready).toBeTruthy();
    expect(THEMES.light).toBe("");
    expect(chartEcharts.init).toBe(echarts.init);
    unmount();
  });

  test("standalone Chart, empty style, loading, events, and resize", async () => {
    const clicks: unknown[] = [];
    const option = signal<EChartsOption>(barOption);
    const { root, unmount } = mountUi(() => (
      <div class="dark">
        <ChartStyle id="empty" config={{}} />
        <ChartStyle
          id="themed"
          config={{
            a: { theme: { light: "#0f0", dark: "#00f" } },
            b: { label: "B" },
            c: { theme: { light: "", dark: "" } },
          }}
        />
        <Chart
          option={() => option.value}
          renderer={() => "svg"}
          style={chartSize}
          theme={() => "dark"}
          initOpts={() => ({ locale: "en" })}
          group={() => "lab"}
          notMerge={() => true}
          lazyUpdate={() => true}
          silent={() => true}
          replaceMerge={() => "series"}
          loading={() => true}
          loadingOption={() => ({ text: "wait" })}
          onEvents={() => ({
            finished: (params, chart) => {
              clicks.push(params);
              void chart;
            },
            click: (params, chart) => {
              clicks.push(params);
              void chart;
            },
            noop: undefined,
          })}
        />
      </div>
    ));
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelector('[data-slot="chart-view"]')).toBeTruthy();
    const view = root.querySelector('[data-slot="chart-view"]') as HTMLElement;
    view.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    lastResizeObserver?.trigger([]);
    lastResizeObserver?.trigger([
      { contentRect: { width: 0, height: 0 } } as ResizeObserverEntry,
    ]);
    lastResizeObserver?.trigger([
      { contentRect: { width: 400, height: 200 } } as ResizeObserverEntry,
    ]);
    option.value = {
      ...barOption,
      color: ["#f00"],
      backgroundColor: "#fff",
      series: [{ type: "line", data: [1, 2] }],
    };
    await new Promise((r) => setTimeout(r, 0));
    unmount();
  });

  test("autoResize false, loading off, and useChart throw", async () => {
    expect(() => withSetup(() => useChart())).toThrow(/ChartContainer/);
    const { unmount } = mountUi(() => (
      <ChartContainer
        config={{
          sales: { label: "Sales", color: "#f00" },
        }}
      >
        <Chart
          option={barOption}
          renderer="svg"
          style={chartSize}
          autoResize={false}
          loading={false}
        />
      </ChartContainer>
    ));
    await new Promise((r) => setTimeout(r, 0));
    lastResizeObserver?.trigger([
      { contentRect: { width: 120, height: 80 } } as ResizeObserverEntry,
    ]);
    unmount();
  });

  test("reads css color tokens and dark theme palette", async () => {
    document.documentElement.classList.add("dark");
    const original = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((elt: Element, pseudo?: string) => {
      const style = original(elt, pseudo);
      return {
        getPropertyValue: (name: string) =>
          name === "--color-sales" ? "#abc" : style.getPropertyValue(name),
      } as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle;
    const { unmount } = mountUi(() => (
      <div class="dark">
        <ChartContainer
          config={{
            sales: { label: "Sales", color: "#3366ff" },
            visitors: { theme: { light: "#111", dark: "#eee" } },
            plain: { label: "Plain" },
          }}
        >
          <Chart option={barOption} renderer="svg" style={chartSize} />
        </ChartContainer>
      </div>
    ));
    await new Promise((r) => setTimeout(r, 0));
    unmount();
    window.getComputedStyle = original;
    document.documentElement.classList.remove("dark");
  });

  test("invokes bound ECharts handlers and skips invalid instances", async () => {
    const clicks: unknown[] = [];
    const captured: Array<(params: unknown) => void> = [];
    const originalInit = echarts.init.bind(echarts);
    const initSpy = spyOn(echarts, "init").mockImplementation(
      ((el, theme, opts) => {
        if (theme === "skip") return {};
        if (theme === "missing") return null;
        const instance = originalInit(el, theme, opts);
        const origOn = instance.on.bind(instance);
        instance.on = ((eventName: string, handler: (params: unknown) => void) => {
          captured.push(handler);
          origOn(eventName, handler);
          return instance;
        }) as typeof instance.on;
        return instance;
      }) as typeof echarts.init,
    );

    try {
      const invalid = mountUi(() => (
        <Chart option={barOption} theme="skip" renderer="svg" style={chartSize} />
      ));
      await new Promise((r) => setTimeout(r, 0));
      invalid.unmount();

      const missing = mountUi(() => (
        <Chart
          option={barOption}
          theme="missing"
          renderer="svg"
          style={chartSize}
        />
      ));
      await new Promise((r) => setTimeout(r, 0));
      missing.unmount();

      const { unmount } = mountUi(() => (
        <Chart
          option={{ ...barOption, animation: false }}
          renderer="svg"
          style={chartSize}
          onEvents={{
            click: (params, chart) => {
              clicks.push(params);
              void chart;
            },
          }}
        />
      ));
      await new Promise((r) => setTimeout(r, 0));
      expect(captured.length).toBeGreaterThan(0);
      const handler = captured[0];
      if (handler) handler({ type: "click" });
      expect(clicks).toEqual([{ type: "click" }]);
      unmount();
    } finally {
      initSpy.mockRestore();
    }
  });

  test("skips same-size resize and follows window resize", async () => {
    let resizes = 0;
    let captured: EChartsOption | undefined;
    const { root, unmount } = mountUi(() => (
      <ChartContainer
        config={{ sales: { label: "Sales", color: "#3366ff" } }}
      >
        <Chart
          option={{
            ...barOption,
            tooltip: { trigger: "axis" },
          }}
          renderer="svg"
          style={chartSize}
          onReady={(chart) => {
            const originalResize = chart.resize.bind(chart);
            chart.resize = (opts) => {
              resizes += 1;
              originalResize(opts);
            };
            const originalSetOption = chart.setOption.bind(chart);
            chart.setOption = (option, opts) => {
              captured = option;
              originalSetOption(option, opts);
            };
          }}
        />
      </ChartContainer>
    ));
    await new Promise((r) => setTimeout(r, 0));
    expect(root.querySelector('[data-slot="chart"]')?.className).toContain(
      "overflow-hidden",
    );
    const tooltip = captured?.tooltip;
    const single = Array.isArray(tooltip) ? tooltip[0] : tooltip;
    expect(single?.showContent).not.toBe(false);
    lastResizeObserver?.trigger([
      { contentRect: { width: 400, height: 200 } } as ResizeObserverEntry,
    ]);
    const afterFirst = resizes;
    lastResizeObserver?.trigger([
      { contentRect: { width: 400, height: 200 } } as ResizeObserverEntry,
    ]);
    expect(resizes).toBe(afterFirst);
    window.dispatchEvent(new Event("resize"));
    unmount();
  });

  test("inits from the host box when client size is already known", async () => {
    const proto = HTMLElement.prototype;
    const widthDesc = Object.getOwnPropertyDescriptor(proto, "clientWidth");
    const heightDesc = Object.getOwnPropertyDescriptor(proto, "clientHeight");
    Object.defineProperty(proto, "clientWidth", {
      configurable: true,
      get() {
        return 400;
      },
    });
    Object.defineProperty(proto, "clientHeight", {
      configurable: true,
      get() {
        return 225;
      },
    });
    try {
      const boxed = mountUi(() => (
        <Chart option={barOption} renderer="svg" style={chartSize} />
      ));
      await flush();
      boxed.unmount();
    } finally {
      if (widthDesc) Object.defineProperty(proto, "clientWidth", widthDesc);
      else delete (proto as { clientWidth?: number }).clientWidth;
      if (heightDesc) Object.defineProperty(proto, "clientHeight", heightDesc);
      else delete (proto as { clientHeight?: number }).clientHeight;
    }
  });
});
