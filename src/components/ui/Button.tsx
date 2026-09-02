import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "dark" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-red text-white hover:bg-brand-red-dark border border-transparent",
  secondary:
    "bg-surface text-ink border border-line hover:border-ink hover:bg-canvas",
  ghost:
    "bg-transparent text-ink-muted border border-transparent hover:bg-band hover:text-ink",
  dark: "bg-ink text-white hover:bg-ink border border-transparent",
  danger: "bg-danger text-white border border-transparent hover:opacity-90",
};

/**
 * Taller on small screens: 44px is the smallest comfortable touch target, and
 * these are pressed with gloves on a shop floor.
 */
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] sm:h-8",
  md: "h-11 px-4 text-sm sm:h-10",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
