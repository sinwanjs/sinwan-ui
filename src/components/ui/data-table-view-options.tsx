import { cc, For, type SinwanNode } from "sinwan/component";
import { Settings2 } from "lucide";
import type { RowData } from "@tanstack/table-core";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";
import {
  type DataTableColumn,
  type DataTableInstance,
} from "./data-table-features";
import { useTableRevision } from "./data-table-node";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type DataTableViewOptionsProps<TData extends RowData = RowData> = {
  table: DataTableInstance<TData>;
};

const DataTableColumnToggle = cc<{ column: DataTableColumn }>((props) => {
  const revision = useTableRevision(props.column.table);
  return (
    <DropdownMenuCheckboxItem
      class="capitalize"
      // @ts-expect-error live getter — compiler does not wrap this internal host
      checked={() => {
        revision.value;
        return props.column.getIsVisible();
      }}
      onCheckedChange={(value) => props.column.toggleVisibility(value)}
    >
      {props.column.id}
    </DropdownMenuCheckboxItem>
  );
});

const DataTableViewOptionsHost = cc<{ table: DataTableInstance }>(
  ({ table }) => {
    const revision = useTableRevision(table);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          class={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "ms-auto gap-1",
          )}
        >
          <Icon icon={Settings2} class="size-4" />
          View
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <For
            each={() => {
              revision.value;
              return table
                .getAllColumns()
                .filter(
                  (column) =>
                    column.accessorFn !== undefined && column.getCanHide(),
                );
            }}
          >
            {(column) => <DataTableColumnToggle column={column} />}
          </For>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

export function DataTableViewOptions<TData extends RowData>(
  props: DataTableViewOptionsProps<TData>,
): SinwanNode {
  return <DataTableViewOptionsHost table={props.table as DataTableInstance} />;
}
