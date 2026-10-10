import type { StatCardTone } from "./stat-card";

/**
 * Chip colours for the shared status tones.
 *
 * `StatusBadge` deliberately owns only the SHAPE of a pill and takes its colour
 * from the caller. Every feature was therefore writing its own
 * `bg-emerald-50 text-emerald-700 dark:…` strings, and "expired" ended up rose
 * in one module and red in another. These are the one set of classes, built on
 * the semantic status tokens in index.css so they follow the theme.
 */
export const STATUS_TONE_CHIP: Record<StatCardTone, string> = {
  total:
    "bg-status-total-surface text-status-total-foreground border-status-total-border",
  success:
    "bg-status-success-surface text-status-success-foreground border-status-success-border",
  warning:
    "bg-status-warning-surface text-status-warning-foreground border-status-warning-border",
  danger:
    "bg-status-danger-surface text-status-danger-foreground border-status-danger-border",
  info:
    "bg-status-info-surface text-status-info-foreground border-status-info-border",
  accent:
    "bg-status-accent-surface text-status-accent-foreground border-status-accent-border",
  neutral:
    "bg-status-neutral-surface text-status-neutral-foreground border-status-neutral-border",
};

/**
 * Tone for the record states shared by Medical, Psychological and Compliance.
 * Kept here so the three modules cannot disagree about what "expiring soon"
 * looks like.
 */
export const RECORD_STATUS_TONE: Record<string, StatCardTone> = {
  VALID: "success",
  ACCEPTED: "success",
  COMPLIANT: "success",
  EXPIRING_SOON: "warning",
  PENDING_REVIEW: "warning",
  NEEDS_REVIEW: "accent",
  NEEDS_CORRECTION: "danger",
  EXPIRED: "danger",
  MISSING: "danger",
  NON_COMPLIANT: "danger",
};
