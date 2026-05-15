// ─── Types ─────────────────────────────────────────────────

export type {
  SinwanNode,
  SinwanSyncNode,
  SinwanElement,
  SinwanComponent,
  SinwanSlots,
  SinwanPrimitive,
  Reactive,
  RenderResult,
  PropsWithChildren,
  PropsWithSlots,
} from "./types.ts";

// ─── JSX Runtime ───────────────────────────────────────────

export {
  jsx,
  jsxs,
  jsxDEV,
  Fragment,
  raw,
  HtmlEscapedString,
} from "./jsx/jsx-runtime.ts";
export { escapeHtml, safeHtml, isSafeHtml } from "./escaper.ts";

// ─── Reactivity ────────────────────────────────────────────

export {
  signal,
  isSignal,
  computed,
  isComputed,
  effect,
  untrack,
  on,
  observable,
  batch,
  nextTick,
} from "./reactivity/index.ts";

export type {
  Signal,
  Computed,
  CleanupFn,
  EffectFn,
  Observer,
  Subscription,
  Observable,
} from "./reactivity/index.ts";

// ─── Components ────────────────────────────────────────────

export {
  cc,
  Show,
  For,
  Switch,
  Match,
  Index,
  Key,
  Dynamic,
  Visible,
  Portal,
  ErrorBoundary,
  Virtual,
} from "./component/index.ts";

export {
  onMounted,
  onUnmounted,
  onUpdated,
  onError,
  onDispose,
  onClient,
  onHydrated,
  onServer,
} from "./component/index.ts";

export { provide, inject, getCurrentInstance } from "./component/index.ts";

export {
  island,
  isIslandElement,
  ISLAND_TAG,
  ISLAND_ATTR,
  ISLAND_PROPS_ATTR,
} from "./component/index.ts";

export type { IslandOptions, IslandMeta } from "./component/index.ts";

export type {
  ComponentInstance,
  InjectionKey,
  ShowProps,
  ForProps,
  SwitchProps,
  MatchProps,
  IndexProps,
  KeyProps,
  DynamicProps,
  DynamicTag,
  VisibleProps,
  PortalProps,
  ErrorBoundaryProps,
  VirtualProps,
} from "./component/index.ts";

// ─── Renderer ──────────────────────────────────────────────

export {
  mount,
  render,
  unmountNode,
  renderNodeToDOM,
  renderElementToDOM,
  domOps,
  setDOMOps,
  resetDOMOps,
  _$createTemplate,
} from "./renderer/index.ts";

export type { MountedNode, AppInstance, DOMOps } from "./renderer/index.ts";

// ─── Hydration ─────────────────────────────────────────────

export { hydrate, hydrateIslands } from "./hydration/index.ts";
export type {
  IslandRegistry,
  HydrateIslandsOptions,
  HydratedIsland,
} from "./hydration/index.ts";

// ─── React interop (SHARED) ───────────────────────────
// Authored from scratch — zero `react` / `react-dom` dependency.
// CLIENT/SERVER/STATIC adapters live behind sub-path exports.

export {
  Fragment as ReactFragment,
  createContext,
  memo,
  lazy,
  use,
  cache,
  cacheSignal,
  addTransitionType,
  captureOwnerStack,
} from "./integrations/react/_shared.ts";

export type {
  ReactNode,
  ReactElement,
  Key as ReactKey,
  Ref,
  RefObject,
  MutableRefObject,
  RefCallback,
  ComponentType,
  FunctionComponent,
  FC,
  MemoExoticComponent,
  LazyExoticComponent,
  ErrorInfo,
  Context,
  Provider as ContextProvider,
  Consumer as ContextConsumer,
  ContextType,
  Usable,
} from "./integrations/react/_shared.ts";

// ─── Server (SSR) ──────────────────────────────────────────

export {
  renderToString,
  renderPage,
  registerPage,
  getPage,
  hasPage,
  streamPage,
  streamHydratablePage,
  streamHydratableNode,
  renderToHydratableString,
  renderNodeToHydratableString,
  renderShell,
  streamShell,
} from "./server/index.ts";

export type {
  ShellOptions,
  ShellScript,
  ShellStylesheet,
} from "./server/index.ts";
