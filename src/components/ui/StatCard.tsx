import Link from "next/link";
import { Card } from "@/components/ui/Card";

export function StatCard({
  label,
  value,
  hint,
  href,
  accent = "graphite",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  accent?: "red" | "graphite" | "light";
}) {
  const bar =
    accent === "red"
      ? "bg-brand-red"
      : accent === "graphite"
        ? "bg-ink"
        : "bg-line";

  const body = (
    <Card className="h-full overflow-hidden transition-shadow hover:shadow-[0_4px_16px_rgba(27,30,33,0.08)]">
      <div className={`h-1 w-full ${bar}`} />
      <div className="p-5">
        <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold text-ink tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-[13px] text-ink-muted">{hint}</p> : null}
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
