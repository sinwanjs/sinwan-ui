import { cc } from "sinwan/component";
import { signal } from "sinwan/reactivity";

/**
 * Counter - Normal interactive component (NOT an island)
 * Fully hydrated by the main hydrate() call
 */
export const Counter = cc<{ initial?: number }>(({ initial = 0 }) => {
  const count = signal(initial);

  return (
    <div style="padding: 20px; border: 2px solid #3498db; border-radius: 8px; margin: 10px 0;">
      <h3>Interactive Counter</h3>
      <p>Count: {count}</p>
      <button
        onClick={() => count.value++}
        style="padding: 8px 16px; margin: 4px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        +
      </button>
      <button
        onClick={() => count.value--}
        style="padding: 8px 16px; margin: 4px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        -
      </button>
    </div>
  );
});
