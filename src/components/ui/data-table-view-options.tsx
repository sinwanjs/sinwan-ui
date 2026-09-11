import { cc, For, type SinwanNode } from "sinwan/component";
import { Settings2 } from "lucide";
import type { RowData } from "@tanstack/table-core";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";
import {
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

type HideableColumn = {
  id: string;
  visible: boolean;
  toggle: (visible: boolean) => void;
};

const DataTableViewOptionsHost = cc<{ table: DataTableInstance }>(
  ({ table }) => {
    const revision = useTableRevision(table);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          class={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "ml-auto gap-1",
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
                )
                .map((column) => {
                  const item: HideableColumn = {
                    id: column.id,
                    visible: column.getIsVisible(),
                    toggle: (visible) => column.toggleVisibility(visible),
                  };
                  return item;
                });
            }}
          >
            {(column) => (
              <DropdownMenuCheckboxItem
                class="capitalize"
                checked={column.visible}
                onCheckedChange={(value) => column.toggle(value)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            )}
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
