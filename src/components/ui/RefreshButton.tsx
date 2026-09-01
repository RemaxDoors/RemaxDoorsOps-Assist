"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Re-runs the server components for the current route. */
export function RefreshButton({
  variant = "secondary",
  size = "md",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className">) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn("h-4 w-4", pending && "animate-spin")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
      </svg>
      {pending ? "Refreshing..." : "Refresh"}
    </Button>
  );
}
