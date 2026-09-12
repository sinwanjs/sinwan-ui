import { cc, For, onUnmounted, type SinwanNode } from "sinwan/component";
import { effect } from "sinwan/reactivity";
import { constructTable, type RowData } from "@tanstack/table-core";

import { cn } from "../../lib/utils";
import { dataTableFeatures, type DataTableColumnDef } from "./data-table-features";
import { DataTableFlexRender, useTableRevision } from "./data-table-node";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableViewOptions } from "./data-table-view-options";
import { Input } from "./input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

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
};

function resolveTableData(data: unknown): RowData[] {
  return Array.isArray(data) ? data : [];
}

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

  const showFilter = Boolean(props.filterColumnId);
  const showView = !props.hideViewOptions;
  const showToolbar = !props.hideToolbar && (showFilter || showView);

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
      <div class="overflow-hidden rounded-md border">
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
                  <For each={() => headerGroup.headers}>
                    {(header) => (
                      <TableHead colSpan={header.colSpan}>
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
                    colSpan={props.columns.length}
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
                  <For each={() => row.getVisibleCells()}>
                    {(cell) => (
                      <TableCell>
                        <DataTableFlexRender cell={cell} />
                      </TableCell>
                    )}
                  </For>
                </TableRow>
              )}
            </For>
          </TableBody>
        </Table>
      </div>
      {props.hidePagination ? null : (
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
    />
  );
}
