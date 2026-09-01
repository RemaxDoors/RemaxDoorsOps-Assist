import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

export type Column<T> = {
  key: string;
  header: string;
  /** Tailwind width/alignment classes for the column. */
  className?: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show yet.",
}: {
  columns: ReadonlyArray<Column<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string | number;
  empty?: string;
}) {
  if (rows.length === 0) return <EmptyState message={empty} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas/60">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-5 py-2.5 text-left text-[12px] font-semibold tracking-wide text-ink-muted uppercase ${c.className ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-line last:border-0 hover:bg-canvas"
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-5 py-3 align-top ${c.className ?? ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
