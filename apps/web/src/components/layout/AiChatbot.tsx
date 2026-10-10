import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { AssistantChat } from "@/components/ai/AssistantChat";
import { AiMascot, type AiMascotState } from "@/components/ai/AiMascot";

/**
 * AI Assistance as a chat bubble in the lower-right corner — for HR,
 * supervisors and employees alike. What each person can ask about is decided
 * by the server from their account; this component only hosts the chat.
 *
 * The current conversation id is remembered for the browser tab (per user),
 * so the bubble reopens where it left off. The server still checks ownership
 * on every request, so a stale or foreign id simply starts a new chat.
 */
export function AiChatbot() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const storageKey = user?.id ? `hrisense.ai.conversation.${user.id}` : null;
  const [open, setOpen] = useState(false);
  const [mascotState, setMascotState] = useState<AiMascotState>("idle");
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (!storageKey) return null;
    try {
      return sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (conversationId) sessionStorage.setItem(storageKey, conversationId);
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable — the chat still works, it just won't be remembered */
    }
  }, [conversationId, storageKey]);

  // The AI Assistance page has the full chat; the bubble would duplicate it.
  if (pathname.startsWith("/ai-assistance")) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex flex-col items-end gap-3 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="AI Assistance chat"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-[calc(100vw-2.5rem)] sm:w-[420px] h-[min(640px,calc(100vh-7rem))] flex flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-card-hover"
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-soft bg-status-accent-surface">
              <span className="h-10 w-10 shrink-0 rounded-xl border border-status-accent-border bg-surface flex items-center justify-center">
                <AiMascot state={mascotState} size={32} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">AI Assistance</p>
                <p className="text-xs text-status-accent-foreground">HSJ HRISense assistant · advisory only</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: "/ai-assistance" });
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface"
                aria-label="Open the AI Assistance page"
                title="Open full page"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AssistantChat
              variant="panel"
              conversationId={conversationId}
              onConversationChange={setConversationId}
              onMascotStateChange={setMascotState}
              className="flex-1"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close AI Assistance" : "Open AI Assistance"}
        className={cn(
          "group flex items-center gap-2 rounded-full bg-accent text-white shadow-card-hover",
          // Phones: a compact round button, so it covers as little of the page as possible.
          "h-12 w-12 justify-center sm:h-14 sm:w-auto sm:justify-start sm:pl-2 sm:pr-5 hover:bg-accent-dark transition-colors",
          open && "sm:pl-4",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          // A light disc so the violet mascot stands out on the violet button.
          <span className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-[#ede9fe] flex items-center justify-center">
            <AiMascot size={30} />
          </span>
        )}
        <span className="hidden sm:inline text-sm font-semibold">{open ? "Close" : "Ask AI"}</span>
      </button>
    </div>
  );
}
