import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch for the public pages (landing, careers, login). It changes
 * the visitor's own theme only — a signed-in account keeps its separate choice,
 * switched from the app's top bar or Settings.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { isGuestDark, toggleGuestTheme } = useTheme();
  const label = isGuestDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggleGuestTheme}
      aria-label={label}
      title={label}
      className={cn(
        "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        className
      )}
    >
      {isGuestDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
