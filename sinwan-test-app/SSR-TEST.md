# Sinwan SSR + Islands Architecture Test

This test demonstrates Sinwan's server-side rendering and partial hydration (Islands) architecture.

## Architecture Overview

### Server (`src/server/`)
- **renderToString()** — Static SSR, no hydration markers (lightweight)
- **renderToHydratableString()** — SSR with hydration markers for full hydration
- **streamHydratablePage()** — Progressive streaming with hydration markers
- **Island Markers** — `data-sinwan-island` attributes for partial hydration

### Hydration (`src/hydration/`)
- **hydrate()** — Full client-side hydration of server-rendered DOM
- **hydrateIslands()** — Partial hydration of only marked islands
- **walk.ts** — DOM walker that matches markers to reactive nodes

## Test Files

| File | Purpose |
|------|---------|
| `src/components/Counter.tsx` | Interactive island component |
| `src/components/IslandPage.tsx` | Page using islands + static content |
| `src/server-ssr.ts` | SSR server with 3 rendering modes |
| `src/hydrate-islands.tsx` | Client hydration entry point |

## Running the Test

```bash
# Start the SSR server on port 3002
bun run src/server-ssr.ts

# Endpoints:
#   http://localhost:3002/static  - Static SSR (no JS)
#   http://localhost:3002/        - SSR with island hydration
#   http://localhost:3002/stream  - Streaming SSR
```

## How Islands Work

1. **Server renders everything** — Both static and interactive content
2. **Island wrapper** — `island(Component)` marks hydration boundaries
3. **Hydration markers** — Server injects `data-sinwan-island="Name"` + JSON props
4. **Client hydrates selectively** — `hydrateIslands()` finds markers, hydrates only those

```tsx
// Mark a component as an island
const CounterIsland = island(Counter, { name: "Counter" });

// Use it - server renders, client hydrates only this part
<CounterIsland initial={5} />

// Client finds and hydrates
hydrateIslands({ Counter }, document);
```

## Benefits

- **Zero JS** for static content (better performance)
- **Interactive islands** where needed
- **SEO-friendly** — Full HTML on initial load
- **Progressive enhancement** — Works without JS, enhanced with JS
