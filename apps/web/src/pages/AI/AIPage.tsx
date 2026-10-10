import { useCallback, useEffect, useState } from 'react';
import { Brain, History, MessageSquare, Plus, Trash2, BarChart3, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpLink } from '@/components/common/HelpLink';
import { TabNav } from '@/components/ui/tab-nav';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { AssistantService, type ConversationSummary } from '@/services/ai-assistant.service';
import { useAuth } from '@/providers/AuthProvider';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import { cn } from '@/lib/utils';
import { WorkforceSummaryPanel } from './WorkforceSummaryPanel';

/**
 * AI Assistance — the role-aware HRISense assistant.
 *
 * Every signed-in user gets the assistant and their own conversation history.
 * HR also gets the "Workforce summary" tab: the deterministic organisation fact
 * sheet and the optional AI summary of it. What anyone can ask about is decided
 * by the server from their account, never by this page.
 */

type Tab = 'assistant' | 'summary';

export default function AIPage() {
  const { user } = useAuth();
  const isHr = user?.permissionTier === 'FULL';
  const [tab, setTab] = useState<Tab>('assistant');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryError(null);
      setConversations(await AssistantService.listConversations());
    } catch (err) {
      setHistoryError(getApiErrorMessage(err, 'Your conversations could not be loaded.'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onConversationChange = (id: string | null) => {
    setConversationId(id);
    loadHistory();
  };

  const remove = async (id: string) => {
    try {
      await AssistantService.deleteConversation(id);
      if (id === conversationId) setConversationId(null);
      setConversations((list) => list.filter((c) => c.id !== id));
    } catch (err) {
      setHistoryError(getApiErrorMessage(err, 'That conversation could not be removed.'));
    }
  };

  const subtitle = isHr
    ? 'Ask about the workforce and how HRISense works. Advisory only — every decision stays with HR.'
    : user?.permissionTier === 'SUPERVISOR'
      ? 'Ask about your own records, your direct reports and how HRISense works. Read-only.'
      : 'Ask about your own records and how HRISense works. Read-only.';

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <PageHeader
        icon={<Brain className="h-5 w-5" />}
        title="AI Assistance"
        subtitle={subtitle}
        actions={<HelpLink slug="use-ai-assistance" />}
      />

      {isHr && (
        <TabNav<Tab>
          aria-label="AI Assistance sections"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'assistant', label: 'Assistant', icon: <MessageSquare /> },
            { id: 'summary', label: 'Workforce summary', icon: <BarChart3 /> },
          ]}
        />
      )}

      {tab === 'summary' && isHr ? (
        <div role="tabpanel" id="tabpanel-summary" aria-labelledby="tab-summary">
          <WorkforceSummaryPanel />
        </div>
      ) : (
        <div
          role={isHr ? 'tabpanel' : undefined}
          id={isHr ? 'tabpanel-assistant' : undefined}
          className="grid grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)] gap-4"
        >
          {/* Conversation history — only this user's own. */}
          <aside className="rounded-2xl border border-border-soft bg-surface flex flex-col min-h-0 lg:h-[calc(100vh-15rem)] max-h-72 lg:max-h-none">
            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Your conversations
              </p>
              <button
                type="button"
                onClick={() => setConversationId(null)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-status-accent-foreground hover:bg-status-accent-surface"
              >
                <Plus className="h-3.5 w-3.5" /> New
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {historyLoading ? (
                <p className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </p>
              ) : historyError ? (
                <p className="px-2 py-3 text-xs text-status-danger-foreground">{historyError}</p>
              ) : conversations.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground leading-relaxed">
                  No conversations yet. Your questions are private to you.
                </p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      'group flex items-start gap-1 rounded-xl px-2.5 py-2 transition-colors',
                      c.id === conversationId ? 'bg-status-accent-surface' : 'hover:bg-surface-2'
                    )}
                  >
                    <button type="button" onClick={() => setConversationId(c.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="rounded-lg p-1 text-muted-foreground opacity-60 hover:bg-surface hover:text-status-danger-foreground group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Remove conversation "${c.title}"`}
                      title="Remove from your list"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="rounded-2xl border border-border-soft bg-surface overflow-hidden h-[calc(100vh-15rem)] min-h-[28rem]">
            <AssistantChat variant="page" conversationId={conversationId} onConversationChange={onConversationChange} />
          </section>
        </div>
      )}
    </div>
  );
}
