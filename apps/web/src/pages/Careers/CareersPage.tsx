import { Link } from "@tanstack/react-router";
import { Briefcase, ArrowRight, CheckCircle2, FileText, Search, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OpenPositions } from "./components/OpenPositions";

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden bg-surface pt-16 pb-20 lg:pt-24 lg:pb-32 border-b border-border">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-primary-100/50 rounded-full blur-3xl opacity-50 dark:opacity-10 pointer-events-none dark:bg-primary-900/60" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1fr,400px] gap-12 items-center">
          <div className="max-w-2xl text-center lg:text-left mx-auto lg:mx-0">
            <Badge size="md" className="mb-6 bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/60 dark:text-primary-300 dark:border-primary-900">
              Careers at Hospicio de San Jose
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-heading text-foreground leading-[1.15] tracking-tight mb-6">
              Build a Career That Supports a <span className="gradient-text">Meaningful Mission</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              See the positions open at Hospicio de San Jose right now and apply through the HRISense Careers portal — no account needed.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
              <a href="#open-positions">
                <Button size="lg" pill rightIcon={<ArrowRight className="h-4 w-4" />}>
                  View Open Positions
                </Button>
              </a>
              <Link to="/">
                <Button variant="outline" size="lg" pill>
                  Back to HRISense
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="hidden lg:block relative">
            <div className="bg-white dark:bg-surface-2 border border-border shadow-card-hover rounded-2xl p-8 relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center dark:bg-primary-900/60 dark:text-primary-300">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Apply through HRISense</h3>
                  <p className="text-sm text-muted-foreground">Secure and direct to HR</p>
                </div>
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  <span>No applicant account required to submit</span>
                </li>
                <li className="flex gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  <span>Direct submission to authorized HR personnel</span>
                </li>
                <li className="flex gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  <span>Data privacy compliant processing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Open Positions: only vacancies accepting applications now ─── */}
      <OpenPositions />

      {/* ─── Application Process Section ─── */}
      <section className="py-24 bg-surface border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-foreground mb-4">Application Process</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              No applicant account is required. Hospicio de San Jose Human Resources will contact applicants through the email address or mobile number submitted in the application.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: "01", icon: <Search className="h-6 w-6" />, title: "Find a Position", desc: "Browse the positions open right now." },
              { num: "02", icon: <FileText className="h-6 w-6" />, title: "Review the Job Details", desc: "Ensure you meet the qualifications and requirements." },
              { num: "03", icon: <Mail className="h-6 w-6" />, title: "Submit Your Application and Résumé", desc: "Use the secure public form to send your details directly to HR." },
              { num: "04", icon: <Users className="h-6 w-6" />, title: "Wait for Hospicio HR to Contact You", desc: "HR will review and contact you via your provided contact info." },
            ].map((step, i) => (
              <div key={i} className="bg-background rounded-2xl border border-border p-6 shadow-sm relative pt-12">
                <div className="absolute -top-6 left-6 h-12 w-12 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-lg shadow-pop-color border-2 border-background">
                  {step.num}
                </div>
                <div className="h-10 w-10 text-primary-500 mb-4 bg-primary-50 rounded-lg flex items-center justify-center dark:bg-primary-900/40">
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Careers CTA ─── */}
      <section className="py-24 bg-primary-900 text-white border-t border-primary-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading mb-4">Ready to Explore an Opportunity?</h2>
          <p className="text-primary-200 text-lg mb-8 max-w-2xl mx-auto">
            Browse the open positions and apply through the HRISense Careers form.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#open-positions">
              <Button size="lg" variant="primary" className="bg-white text-primary-900 hover:bg-white/90 dark:bg-surface dark:text-primary-300 dark:hover:bg-surface/90" pill rightIcon={<ArrowRight className="h-4 w-4" />}>
                Browse Open Positions
              </Button>
            </a>
            <Link to="/" hash="about">
              <Button size="lg" variant="outline" className="text-white border-white/20 hover:bg-white/10" pill>
                Learn More About HRISense
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
