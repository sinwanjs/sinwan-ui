/**
 * Sinwan Virtual adapter for the benchmark harness.
 *
 * Uses <Virtual> for efficient rendering of large lists (10K+ rows).
 * Only renders visible items with absolute positioning.
 *
 * NOTE: This differs from js-framework-benchmark standard table layout
 * but demonstrates the performance advantage of virtualization.
 */

import { signal, type Signal } from "sinwan/reactivity";
import { mount } from "sinwan/renderer";
import { cc, Virtual } from "sinwan/component";
import type { Row } from "./data.ts";
import type { FrameworkAdapter } from "./harness.ts";

const ITEM_HEIGHT = 40; // px - matches bench-table row height
const CONTAINER_HEIGHT = 600; // px - visible viewport

export function createSinwanVirtualAdapter(): FrameworkAdapter {
  let rowsSignal: Signal<readonly Row[]> | null = null;
  let app: { unmount(): void } | null = null;

  const VirtualTable = cc(() => {
    const rows = signal<readonly Row[]>([]);
    rowsSignal = rows;

    return (
      <div class="virtual-container">
        <Virtual
          each={rows}
          itemHeight={ITEM_HEIGHT}
          containerHeight={CONTAINER_HEIGHT}
          overscan={5}
          minRendered={20}
          key={(r) => r.id}
        >
          {(row: Row) => (
            <div class="virtual-row" data-id={row.id}>
              <span class="col-id">{row.id}</span>
              <span class="col-label">{row.label}</span>
            </div>
          )}
        </Virtual>
      </div>
    );
  });

  return {
    name: "sinwan-virtual",

    mount(container) {
      // Inject styles for virtual row layout
      const style = document.createElement("style");
      style.textContent = `
        .virtual-container {
          width: 100%;
          border: 1px solid #ddd;
        }
        .virtual-row {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
          box-sizing: border-box;
          height: ${ITEM_HEIGHT}px;
        }
        .virtual-row .col-id {
          width: 60px;
          font-weight: bold;
          color: #666;
        }
        .virtual-row .col-label {
          flex: 1;
        }
      `;
      container.appendChild(style);
      app = mount(VirtualTable, container);
    },

    setRows(rows) {
      rowsSignal!.value = rows;
    },

    updateRow(index, newLabel) {
      const current = rowsSignal!.peek();
      const next = current.slice();
      next[index] = { ...next[index]!, label: newLabel };
      rowsSignal!.value = next;
    },

    swapRows(a, b) {
      const current = rowsSignal!.peek();
      const next = current.slice();
      const tmp = next[a]!;
      next[a] = next[b]!;
      next[b] = tmp;
      rowsSignal!.value = next;
    },

    clear() {
      rowsSignal!.value = [];
    },

    unmount() {
      app?.unmount();
      app = null;
      rowsSignal = null;
    },
  };
}
