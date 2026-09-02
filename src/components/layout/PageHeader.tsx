import type { ReactNode } from "react";

/**
 * Page title and its actions.
 *
 * Actions used to be hidden below `sm`, on the reasoning that the hamburger
 * duplicated them. That stopped being true once pages gained their own —
 * "Create Simpro task" and "Back to list" exist nowhere else, so on a phone
 * they simply vanished. They now wrap onto their own row instead.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-ink-body">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}
