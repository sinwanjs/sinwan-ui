import { cc } from "sinwan/component";
import { signal } from "sinwan/reactivity";

/**
 * Counter Island - An interactive component that will be hydrated on the client
 */
export const Counter = cc<{ initial?: number }>(({ initial = 0 }) => {
  const count = signal(initial);

  return (
    <div class="counter">
      <h3>Interactive Counter</h3>
      <p>Count: {count}</p>
      <button
        onClick={() => count.value++}
        style="padding: 8px 16px; margin: 4px;"
      >
        +
      </button>
      <button
        onClick={() => count.value--}
        style="padding: 8px 16px; margin: 4px;"
      >
        -
      </button>
    </div>
  );
});
