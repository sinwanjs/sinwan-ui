import {
  cc,
  inject,
  onMounted,
  onUnmounted,
  provide,
  type InjectionKey,
  type SinwanNode,
} from "sinwan/component";
import { signal } from "sinwan/reactivity";

import { cn, jsxClass } from "../../lib/utils";

function svgNode(
  tag: string,
  props: Record<string, unknown>,
  children: SinwanNode[] = [],
): SinwanNode {
  return { tag, props, children };
}

const THEMES = { light: "", dark: ".dark" } as const;
const INITIAL_DIMENSION = { width: 320, height: 200 } as const;

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
  width: () => number;
  height: () => number;
};

const ChartKey: InjectionKey<ChartContextProps> = Symbol("sinwan-ui.chart");

function useChart(): ChartContextProps {
  const context = inject(ChartKey);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

let chartIdSeq = 0;

export type ChartContainerProps = JSX.IntrinsicElements["div"] & {
  config: ChartConfig;
  id?: string;
  children?: SinwanNode;
  initialDimension?: { width: number; height: number };
};

export const ChartContainer = cc<ChartContainerProps>(
  ({
    id,
    class: className,
    children,
    config,
    initialDimension = INITIAL_DIMENSION,
    ...props
  }) => {
    chartIdSeq += 1;
    const chartId = `chart-${id ?? chartIdSeq}`;
    const width = signal(initialDimension.width);
    const height = signal(initialDimension.height);
    let containerEl: HTMLElement | null = null;

    onMounted(() => {
      if (!containerEl || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width: w, height: h } = entry.contentRect;
        if (w > 0) width.value = Math.floor(w);
        if (h > 0) height.value = Math.floor(h);
      });
      observer.observe(containerEl);
      onUnmounted(() => observer.disconnect());
    });

    provide(ChartKey, {
      config,
      width: () => width.value,
      height: () => height.value,
    });

    return (
      <div
        data-slot="chart"
        data-chart={chartId}
        class={cn(
          "flex aspect-video justify-center text-xs [&_svg]:overflow-visible",
          className,
        )}
        ref={(el: HTMLElement | null) => {
          containerEl = el;
        }}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <div class="size-full min-h-0 min-w-0">{children}</div>
      </div>
    );
  },
);

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

export type ChartTooltipPayloadItem = {
  name?: string;
  dataKey?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

export type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
  children?: SinwanNode;
  class?: string;
};

export function ChartTooltip({
  active,
  children,
  class: className,
}: ChartTooltipProps) {
  if (!active) return null;
  return (
    <div data-slot="chart-tooltip" class={cn(className)}>
      {children}
    </div>
  );
}

export type ChartTooltipContentProps = {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  class?: string;
  indicator?: "line" | "dot" | "dashed";
  hideLabel?: boolean;
  hideIndicator?: boolean;
  label?: string;
  labelFormatter?: (
    value: unknown,
    payload: ChartTooltipPayloadItem[],
  ) => SinwanNode;
  labelClass?: string;
  formatter?: (
    value: number | string,
    name: string,
    item: ChartTooltipPayloadItem,
    index: number,
    payload?: Record<string, unknown>,
  ) => SinwanNode;
  color?: string;
  nameKey?: string;
  labelKey?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  class: className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClass,
  formatter,
  color,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  const [first] = payload;
  const key = `${labelKey ?? first?.dataKey ?? first?.name ?? "value"}`;
  const itemConfig = getPayloadConfigFromPayload(config, first, key);
  const labelValue =
    !labelKey && typeof label === "string"
      ? (config[label]?.label ?? label)
      : itemConfig?.label;

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      class={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!nestLabel && !hideLabel
        ? labelFormatter
          ? (
              <div class={cn("font-medium", labelClass)}>
                {labelFormatter(labelValue, payload)}
              </div>
            )
          : labelValue
            ? (
                <div class={cn("font-medium", labelClass)}>{labelValue}</div>
              )
            : null
        : null}
      <div class="grid gap-1.5">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => {
            const itemKey = `${nameKey ?? item.name ?? item.dataKey ?? "value"}`;
            const cfg = getPayloadConfigFromPayload(config, item, itemKey);
            const indicatorColor =
              color ?? item.payload?.fill ?? item.fill ?? item.color;

            return (
              <div
                class={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center",
                )}
              >
                {formatter && item.value !== undefined && item.name
                  ? formatter(
                      item.value,
                      item.name,
                      item,
                      index,
                      item.payload,
                    )
                  : (
                      <>
                        {cfg?.icon ? (
                          cfg.icon()
                        ) : (
                          !hideIndicator && (
                            <div
                              class={cn(
                                "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                                {
                                  "h-2.5 w-2.5": indicator === "dot",
                                  "w-1": indicator === "line",
                                  "w-0 border-[1.5px] border-dashed bg-transparent":
                                    indicator === "dashed",
                                  "my-0.5": nestLabel && indicator === "dashed",
                                },
                              )}
                              style={
                                {
                                  "--color-bg": indicatorColor,
                                  "--color-border": indicatorColor,
                                } as unknown as string
                              }
                            />
                          )
                        )}
                        <div
                          class={cn(
                            "flex flex-1 justify-between leading-none",
                            nestLabel ? "items-end" : "items-center",
                          )}
                        >
                          <div class="grid gap-1.5">
                            {nestLabel && !hideLabel ? (
                              <div class={cn("font-medium", labelClass)}>
                                {labelValue}
                              </div>
                            ) : null}
                            <span class="text-muted-foreground">
                              {cfg?.label ?? item.name}
                            </span>
                          </div>
                          {item.value != null && (
                            <span class="font-mono font-medium text-foreground tabular-nums">
                              {typeof item.value === "number"
                                ? item.value.toLocaleString()
                                : String(item.value)}
                            </span>
                          )}
                        </div>
                      </>
                    )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export type ChartLegendPayloadItem = {
  value?: string;
  dataKey?: string;
  color?: string;
  type?: string;
};

export function ChartLegend({
  class: className,
  children,
}: {
  class?: string;
  children?: SinwanNode;
}) {
  return (
    <div data-slot="chart-legend" class={cn(className)}>
      {children}
    </div>
  );
}

export type ChartLegendContentProps = {
  class?: string;
  hideIcon?: boolean;
  payload?: ChartLegendPayloadItem[];
  verticalAlign?: "top" | "bottom";
  nameKey?: string;
};

export function ChartLegendContent({
  class: className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: ChartLegendContentProps) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div
      class={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = `${nameKey ?? item.dataKey ?? "value"}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);
          return (
            <div class="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground">
              {itemConfig?.icon && !hideIcon ? (
                itemConfig.icon()
              ) : (
                <div
                  class="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {itemConfig?.label ?? item.value}
            </div>
          );
        })}
    </div>
  );
}

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string,
) {
  if (typeof payload !== "object" || payload === null) return undefined;

  const record = payload as Record<string, unknown>;
  const nested =
    "payload" in record &&
    typeof record.payload === "object" &&
    record.payload !== null
      ? (record.payload as Record<string, unknown>)
      : undefined;

  let configLabelKey = key;
  if (key in record && typeof record[key] === "string") {
    configLabelKey = record[key] as string;
  } else if (nested && key in nested && typeof nested[key] === "string") {
    configLabelKey = nested[key] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

// ─── SVG chart helpers ───────────────────────────────────────

export type ChartSeriesPoint = Record<string, number | string>;

function seriesColor(config: ChartConfig, key: string): string {
  return `var(--color-${key}, ${config[key]?.color ?? "currentColor"})`;
}

export type ChartBarProps = {
  data: ChartSeriesPoint[];
  dataKey: string;
  categoryKey?: string;
  class?: string;
  fill?: string;
  gap?: number;
};

export const ChartBar = cc<ChartBarProps>(
  ({ data, dataKey, class: className, fill, gap = 8 }) => {
    const chart = useChart();
    const values = data.map((d) => Number(d[dataKey] ?? 0));
    const max = Math.max(1, ...values.map((v) => Math.abs(v)));

    return (
      <svg
        data-slot="chart-bar"
        class={cn("size-full", className)}
        width={jsxClass(() => chart.width())}
        height={jsxClass(() => chart.height())}
        viewBox={jsxClass(() => `0 0 ${chart.width()} ${chart.height()}`)}
      >
        {() => {
          const w = chart.width();
          const h = chart.height();
          const barWidth = Math.max(
            1,
            (w - gap * (data.length + 1)) / Math.max(1, data.length),
          );
          return data.map((point, index) => {
            const value = Number(point[dataKey] ?? 0);
            const barHeight = (Math.abs(value) / max) * (h - 16);
            const x = gap + index * (barWidth + gap);
            const y = h - barHeight - 8;
            return svgNode("rect", {
              x: String(x),
              y: String(y),
              width: String(barWidth),
              height: String(barHeight),
              rx: "4",
              fill: fill ?? seriesColor(chart.config, dataKey),
            });
          });
        }}
      </svg>
    );
  },
);

export type ChartLineProps = {
  data: ChartSeriesPoint[];
  dataKey: string;
  class?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: boolean;
};

function linePath(
  data: ChartSeriesPoint[],
  dataKey: string,
  width: number,
  height: number,
): string {
  if (!data.length) return "";
  const values = data.map((d) => Number(d[dataKey] ?? 0));
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);
  const step = data.length === 1 ? 0 : width / (data.length - 1);
  return data
    .map((point, index) => {
      const value = Number(point[dataKey] ?? 0);
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 16) - 8;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export const ChartLine = cc<ChartLineProps>(
  ({ data, dataKey, class: className, stroke, strokeWidth = 2 }) => {
    const chart = useChart();
    return (
      <svg
        data-slot="chart-line"
        class={cn("size-full", className)}
        width={jsxClass(() => chart.width())}
        height={jsxClass(() => chart.height())}
        viewBox={jsxClass(() => `0 0 ${chart.width()} ${chart.height()}`)}
      >
        {svgNode("path", {
          d: jsxClass(() =>
            linePath(data, dataKey, chart.width(), chart.height()),
          ),
          fill: "none",
          stroke: stroke ?? seriesColor(chart.config, dataKey),
          "stroke-width": strokeWidth,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        })}
      </svg>
    );
  },
);

export type ChartAreaProps = ChartLineProps;

export const ChartArea = cc<ChartAreaProps>(
  ({ data, dataKey, class: className, stroke, strokeWidth = 2 }) => {
    const chart = useChart();
    return (
      <svg
        data-slot="chart-area"
        class={cn("size-full", className)}
        width={jsxClass(() => chart.width())}
        height={jsxClass(() => chart.height())}
        viewBox={jsxClass(() => `0 0 ${chart.width()} ${chart.height()}`)}
      >
        {() => {
          const w = chart.width();
          const h = chart.height();
          const line = linePath(data, dataKey, w, h);
          if (!line) return null;
          const area = `${line} L${w},${h - 8} L0,${h - 8} Z`;
          const color = stroke ?? seriesColor(chart.config, dataKey);
          return (
            <>
              {svgNode("path", { d: area, fill: color, opacity: "0.2" })}
              {svgNode("path", {
                d: line,
                fill: "none",
                stroke: color,
                "stroke-width": strokeWidth,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
              })}
            </>
          );
        }}
      </svg>
    );
  },
);

export type ChartPieSlice = {
  key: string;
  value: number;
  label?: string;
};

export type ChartPieProps = {
  data: ChartPieSlice[];
  class?: string;
  innerRadius?: number;
};

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  inner: number,
  start: number,
  end: number,
): string {
  const large = end - start > 180 ? 1 : 0;
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  if (inner <= 0) {
    return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large} 0 ${e.x},${e.y} Z`;
  }
  const si = polar(cx, cy, inner, end);
  const ei = polar(cx, cy, inner, start);
  return `M${s.x},${s.y} A${r},${r} 0 ${large} 0 ${e.x},${e.y} L${ei.x},${ei.y} A${inner},${inner} 0 ${large} 1 ${si.x},${si.y} Z`;
}

export const ChartPie = cc<ChartPieProps>(
  ({ data, class: className, innerRadius = 0 }) => {
    const chart = useChart();
    const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);

    return (
      <svg
        data-slot="chart-pie"
        class={cn("size-full", className)}
        width={jsxClass(() => chart.width())}
        height={jsxClass(() => chart.height())}
        viewBox={jsxClass(() => `0 0 ${chart.width()} ${chart.height()}`)}
      >
        {() => {
          const w = chart.width();
          const h = chart.height();
          const cx = w / 2;
          const cy = h / 2;
          const r = Math.min(w, h) / 2 - 4;
          const ir = Math.min(innerRadius, r - 1);
          let angle = 0;
          return data.map((slice) => {
            const portion = total > 0 ? (slice.value / total) * 360 : 0;
            const start = angle;
            const end = angle + portion;
            angle = end;
            return svgNode("path", {
              d: arcPath(cx, cy, r, ir, start, end),
              fill: seriesColor(chart.config, slice.key),
            });
          });
        }}
      </svg>
    );
  },
);

export { useChart, THEMES };
