import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { useAppShell } from '@/components/layout/AppShell';
import { useBuddyEnabled } from '@/hooks/useBuddyEnabled';
import { AiMascot, type AiMascotState } from './AiMascot';

/**
 * The HRISense buddy: the AI mascot peeking in from the left or right edge of
 * every signed-in page, taking turns on each side.
 *
 * - Press him: he steps out, waves and says something. Press again (or wait)
 *   and he ducks back in, then reappears on the other side.
 * - Drag him: drop him anywhere; he settles on the nearer edge at that height
 *   and stays there for a while before roaming again.
 *
 * He lives in the page-content area only (never over the sidebar or top bar),
 * keeps clear of the Ask AI button's corner, sits under dialogs and the chat,
 * and is hidden in print. On phones he stays docked, small, in the bottom-left
 * corner (the page keeps space free there) instead of roaming over content. With reduced motion he stays put and moves without
 * animation. He can be turned off in Settings (useBuddyEnabled).
 */

type Side = 'left' | 'right';
type Phase = 'hidden' | 'peek' | 'out' | 'drag';

/** Roaming spots: height as a fraction of the content area, and his mood there. */
const SPOTS: { at: number; mood: AiMascotState }[] = [
  { at: 0.3, mood: 'thinking' },
  { at: 0.18, mood: 'thinking' },
  { at: 0.55, mood: 'done' },
  { at: 0.4, mood: 'idle' },
];
const FIRST_MS = 1500;
const PEEK_MS = 10000;
const HIDDEN_MS = 2500;
const TALK_MS = 4200;
const MOUTH_MS = 1800;
const PIN_MS = 30000;
/** Space kept free at the bottom of the content area (the Ask AI button). */
const BOTTOM_RESERVE = 110;

function linesFor(firstName?: string) {
  return [
    `Hi${firstName ? `, ${firstName}` : ''}! I'm your HRISense buddy.`,
    'Need an answer? Press Ask AI in the corner.',
    'Stuck on a task? The Help Center has step-by-step guides.',
    'Tip: press Ctrl + K (⌘K on a Mac) to search HRISense.',
    "In the way? Drag me to the other side!",
    'You can turn me off in Settings.',
  ];
}

export function AiBuddy() {
  const [enabled] = useBuddyEnabled();
  return enabled ? <Buddy /> : null;
}

function Buddy() {
  const { contentOffset } = useAppShell();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion() ?? false;

  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A bit larger than the Help Center peek; small and docked on phones.
  const phone = box.w > 0 && box.w < 640;
  const H = phone ? 72 : 148;
  const W = Math.round((H * 300) / 304);

  const x = useMotionValue(-1000);
  const y = useMotionValue(0);
  const [side, setSide] = useState<Side>('left');
  const [phase, setPhase] = useState<Phase>('hidden');
  const [mood, setMood] = useState<AiMascotState>(SPOTS[0].mood);
  const [line, setLine] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);

  // Timers and the latest values, for callbacks that fire later.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const live = useRef({ side, phase, W, H, box, phone });
  live.current = { side, phase, W, H, box, phone };
  const spot = useRef(0);
  const nextLine = useRef(0);
  const pinnedUntil = useRef(0);
  const dragged = useRef(false);
  const started = useRef(false);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const xFor = (s: Side, p: Phase) => {
    const { W, box, phone } = live.current;
    // Phones: tucked further into the corner so the peek stays inside the
    // page gutter and never over a card's text or buttons.
    const peekIn = phone ? 0.55 : 0.24;
    if (s === 'left') return p === 'hidden' ? -W * 1.1 : p === 'out' ? 12 : -W * peekIn;
    return p === 'hidden' ? box.w + W * 0.1 : p === 'out' ? box.w - W - 12 : box.w - W * 0.76;
  };
  const clampTop = (top: number) => {
    const { H, box, phone } = live.current;
    // Phones: always the bottom-left dock, clear of the content above it.
    if (phone) return Math.max(8, box.h - H - 8);
    return Math.max(8, Math.min(top, box.h - H - BOTTOM_RESERVE));
  };
  const move = (p: Phase, s: Side, top?: number) => {
    setPhase(p);
    live.current.phase = p;
    const t = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 120, damping: 18 };
    animate(x, xFor(s, p), t);
    if (top !== undefined) animate(y, top, t);
  };

  /** Duck out of sight, then reappear at the next spot on the other side. */
  const relocate = () => {
    clearTimers();
    setLine(null);
    setTalking(false);
    move('hidden', live.current.side);
    later(() => {
      // Phones: back into the same dock (the right corner is the Ask AI button's).
      const next: Side = live.current.phone ? 'left' : live.current.side === 'left' ? 'right' : 'left';
      spot.current = (spot.current + 1) % SPOTS.length;
      const top = clampTop(SPOTS[spot.current].at * live.current.box.h);
      setSide(next);
      live.current.side = next;
      x.set(xFor(next, 'hidden'));
      y.set(top);
      setMood(SPOTS[spot.current].mood);
      move('peek', next);
      scheduleRoam();
    }, reduceMotion ? 0 : HIDDEN_MS);
  };

  const scheduleRoam = () => {
    if (reduceMotion || live.current.phone) return; // stays put; only presses (and drags) move him
    later(() => {
      if (Date.now() < pinnedUntil.current || live.current.phase !== 'peek') {
        scheduleRoam();
        return;
      }
      relocate();
    }, PEEK_MS);
  };

  // First appearance once the area is measured; re-snap when it resizes.
  useEffect(() => {
    if (!box.w || !box.h) return;
    if (started.current) {
      const { side: was, phase: p, phone: onPhone } = live.current;
      // Narrowed to a phone while on the right: move to the phone dock (left).
      const s: Side = onPhone ? 'left' : was;
      if (s !== was) {
        setSide(s);
        live.current.side = s;
      }
      if (p !== 'drag') {
        x.set(xFor(s, p));
        y.set(clampTop(y.get()));
      }
      return;
    }
    started.current = true;
    const top = clampTop(SPOTS[0].at * box.h);
    x.set(xFor('left', 'hidden'));
    y.set(top);
    later(() => {
      move('peek', 'left');
      scheduleRoam();
    }, reduceMotion ? 0 : FIRST_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.w, box.h, H]);

  const say = (text: string, ms: number) => {
    setLine(text);
    setTalking(true);
    later(() => setTalking(false), Math.min(MOUTH_MS, ms));
    later(() => setLine(null), ms);
  };

  const press = () => {
    if (dragged.current) return;
    const p = live.current.phase;
    if (p === 'out') {
      relocate(); // pressed again: back in he goes
      return;
    }
    if (p !== 'peek') return;
    clearTimers();
    const lines = linesFor(user?.employee?.firstName);
    const text = lines[nextLine.current % lines.length];
    nextLine.current += 1;
    setMood('hello');
    move('out', live.current.side);
    say(text, TALK_MS);
    later(relocate, TALK_MS + 200);
  };

  return (
    <div
      ref={boxRef}
      className="pointer-events-none fixed top-16 right-0 bottom-0 z-[15] overflow-hidden print:hidden"
      style={{ left: contentOffset }}
    >
      {box.w > 0 && (
        <motion.div
          role="button"
          tabIndex={0}
          aria-label={phone ? 'HRISense buddy. Press to say hi.' : 'HRISense buddy. Press to say hi, or drag to move him.'}
          className="pointer-events-auto absolute left-0 top-0 cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-3xl active:cursor-grabbing"
          style={{ x, y, width: W, height: H }}
          drag={!phone}
          dragConstraints={boxRef}
          dragElastic={0.08}
          dragMomentum={false}
          onPointerDown={(e) => {
            dragged.current = false;
            // Stops the browser starting a text selection while he is dragged
            // across the page; the click still fires.
            e.preventDefault();
          }}
          onDragStart={() => {
            dragged.current = true;
            document.documentElement.style.userSelect = 'none';
            clearTimers();
            setLine(null);
            setTalking(false);
            setMood('done');
            setPhase('drag');
            live.current.phase = 'drag';
          }}
          onDragEnd={() => {
            document.documentElement.style.userSelect = '';
            const { W: w, box: b } = live.current;
            const s: Side = x.get() + w / 2 < b.w / 2 ? 'left' : 'right';
            setSide(s);
            live.current.side = s;
            setMood('idle');
            move('peek', s, clampTop(y.get()));
            pinnedUntil.current = Date.now() + PIN_MS;
            say("I'll stay here for a bit.", 2600);
            scheduleRoam();
          }}
          onClick={press}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              dragged.current = false;
              press();
            }
          }}
        >
          <motion.div whileHover={reduceMotion ? undefined : { scale: 1.06 }} className="h-full w-full">
            {/* Mirrored on the right edge so he always faces the page. */}
            <div className={cn('h-full w-full', side === 'right' && '-scale-x-100')}>
              <div className={cn('h-full w-full', phase === 'peek' && 'ai-mascot-peek')}>
                <AiMascot variant="full" state={mood} talking={talking} size={H} />
              </div>
            </div>
          </motion.div>

          <AnimatePresence>
            {line && phase !== 'hidden' && (
              <motion.div
                key={line}
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
                className={cn(
                  'pointer-events-none absolute w-max max-w-[210px] rounded-2xl border border-status-accent-border bg-surface px-3 py-2 text-sm font-medium leading-snug text-foreground shadow-card-hover',
                  side === 'left' ? 'origin-bottom-left' : 'origin-bottom-right'
                )}
                style={{ bottom: H * 0.7, ...(side === 'left' ? { left: W * 0.72 } : { right: W * 0.72 }) }}
              >
                {line}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
