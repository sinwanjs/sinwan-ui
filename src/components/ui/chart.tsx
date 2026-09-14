import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { effect, signal } from "sinwan/reactivity";
import * as echarts from "echarts";
import type {
  EChartsInitOpts,
  EChartsOption,
  SetOptionOpts,
} from "echarts/types/dist/echarts";

import { cn } from "../../lib/utils";

export type EChartsInstance = {
  group: string;
  setOption: (option: EChartsOption, opts?: SetOptionOpts) => void;
  resize: (opts?: { width?: number; height?: number }) => void;
  dispose: () => void;
  isDisposed: () => boolean;
  showLoading: (name?: string, opts?: Record<string, unknown>) => void;
  hideLoading: () => void;
  on: (eventName: string, handler: (params: unknown) => void) => void;
  off: (eventName: string, handler?: (params: unknown) => void) => void;
};

function isChartInstance(value: unknown): value is EChartsInstance {
  if (typeof value !== "object" || value === null) return false;
  const chart = value as Record<string, unknown>;
  return (
    typeof chart.setOption === "function" &&
    typeof chart.resize === "function" &&
    typeof chart.dispose === "function" &&
    typeof chart.isDisposed === "function" &&
    typeof chart.showLoading === "function" &&
    typeof chart.hideLoading === "function" &&
    typeof chart.on === "function" &&
    typeof chart.off === "function"
  );
}

const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = Record<
  string,
  {
    label?: SinwanNode | string;
    icon?: (props?: { class?: string }) => SinwanNode;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

type ChartContextProps = {
  config: ChartConfig;
  chartId: string;
  instance: () => EChartsInstance | null;
  setInstance: (chart: EChartsInstance | null) => void;
};

const ChartKey: InjectionKey<ChartContextProps> = Symbol("sinwan-ui.chart");

function useChart(): ChartContextProps {
  const context = inject(ChartKey);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

type Live<T> = T | (() => T);

function readLive<T>(value: Live<T> | undefined): T | undefined {
  if (typeof value === "function") {
    return (value as () => T)();
  }
  return value;
}

function readOption(
  value: Live<EChartsOption> | undefined,
): EChartsOption {
  const option = readLive(value);
  return option ?? {};
}

let chartIdSeq = 0;

export type ChartContainerProps = JSX.IntrinsicElements["div"] & {
  config: ChartConfig;
  id?: string;
  children?: SinwanNode;
};

export const ChartContainer = cc<ChartContainerProps>((props) => {
  chartIdSeq += 1;
  const chartId = `chart-${props.id ?? chartIdSeq}`;
  const instance = signal<EChartsInstance | null>(null);

  provide(ChartKey, {
    config: props.config,
    chartId,
    instance: () => instance.value,
    setInstance: (chart: EChartsInstance | null) => {
      instance.value = chart;
    },
  });

  return (
    <div
      data-slot="chart"
      data-chart={chartId}
      class={cn(
        "relative w-full min-h-[16rem] min-w-0 aspect-video overflow-hidden text-xs",
        props.class,
      )}
      style={props.style}
    >
      <ChartStyle id={chartId} config={props.config} />
      {props.children}
    </div>
  );
});

export function ChartStyle({
  id,
  config,
}: {
  id: string;
  config: ChartConfig;
}): SinwanNode {
  const colorConfig = Object.entries(config).filter(
    ([, item]) => item.theme ?? item.color,
  );

  if (!colorConfig.length) return null;

  const css = Object.entries(THEMES)
    .map(
      ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ??
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
    )
    .join("\n");

  return (
    <style
      {...({
        dangerouslySetInnerHTML: { __html: css },
      } as Record<string, unknown>)}
    />
  );
}

function isDarkRoot(el: HTMLElement): boolean {
  return (
    Boolean(el.closest(".dark")) ||
    document.documentElement.classList.contains("dark")
  );
}

function paletteFromConfig(
  config: ChartConfig,
  el: HTMLElement,
): string[] {
  const colors: string[] = [];
  for (const [key, item] of Object.entries(config)) {
    let color: string | undefined;
    const css =
      el.ownerDocument.defaultView
        ?.getComputedStyle(el)
        .getPropertyValue(`--color-${key}`)
        .trim() ?? "";
    if (css.length > 0) color = css;
    if (!color && "color" in item && typeof item.color === "string") {
      color = item.color;
    }
    if (!color && item.theme) {
      color = isDarkRoot(el) ? item.theme.dark : item.theme.light;
    }
    if (color) colors.push(color);
  }
  return colors;
}

function withChartDefaults(
  option: EChartsOption,
  palette: string[],
): EChartsOption {
  const next: EChartsOption = { ...option };
  if (next.color == null && palette.length > 0) {
    next.color = palette;
  }
  if (next.backgroundColor == null) {
    next.backgroundColor = "transparent";
  }
  return next;
}

function roundedBox(width: number, height: number): string {
  return `${Math.round(width)}x${Math.round(height)}`;
}

export type ChartEventHandler = (
  params: unknown,
  chart: EChartsInstance,
) => void;

export type ChartProps = Omit<JSX.IntrinsicElements["div"], "on"> & {
  option: Live<EChartsOption>;
  theme?: Live<string | object | null>;
  renderer?: Live<"canvas" | "svg">;
  initOpts?: Live<Omit<EChartsInitOpts, "renderer">>;
  notMerge?: Live<boolean>;
  replaceMerge?: Live<SetOptionOpts["replaceMerge"]>;
  lazyUpdate?: Live<boolean>;
  silent?: Live<boolean>;
  autoResize?: Live<boolean>;
  loading?: Live<boolean>;
  loadingOption?: Live<Record<string, unknown>>;
  group?: Live<string>;
  onEvents?: Live<Record<string, ChartEventHandler | undefined>>;
  onReady?: (chart: EChartsInstance) => void;
};

export const Chart = cc<ChartProps>((props) => {
  const ctx = inject<ChartContextProps | undefined>(ChartKey, undefined);
  const hostEl = signal<HTMLElement | null>(null);

  onMounted(() => {
    const el = hostEl.value;
    if (!el) return;

    const renderer = readLive(props.renderer) ?? "canvas";
    const theme = readLive(props.theme) ?? null;
    const initOpts = readLive(props.initOpts);
    const hasBox = el.clientWidth > 0 && el.clientHeight > 0;
    const created: unknown = echarts.init(el, theme, {
      ...(hasBox ? {} : { width: 320, height: 180 }),
      ...(initOpts ?? {}),
      renderer,
    });
    if (!isChartInstance(created)) return;
    const chart = created;
    const group = readLive(props.group);
    if (group) chart.group = group;

    ctx?.setInstance(chart);
    props.onReady?.(chart);

    const bound = new Map<string, (params: unknown) => void>();

    const sync = () => {
      if (chart.isDisposed()) return;
      const option = readOption(props.option);
      const palette = ctx ? paletteFromConfig(ctx.config, el) : [];
      chart.setOption(withChartDefaults(option, palette), {
        notMerge: Boolean(readLive(props.notMerge)),
        lazyUpdate: Boolean(readLive(props.lazyUpdate)),
        silent: Boolean(readLive(props.silent)),
        replaceMerge: readLive(props.replaceMerge),
      });
      if (readLive(props.loading)) {
        chart.showLoading("default", readLive(props.loadingOption));
      } else {
        chart.hideLoading();
      }

      for (const [name, fn] of bound) {
        chart.off(name, fn);
      }
      bound.clear();
      const events = readLive(props.onEvents);
      if (!events) return;
      for (const name of Object.keys(events)) {
        const handler = events[name];
        if (!handler) continue;
        const wrapped = (params: unknown) => {
          handler(params, chart);
        };
        bound.set(name, wrapped);
        chart.on(name, wrapped);
      }
    };

    const stop = effect(sync);

    const sizeEl =
      (el.parentElement?.closest("[data-slot=chart]") as HTMLElement | null) ??
      el;
    let lastBox = "";
    const resizeTo = (width: number, height: number) => {
      let nextWidth = width;
      let nextHeight = height;
      if (nextWidth <= 0 && nextHeight <= 0) {
        if (lastBox !== "") return;
        nextWidth = 320;
        nextHeight = 180;
      }
      const nextBox = roundedBox(nextWidth, nextHeight);
      if (nextBox === lastBox) return;
      lastBox = nextBox;
      if (!chart.isDisposed()) {
        chart.resize({
          width: Math.round(nextWidth),
          height: Math.round(nextHeight),
        });
      }
    };

    let observer: ResizeObserver | undefined;
    const view = el.ownerDocument.defaultView;
    const onWindowResize = () => {
      resizeTo(sizeEl.clientWidth, sizeEl.clientHeight);
    };
    if (readLive(props.autoResize) !== false) {
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          resizeTo(entry.contentRect.width, entry.contentRect.height);
        });
        observer.observe(sizeEl);
      }
      view?.addEventListener("resize", onWindowResize);
      resizeTo(sizeEl.clientWidth, sizeEl.clientHeight);
      view?.requestAnimationFrame(() => {
        resizeTo(sizeEl.clientWidth, sizeEl.clientHeight);
      });
    }

    onUnmounted(() => {
      stop();
      observer?.disconnect();
      view?.removeEventListener("resize", onWindowResize);
      for (const [name, fn] of bound) {
        if (!chart.isDisposed()) chart.off(name, fn);
      }
      bound.clear();
      if (!chart.isDisposed()) chart.dispose();
      ctx?.setInstance(null);
    });
  });

  return (
    <div
      data-slot="chart-view"
      class={cn(
        ctx
          ? "absolute inset-0 size-full min-h-0 min-w-0 overflow-hidden"
          : "relative h-full min-h-[16rem] w-full min-w-0 overflow-hidden",
        props.class,
      )}
      style={props.style}
      ref={(el: HTMLElement | null) => {
        hostEl.value = el;
      }}
    />
  );
});

export { echarts, useChart, THEMES };
export type { EChartsOption, EChartsInitOpts, SetOptionOpts };
