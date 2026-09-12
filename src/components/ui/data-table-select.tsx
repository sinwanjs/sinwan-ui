import { cc, type SinwanNode } from "sinwan/component";
import type { RowData } from "@tanstack/table-core";

import { Checkbox } from "./checkbox";
import {
  type DataTableInstance,
  type DataTableRow,
} from "./data-table-features";
import { useTableRevision } from "./data-table-node";

const DataTableSelectAllHost = cc<{ table: DataTableInstance }>(({ table }) => {
  const revision = useTableRevision(table);
  return (
    <Checkbox
      aria-label="Select all"
      // @ts-expect-error live getter — compiler does not wrap this internal host
      checked={() => (revision.value, table.getIsAllPageRowsSelected())}
      // @ts-expect-error live getter — compiler does not wrap this internal host
      indeterminate={() =>
        (revision.value,
        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected())
      }
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(value)}
    />
  );
});

const DataTableSelectRowHost = cc<{ row: DataTableRow }>(({ row }) => {
  const revision = useTableRevision(row.table);
  return (
    <Checkbox
      aria-label="Select row"
      // @ts-expect-error live getter — compiler does not wrap this internal host
      checked={() => (revision.value, row.getIsSelected())}
      onCheckedChange={(value) => row.toggleSelected(value)}
    />
  );
});

export function DataTableSelectAll<TData extends RowData>(props: {
  table: DataTableInstance<TData>;
}): SinwanNode {
  return <DataTableSelectAllHost table={props.table as DataTableInstance} />;
}

export function DataTableSelectRow<TData extends RowData>(props: {
  row: DataTableRow<TData>;
}): SinwanNode {
  return <DataTableSelectRowHost row={props.row as DataTableRow} />;
}
