import { cc, type SinwanNode } from "sinwan/component";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide";
import type { RowData } from "@tanstack/table-core";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import {
  type DataTableInstance,
} from "./data-table-features";
import { useTableRevision } from "./data-table-node";
import { Label } from "./label";
import { NativeSelect, NativeSelectOption } from "./native-select";

const DEFAULT_PAGE_SIZES = [10, 20, 25, 30, 40, 50];

export type DataTablePaginationProps<TData extends RowData = RowData> = {
  table: DataTableInstance<TData>;
  pageSizes?: readonly number[];
  class?: string;
};

type DataTablePaginationHostProps = {
  table: DataTableInstance;
  pageSizes: readonly number[];
  class?: string;
};

const DataTablePaginationHost = cc<DataTablePaginationHostProps>(
  ({ table, pageSizes, class: className }) => {
    const revision = useTableRevision(table);

    return (
      <div
        data-slot="data-table-pagination"
        class={cn(
          "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div
          class="flex-1 text-sm text-muted-foreground"
          data-slot="data-table-selected-count"
        >
          {() => {
            revision.value;
            const selected = table.getFilteredSelectedRowModel().rows.length;
            const total = table.getFilteredRowModel().rows.length;
            return `${selected} of ${total} row(s) selected.`;
          }}
        </div>
        {() => {
          revision.value;
          const canPrev = !table.getCanPreviousPage();
          const canNext = !table.getCanNextPage();
          const pageSize = String(table.store.get().pagination.pageSize);
          const pageIndex = table.store.get().pagination.pageIndex;
          const pageCount = Math.max(table.getPageCount(), 1);
          return (
            <div class="flex flex-wrap items-center gap-4 lg:gap-6">
              <div class="flex items-center gap-2">
                <Label class="text-sm font-medium whitespace-nowrap">
                  Rows per page
                </Label>
                <NativeSelect
                  data-slot="data-table-page-size"
                  aria-label="Rows per page"
                  size="sm"
                  value={pageSize}
                  onchange={(event: Event) => {
                    const select = event.currentTarget as HTMLSelectElement;
                    table.setPageSize(Number(select.value));
                  }}
                >
                  {pageSizes.map((size) => (
                    <NativeSelectOption value={String(size)}>
                      {size}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div
                class="text-sm font-medium whitespace-nowrap"
                data-slot="data-table-page-status"
              >
                {`Page ${pageIndex + 1} of ${pageCount}`}
              </div>
              <div class="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  data-slot="data-table-first-page"
                  aria-label="Go to first page"
                  disabled={canPrev}
                  onclick={() => table.firstPage()}
                >
                  <Icon icon={ChevronsLeft} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  data-slot="data-table-previous-page"
                  aria-label="Go to previous page"
                  disabled={canPrev}
                  onclick={() => table.previousPage()}
                >
                  <Icon icon={ChevronLeft} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  data-slot="data-table-next-page"
                  aria-label="Go to next page"
                  disabled={canNext}
                  onclick={() => table.nextPage()}
                >
                  <Icon icon={ChevronRight} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  data-slot="data-table-last-page"
                  aria-label="Go to last page"
                  disabled={canNext}
                  onclick={() => table.lastPage()}
                >
                  <Icon icon={ChevronsRight} />
                </Button>
              </div>
            </div>
          );
        }}
      </div>
    );
  },
);

export function DataTablePagination<TData extends RowData>(
  props: DataTablePaginationProps<TData>,
): SinwanNode {
  return (
    <DataTablePaginationHost
      table={props.table as DataTableInstance}
      pageSizes={props.pageSizes ?? DEFAULT_PAGE_SIZES}
      class={props.class}
    />
  );
}
