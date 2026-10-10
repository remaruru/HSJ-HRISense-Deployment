import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Sparkles } from "lucide-react";

const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium border select-none",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground border-border",
        primary: "bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900/60 dark:text-primary-300 dark:border-primary-900",
        success: "bg-success-light text-success-dark border-success",
        warning: "bg-warning-light text-warning-dark border-warning",
        danger: "bg-danger-light text-danger-dark border-danger",
        info: "bg-info-light text-info-dark border-info",
        accent: "bg-accent-light text-accent-dark border-accent",
        /** AI Generated — animated gradient */
        ai: [
          "relative overflow-hidden",
          "bg-gradient-to-r from-primary-500/10 via-accent/10 to-pop-pink/10",
          "text-accent-dark border-accent/30",
        ],
        outline: "bg-transparent text-foreground border-border",
        // "pop" kept for call sites, but it wears the brand rather than a
        // colour that exists nowhere else in the system.
        pop: "bg-primary-50 text-primary-700 border-primary-500 dark:bg-primary-900/40 dark:text-primary-300",
      },
      size: {
        sm: "px-1.5 py-0.5 text-xs rounded-md",
        md: "px-2 py-0.5 text-xs rounded-lg",
        lg: "px-3 py-1 text-sm rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: React.ReactNode;
  isAI?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  dot,
  icon,
  isAI,
  children,
  ...props
}: BadgeProps) {
  const resolvedVariant = isAI ? "ai" : variant;

  return (
    <span
      className={cn(badgeVariants({ variant: resolvedVariant, size }), className)}
      {...props}
    >
      {isAI && (
        <Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
      )}
      {!isAI && icon && <span className="shrink-0">{icon}</span>}
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-danger",
            variant === "info" && "bg-info",
            (!variant || variant === "default") && "bg-muted-foreground"
          )}
        />
      )}
      {children}
    </span>
  );
}
