import { cc, type SinwanNode } from "sinwan/component";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide";
import type { RowData } from "@tanstack/table-core";

import { Icon } from "../../icons";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";
import { type DataTableColumn } from "./data-table-features";
import { useTableRevision } from "./data-table-node";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type DataTableColumnHeaderProps<
  TData extends RowData = RowData,
  TValue = unknown,
> = {
  column: DataTableColumn<TData, TValue>;
  title: string;
  class?: string;
};

type DataTableColumnHeaderHostProps = {
  column: DataTableColumn;
  title: string;
  class?: string;
};

const DataTableColumnHeaderHost = cc<DataTableColumnHeaderHostProps>(
  ({ column, title, class: className }) => {
    const revision = useTableRevision(column.table);
    if (!column.getCanSort()) {
      return (
        <div class={cn("text-sm font-medium", className)} data-slot="data-table-column-title">
          {title}
        </div>
      );
    }

    const canHide = column.getCanHide();

    return (
      <div class={cn("flex items-center gap-2", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger
            class={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-3 h-8 gap-1",
            )}
          >
            <span>{title}</span>
            {() => {
              revision.value;
              const sorted = column.getIsSorted();
              if (sorted === "desc") {
                return <Icon icon={ArrowDown} class="size-4" />;
              }
              if (sorted === "asc") {
                return <Icon icon={ArrowUp} class="size-4" />;
              }
              return <Icon icon={ChevronsUpDown} class="size-4" />;
            }}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onclick={() => column.toggleSorting(false)}>
              <Icon icon={ArrowUp} class="size-4" />
              Asc
            </DropdownMenuItem>
            <DropdownMenuItem onclick={() => column.toggleSorting(true)}>
              <Icon icon={ArrowDown} class="size-4" />
              Desc
            </DropdownMenuItem>
            {canHide ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onclick={() => column.toggleVisibility(false)}>
                  <Icon icon={EyeOff} class="size-4" />
                  Hide
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);

export function DataTableColumnHeader<TData extends RowData, TValue>(
  props: DataTableColumnHeaderProps<TData, TValue>,
): SinwanNode {
  return (
    <DataTableColumnHeaderHost
      column={props.column as DataTableColumn}
      title={props.title}
      class={props.class}
    />
  );
}
