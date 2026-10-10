import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Ban,
  CircleSlash,
  Info,
  Loader2,
  Lock,
  Plus,
  SearchX,
  Send,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import {
  AssistantService,
  type AssistantContext,
  type AssistantMessage,
  type AssistantStatus,
  type QuickViewOption,
} from '@/services/ai-assistant.service';
import { AssistantText } from './AssistantText';
import { AssistantChart } from './AssistantChart';
import { AiMascot, type AiMascotState } from './AiMascot';

/**
 * The AI assistant conversation, for every access level.
 *
 * What it shows comes entirely from the server: the user's access level, the
 * suggested questions, each answer and any chart or link in it. It sends only
 * the typed question (and the conversation id for a follow-up).
 */

const STATUS_META: Partial<Record<AssistantStatus, { label: string; icon: React.ElementType; tone: string }>> = {
  NOT_AUTHORIZED: { label: 'Outside your access', icon: Lock, tone: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border' },
  NO_DATA: { label: 'No data found', icon: SearchX, tone: 'bg-surface-2 text-muted-foreground border-border-soft' },
  OUT_OF_SCOPE: { label: 'Outside HRISense', icon: CircleSlash, tone: 'bg-surface-2 text-muted-foreground border-border-soft' },
  REFUSED: { label: "Can't help with that", icon: Ban, tone: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border' },
  AI_UNAVAILABLE: { label: 'AI not configured', icon: WifiOff, tone: 'bg-status-warning-surface text-status-warning-foreground border-status-warning-border' },
  ERROR: { label: "Couldn't answer", icon: AlertTriangle, tone: 'bg-status-danger-surface text-status-danger-foreground border-status-danger-border' },
};

export interface AssistantChatProps {
  /** `panel` = the floating chat; `page` = the AI Assistance page. */
  variant: 'panel' | 'page';
  conversationId?: string | null;
  /** Called when a new conversation is created or the user starts a new one. */
  onConversationChange?: (id: string | null) => void;
  /** The mascot's mood: thinking while an answer is prepared, done briefly after one arrives. */
  onMascotStateChange?: (state: AiMascotState) => void;
  className?: string;
}

/** How long the mascot celebrates after an answer arrives. */
const DONE_MS = 1800;

export function AssistantChat({ variant, conversationId: externalId, onConversationChange, onMascotStateChange, className }: AssistantChatProps) {
  const navigate = useNavigate();
  const compact = variant === 'panel';
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(externalId ?? null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [justAnswered, setJustAnswered] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mascotState: AiMascotState = sending ? 'thinking' : justAnswered ? 'done' : 'idle';

  useEffect(() => {
    onMascotStateChange?.(mascotState);
  }, [mascotState, onMascotStateChange]);
  useEffect(() => () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

  useEffect(() => {
    AssistantService.getContext()
      .then(setContext)
      .catch((err) => setContextError(getApiErrorMessage(err, 'AI Assistance could not be reached.')));
  }, []);

  // Follow the conversation chosen outside (the page's history list).
  useEffect(() => {
    if ((externalId ?? null) === conversationId) return;
    setConversationId(externalId ?? null);
    if (!externalId) {
      setMessages([]);
      return;
    }
    setLoadingConversation(true);
    AssistantService.getConversation(externalId)
      .then((c) => setMessages(c.messages))
      .catch(() => {
        setMessages([]);
        setConversationId(null);
        onConversationChange?.(null);
      })
      .finally(() => setLoadingConversation(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const maxLength = context?.maxMessageLength ?? 2000;

  /** Sends one turn — a typed question or a quick view — and appends the reply. */
  const submit = useCallback(
    async (
      label: string,
      request: () => Promise<{ conversationId: string; userMessage: AssistantMessage | null; message: AssistantMessage | null }>,
      restoreInput: string | null
    ) => {
      if (sending) return;
      const pendingId = `pending-${Date.now()}`;
      setMessages((m) => [
        ...m,
        { id: pendingId, role: 'user', content: label, charts: [], links: [], followUps: [], notices: [], createdAt: new Date().toISOString() },
      ]);
      setInput('');
      setSending(true);
      try {
        const reply = await request();
        setMessages((m) => [
          ...m.filter((x) => x.id !== pendingId),
          ...(reply.userMessage ? [reply.userMessage] : []),
          ...(reply.message ? [reply.message] : []),
        ]);
        if (reply.conversationId && reply.conversationId !== conversationId) {
          setConversationId(reply.conversationId);
          onConversationChange?.(reply.conversationId);
        }
        // Celebrate only a real answer, not a refusal or an error.
        if (reply.message && (!reply.message.status || reply.message.status === 'ANSWERED')) {
          setJustAnswered(true);
          if (doneTimer.current) clearTimeout(doneTimer.current);
          doneTimer.current = setTimeout(() => setJustAnswered(false), DONE_MS);
        }
      } catch (err) {
        setMessages((m) => [
          ...m.map((x) => (x.id === pendingId ? { ...x, failed: true } : x)),
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            status: 'ERROR',
            content: getApiErrorMessage(err, 'AI Assistance could not answer right now.'),
            charts: [],
            links: [],
            followUps: [],
            notices: [],
            createdAt: new Date().toISOString(),
          },
        ]);
        if (restoreInput) setInput(restoreInput);
      } finally {
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [conversationId, onConversationChange, sending]
  );

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question) return;
      return submit(question, () => AssistantService.send(question, conversationId), question);
    },
    [conversationId, submit]
  );

  const runQuickView = useCallback(
    (view: QuickViewOption) => {
      setQuickOpen(false);
      return submit(view.label, () => AssistantService.runQuickView(view.id, conversationId), null);
    },
    [conversationId, submit]
  );

  const startNew = () => {
    setConversationId(null);
    setMessages([]);
    onConversationChange?.(null);
    inputRef.current?.focus();
  };

  const unavailable = context && !context.availability.available;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Access strip — says whose access the answers use. */}
      <div className={cn('flex items-center gap-2 border-b border-border-soft bg-surface px-4', compact ? 'py-2' : 'py-2.5')}>
        <ShieldCheck className="h-4 w-4 shrink-0 text-status-accent-foreground" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {context ? (
            <>
              Answers use your access: <span className="font-semibold text-foreground">{context.accessLabel}</span>
              {context.accessLevel === 'SUPERVISOR' && <> · team of {context.directReports}</>} · read-only
            </>
          ) : contextError ? (
            contextError
          ) : (
            'Checking your access…'
          )}
        </p>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
        )}
      </div>

      {/* Conversation */}
      <div ref={listRef} className={cn('flex-1 min-h-0 overflow-y-auto bg-background', compact ? 'px-3 py-3 space-y-3' : 'px-4 sm:px-6 py-5 space-y-4')} aria-live="polite">
        {loadingConversation ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
          </p>
        ) : messages.length === 0 ? (
          <Welcome context={context} compact={compact} onPick={send} onQuickView={runQuickView} disabled={sending} />
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className={cn('max-w-[85%] rounded-2xl rounded-br-md bg-primary-600 px-3.5 py-2.5 text-sm text-white whitespace-pre-line', m.failed && 'opacity-60')}>
                  {m.content}
                </div>
              </div>
            ) : (
              <AssistantBubble key={m.id} message={m} compact={compact} onFollowUp={send} onNavigate={(path) => navigate({ to: path as any })} disabled={sending} />
            )
          )
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2.5 rounded-2xl rounded-bl-md border border-border-soft bg-surface px-3 py-2 text-sm text-muted-foreground">
              <AiMascot state="thinking" size={30} /> Looking this up in HRISense…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border-soft bg-surface px-3 pb-3 pt-2.5 space-y-2">
        {unavailable && (
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-status-warning-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            AI answers are not configured on this server yet. Quick analytics (the chart button) still work because they need no AI; typed questions get the matching Help Center guides.
          </p>
        )}
        {quickOpen && context?.quickViews?.length ? (
          <QuickViewMenu views={context.quickViews} onPick={runQuickView} onClose={() => setQuickOpen(false)} compact={compact} />
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          {context?.quickViews?.length ? (
            <button
              type="button"
              onClick={() => setQuickOpen((o) => !o)}
              disabled={sending}
              aria-expanded={quickOpen}
              aria-label="Quick analytics"
              title="Quick analytics — charts from HRISense data"
              className={cn(
                'h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40',
                quickOpen
                  ? 'border-status-accent-border bg-status-accent-surface text-status-accent-foreground'
                  : 'border-input bg-surface text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          ) : null}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={compact ? 1 : 2}
            maxLength={maxLength}
            disabled={sending}
            placeholder="Ask about HRISense or your records…"
            aria-label="Question for AI Assistance"
            className="flex-1 max-h-32 min-h-11 resize-none rounded-xl border border-input bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-500 disabled:bg-surface-2"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send question"
            className="h-11 w-11 shrink-0 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span>AI can be wrong — check important figures on the page it links to.</span>
          {input.length > maxLength - 200 && (
            <span className="tabular-nums">
              {input.length}/{maxLength}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Welcome({
  context,
  compact,
  onPick,
  onQuickView,
  disabled,
}: {
  context: AssistantContext | null;
  compact: boolean;
  onPick: (q: string) => void;
  onQuickView: (v: QuickViewOption) => void;
  disabled: boolean;
}) {
  return (
    <div className={cn('mx-auto space-y-4', compact ? '' : 'max-w-2xl pt-4')}>
      <div className="flex items-start gap-3">
        <AiMascot variant="full" size={compact ? 76 : 108} className="-ml-1" />
        <div className="space-y-1 min-w-0 pt-1">
          <p className="text-sm font-semibold text-foreground">
            Hi{context?.firstName ? `, ${context.firstName}` : ''}! I'm the HSJ HRISense assistant.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {context?.accessLevel === 'FULL'
              ? 'Ask about the workforce, attendance coverage, leave, compliance, training, evaluations, recruitment or how HRISense works. I only explain what the records show — every decision stays with HR.'
              : context?.accessLevel === 'SUPERVISOR'
                ? 'Ask about your own records, your direct reports (attendance, schedules, leave, compliance, training) or how HRISense works.'
                : 'Ask about your schedule, attendance, leave, training, evaluations, compliance, announcements or how to do something in HRISense.'}
          </p>
        </div>
      </div>
      {context?.quickViews?.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Quick analytics</p>
          <div className="flex flex-wrap gap-1.5">
            {context.quickViews.slice(0, compact ? 4 : 8).map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={disabled}
                onClick={() => onQuickView(v)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-status-accent-border hover:bg-status-accent-surface disabled:opacity-50"
              >
                <BarChart3 className="h-3.5 w-3.5 text-status-accent-foreground" aria-hidden="true" /> {v.label}
              </button>
            ))}
          </div>
          {context.quickViews.length > (compact ? 4 : 8) && (
            <p className="text-[11px] text-muted-foreground">More in the chart button next to the question box.</p>
          )}
        </div>
      ) : null}
      {context?.suggestions?.length ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Or ask in your own words</p>
          <div className="flex flex-wrap gap-1.5">
            {context.suggestions.slice(0, compact ? 4 : 8).map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onPick(s)}
                className="rounded-full border border-status-accent-border bg-status-accent-surface px-3 py-1.5 text-xs font-medium text-status-accent-foreground hover:brightness-95 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssistantBubble({
  message,
  compact,
  onFollowUp,
  onNavigate,
  disabled,
}: {
  message: AssistantMessage;
  compact: boolean;
  onFollowUp: (q: string) => void;
  onNavigate: (path: string) => void;
  disabled: boolean;
}) {
  const meta = message.status ? STATUS_META[message.status] : undefined;
  return (
    <div className="flex justify-start">
      <div className={cn('w-full rounded-2xl rounded-bl-md border border-border-soft bg-surface px-3.5 py-3 space-y-3', compact ? 'max-w-[94%]' : 'max-w-[88%]')}>
        {meta && (
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold', meta.tone)}>
            <meta.icon className="h-3 w-3" aria-hidden="true" /> {meta.label}
          </span>
        )}
        <AssistantText text={message.content} />
        {message.charts.map((c, i) => (
          <AssistantChart key={i} chart={c} compact={compact} />
        ))}
        {message.notices.length > 0 && (
          <ul className="space-y-0.5">
            {message.notices.map((n, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                {n}
              </li>
            ))}
          </ul>
        )}
        {message.links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.links.map((l) => (
              <button
                key={l.path}
                type="button"
                onClick={() => onNavigate(l.path)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary-500/40 hover:text-primary-700 dark:hover:text-primary-300"
              >
                {l.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {message.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-border-soft pt-2.5">
            {message.followUps.map((f) => (
              <button
                key={f}
                type="button"
                disabled={disabled}
                onClick={() => onFollowUp(f)}
                className="rounded-full border border-border-soft px-2.5 py-1 text-[11.5px] text-muted-foreground hover:border-status-accent-border hover:bg-status-accent-surface hover:text-status-accent-foreground disabled:opacity-50"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickViewMenu({
  views,
  onPick,
  onClose,
  compact,
}: {
  views: QuickViewOption[];
  onPick: (v: QuickViewOption) => void;
  onClose: () => void;
  compact: boolean;
}) {
  const groups = (['You', 'Your team', 'Organisation'] as const)
    .map((g) => ({ group: g, items: views.filter((v) => v.group === g) }))
    .filter((g) => g.items.length);
  return (
    <div
      role="menu"
      aria-label="Quick analytics"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className={cn('overflow-y-auto rounded-xl border border-border-soft bg-surface p-2 shadow-card-hover', compact ? 'max-h-56' : 'max-h-72')}
    >
      <p className="px-2 pb-1 text-[11px] text-muted-foreground">Charts calculated directly from HRISense records.</p>
      {groups.map((g) => (
        <div key={g.group} className="py-1">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{g.group}</p>
          {g.items.map((v) => (
            <button
              key={v.id}
              type="button"
              role="menuitem"
              onClick={() => onPick(v)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface-2"
            >
              <BarChart3 className="h-3.5 w-3.5 shrink-0 text-status-accent-foreground" aria-hidden="true" /> {v.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
