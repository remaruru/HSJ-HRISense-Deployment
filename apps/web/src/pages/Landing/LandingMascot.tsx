import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { AiMascot, type AiMascotState } from '@/components/ai/AiMascot';
import { cn } from '@/lib/utils';

/**
 * The HRISense mascot on the public landing page — the same character as the
 * Ask AI button and the signed-in buddy, never a second design.
 *
 * - In the hero it is a large part of the composition.
 * - Once the hero mascot has scrolled fully out of view, a smaller companion
 *   pops in at the lower-right and follows the visitor; scrolling back to the
 *   hero puts it away again. Only one of the two is ever visible, and the
 *   companion steps aside over the footer so it never covers the contacts.
 * - Pressing it (click, tap, Enter or Space) opens a short quick fact about
 *   Hospicio de San Jose or HSJ HRISense, matched loosely to the section being
 *   read. **Next fact**
 *   cycles; ✕ or Esc closes.
 *
 * The facts are a small, fixed, public-safe list (below). They never come from
 * HRISense data — no employee records, counts, names, IDs, statistics or
 * assignments — and never from an AI call. Motion is subtle and stops under
 * prefers-reduced-motion.
 */

export interface LandingFact {
  id: string;
  /** Landing sections this fact suits (ids of the page sections). */
  sections: string[];
  title: string;
  text: string;
}

/**
 * The approved quick facts. Two kinds only:
 *
 * • Hospicio de San Jose — each fact is stated by an official source, checked on
 *   5 October 2026: Hospicio's own website (hospiciodesanjose.org/about-us) and
 *   the National Historical Commission of the Philippines' historic-site registry
 *   (philhistoricsites.nhcp.gov.ph, "Hospicio de San Jose"). The founding year is
 *   left out on purpose: the two sources give different years.
 * • HRISense — high-level only: what it is for, never how it works inside.
 *
 * To change a fact, keep to these rules and cite the source here.
 */
export const LANDING_FACTS: LandingFact[] = [
  {
    id: 'what',
    sections: ['top'],
    title: 'What is HRISense?',
    text: 'HRISense helps Hospicio de San Jose organize its workforce administration in one system.',
  },
  {
    // hospiciodesanjose.org: "the first social welfare institution in the Philippines"
    id: 'hsj-first',
    sections: ['about'],
    title: 'Hospicio de San Jose',
    text: 'Hospicio de San Jose is the first social welfare institution in the Philippines.',
  },
  {
    id: 'modules',
    sections: ['features'],
    title: 'What it covers',
    text: 'HRISense brings together attendance, leave, evaluations, training, recruitment and compliance.',
  },
  {
    // hospiciodesanjose.org: "surrendered, abandoned and neglected children, older
    // persons, persons with special needs, and persons in crisis"
    id: 'hsj-serves',
    sections: [],
    title: 'Who Hospicio serves',
    text: 'Hospicio cares for abandoned and neglected children, older persons, persons with special needs and people in crisis.',
  },
  {
    id: 'roles',
    sections: ['roles', 'sign-in'],
    title: 'The right tools for each role',
    text: 'Each person in HRISense uses the functions that fit their role.',
  },
  {
    id: 'people-decide',
    sections: ['how-it-works', 'ai-assistance'],
    title: 'People decide',
    text: 'AI Assistance helps explain information a person is allowed to see. People make the final HR decisions.',
  },
  {
    // NHCP historical marker: "the Sisters of Charity have been administering it since 1865"
    id: 'hsj-sisters',
    sections: [],
    title: 'Since 1865',
    text: 'The Sisters of Charity have been running Hospicio de San Jose since 1865.',
  },
  {
    // hospiciodesanjose.org: address on Isla de Convalecencia, Ermita, Manila
    id: 'hsj-island',
    sections: [],
    title: 'An island home',
    text: 'Hospicio de San Jose stands on Isla de Convalecencia, a small island in Manila.',
  },
  {
    id: 'careers',
    sections: ['careers'],
    title: 'Applying for a job?',
    text: 'You can see the positions Hospicio is hiring for right now and apply online — no account needed.',
  },
  {
    // hospiciodesanjose.org mission statement
    id: 'hsj-mission',
    sections: [],
    title: "Hospicio's mission",
    text: 'Hospicio commits itself to the integral development and well-being of the vulnerable and excluded sectors of society.',
  },
];

/** The landing sections, top to bottom (their element ids). */
const SECTION_IDS = ['top', 'about', 'features', 'roles', 'how-it-works', 'ai-assistance', 'careers', 'sign-in'];

const factIndexFor = (section: string) => {
  const i = LANDING_FACTS.findIndex((f) => f.sections.includes(section));
  return i === -1 ? 0 : i;
};

interface MascotContextValue {
  open: boolean;
  fact: LandingFact;
  mood: AiMascotState;
  talking: boolean;
  docked: boolean;
  dockHidden: boolean;
  bubbleId: string;
  heroSlotRef: React.RefObject<HTMLDivElement | null>;
  toggle: () => void;
  close: () => void;
  next: () => void;
}

const MascotContext = createContext<MascotContextValue | null>(null);

const useMascot = () => {
  const ctx = useContext(MascotContext);
  if (!ctx) throw new Error('Landing mascot pieces must be inside <LandingMascotProvider>.');
  return ctx;
};

export function LandingMascotProvider({ children }: { children: React.ReactNode }) {
  const heroSlotRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const [section, setSection] = useState('top');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [mood, setMood] = useState<AiMascotState>('idle');
  const [talking, setTalking] = useState(false);
  const bubbleId = useId();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /** A wave and a few words, then back to idle. */
  const greet = useCallback(() => {
    clearTimers();
    setMood('hello');
    setTalking(true);
    timers.current.push(setTimeout(() => setTalking(false), 1600));
    timers.current.push(setTimeout(() => setMood('idle'), 2200));
  }, []);

  // The hero mascot counts as visible while any of it is below the fixed nav.
  useEffect(() => {
    const el = heroSlotRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The companion steps aside over the footer (support contacts).
  useEffect(() => {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Which section is in the middle of the screen — for section-aware facts.
  useEffect(() => {
    const els = SECTION_IDS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setSection(hit.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  // While a fact is open, it follows the section being read.
  useEffect(() => {
    if (open) setIndex(factIndexFor(section));
  }, [section, open]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    setOpen((was) => {
      if (!was) {
        setIndex(factIndexFor(section));
        greet();
      }
      return !was;
    });
  }, [section, greet]);
  const next = useCallback(() => {
    setIndex((i) => (i + 1) % LANDING_FACTS.length);
    greet();
  }, [greet]);

  // Esc closes the fact from anywhere on the page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const value = useMemo<MascotContextValue>(
    () => ({
      open,
      fact: LANDING_FACTS[index],
      mood,
      talking,
      docked: !heroVisible,
      dockHidden: footerVisible,
      bubbleId,
      heroSlotRef,
      toggle,
      close,
      next,
    }),
    [open, index, mood, talking, heroVisible, footerVisible, bubbleId, toggle, close, next]
  );

  return (
    <MascotContext.Provider value={value}>
      {children}
      <DockedMascot />
    </MascotContext.Provider>
  );
}

/** The quick-fact speech bubble. */
function FactBubble({ className }: { className?: string }) {
  const { fact, close, next, bubbleId } = useMascot();
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <motion.div
      id={bubbleId}
      role="dialog"
      aria-modal="false"
      aria-label="HRISense quick fact"
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      className={cn(
        'z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-primary-200 bg-surface p-4 text-left shadow-card-hover',
        'dark:border-primary-800',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-foreground">Hi! I&rsquo;m the HRISense assistant.</p>
        <button
          type="button"
          onClick={close}
          aria-label="Close quick fact"
          className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div aria-live="polite" className="mt-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-700 dark:text-primary-300">{fact.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground break-words">{fact.text}</p>
      </div>
      <button
        type="button"
        onClick={next}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300 dark:hover:bg-primary-900/40"
      >
        Next fact <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

/** The mascot itself as a real button. */
function MascotButton({ sizeClass, label }: { sizeClass: string; label: string }) {
  const { open, toggle, mood, talking, bubbleId } = useMascot();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-controls={open ? bubbleId : undefined}
      aria-label={label}
      className="group rounded-[2rem] p-1 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50 motion-safe:hover:-translate-y-1"
    >
      <AiMascot variant="full" state={mood} talking={talking} size={420} className={sizeClass} />
    </button>
  );
}

/** The large hero mascot. Its slot is what the page watches to know when to dock. */
export function HeroMascot() {
  const { heroSlotRef, open, docked } = useMascot();
  return (
    <div ref={heroSlotRef} className="relative flex flex-col items-center">
      <AnimatePresence>
        {open && !docked && (
          // Phones and tablets: below the mascot (the buttons are above it).
          // Desktop: over the top of the mascot, never up under the fixed nav.
          // The z-index sits on this wrapper, not the bubble: the mascot button
          // lifts on hover with a transform, which would otherwise paint it
          // over the bubble (it comes later in the page).
          <div className="absolute left-1/2 top-[88%] z-30 -translate-x-1/2 lg:top-auto lg:bottom-[70%]">
            <FactBubble />
          </div>
        )}
      </AnimatePresence>
      <MascotButton
        sizeClass="h-[180px] w-auto sm:h-[230px] md:h-[260px] lg:h-[340px] xl:h-[400px]"
        label="HRISense assistant. Press for a quick fact about HSJ HRISense."
      />
      <p className="mt-1 text-xs font-medium text-muted-foreground">Press me for a quick fact</p>
    </div>
  );
}

/** The smaller companion that follows the visitor once the hero is behind them. */
function DockedMascot() {
  const { docked, dockHidden, open } = useMascot();
  const reduceMotion = useReducedMotion() ?? false;
  const show = docked && !dockHidden;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="docked-mascot"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.85 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
          className="fixed bottom-3 right-3 z-40 sm:bottom-5 sm:right-5 print:hidden"
        >
          <AnimatePresence>
            {open && (
              <div className="absolute bottom-full right-0 z-30 mb-1">
                <FactBubble />
              </div>
            )}
          </AnimatePresence>
          <div className="rounded-[2rem] bg-surface/80 shadow-card-hover backdrop-blur-sm ring-1 ring-border-soft">
            <MascotButton
              sizeClass="h-16 w-auto sm:h-[88px] lg:h-28"
              label="HRISense assistant. Press for a quick fact about HSJ HRISense."
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
