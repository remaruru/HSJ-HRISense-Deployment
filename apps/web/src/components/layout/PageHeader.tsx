import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PageHeaderStat {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  badgeText?: string;
  stats?: PageHeaderStat[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  badgeText,
  stats,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-950/80 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-primary-700 dark:text-primary-300 shrink-0 shadow-sm mt-0.5">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
                {title}
              </h1>
              {badgeText && (
                <Badge
                  variant="outline"
                  className="bg-primary-50 text-primary-800 border-primary-200 dark:bg-primary-950/60 dark:text-primary-300 dark:border-primary-800 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                >
                  {badgeText}
                </Badge>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/*
          Stats & Actions.
          `sm:flex-nowrap` used to forbid wrapping from the `sm` breakpoint up, so
          a long action label (e.g. "Create Training / Seminar") was pushed past
          the right edge of the viewport and the page scrolled sideways. Wrapping
          is now allowed at every width — items still sit on one row whenever they
          fit, and drop to a second row instead of overflowing.
        */}
        {(stats || actions) && (
          <div className="flex items-center justify-end gap-3 w-full sm:w-auto flex-wrap min-w-0">
            {stats?.map((stat, idx) => (
              <div
                key={idx}
                className="bg-surface border-2 border-border rounded-2xl px-4 py-2 shadow-sm flex items-center gap-3 flex-1 sm:flex-initial"
              >
                {stat.icon && (
                  <div className="h-9 w-9 rounded-xl bg-primary-50 dark:bg-primary-950/80 border border-primary-200 dark:border-primary-800 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                    {stat.icon}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-base font-bold text-foreground leading-none font-heading">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
            {actions}
          </div>
        )}
      </div>

      {/* Teal Header Accent Divider Line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary-500/40 via-primary-300/20 to-transparent rounded-full" />
    </div>
  );
}
