import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

/**
 * Philippine time, ticking every second. Formatted in `Asia/Manila` explicitly,
 * so it reads PHT even on a machine whose clock is set to another zone.
 */
function PhtClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);
  const date = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  return (
    <div
      className="flex items-center gap-3 self-end @2xl:self-start shrink-0 rounded-2xl border border-white/15 bg-[#062f2e]/55 px-4 py-2.5 backdrop-blur-md shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
      aria-label={`Philippine time: ${date}, ${time}`}
    >
      <span className="h-10 w-10 shrink-0 rounded-xl bg-white/15 text-white flex items-center justify-center">
        <Clock3 className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold font-heading text-white tabular-nums leading-none" aria-live="off">
          {time}
          <span className="ml-1.5 text-xs font-semibold text-primary-100 align-middle">PHT</span>
        </p>
        <p className="text-xs text-primary-50 mt-1 whitespace-nowrap">{date}</p>
      </div>
    </div>
  );
}

/**
 * Flowing "silk" lines sweeping up toward the clock — decoration only. The
 * strokes keep their width however wide the container gets.
 */
function HeroSilk() {
  const lines = [
    { d: "M-20 200 C 220 110, 420 250, 680 160 S 1040 70, 1220 40", o: 0.22 },
    { d: "M-20 222 C 230 132, 440 272, 700 182 S 1050 92, 1220 66", o: 0.16 },
    { d: "M-20 244 C 240 154, 460 294, 720 204 S 1060 114, 1220 92", o: 0.11 },
    { d: "M-20 266 C 250 176, 480 316, 740 226 S 1070 136, 1220 118", o: 0.07 },
    { d: "M-20 150 C 260 60, 520 190, 800 110 S 1100 30, 1220 10", o: 0.08 },
  ];
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[260px] w-full text-white dark:opacity-60"
      viewBox="0 0 1200 300"
      preserveAspectRatio="none"
      fill="none"
    >
      {lines.map((l) => (
        <path key={l.d} d={l.d} stroke="currentColor" strokeOpacity={l.o} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/**
 * The dashboard's welcome container: greeting on the left, Philippine time in
 * the top-right corner, and the role's summary cards (`children`) underneath.
 * Quick Actions live in the top bar (⚡) so they are reachable on every page.
 *
 * The "teal tide" gradient is `.dashboard-hero` in index.css — brand teal
 * only, never a status colour, so the pastel cards inside keep their meaning.
 */
export function DashboardHeader({
  name,
  role,
  children,
}: {
  name: string;
  role: string;
  children?: React.ReactNode;
}) {
  // Greeting follows Philippine time too, not the browser's zone.
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", hour12: false }).format(new Date())
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <section
      aria-label="Welcome"
      className="dashboard-hero @container relative isolate overflow-hidden rounded-2xl p-5 sm:p-6 text-white"
    >
      <HeroSilk />

      <div className="relative flex flex-col-reverse gap-4 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div className="min-w-0 @2xl:pt-1">
          <h1 className="text-2xl @2xl:text-3xl font-bold font-heading leading-tight text-white">
            {greeting}, {name}
          </h1>
          <p className="mt-1.5 text-sm text-primary-50/90">{role} · Hospicio de San Jose</p>
        </div>
        <PhtClock />
      </div>

      {children && <div className="relative mt-6">{children}</div>}
    </section>
  );
}
