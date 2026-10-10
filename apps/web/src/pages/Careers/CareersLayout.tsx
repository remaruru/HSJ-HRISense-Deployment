import { Outlet } from '@tanstack/react-router';
import { LandingNav, PublicFooter } from '@/pages/Landing/LandingPage';

export function CareersLayout() {
  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans antialiased text-foreground selection:bg-primary-500/30">
      <LandingNav />
      {/* pt-16 clears the fixed public nav; pages add their own rhythm on top. */}
      <main className="flex-1 pt-16">
        <Outlet />
      </main>
      {/* Shared Footer */}
      <PublicFooter />
    </div>
  );
}
