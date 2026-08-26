import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, eyebrow, action, children, className, ...rest }: PanelProps) {
  return (
    <div
      className={clsx("rounded-lg border border-border-subtle bg-surface", className)}
      {...rest}
    >
      {(title || eyebrow || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            {eyebrow && (
              <div className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
                {eyebrow}
              </div>
            )}
            {title && <h3 className="mt-0.5 font-display text-base font-medium text-text-primary">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
