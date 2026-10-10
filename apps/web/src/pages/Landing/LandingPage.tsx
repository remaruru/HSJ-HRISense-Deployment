import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Heart, ArrowRight, Users, BarChart3, ShieldCheck, Clock, Brain, CheckCircle2,
  BookOpen, Menu, X, ArrowUp, Globe, Mail, ClipboardCheck, FolderOpen, Workflow, UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItemPop, staggerItem, hoverPop } from "@/lib/motion";
import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { HeroMascot, LandingMascotProvider } from "./LandingMascot";

/** The system's official title — used as is, never with words added. */
const OFFICIAL_TITLE = "An AI-Assisted Workforce Administration System with Compliance Decision";

/* ─── Section Wrapper ───────────────────────────────────────────── */
function Section({ children, className, id }: { children: React.ReactNode; className?: string; id?: string; }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section ref={ref} id={id} initial="hidden" animate={isInView ? "visible" : "hidden"} variants={staggerContainer} className={cn("relative scroll-mt-24", className)}>
      {children}
    </motion.section>
  );
}

/* ─── Landing TopNav ────────────────────────────────────────────── */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const onCareers = window.location.pathname.startsWith('/careers');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "About", hash: "about" },
    { label: "Features", hash: "features" },
    { label: "How It Works", hash: "how-it-works" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled ? "bg-surface/90 backdrop-blur-xl border-b border-border shadow-card" : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-pop-color">
              <Heart className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div><span className="text-base font-bold font-heading text-foreground">HSJ HRISense</span></div>
          </Link>

          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            {links.map((link) => (
              <Link key={link.label} to="/" hash={link.hash} className="whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
            <Link to={"/careers" as any} className="whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Careers</Link>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {onCareers ? (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Sign In</Button></Link>
                <Link to={"/careers" as any} hash="open-positions">
                  <Button size="sm" pill rightIcon={<ArrowRight className="h-3.5 w-3.5" />}><span className="hidden lg:inline">View&nbsp;</span>Job Positions</Button>
                </Link>
              </>
            ) : (
              <Link to="/login">
                <Button size="sm" pill rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Sign In</Button>
              </Link>
            )}
          </div>

          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button onClick={() => setMobileOpen((p) => !p)} className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors" aria-label="Toggle Menu" aria-expanded={mobileOpen}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-16 left-0 right-0 z-50 bg-surface border-b border-border shadow-card-hover p-4 md:hidden">
            <div className="space-y-1">
              {links.map((link) => (
                <Link key={link.label} to="/" hash={link.hash} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors">{link.label}</Link>
              ))}
              <Link to={"/careers" as any} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-muted transition-colors">Careers</Link>
              <div className="pt-2 space-y-2">
                <Link to="/login" className="block w-full" onClick={() => setMobileOpen(false)}><Button size="md" className="w-full" pill>Sign In</Button></Link>
                {onCareers && (
                  <Link to={"/careers" as any} hash="open-positions" className="block w-full" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" size="md" className="w-full" pill>View Job Positions</Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden pt-16 scroll-mt-24">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/80 via-background to-background dark:from-primary-900/35" aria-hidden="true" />
      <div className="absolute inset-0 dot-grid opacity-30" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-16 sm:pb-20 lg:py-20 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-8 lg:gap-12 items-center lg:min-h-[calc(100vh-4rem)]">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="text-center lg:text-left min-w-0">
          <motion.p variants={staggerItem} className="text-sm font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300 mb-3">
            Hospicio de San Jose
          </motion.p>
          <motion.h1 variants={staggerItem} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold font-heading text-foreground leading-[1.05] tracking-tight mb-4">
            HSJ <span className="text-primary-600 dark:text-primary-300">HRISense</span>
          </motion.h1>
          <motion.p variants={staggerItem} className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground leading-snug mb-5 max-w-2xl mx-auto lg:mx-0">
            {OFFICIAL_TITLE}
          </motion.p>
          <motion.p variants={staggerItem} className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto lg:mx-0">
            Designed for Hospicio de San Jose, it brings workforce records, attendance, leave, schedules, evaluations,
            training, recruitment and compliance monitoring together in one system, with AI-assisted summaries that
            support authorized personnel.
          </motion.p>
          <motion.div variants={staggerItem} className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 sm:gap-4">
            <a href="#about" className="w-full sm:w-auto">
              <Button size="lg" pill className="w-full sm:w-auto" rightIcon={<span className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center"><ArrowRight className="h-4 w-4" /></span>}>Explore HRISense</Button>
            </a>
            <Link to={"/careers" as any} className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" pill className="w-full sm:w-auto">View Careers</Button>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <HeroMascot />
        </motion.div>
      </div>
    </section>
  );
}

/* ─── HSJ HRISense — what it is ─────────────────────────────────── */
function AboutSection() {
  return (
    <Section className="py-20 sm:py-24 bg-surface" id="about">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2 variants={staggerItem} className="text-4xl sm:text-5xl font-extrabold font-heading mb-6">
          HSJ <span className="gradient-text">HRISense</span>
        </motion.h2>
        <motion.p variants={staggerItem} className="text-muted-foreground text-lg sm:text-xl leading-relaxed mb-5">
          HSJ HRISense is Hospicio de San Jose&rsquo;s workforce administration system. It keeps employee records,
          attendance, leave, work schedules, evaluations, training, recruitment, compliance monitoring, medical and
          psychological records, announcements and reports in one place, for the people authorized to handle them.
        </motion.p>
        <motion.p variants={staggerItem} className="text-muted-foreground text-lg sm:text-xl leading-relaxed">
          Its AI Assistance summarizes the workforce information a user is allowed to see and helps them understand it.
          It does not make decisions: final decisions stay with authorized Hospicio personnel.
        </motion.p>
      </div>
    </Section>
  );
}

/* ─── What HRISense covers ──────────────────────────────────────── */
function FeaturesSection() {
  const tone = "bg-primary-50 text-primary-600 border border-primary-100 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900";
  const features = [
    { icon: <Users className="h-6 w-6" />, title: "Employee Records", description: "Employee profiles, organisational assignments, employment details and documents, kept by HR.", color: tone },
    { icon: <Clock className="h-6 w-6" />, title: "Attendance, Schedules & Leave", description: "Attendance imported from the timekeeping system, weekly work schedules, and leave requests endorsed by supervisors and decided by HR.", color: tone },
    { icon: <ClipboardCheck className="h-6 w-6" />, title: "Evaluations & Training", description: "Performance evaluations on Hospicio's official forms, and training and seminar records.", color: tone },
    { icon: <ShieldCheck className="h-6 w-6" />, title: "Compliance", description: "Licences, health clearances and required certificates — what is missing, expiring or expired.", color: tone },
    { icon: <Globe className="h-6 w-6" />, title: "Recruitment & Careers", description: "Job openings applicants can view and apply to online; HR reviews every application.", color: tone },
    { icon: <Brain className="h-6 w-6" />, title: "AI Assistance & Reports", description: "Summaries of the workforce figures a user may see, and reports exportable to Excel, PDF or CSV. Advisory only — people decide.", color: "bg-accent-light text-accent-dark border border-accent/20", isAI: true },
  ];

  return (
    <Section className="py-20 sm:py-24 bg-background" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={staggerItem} className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">What <span className="gradient-text">HRISense</span> covers</h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">The HR work Hospicio de San Jose handles every day, in one system.</p>
        </motion.div>
        <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <motion.div key={feature.title} variants={staggerItemPop} {...hoverPop} className="bg-surface rounded-2xl border border-border-soft p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-4", feature.color)}>{feature.icon}</div>
              <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-2 mb-3">
                <h3 className="font-bold font-heading text-xl flex-1 min-w-0 break-words leading-tight">{feature.title}</h3>
                {feature.isAI && <Badge isAI size="sm" className="shrink-0">AI</Badge>}
              </div>
              <p className="text-muted-foreground text-base leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ─── Roles ─────────────────────────────────────────────────────── */
function RolesSection() {
  const badgeClass = "bg-primary-50 text-primary-600 border-primary-100 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-900";
  const roles = [
    // HRISense has exactly three access tiers. There is no separate system
    // "Administrator" role — HR Personnel hold the full-access tier, and a job
    // title such as Assistant Administrator carries no elevated system rights.
    { title: "HR Personnel", subtitle: "Employee Management", icon: <Users className="h-6 w-6" />, desc: "Keep employee records, attendance, leave, recruitment and compliance, and manage HRISense accounts.", modules: ["Employee Management", "Attendance & Leave", "Recruitment", "Compliance", "Account Management"] },
    { title: "Supervisor", subtitle: "My Team", icon: <UserCheck className="h-6 w-6" />, desc: "See the employees who report directly to them, follow their attendance and endorse their leave to HR.", modules: ["My Team", "Team Attendance", "Leave Endorsement", "Team Schedules", "Evaluations"] },
    { title: "Employee", subtitle: "My Profile", icon: <FolderOpen className="h-6 w-6" />, desc: "See their own profile, schedule, attendance, leave balances and training, and update their own contact details.", modules: ["My Profile", "Leave Requests", "Work Schedule", "Training History"] },
  ];

  return (
    <Section className="py-20 sm:py-24 bg-muted" id="roles">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={staggerItem} className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">Different access for <span className="gradient-text">different roles</span></h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">Each person sees only what their role allows.</p>
        </motion.div>
        <motion.div variants={staggerContainer} className="flex flex-wrap justify-center gap-6">
          {roles.map((role) => (
            <motion.div key={role.title} variants={staggerItemPop} className="bg-surface rounded-2xl border border-border-soft p-6 flex flex-col w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] shadow-card">
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center border mb-6", badgeClass)}>{role.icon}</div>
              <h3 className="font-bold font-heading text-xl mb-1">{role.title}</h3>
              <p className="text-sm font-semibold text-muted-foreground mb-3">{role.subtitle}</p>
              <p className="text-muted-foreground text-base leading-relaxed mb-6 flex-1">{role.desc}</p>
              <div className="border-t border-border/60 pt-4">
                <ul className="space-y-2">
                  {role.modules.map(mod => (
                    <li key={mod} className="flex items-start gap-2 text-[15px] text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary-400 shrink-0 mt-0.5" /> <span>{mod}</span></li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

/* ─── How It Works ──────────────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { title: "Manage Workforce Information", description: "Employee records, organisational assignments, documents and employment information are kept in one place.", icon: <Users className="h-6 w-6" /> },
    { title: "Handle HR Processes", description: "Attendance, schedules, leave, evaluations, training, recruitment, compliance and related HR work are handled in HRISense.", icon: <Workflow className="h-6 w-6" /> },
    { title: "Use AI Assistance", description: "HRISense can summarize authorized information, point out data that may need review, and answer questions suited to the user's role.", icon: <Brain className="h-6 w-6" /> },
    { title: "Human Review and Decision", description: "Authorized Hospicio personnel review the information and make the final HR decisions.", icon: <CheckCircle2 className="h-6 w-6" /> },
  ];

  return (
    <Section className="py-20 sm:py-24 bg-background" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div variants={staggerItem} className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">How <span className="gradient-text">HRISense</span> Works</h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">Four steps — and the last one is always a person.</p>
        </motion.div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.li
              key={step.title}
              variants={staggerItem}
              className={cn(
                "relative rounded-2xl border p-6 text-left shadow-card",
                i === steps.length - 1
                  ? "border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/40"
                  : "border-border-soft bg-surface"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="h-10 w-10 rounded-full bg-primary-600 text-white text-base font-bold flex items-center justify-center shrink-0" aria-hidden="true">{i + 1}</span>
                <span className="h-10 w-10 rounded-xl border border-primary-100 bg-primary-50 flex items-center justify-center text-primary-600 dark:border-primary-900 dark:bg-primary-900/40 dark:text-primary-300" aria-hidden="true">{step.icon}</span>
              </div>
              <h3 className="text-xl font-bold font-heading mb-2"><span className="sr-only">{`Step ${i + 1}: `}</span>{step.title}</h3>
              <p className="text-muted-foreground text-base leading-relaxed">{step.description}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

/* ─── AI Section ────────────────────────────────────────────────── */
function AISection() {
  const capabilities = [
    "Attendance summaries",
    "Leave summaries",
    "Training completion",
    "Compliance status and expiries",
    "Tardiness patterns",
    "Plain-language workforce reports",
  ];

  return (
    <Section className="py-20 sm:py-24 overflow-hidden" id="ai-assistance">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900 to-primary-700" />
      <div className="absolute inset-0 dot-grid opacity-10" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr,1.1fr] gap-12 lg:gap-20 items-center">
        <div>
          <motion.div variants={staggerItem}>
            <Badge isAI size="lg" className="mb-6 bg-accent/20 border-accent/40 text-accent-light">AI Assistance</Badge>
          </motion.div>
          <motion.h2 variants={staggerItem} className="text-4xl sm:text-5xl font-extrabold font-heading text-white mb-6">
            AI that informs HR. <span className="text-primary-300">People decide.</span>
          </motion.h2>
          <motion.p variants={staggerItem} className="text-primary-100 text-lg sm:text-xl mb-4 leading-relaxed">
            HRISense reads the records HR already keeps and explains what they show. It never approves,
            hires, rejects, disciplines or rates anyone — authorized Hospicio de San Jose personnel make
            every decision.
          </motion.p>
          <motion.div variants={staggerContainer} className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mt-8">
            {capabilities.map((cap) => (
              <motion.div key={cap} variants={staggerItem} className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-primary-500 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
                <span className="text-primary-100 text-sm flex-1 min-w-0 break-words">{cap}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
        <motion.div variants={staggerItem} className="space-y-6 lg:pl-8">
          {/* How a figure becomes a decision. The last step is a person, and it
              is styled to look like the end of the chain. */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 text-white">
            <ol className="space-y-3 mb-6">
              {[
                { icon: <Users className="h-5 w-5" />, label: 'HRISense organizes workforce information' },
                { icon: <BarChart3 className="h-5 w-5" />, label: 'Relevant patterns are identified from those records' },
                { icon: <Brain className="h-5 w-5" />, label: 'AI Assistance presents summaries' },
                { icon: <BookOpen className="h-5 w-5" />, label: 'HR reviews the information' },
              ].map((step, i) => (
                <li key={step.label} className="flex items-start gap-3">
                  <span className="h-9 w-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-primary-100">
                    {step.icon}
                  </span>
                  <span className="text-[15px] text-primary-100 leading-snug pt-1.5 min-w-0">
                    <span className="sr-only">{`Step ${i + 1}: `}</span>{step.label}
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-3 rounded-xl bg-white/15 border border-white/25 p-3 -mx-1">
                <span className="h-9 w-9 rounded-xl bg-white text-primary-700 flex items-center justify-center shrink-0 dark:bg-surface dark:text-primary-300">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <span className="text-[15px] font-bold text-white leading-snug pt-1.5 min-w-0">
                  HR personnel make the final decision
                </span>
              </li>
            </ol>

            <div className="border-t border-white/10 pt-4">
              {/* Describes what the feature does. Deliberately NOT a sample
                  insight: a fabricated figure about a named unit would read as a
                  real finding about real staff. */}
              <p className="text-sm text-primary-100 mb-3 leading-relaxed">
                AI Assistance reads the workforce figures already in HRISense — headcount, attendance
                records, leave requests, compliance status, training and evaluations — and describes
                what they show, together with the areas HR may want to look at.
              </p>
              <p className="text-xs text-primary-200 leading-relaxed">
                Every observation cites the figures it came from. It does not approve leave, hire or
                reject applicants, or change any record.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

/*
 * The public landing page carries no personal names other than the support
 * contacts in the footer. Team and adviser attribution lives in the project
 * documentation, not on a page anyone can read.
 */

/* ─── Careers CTA ───────────────────────────────────────────────── */
function CareersCTASection() {
  return (
    <Section className="py-20 bg-background border-t border-border" id="careers">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold font-heading mb-4">Join Our Team</h2>
        <p className="text-muted-foreground text-lg mb-8">
          Interested applicants can view available openings, read job details, submit an application, upload a résumé, and receive updates from HR through the contact information they provide.
        </p>
        <Link to={"/careers" as any}>
          <Button size="lg" pill rightIcon={<ArrowRight className="h-4 w-4" />}>View Open Positions</Button>
        </Link>
      </div>
    </Section>
  );
}

/* ─── Login CTA ─────────────────────────────────────────────────── */
function LoginCTASection() {
  return (
    <Section className="py-20 sm:py-24 bg-primary-900 text-white relative overflow-hidden" id="sign-in">
      <div className="absolute inset-0 dot-grid opacity-10" />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold font-heading mb-4">Already part of Hospicio de San Jose?</h2>
        <p className="text-primary-200 text-lg mb-8">Sign in with the personal email registered with HR.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/login">
            <Button size="lg" variant="primary" className="bg-white text-primary-900 hover:bg-white/90 dark:bg-surface dark:text-primary-300 dark:hover:bg-surface/90" pill rightIcon={<ArrowRight className="h-4 w-4" />}>Sign In to HRISense</Button>
          </Link>
          <Link to={"/careers" as any}>
            <Button size="lg" variant="outline" className="text-white border-white/20 hover:bg-white/10" pill>Explore Careers</Button>
          </Link>
        </div>
      </div>
    </Section>
  );
}

/* ─── Footer ────────────────────────────────────────────────────── */
/** Who to contact about problems with the system (shown above the copyright). */
const SUPPORT_CONTACTS = [
  { name: "EARL ANGELO ROLDAN", email: "mearoldan@tip.edu.ph" },
  { name: "ENZO BENEDICT ROSALES", email: "mebrosales@tip.edu.ph" },
  { name: "MARIA CIELO SALAZAR", email: "mmcsalazar02@tip.edu.ph" },
];

export function PublicFooter() {
  return (
    <footer id="site-footer" className="bg-surface border-t border-border pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-10">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <Heart className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold font-heading">HSJ HRISense</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2 max-w-md">
              HSJ HRISense: {OFFICIAL_TITLE}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">Hospicio de San Jose</p>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-4">Navigation</h3>
            <ul className="space-y-3">
              {[{ label: "About", hash: "about" }, { label: "Features", hash: "features" }, { label: "How It Works", hash: "how-it-works" }].map(link => (
                <li key={link.label}>
                  <Link to="/" hash={link.hash} className="text-sm text-muted-foreground hover:text-primary-600 transition-colors dark:hover:text-primary-300">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-foreground mb-4">Portal</h3>
            <ul className="space-y-3">
              <li><Link to={"/careers" as any} className="text-sm text-muted-foreground hover:text-primary-600 transition-colors dark:hover:text-primary-300">Public Careers</Link></li>
              <li><Link to="/login" className="text-sm text-muted-foreground hover:text-primary-600 transition-colors dark:hover:text-primary-300">System Login</Link></li>
            </ul>
          </div>
        </div>
        {/* Support contacts */}
        <section aria-labelledby="footer-support-heading" className="border-t border-border py-8">
          <h3 id="footer-support-heading" className="text-sm font-semibold text-foreground mb-4">
            If you have any issues, please contact:
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
            {SUPPORT_CONTACTS.map((contact) => (
              <li key={contact.email} className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-foreground">{contact.name}</p>
                {/* The whole row is the link, so the touch target is at least 44px tall. */}
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex max-w-full min-h-11 items-center gap-2 text-sm text-primary-700 hover:text-primary-800 hover:underline underline-offset-2 dark:text-primary-300 dark:hover:text-primary-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{contact.email}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left">© {new Date().getFullYear()} HSJ HRISense · Hospicio de San Jose. All rights reserved.</p>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Top <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */
export default function LandingPage() {
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <LandingMascotProvider>
        <LandingNav />
        <HeroSection />
        <AboutSection />
        <FeaturesSection />
        <RolesSection />
        <HowItWorksSection />
        <AISection />
        <CareersCTASection />
        <LoginCTASection />
        <PublicFooter />
      </LandingMascotProvider>
    </div>
  );
}
