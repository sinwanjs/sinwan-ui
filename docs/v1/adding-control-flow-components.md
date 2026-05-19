# Adding Control Flow Components to Sinwan

This guide explains how to add a new control flow component (like `<Show>`, `<For>`, `<Virtual>`) to Sinwan with full integration across client-side rendering, server-side rendering (SSR), and hydration.

---

## Overview

A control flow component in Sinwan requires integration across 5 layers:

1. **Component Definition** (`src/component/control-flow.ts`) - Props interface, symbol type, component function
2. **Client Renderer** (`src/renderer/render-control-flow.ts`) - Reactive DOM updates
3. **Hydration** (`src/hydration/walk.ts`) - Attaching reactivity to server-rendered HTML
4. **Server Renderer** (`src/server/`) - SSR output (if special handling needed)
5. **Tests & Documentation** - Unit tests, integration tests, API docs

---

## Step 1: Define the Component

### Location: `src/component/control-flow.ts`

### 1.1 Add a unique Symbol type

```typescript
export const YOUR_COMPONENT_TYPE = Symbol.for("Sinwan.YourComponent");
```

### 1.2 Define the props interface

```typescript
export interface YourComponentProps<T> {
  /**
   * Description of the required prop
   */
  requiredProp: Reactive<T>;
  /**
   * Description of optional prop
   */
  optionalProp?: SinwanNode;
  /**
   * Render function or content
   */
  children?: SinwanNode | ((value: T) => SinwanNode);
}
```

### 1.3 Create the component function

```typescript
export function YourComponent<T>(props: YourComponentProps<T>): SinwanElement {
  return {
    tag: YOUR_COMPONENT_TYPE,
    props: props as unknown as Record<string, unknown>,
    children: [],
  };
}
```

### 1.4 Add a type guard function

```typescript
export function isYourComponentElement(element: SinwanElement): boolean {
  return element.tag === YOUR_COMPONENT_TYPE;
}
```

### 1.5 Add helper functions (if needed)

If your component needs to resolve children based on props (like `<Show>`, `<Key>`, `<Match>`):

```typescript
export function resolveYourComponentChildren(
  element: SinwanElement,
  value: unknown,
): SinwanNode {
  const children = (element.props as any).children ?? element.children;
  if (typeof children === "function") {
    return children(value);
  }
  return children as SinwanNode;
}
```

### 1.6 Update the expansion logic (if needed)

If your component should be expanded in `findTruthyMatch` (for `<Switch>` support), add it to the expansion check list around line 512-524:

```typescript
if (
  expanded.tag === MATCH_TYPE ||
  expanded.tag === SHOW_TYPE ||
  expanded.tag === FOR_TYPE ||
  expanded.tag === INDEX_TYPE ||
  expanded.tag === KEY_TYPE ||
  expanded.tag === SWITCH_TYPE ||
  expanded.tag === DYNAMIC_TYPE ||
  expanded.tag === PORTAL_TYPE ||
  expanded.tag === VIRTUAL_TYPE ||
  expanded.tag === ERROR_BOUNDARY_TYPE ||
  expanded.tag === SUSPENSE_TYPE ||
  expanded.tag === ACTIVITY_TYPE ||
  expanded.tag === VIEW_TRANSITION_TYPE ||
  expanded.tag === YOUR_COMPONENT_TYPE  // ← Add this
) {
  element = expanded;
}
```

---

## Step 2: Implement Client-Side Rendering

### Location: `src/renderer/render-control-flow.ts`

### 2.1 Import the type guard

Add to the imports at the top:

```typescript
import {
  // ... existing imports
  isYourComponentElement,
  resolveYourComponentChildren,
} from "../component/control-flow.ts";
```

### 2.2 Add the component to the main switch

Add your component to the `renderControlFlowToDOM` function around line 99-157:

```typescript
if (isYourComponentElement(element)) {
  disposeEffect = renderYourComponentBlock(
    element,
    block,
    parent,
    namespace,
    owner,
  );
}
```

### 2.3 Implement the render function

Add a new function to handle rendering:

```typescript
function renderYourComponentBlock<T>(
  element: SinwanElement,
  block: MountedReactiveBlock,
  parent: Node,
  namespace: string | null,
  owner: ComponentInstance | null,
): () => void {
  let initialized = false;

  return effect(() => {
    const props = element.props as YourComponentProps<T>;
    const value = readReactive(props.requiredProp);

    // Skip first run - DOM is already rendered
    if (!initialized) {
      initialized = true;
      // Render initial content
      block.children = withOptionalInstance(owner, () => {
        const content = typeof props.children === "function"
          ? props.children(value as T)
          : props.children;
        return renderBlockContent(
          content,
          parent,
          block.endAnchor,
          namespace,
          owner,
        );
      });
      fireMountedHooks(owner);
      return;
    }

    // Update content on reactive changes
    clearChildren(block);
    block.children = withOptionalInstance(owner, () => {
      const content = typeof props.children === "function"
        ? props.children(value as T)
        : props.children;
      return renderBlockContent(
        content,
        parent,
        block.endAnchor,
        namespace,
        owner,
      );
    });
    fireMountedAndQueueUpdated(owner);
  });
}
```

### 2.4 Handle special patterns

**For list-based components** (like `<For>`, `<Index>`):
- Use keyed reconciliation with a `Map` or array of records
- Implement insert, remove, move, and update logic
- Track items by key to enable efficient reuse

**For components with special DOM structure** (like `<Virtual>`, `<Portal>`):
- Create custom DOM structure outside the standard anchor pattern
- Handle cleanup manually (scroll listeners, portal mount points, etc.)
- Store cleanup functions in `mounted.eventCleanups`

---

## Step 3: Implement Hydration

### Location: `src/hydration/walk.ts`

### 3.1 Import the type guard

Add to the imports at the top:

```typescript
import {
  // ... existing imports
  isYourComponentElement,
} from "../component/control-flow.ts";
```

### 3.2 Add to the hydrateElement switch

Add your component to the `hydrateElement` function around line 285-299:

```typescript
if (isYourComponentElement(element)) {
  return hydrateControlFlow(element, cursor);
}
```

### 3.3 Add to the hydrateControlFlow switch

Add your component handling to the `hydrateControlFlow` function:

```typescript
if (isYourComponentElement(element)) {
  const props = element.props as YourComponentProps<unknown>;
  const value = readReactive(props.requiredProp);
  const content = typeof props.children === "function"
    ? props.children(value)
    : props.children;
  const initialMounted = hydrateContent(content, cursor);
  return makeReactiveBlock(
    initialMounted,
    () => {
      const newValue = readReactive(props.requiredProp);
      return typeof props.children === "function"
        ? props.children(newValue)
        : props.children;
    },
    value,
  );
}
```

### 3.4 Handle special hydration patterns

**For components with custom DOM structure** (like `<Virtual>`):
- Advance past custom DOM elements with `advance(cursor)`
- Validate DOM structure matches expectations
- Build custom registries (like `keyMap` for Virtual)
- Set up post-hydration reactivity (scroll listeners, effects)

**For components that render differently on first run**:
- Use `initialized` flag in the effect to skip first-run logic
- Set initial DOM state directly, then attach reactivity

---

## Step 4: Server-Side Rendering (SSR)

### Location: `src/server/` or automatic via marker system

Most control flow components work automatically through Sinwan's marker system. The server renderer:

1. Executes the component function
2. Resolves reactive values
3. Renders the resulting JSX tree
4. Inserts markers for reactive text and component boundaries

### 4.1 When custom SSR is needed

Add custom SSR handling only if your component:

- Renders a non-standard DOM structure (like `<Virtual>`'s container/content divs)
- Needs server-side only logic
- Must emit special markers or attributes

Example for `<Virtual>` (which has custom SSR):

```typescript
// In server renderer
if (isVirtualElement(element)) {
  const props = element.props as VirtualProps<unknown>;
  const items = readReactive(props.each);
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    return renderToHydratableString(props.fallback ?? null);
  }

  // Render container div with content div inside
  const containerHeight = props.containerHeight;
  const itemHeight = props.itemHeight;
  const totalHeight = list.length * itemHeight;

  // Calculate initial window
  // ... window calculation logic

  // Render only visible items
  // ... item rendering logic
}
```

### 4.2 Test SSR

Ensure your component renders correctly with `renderToHydratableString`:

```typescript
const html = await renderToHydratableString(
  () => <YourComponent requiredProp={signal("value")} />,
  {},
);
```

---

## Step 5: Add Tests

### Location: `__tests__/` or create `__tests__/control-flow/your-component.test.ts`

### 5.1 Basic rendering test

```typescript
import { describe, it, expect } from "bun:test";
import { render } from "sinwan/renderer";
import { YourComponent } from "sinwan/component";

describe("YourComponent", () => {
  it("renders children when condition is truthy", () => {
    const container = document.createElement("div");
    const { root } = render(
      () => <YourComponent requiredProp={signal(true)}>Content</YourComponent>,
      container,
    );
    expect(container.textContent).toBe("Content");
  });

  it("renders fallback when condition is falsy", () => {
    const container = document.createElement("div");
    const { root } = render(
      () => (
        <YourComponent requiredProp={signal(false)} fallback="Fallback">
          Content
        </YourComponent>
      ),
      container,
    );
    expect(container.textContent).toBe("Fallback");
  });
});
```

### 5.2 Reactivity test

```typescript
it("updates when required prop changes", () => {
  const container = document.createElement("div");
  const value = signal(true);
  const { root } = render(
    () => <YourComponent requiredProp={value}>Content</YourComponent>,
    container,
  );
  expect(container.textContent).toBe("Content");

  value.value = false;
  expect(container.textContent).toBe(""); // or fallback if provided
});
```

### 5.3 SSR test

```typescript
it("renders correctly on server", async () => {
  const html = await renderToHydratableString(
    () => <YourComponent requiredProp={signal("value")}>Content</YourComponent>,
    {},
  );
  expect(html).toContain("Content");
});
```

### 5.4 Hydration test

```typescript
it("hydrates correctly from SSR", async () => {
  const ssrHtml = await renderToHydratableString(
    () => <YourComponent requiredProp={signal("value")}>Content</YourComponent>,
    {},
  );

  const container = document.createElement("div");
  container.innerHTML = ssrHtml;

  const { root } = hydrate(
    () => <YourComponent requiredProp={signal("value")}>Content</YourComponent>,
    container,
  );

  expect(container.textContent).toBe("Content");
  // Verify reactivity works after hydration
});
```

---

## Step 6: Update Documentation

### 6.1 Add to API Reference

Location: `docs/v1/15-api-reference.md`

Add a section documenting your component:

```markdown
### YourComponent

Control flow primitive for [description].

```tsx
import { YourComponent } from "sinwan/component";

<YourComponent requiredProp={signal(value)}>
  Content
</YourComponent>
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| requiredProp | `Reactive<T>` | Yes | Description |
| optionalProp | `SinwanNode` | No | Description |
| children | `SinwanNode \| ((value: T) => SinwanNode)` | No | Content or render function |
```

### 6.2 Add to Component Docs

Location: `docs/v1/04-components.md`

Add a section with usage examples:

```markdown
### YourComponent

```tsx
import { YourComponent } from "sinwan/component";
import { signal } from "sinwan/reactivity";

const value = signal(true);

<YourComponent requiredProp={value}>
  {value => <div>{value}</div>}
</YourComponent>
```
```

### 6.3 Update Exports

Ensure your component is exported from the main entry point:

Location: `src/component/index.ts`

```typescript
export {
  // ... existing exports
  YourComponent,
  type YourComponentProps,
} from "./control-flow.ts";
```

---

## Step 7: Type Safety

### 7.1 Add to JSX intrinsic types

If your component should work with JSX without explicit import, add it to the JSX types (if applicable).

### 7.2 TypeScript checks

Run type checking to ensure no errors:

```bash
bun run typecheck
```

---

## Step 8: Build and Test

### 8.1 Run the full test suite

```bash
bun run test
```

### 8.2 Build the project

```bash
bun run build
```

### 8.3 Test in the test app

Add your component to `sinwan-test-app/src/App.tsx` or create a test page to verify it works in a real application.

---

## Checklist

Before considering your component complete:

- [ ] Component defined in `src/component/control-flow.ts`
  - [ ] Symbol type added
  - [ ] Props interface defined
  - [ ] Component function implemented
  - [ ] Type guard function added
  - [ ] Helper functions added (if needed)

- [ ] Client renderer implemented in `src/renderer/render-control-flow.ts`
  - [ ] Type guard imported
  - [ ] Added to `renderControlFlowToDOM` switch
  - [ ] Render function implemented
  - [ ] Reactive updates working
  - [ ] Cleanup handled

- [ ] Hydration implemented in `src/hydration/walk.ts`
  - [ ] Type guard imported
  - [ ] Added to `hydrateElement` switch
  - [ ] Added to `hydrateControlFlow` switch
  - [ ] Initial hydration working
  - [ ] Post-hydration reactivity working

- [ ] SSR working (if custom handling needed)
  - [ ] Server renderer implemented (if needed)
  - [ ] SSR output matches client structure

- [ ] Tests added
  - [ ] Basic rendering tests
  - [ ] Reactivity tests
  - [ ] SSR tests
  - [ ] Hydration tests

- [ ] Documentation updated
  - [ ] API reference updated
  - [ ] Component docs updated
  - [ ] Examples added

- [ ] Type safety verified
  - [ ] `bun run typecheck` passes
  - [ ] No TypeScript errors

- [ ] Build successful
  - [ ] `bun run build` passes
  - [ ] Dist files generated correctly

- [ ] Integration tested
  - [ ] Works in test app
  - [ ] Manual testing completed

---

## Example: Adding a Simple `<If>` Component

Here's a complete example of adding a simple conditional component similar to `<Show>`:

### 1. Component Definition (`src/component/control-flow.ts`)

```typescript
export const IF_TYPE = Symbol.for("Sinwan.If");

export interface IfProps<T> {
  when: Reactive<T | false | null | undefined>;
  then?: SinwanNode;
  else?: SinwanNode;
}

export function If<T>(props: IfProps<T>): SinwanElement {
  return {
    tag: IF_TYPE,
    props: props as unknown as Record<string, unknown>,
    children: [],
  };
}

export function isIfElement(element: SinwanElement): boolean {
  return element.tag === IF_TYPE;
}
```

### 2. Client Renderer (`src/renderer/render-control-flow.ts`)

```typescript
// Import
import { isIfElement } from "../component/control-flow.ts";

// Add to switch
if (isIfElement(element)) {
  disposeEffect = renderIfBlock(element, block, parent, namespace, owner);
}

// Implement render function
function renderIfBlock(
  element: SinwanElement,
  block: MountedReactiveBlock,
  parent: Node,
  namespace: string | null,
  owner: ComponentInstance | null,
): () => void {
  let initialized = false;
  let prevWhen: unknown = undefined;

  return effect(() => {
    const when = readReactive((element.props as any).when);

    if (initialized && Object.is(when, prevWhen)) {
      return;
    }
    prevWhen = when;

    clearChildren(block);
    block.children = withOptionalInstance(owner, () => {
      const content = when
        ? (element.props as any).then
        : (element.props as any).else;
      return renderBlockContent(
        content,
        parent,
        block.endAnchor,
        namespace,
        owner,
      );
    });

    if (initialized) {
      fireMountedAndQueueUpdated(owner);
    }
    initialized = true;
  });
}
```

### 3. Hydration (`src/hydration/walk.ts`)

```typescript
// Import
import { isIfElement } from "../component/control-flow.ts";

// Add to hydrateElement
if (isIfElement(element)) {
  return hydrateControlFlow(element, cursor);
}

// Add to hydrateControlFlow
if (isIfElement(element)) {
  const props = element.props as IfProps<unknown>;
  const when = readReactive(props.when);
  const content = when ? props.then : props.else;
  const initialMounted = hydrateContent(content ?? null, cursor);
  return makeReactiveBlock(
    initialMounted,
    () => {
      const newWhen = readReactive(props.when);
      return newWhen ? props.then : props.else;
    },
    when,
  );
}
```

### 4. Tests

```typescript
describe("If", () => {
  it("renders then when when is truthy", () => {
    const container = document.createElement("div");
    render(() => <If when={signal(true)} then="Then" else="Else" />, container);
    expect(container.textContent).toBe("Then");
  });

  it("renders else when when is falsy", () => {
    const container = document.createElement("div");
    render(() => <If when={signal(false)} then="Then" else="Else" />, container);
    expect(container.textContent).toBe("Else");
  });

  it("updates when when changes", () => {
    const container = document.createElement("div");
    const value = signal(true);
    render(() => <If when={value} then="Then" else="Else" />, container);
    expect(container.textContent).toBe("Then");
    value.value = false;
    expect(container.textContent).toBe("Else");
  });
});
```

---

## Common Patterns

### Pattern 1: Conditional Rendering

Like `<Show>`, `<If>` - render one of two branches based on a reactive condition.

### Pattern 2: List Iteration

Like `<For>`, `<Index>` - render a list of items with optional keys and index accessors.

### Pattern 3: Branch Selection

Like `<Switch>`, `<Match>` - render the first matching branch from multiple options.

### Pattern 4: Dynamic Tag/Component

Like `<Dynamic>` - render a tag or component determined reactively.

### Pattern 5: DOM Positioning

Like `<Portal>` - render content outside the normal DOM hierarchy.

### Pattern 6: Virtualization

Like `<Virtual>` - render only a subset of items for performance.

---

## Troubleshooting

### Component not rendering

- Check the type guard is correctly implemented
- Verify the component is added to all necessary switch statements
- Ensure the component function returns a proper `SinwanElement`

### Reactivity not working

- Verify `readReactive` is called on reactive props
- Check the effect is properly set up in the renderer
- Ensure cleanup functions are returned

### Hydration mismatches

- Verify SSR output matches the expected DOM structure
- Check the hydration cursor advances correctly
- Ensure markers are in the right places

### TypeScript errors

- Verify props interface is correctly typed
- Check generic type parameters are properly propagated
- Ensure the component is exported from the correct entry point

---

## Additional Resources

- [Component Documentation](./04-components.md)
- [Renderer Architecture](./08-renderer.md)
- [Hydration Guide](./10-hydration.md)
- [SSR Guide](./09-ssr.md)
- [API Reference](./15-api-reference.md)
