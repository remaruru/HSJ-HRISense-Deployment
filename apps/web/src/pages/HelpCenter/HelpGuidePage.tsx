import React, { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileQuestion,
  Info,
  Layers,
  Lightbulb,
  Lock,
  Printer,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { HELP_CATEGORIES } from './helpCenter.registry';
import { getGuideBySlug } from './helpCenter.search';
import type { HelpRole } from './helpCenter.types';
import { DEV_READER_FIXTURE } from './devGuideFixture';
import { HelpBreadcrumbs } from './components/HelpBreadcrumbs';
import { HelpRoleIndicator } from './components/HelpRoleIndicator';
import { HelpPrerequisites } from './components/HelpPrerequisites';
import { HelpGuideStep } from './components/HelpGuideStep';
import { HelpTroubleshooting } from './components/HelpTroubleshooting';
import { HelpRelatedGuides } from './components/HelpRelatedGuides';
import { HelpGuideNavigation } from './components/HelpGuideNavigation';
import { staggerContainer, staggerItem } from '@/lib/motion';

export default function HelpGuidePage() {
  const { guideSlug } = useParams({ strict: false }) as { guideSlug?: string };
  const { user } = useAuth();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  const role: HelpRole =
    user?.permissionTier === 'FULL'
      ? 'FULL'
      : user?.permissionTier === 'SUPERVISOR'
      ? 'SUPERVISOR'
      : 'STANDARD';

  // DEV-ONLY: Support development preview fixture without polluting production registry.
  // In production builds this route falls through to normal getGuideBySlug (returns undefined → "Guide Not Found").
  const isDev = import.meta.env.DEV;
  const rawGuide =
    guideSlug === 'preview-guide-reader' && isDev
      ? DEV_READER_FIXTURE
      : guideSlug
      ? getGuideBySlug(guideSlug)
      : undefined;

  const isAuthorized = rawGuide ? rawGuide.roles.includes(role) : false;

  const handleBackToHelp = () => {
    navigate({ to: '/help-center' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleScrollToStep = (stepNumber: number) => {
    setActiveStep(stepNumber);
    const element = document.getElementById(`step-${stepNumber}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ─── Case 1: Guide Slug Not Found ──────────────────────────────────────────
  if (!rawGuide) {
    return (
      <div className="p-8 max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/80 border-2 border-border flex items-center justify-center text-muted-foreground shadow-xs">
          <FileQuestion className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold font-heading text-foreground">
            Guide Not Found
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            The guide you are looking for does not exist or may have been moved.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleBackToHelp}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Help Center
        </Button>
      </div>
    );
  }

  // ─── Case 2: Guide exists but unauthorized for current user's role ─────────
  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-status-warning-surface border-2 border-status-warning-border flex items-center justify-center text-status-warning-foreground shadow-xs">
          <Lock className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold font-heading text-foreground">
            Guide Not Available for Your Account
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            This guide describes features available to other roles and is not accessible with your current permissions.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleBackToHelp}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Help Center
        </Button>
      </div>
    );
  }

  // ─── Case 3: Guide is in preparation / unfinished (METADATA_ONLY or DRAFT) ──
  if (rawGuide.contentStatus !== 'READY') {
    return (
      <div className="p-8 max-w-2xl mx-auto py-16 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-info-50 dark:bg-info-950/40 border-2 border-info-200 dark:border-info-800 flex items-center justify-center text-info-600 dark:text-info-400 shadow-xs">
          <Info className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold font-heading text-foreground">
            Guide not available yet
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
            This step-by-step guide is still being prepared. More guides will be published as documentation continues.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleBackToHelp}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Help Center
        </Button>
      </div>
    );
  }

  const guide = rawGuide;
  const category = HELP_CATEGORIES.find((c) => c.code === guide.category);
  const steps = guide.content?.steps || [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 print:p-0 print:max-w-full"
    >
      {/* ─── Breadcrumbs & Action Bar ───────────────────────────────────── */}
      <motion.div variants={staggerItem} className="print:hidden space-y-3">
        <HelpBreadcrumbs
          items={[
            { label: 'Help Center', onClick: handleBackToHelp },
            { label: category?.name || guide.module, onClick: handleBackToHelp },
            { label: guide.title },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleBackToHelp}
            className="inline-flex items-center gap-2 text-sm md:text-base font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors dark:hover:text-primary-300"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
            <span>Back to Help Center</span>
          </button>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {guide.appLink && (
              <button
                type="button"
                onClick={() => navigate({ to: guide.appLink!.to as any })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary-200 bg-primary-50 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open {guide.appLink.label}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-status-success-foreground" />
                  <span className="text-status-success-foreground font-bold">Link copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              <Printer className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Print Guide</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── Main Guide Header ──────────────────────────────────────────── */}
      <motion.header
        variants={staggerItem}
        className="space-y-4 border-b-2 border-border/80 pb-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border uppercase tracking-wider">
            {category?.name || guide.module}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-surface border border-border text-foreground shadow-xs">
            <Layers className="h-3.5 w-3.5 text-primary-500" />
            <span>{guide.estimatedSteps} {guide.estimatedSteps === 1 ? 'Step' : 'Steps'}</span>
          </span>
          {guide.lastReviewed && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Reviewed: {guide.lastReviewed}</span>
            </span>
          )}
          <HelpRoleIndicator role={role} />
        </div>

        <h1 className="text-2xl md:text-4xl font-extrabold font-heading text-foreground tracking-tight leading-tight">
          {guide.title}
        </h1>

        <p className="text-base md:text-lg text-foreground/80 leading-relaxed max-w-3xl">
          {guide.content?.purpose || guide.shortDescription}
        </p>
      </motion.header>

      {/* ─── Guide Body / Reader Layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Reading Column (760-900px) */}
          <main className="lg:col-span-8 space-y-8 max-w-3xl">
            {/* Before You Start / Prerequisites */}
            {guide.content?.prerequisites && guide.content.prerequisites.length > 0 && (
              <motion.section variants={staggerItem}>
                <HelpPrerequisites prerequisites={guide.content.prerequisites} />
              </motion.section>
            )}

            {/* Step-by-Step Instructions */}
            <motion.section variants={staggerItem} className="space-y-2 pt-2">
              <h2 className="text-xl md:text-2xl font-bold font-heading text-foreground mb-6">
                Step-by-Step Instructions
              </h2>
              {/* Room on the left for the step badge, which sits on the timeline line. */}
              <div className="space-y-6 pl-6 md:pl-0">
                {steps.map((step) => (
                  <HelpGuideStep
                    key={step.stepNumber}
                    step={step}
                    totalSteps={steps.length}
                    onNavigateStep={handleScrollToStep}
                  />
                ))}
              </div>
            </motion.section>

            {/* What Happens Next Section */}
            {guide.content?.whatHappensNext && (
              <motion.section
                variants={staggerItem}
                className="p-5 md:p-6 rounded-2xl bg-primary-50/60 dark:bg-primary-950/30 border-2 border-primary-200 dark:border-primary-800/60 space-y-2"
              >
                <div className="flex items-center gap-2 text-primary-900 dark:text-primary-200 font-bold font-heading text-base md:text-lg">
                  <CheckCircle2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  <h3>What happens next?</h3>
                </div>
                <p className="text-sm md:text-base text-primary-950/85 dark:text-primary-200/90 leading-relaxed">
                  {guide.content.whatHappensNext}
                </p>
              </motion.section>
            )}

            {/* Troubleshooting Accordion */}
            {guide.content?.troubleshooting && (
              <motion.section variants={staggerItem}>
                <HelpTroubleshooting items={guide.content.troubleshooting} />
              </motion.section>
            )}

            {/* Helpful Tips Section */}
            {guide.content?.tips && guide.content.tips.length > 0 && (
              <motion.section variants={staggerItem} className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-foreground font-bold font-heading text-base md:text-lg">
                  <Lightbulb className="h-5 w-5 text-status-warning-foreground" />
                  <h3>Helpful Tips</h3>
                </div>
                <ul className="space-y-2 text-sm md:text-base text-foreground/90 leading-relaxed list-disc list-inside">
                  {guide.content.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </motion.section>
            )}

            {/* Related Guides */}
            {guide.content?.relatedGuideIds && (
              <motion.section variants={staggerItem}>
                <HelpRelatedGuides
                  relatedGuideIds={guide.content.relatedGuideIds}
                  currentRole={role}
                  onSelectGuide={(slug) =>
                    navigate({ to: '/help-center/$guideSlug', params: { guideSlug: slug } })
                  }
                />
              </motion.section>
            )}
          </main>

          {/* Sticky Guide Navigation Sidebar (Desktop Only) */}
          <aside className="hidden lg:block lg:col-span-4 print:hidden">
            <HelpGuideNavigation
              steps={steps}
              activeStep={activeStep}
              onStepClick={handleScrollToStep}
            />
          </aside>
        </div>

      {/* ─── Bottom Navigation ──────────────────────────────────────────── */}
      <motion.footer
        variants={staggerItem}
        className="pt-6 border-t-2 border-border flex items-center justify-between print:hidden"
      >
        <Button
          variant="outline"
          onClick={handleBackToHelp}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Help Center
        </Button>
      </motion.footer>
    </motion.div>
  );
}
