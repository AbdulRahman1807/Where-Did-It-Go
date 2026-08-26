import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-cyan text-void hover:bg-cyan/90 border-transparent",
  secondary: "bg-surface-2 text-text-primary hover:bg-surface-3 border-border-medium",
  danger: "bg-red/10 text-red hover:bg-red/20 border-red/30",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary border-transparent hover:bg-surface-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "secondary", className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        VARIANT_CLASSES[variant],
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
