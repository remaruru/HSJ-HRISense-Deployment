import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./index.css";
import { queryClient } from "@/lib/queryClient";
import { router } from "@/lib/router";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { ConfirmProvider } from "./components/shared/ConfirmProvider";
import { AppErrorBoundary } from "@/components/shared/AppErrorBoundary";

function InnerApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Theme sits inside auth: light/dark is saved per signed-in account. */}
        <AuthProvider>
          <ThemeProvider>
            <InnerApp />
            <ConfirmProvider />
            <Toaster
              position="top-right"
              // Every toast can be closed by hand — on a phone it may sit over
              // something the person needs.
              closeButton
              toastOptions={{
                // Theme tokens, so toasts follow light/dark like everything else.
                style: {
                  background: "var(--surface)",
                  color: "var(--foreground)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-soft)",
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>
);
