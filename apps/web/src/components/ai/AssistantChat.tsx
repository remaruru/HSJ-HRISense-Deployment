import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Ban,
  Briefcase,
  CheckCircle2,
  CircleSlash,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Lock,
  Pencil,
  Plus,
  SearchX,
  Send,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadProtectedFile } from '@/lib/downloadProtectedFile';
import { AI_JOB_DRAFT_KEY } from '@/lib/aiJobDraft';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/utils/error-handler.util';
import {
  AssistantService,
  type AssistantContext,
  type AssistantMessage,
  type AssistantStatus,
  type JobOpeningAction,
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
              <AssistantBubble
                key={m.id}
                message={m}
                compact={compact}
                conversationId={conversationId}
                canPrepareJobs={context?.accessLevel === 'FULL'}
                onFollowUp={send}
                onNavigate={(path) => {
                  // A link may carry a query the server allowed (?tab=…, ?activity=…).
                  const [pathname, query] = path.split('?');
                  navigate({ to: pathname as any, search: query ? (Object.fromEntries(new URLSearchParams(query)) as any) : undefined });
                }}
                onActionChange={(action) => setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, action } : x)))}
                disabled={sending}
              />
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
  conversationId,
  canPrepareJobs,
  onFollowUp,
  onNavigate,
  onActionChange,
  disabled,
}: {
  message: AssistantMessage;
  compact: boolean;
  conversationId: string | null;
  canPrepareJobs: boolean;
  onFollowUp: (q: string) => void;
  onNavigate: (path: string) => void;
  onActionChange: (action: JobOpeningAction) => void;
  disabled: boolean;
}) {
  const meta = message.status ? STATUS_META[message.status] : undefined;
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  // Every real answer can be exported — not client-only error bubbles.
  const exportable = Boolean(conversationId) && !message.id.startsWith('error-') && (!message.status || message.status === 'ANSWERED' || message.status === 'NO_DATA');
  const exportAs = async (format: 'pdf' | 'excel') => {
    if (!conversationId || exporting) return;
    setExporting(format);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadProtectedFile(
        AssistantService.exportMessagePath(conversationId, message.id, format),
        `HRISense_AI_answer_${stamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The answer could not be exported. Please try again.'));
    } finally {
      setExporting(null);
    }
  };
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
        {message.action && (
          <JobOpeningCard
            action={message.action}
            compact={compact}
            canPublish={canPrepareJobs && Boolean(conversationId)}
            onPublish={async () => {
              if (!conversationId) return;
              const action = await AssistantService.publishJobOpening(conversationId, message.id);
              onActionChange(action);
              toast.success(action.state === 'PUBLISHED' ? `Published as ${action.published?.referenceNumber}.` : 'Saved as a draft in Job Openings.');
            }}
            onNavigate={onNavigate}
          />
        )}
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
        {exportable && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Export:</span>
            <button
              type="button"
              onClick={() => exportAs('pdf')}
              disabled={Boolean(exporting)}
              className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:border-status-accent-border hover:text-status-accent-foreground disabled:opacity-50"
            >
              {exporting === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" aria-hidden="true" />} PDF
            </button>
            <button
              type="button"
              onClick={() => exportAs('excel')}
              disabled={Boolean(exporting)}
              className="inline-flex items-center gap-1 rounded-md border border-border-soft px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:border-status-accent-border hover:text-status-accent-foreground disabled:opacity-50"
            >
              {exporting === 'excel' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" aria-hidden="true" />} Excel
            </button>
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

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  REGULAR: 'Regular',
  PROBATIONARY: 'Probationary',
  CONTRACTUAL: 'Contractual',
  CASUAL: 'Casual',
  PART_TIME: 'Part-time',
};

/** "- a\n- b" → ["a", "b"]; plain text stays one line. */
const toLines = (text: string | null) =>
  (text ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);


/**
 * A job opening the assistant prepared — the full breakdown, and the one button
 * that creates it. The server publishes the draft it stored with this answer;
 * nothing typed here is sent.
 */
function JobOpeningCard({
  action,
  compact,
  canPublish,
  onPublish,
  onNavigate,
}: {
  action: JobOpeningAction;
  compact: boolean;
  canPublish: boolean;
  onPublish: () => Promise<void>;
  onNavigate: (path: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const d = action.draft;
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  const section = (title: string, text: string | null) =>
    text ? (
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
        <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-foreground">
          {toLines(text).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    ) : null;
  const publish = async () => {
    setBusy(true);
    try {
      await onPublish();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'The job opening could not be published.'));
    } finally {
      setBusy(false);
    }
  };
  const editInForm = () => {
    try {
      sessionStorage.setItem(AI_JOB_DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* storage unavailable: the form simply starts empty */
    }
    onNavigate('/recruitment/openings/new');
  };
  return (
    <div className="rounded-xl border border-status-accent-border bg-status-accent-surface/40 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 rounded-lg bg-status-accent-surface p-1.5 text-status-accent-foreground">
            <Briefcase className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{d.title}</p>
            <p className="text-xs text-muted-foreground">
              {d.jobRoleTitle} · {d.unitName}
              {d.departmentName ? ` · ${d.departmentName}` : ''}
            </p>
          </div>
        </div>
        {action.state === 'PUBLISHED' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-surface px-2 py-0.5 text-[11px] font-semibold text-status-success-foreground">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Published · {action.published?.referenceNumber}
          </span>
        ) : action.state === 'SAVED' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-status-warning-border bg-status-warning-surface px-2 py-0.5 text-[11px] font-semibold text-status-warning-foreground">
            Saved as draft · {action.published?.referenceNumber}
          </span>
        ) : (
          <span className="rounded-full border border-border-soft bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Not published yet</span>
        )}
      </div>
      <dl className={cn('grid gap-2 text-[12.5px]', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        {[
          ['Employment', EMPLOYMENT_TYPE_LABEL[d.employmentType] ?? d.employmentType],
          ['Vacancies', String(d.vacancies)],
          ['Opens', fmt(d.openingDate)],
          ['Closes', fmt(d.closingDate)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border-soft bg-surface px-2.5 py-1.5">
            <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="font-semibold text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Description</p>
        <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-line">{d.description}</p>
      </div>
      {section('Responsibilities', d.responsibilities)}
      {section('Qualifications', d.qualifications)}
      {section('Required documents', d.requiredDocuments)}
      <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-2.5">
        {action.state === 'DRAFT' ? (
          canPublish ? (
            <>
              <button
                type="button"
                onClick={publish}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />} Publish job opening
              </button>
              <button
                type="button"
                onClick={editInForm}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2 disabled:opacity-60"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit in the form first
              </button>
              <span className="text-[11px] text-muted-foreground">Nothing is posted until you press Publish.</span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">Only HR can publish job openings.</span>
          )
        ) : (
          action.published && (
            <>
              <button
                type="button"
                onClick={() => onNavigate(`/recruitment/openings/${action.published!.openingId}`)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-2"
              >
                Open the job opening <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {action.state === 'PUBLISHED' && (
                <a
                  href={`/careers/${action.published.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-2"
                >
                  View on the Careers page <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              {action.state === 'SAVED' && <span className="text-[11px] text-muted-foreground">An HR Officer publishes it from Job Openings.</span>}
            </>
          )
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
