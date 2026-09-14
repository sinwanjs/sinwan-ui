import { cc, For, Virtual, onUnmounted, type SinwanNode } from "sinwan/component";
import { effect, type Signal } from "sinwan/reactivity";
import { constructTable, type RowData } from "@tanstack/table-core";

import { cn } from "../../lib/utils";
import {
  dataTableFeatures,
  type DataTableColumnDef,
  type DataTableInstance,
  type DataTableRow,
} from "./data-table-features";
import { DataTableFlexRender, useTableRevision } from "./data-table-node";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableViewOptions } from "./data-table-view-options";
import { Input } from "./input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export type DataTableVirtualOptions = {
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  minRendered?: number;
};

export type DataTableProps<TData extends RowData = RowData> = {
  columns: ReadonlyArray<DataTableColumnDef<TData>>;
  data: TData[];
  filterColumnId?: string;
  filterPlaceholder?: string;
  getRowId?: (originalRow: TData, index: number) => string;
  empty?: SinwanNode;
  class?: string;
  hideToolbar?: boolean;
  hidePagination?: boolean;
  hideViewOptions?: boolean;
  pageSizes?: readonly number[];
  /**
   * Window body rows with Sinwan `<Virtual>`. Uses the pre-pagination row
   * model so filtering/sorting still apply. Pagination is hidden while this
   * is on — `<Virtual>` owns a dedicated scrollport and cannot live in `<tbody>`.
   */
  virtual?: boolean | DataTableVirtualOptions;
};

type ResolvedVirtual = {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
  minRendered: number;
};

type DataTableHostProps = {
  columns: ReadonlyArray<DataTableColumnDef>;
  data: RowData[];
  filterColumnId?: string;
  filterPlaceholder: string;
  getRowId?: (originalRow: RowData, index: number) => string;
  empty: SinwanNode;
  class?: string;
  hideToolbar: boolean;
  hidePagination: boolean;
  hideViewOptions: boolean;
  pageSizes?: readonly number[];
  virtual?: boolean | DataTableVirtualOptions;
};

const DEFAULT_VIRTUAL_ITEM_HEIGHT = 48;
const DEFAULT_VIRTUAL_CONTAINER_HEIGHT = 384;
const DEFAULT_VIRTUAL_OVERSCAN = 8;

const VIRTUAL_ROW_CLASS =
  "grid h-full w-full border-b border-border/80 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted";
const VIRTUAL_HEAD_CLASS =
  "flex h-full min-w-0 items-center px-2 text-start text-sm font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pe-0";
const VIRTUAL_CELL_CLASS =
  "flex h-full min-w-0 items-center overflow-hidden px-2 text-sm whitespace-nowrap [&:has([role=checkbox])]:pe-0";

function resolveTableData(data: unknown): RowData[] {
  return Array.isArray(data) ? data : [];
}

function toFiniteCount(value: unknown, fallback: number, allowZero: boolean): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (allowZero ? value < 0 : value <= 0) return fallback;
  return Math.floor(value);
}

function resolveDataTableVirtual(
  virtual: boolean | DataTableVirtualOptions | undefined,
): ResolvedVirtual | null {
  if (!virtual) return null;
  const options = virtual === true ? {} : virtual;
  return {
    itemHeight: toFiniteCount(
      options.itemHeight,
      DEFAULT_VIRTUAL_ITEM_HEIGHT,
      false,
    ),
    containerHeight: toFiniteCount(
      options.containerHeight,
      DEFAULT_VIRTUAL_CONTAINER_HEIGHT,
      false,
    ),
    overscan: toFiniteCount(options.overscan, DEFAULT_VIRTUAL_OVERSCAN, true),
    minRendered: toFiniteCount(options.minRendered, 0, true),
  };
}

function leafGridStyle(
  columns: ReadonlyArray<{ accessorFn?: unknown }>,
): Record<string, string> {
  const tracks =
    columns.length === 0
      ? ["minmax(0, 1fr)"]
      : columns.map((column) =>
          column.accessorFn === undefined ? "3rem" : "minmax(6rem, 1fr)",
        );
  return {
    display: "grid",
    width: "100%",
    minWidth: "100%",
    gridTemplateColumns: tracks.join(" "),
  };
}

type VirtualSheetProps = {
  table: DataTableInstance;
  revision: Signal<number>;
  empty: SinwanNode;
  itemHeight: number;
  containerHeight: number;
  overscan: number;
  minRendered: number;
};

const DataTableVirtualSheet = cc<VirtualSheetProps>((props) => {
  const { table, revision } = props;

  return (
    <div
      data-slot="table-container"
      class="relative w-full min-w-0 overflow-x-auto"
    >
      <div data-slot="table" class="w-full min-w-0 text-sm">
        <div
          data-slot="table-header"
          data-virtual-header=""
          class="sticky top-0 z-10 border-b bg-muted/50"
        >
          <For
            each={() => {
              revision.value;
              return table.getHeaderGroups();
            }}
          >
            {(headerGroup) => (
              <div
                role="row"
                data-slot="table-row"
                class={cn(VIRTUAL_ROW_CLASS, "border-b-0")}
                style={() => {
                  revision.value;
                  return {
                    ...leafGridStyle(table.getVisibleLeafColumns()),
                    height: `${props.itemHeight}px`,
                  };
                }}
              >
                <For
                  each={() => {
                    revision.value;
                    return headerGroup.headers;
                  }}
                >
                  {(header) => (
                    <div
                      role="columnheader"
                      data-slot="table-head"
                      data-column-id={header.column.id}
                      class={VIRTUAL_HEAD_CLASS}
                    >
                      {header.isPlaceholder ? null : (
                        <DataTableFlexRender header={header} />
                      )}
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
        <div data-slot="table-body">
          <div data-slot="data-table-virtual-body">
            <Virtual
              each={() => {
                revision.value;
                return table.getPrePaginatedRowModel().rows;
              }}
              itemHeight={props.itemHeight}
              containerHeight={props.containerHeight}
              overscan={props.overscan}
              minRendered={props.minRendered}
              fallback={
                <div
                  class="flex h-24 items-center justify-center text-center text-sm text-muted-foreground"
                  data-slot="data-table-empty"
                >
                  {props.empty}
                </div>
              }
            >
              {(row: DataTableRow) => (
                <div
                  role="row"
                  data-slot="table-row"
                  class={VIRTUAL_ROW_CLASS}
                  data-state={() => {
                    revision.value;
                    return row.getIsSelected() ? "selected" : undefined;
                  }}
                  style={() => {
                    revision.value;
                    return leafGridStyle(table.getVisibleLeafColumns());
                  }}
                >
                  <For
                    each={() => {
                      revision.value;
                      return row.getVisibleCells();
                    }}
                  >
                    {(cell) => (
                      <div
                        role="cell"
                        data-slot="table-cell"
                        data-column-id={cell.column.id}
                        class={VIRTUAL_CELL_CLASS}
                      >
                        <DataTableFlexRender cell={cell} />
                      </div>
                    )}
                  </For>
                </div>
              )}
            </Virtual>
          </div>
        </div>
      </div>
    </div>
  );
});

const DataTableHost = cc<DataTableHostProps>((props) => {
  const table = constructTable({
    features: dataTableFeatures,
    columns: props.columns,
    data: resolveTableData(props.data),
    getRowId: props.getRowId,
  });
  const revision = useTableRevision(table);
  const stopData = effect(() => {
    const next = resolveTableData(props.data);
    table.setOptions((current) => ({
      ...current,
      data: next,
      columns: props.columns,
    }));
  });
  onUnmounted(stopData);

  const virtual = resolveDataTableVirtual(props.virtual);
  const showFilter = Boolean(props.filterColumnId);
  const showView = !props.hideViewOptions;
  const showToolbar = !props.hideToolbar && (showFilter || showView);
  const hidePagination = props.hidePagination || virtual != null;

  return (
    <div data-slot="data-table" class={cn("w-full", props.class)}>
      {showToolbar ? (
        <div class="flex items-center gap-2 py-4">
          {showFilter ? (
            <Input
              data-slot="data-table-filter"
              placeholder={props.filterPlaceholder}
              class="max-w-sm"
              value={() => {
                revision.value;
                const column = table.getColumn(props.filterColumnId ?? "");
                const filterValue = column?.getFilterValue();
                return typeof filterValue === "string" ? filterValue : "";
              }}
              oninput={(event: Event) => {
                const input = event.currentTarget as HTMLInputElement;
                table
                  .getColumn(props.filterColumnId ?? "")
                  ?.setFilterValue(input.value);
              }}
            />
          ) : null}
          {showView ? <DataTableViewOptions table={table} /> : null}
        </div>
      ) : null}
      <div
        data-slot="data-table-frame"
        class="min-w-0 w-full overflow-hidden rounded-md border bg-card"
      >
        {virtual ? (
          <DataTableVirtualSheet
            table={table}
            revision={revision}
            empty={props.empty}
            itemHeight={virtual.itemHeight}
            containerHeight={virtual.containerHeight}
            overscan={virtual.overscan}
            minRendered={virtual.minRendered}
          />
        ) : (
          <Table>
            <TableHeader>
              <For
                each={() => {
                  revision.value;
                  return table.getHeaderGroups();
                }}
              >
                {(headerGroup) => (
                  <TableRow>
                    <For
                      each={() => {
                        revision.value;
                        return headerGroup.headers;
                      }}
                    >
                      {(header) => (
                        <TableHead
                          colSpan={header.colSpan}
                          data-column-id={header.column.id}
                        >
                          {header.isPlaceholder ? null : (
                            <DataTableFlexRender header={header} />
                          )}
                        </TableHead>
                      )}
                    </For>
                  </TableRow>
                )}
              </For>
            </TableHeader>
            <TableBody>
              <For
                each={() => {
                  revision.value;
                  return table.getRowModel().rows;
                }}
                fallback={
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(table.getVisibleLeafColumns().length, 1)}
                      class="h-24 text-center"
                      data-slot="data-table-empty"
                    >
                      {props.empty}
                    </TableCell>
                  </TableRow>
                }
              >
                {(row) => (
                  <TableRow
                    data-state={() => {
                      revision.value;
                      return row.getIsSelected() ? "selected" : undefined;
                    }}
                  >
                    <For
                      each={() => {
                        revision.value;
                        return row.getVisibleCells();
                      }}
                    >
                      {(cell) => (
                        <TableCell data-column-id={cell.column.id}>
                          <DataTableFlexRender cell={cell} />
                        </TableCell>
                      )}
                    </For>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        )}
      </div>
      {hidePagination ? null : (
        <DataTablePagination table={table} pageSizes={props.pageSizes} />
      )}
    </div>
  );
});

/**
 * ColumnDef/Table are invariant in the row type. The host only ever renders
 * `columns` against the matching `data` array, so widening TData to RowData is
 * sound at this boundary.
 */
export function DataTable<TData extends RowData>(
  props: DataTableProps<TData>,
): SinwanNode {
  return (
    <DataTableHost
      columns={props.columns as ReadonlyArray<DataTableColumnDef>}
      data={props.data as RowData[]}
      filterColumnId={props.filterColumnId}
      filterPlaceholder={props.filterPlaceholder ?? "Filter..."}
      getRowId={props.getRowId as DataTableHostProps["getRowId"]}
      empty={props.empty ?? "No results."}
      class={props.class}
      hideToolbar={props.hideToolbar ?? false}
      hidePagination={props.hidePagination ?? false}
      hideViewOptions={props.hideViewOptions ?? false}
      pageSizes={props.pageSizes}
      virtual={props.virtual}
    />
  );
}
