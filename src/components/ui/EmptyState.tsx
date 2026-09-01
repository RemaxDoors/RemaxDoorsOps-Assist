import type { ReactNode } from "react";

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
      <div className="brand-rule h-1 w-16" />
      <p className="text-sm text-ink-muted">{message}</p>
      {action}
    </div>
  );
}
