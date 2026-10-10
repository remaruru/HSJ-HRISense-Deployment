import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-semibold select-none cursor-pointer",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "border-2",
    // A label must never be cut in half or wrap into a fixed-height button.
    // Rows that hold buttons wrap the buttons themselves instead.
    "whitespace-nowrap max-w-full",
    // Icons keep their box no matter how tight the row gets, so they can never
    // be squashed into the label.
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** Primary "Candy Button" — teal with hard shadow */
        primary: [
          "bg-primary-500 text-white border-foreground",
          "shadow-[4px_4px_0px_0px_#1e293b]",
          "hover:shadow-[6px_6px_0px_0px_#1e293b] hover:-translate-x-0.5 hover:-translate-y-0.5",
          "active:shadow-[2px_2px_0px_0px_#1e293b] active:translate-x-0.5 active:translate-y-0.5",
        ],
        /** Secondary — ghost that fills amber on hover */
        secondary: [
          "bg-transparent text-foreground border-foreground",
          // Was a stray yellow. Secondary hover now tints with the brand.
          "hover:bg-primary-50 dark:hover:bg-primary-900/40",
          "active:scale-95",
        ],
        /** Destructive */
        destructive: [
          "bg-danger text-white border-danger-dark",
          "shadow-[4px_4px_0px_0px_#b91c1c]",
          "hover:shadow-[6px_6px_0px_0px_#b91c1c] hover:-translate-x-0.5 hover:-translate-y-0.5",
          "active:shadow-[2px_2px_0px_0px_#b91c1c] active:translate-x-0.5 active:translate-y-0.5",
        ],
        /** Ghost — no border, no shadow */
        ghost: [
          "border-transparent bg-transparent text-foreground",
          "hover:bg-muted",
          "active:scale-95",
        ],
        /** Outline */
        outline: [
          "bg-transparent text-foreground border-border",
          "hover:bg-muted hover:border-border-strong",
          "active:scale-95",
        ],
        /**
         * Solid — filled HRISense teal with a soft shadow instead of the hard
         * offset used by `primary`. For dense management screens where the
         * brutalist drop shadow reads as noise rather than emphasis.
         */
        solid: [
          "bg-primary-500 text-white border-primary-500",
          "shadow-sm",
          "hover:bg-primary-600 hover:border-primary-600 hover:shadow",
          "active:bg-primary-700 active:border-primary-700",
        ],
        /**
         * Subtle — filled neutral with no visible outline. The secondary partner
         * to `solid`: readable as a button without competing with the primary
         * action, and without adding another dark rectangle to the page.
         */
        subtle: [
          "bg-slate-100 text-slate-800 border-transparent dark:bg-surface-2 dark:text-foreground",
          "dark:bg-slate-800 dark:text-slate-100",
          "hover:bg-slate-200 dark:hover:bg-slate-700",
          "active:scale-[0.98]",
        ],
        /** AI / Accent */
        ai: [
          "bg-accent text-white border-accent-dark",
          "shadow-[4px_4px_0px_0px_#6d28d9]",
          "hover:shadow-[6px_6px_0px_0px_#6d28d9] hover:-translate-x-0.5 hover:-translate-y-0.5",
          "active:shadow-[2px_2px_0px_0px_#6d28d9] active:translate-x-0.5 active:translate-y-0.5",
        ],
        /*
         * CRUD actions — Hospicio Capstone colour code. The action's MEANING
         * picks the colour, so "Add" is green and "Delete" is red on every
         * screen. Pastel fill, same-hue dark text (≥6.3:1), soft border.
         */
        /** Create / Add / New */
        create: [
          "bg-status-success-surface text-status-success-foreground border-status-success-border",
          "hover:brightness-95 active:brightness-90",
        ],
        /** Edit / Update / Change */
        update: [
          "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
          "hover:brightness-95 active:brightness-90",
        ],
        /** Delete / Remove / Archive */
        delete: [
          "bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
          "hover:brightness-95 active:brightness-90",
        ],
        /** View / Details / Review / Preview */
        review: [
          "bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
          "hover:brightness-95 active:brightness-90",
        ],
        /** Link-style */
        link: [
          "border-transparent bg-transparent text-primary-500 underline-offset-4",
          "hover:underline",
          "active:opacity-70",
        ],
      },
      /**
       * Each size also fixes the icon box, so a call site cannot end up with a
       * 12px icon next to a 15px label. Icon size tracks the label size:
       * roughly one step larger, which is what reads as "aligned".
       */
      size: {
        xs: "h-7 px-2.5 text-xs rounded-md [&_svg]:size-3.5",
        sm: "h-8 px-3 text-sm rounded-lg [&_svg]:size-4",
        md: "h-10 px-4 text-[0.9375rem] rounded-xl [&_svg]:size-[1.125rem]",
        lg: "h-11 px-6 text-base rounded-xl [&_svg]:size-5",
        xl: "h-13 px-8 text-base rounded-2xl [&_svg]:size-5",
        icon: "h-9 w-9 rounded-lg p-0 [&_svg]:size-[1.125rem]",
        "icon-sm": "h-7 w-7 rounded-md p-0 [&_svg]:size-4",
        "icon-lg": "h-11 w-11 rounded-xl p-0 [&_svg]:size-5",
      },
      pill: {
        true: "!rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  pill?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      pill,
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        className={cn(buttonVariants({ variant, size, pill, className }))}
        disabled={disabled || isLoading}
        whileTap={{ scale: 0.97 }}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {/*
          Most call sites pass their icon inside `children` rather than through
          `leftIcon`. A plain <span> laid those out inline, so the icon sat on
          the text baseline with no gap — the overlap QA reported. Making the
          label box a flex row spaces and centres them wherever they come from.
        */}
        {children && (
          <span className="inline-flex items-center gap-2 min-w-0">{children}</span>
        )}
        {!isLoading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
