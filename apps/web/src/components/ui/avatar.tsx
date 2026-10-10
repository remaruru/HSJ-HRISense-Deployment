import { cn, getInitials, getAvatarColor } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { User } from "lucide-react";
import { useProtectedImageUrl } from "@/hooks/useProtectedImageUrl";

const avatarVariants = cva(
  "relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none font-semibold",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-xs rounded-md",
        sm: "h-8 w-8 text-sm rounded-lg",
        md: "h-10 w-10 text-sm rounded-xl",
        lg: "h-12 w-12 text-base rounded-xl",
        xl: "h-16 w-16 text-lg rounded-2xl",
        "2xl": "h-24 w-24 text-2xl rounded-3xl",
      },
      shape: {
        square: "",
        circle: "!rounded-full",
      },
    },
    defaultVariants: {
      size: "md",
      shape: "circle",
    },
  }
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name?: string;
  src?: string;
  alt?: string;
  className?: string;
  showStatus?: boolean;
  status?: "online" | "offline" | "away" | "busy";
}

const statusColors = {
  online: "bg-success",
  offline: "bg-muted-foreground",
  away: "bg-warning",
  busy: "bg-danger",
};

export function Avatar({
  name,
  src,
  alt,
  size,
  shape,
  className,
  showStatus,
  status = "offline",
}: AvatarProps) {
  const initials = name ? getInitials(name) : null;
  const colorClass = name ? getAvatarColor(name) : "bg-muted";
  // Employee photos are streamed through an authenticated route, so the raw
  // reference has to be resolved to an object URL before <img> can show it.
  const resolvedSrc = useProtectedImageUrl(src);

  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          avatarVariants({ size, shape }),
          resolvedSrc ? "bg-transparent" : colorClass,
          !resolvedSrc && "text-white",
          className
        )}
      >
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt={alt || name || "Avatar"}
            className="h-full w-full object-cover"
          />
        ) : initials ? (
          <span>{initials}</span>
        ) : (
          <User className="h-1/2 w-1/2 opacity-60" />
        )}
      </span>

      {showStatus && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-surface",
            statusColors[status]
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </span>
  );
}
