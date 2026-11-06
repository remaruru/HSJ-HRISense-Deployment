/**
 * Asks every question in the AI Assistance question bank through the REAL
 * pipeline (the configured model, the local database) as an HR officer, a
 * supervisor and an employee, and checks each answer: which lookups it used,
 * what it must and must not say, its status, and whether a job opening card was
 * attached. Writes a JSON + Markdown report and exits non-zero on failures.
 *
 *   npm run ai:question-bank --workspace=apps/api [-- --only=vocab,exp --concurrency=4 --out=<dir>]
 *
 * It needs an AI key (OPENAI_API_KEY in apps/api/.env.local) and the demo data
 * (seed-demo.js, incl. seed-experience.js). It never runs in the normal test
 * suite. Conversations it creates are archived again at the end.
 */
import '../config/env';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { AssistantOrchestrator } from '../services/ai/assistant/assistant.orchestrator';
import { resolveAiActor } from '../services/ai/actor/ai-actor';
import { ConversationService } from '../services/ai/conversation/conversation.service';
import { BankItem, BankRole, QUESTION_BANK } from '../services/ai/evaluation/question-bank';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')) as Array<[string, string]>);
const ONLY = args.only ? args.only.split(',') : null;
const CONCURRENCY = Math.max(1, Math.min(8, Number(args.concurrency) || 4));
const OUT = args.out || path.join(process.cwd(), 'ai-question-bank-report');

/** Who asks, by employee number (demo data). */
const ASKERS: Record<BankRole, string> = {
  HR: process.env.AI_BANK_HR ?? 'TEAM-HRD-001',
  SUPERVISOR: process.env.AI_BANK_SUPERVISOR ?? 'DEV-PCH-001',
  EMPLOYEE: process.env.AI_BANK_EMPLOYEE ?? 'DEV-GSS-022',
};

interface Result {
  id: string;
  role: BankRole;
  q: string;
  then?: string;
  status: string;
  answer: string;
  tools: string[];
  links: string[];
  jobOpening: boolean;
  ms: number;
  failures: string[];
}

async function userIdOf(employeeNumber: string): Promise<string> {
  const emp = await prisma.employee.findFirst({ where: { employeeNumber }, select: { user: { select: { id: true } } } });
  if (!emp?.user) throw new Error(`No user account for ${employeeNumber}.`);
  return emp.user.id;
}

async function toolsUsed(conversationId: string, since: Date): Promise<string[]> {
  const logs = await prisma.aIRequestLog.findMany({ where: { conversationId, createdAt: { gte: since } }, select: { toolCalls: true } });
  const names = new Set<string>();
  for (const l of logs) for (const t of ((l.toolCalls as any[]) ?? [])) if (t?.name) names.add(t.name);
  return [...names];
}

function check(item: BankItem, r: Omit<Result, 'failures'>): string[] {
  const f: string[] = [];
  const e = item.expect;
  const text = r.answer.toLowerCase();
  const allowed = e.status ?? ['ANSWERED'];
  if (!allowed.includes(r.status)) f.push(`status ${r.status} (expected ${allowed.join('/')})`);
  if (e.tools && !e.tools.some((t) => r.tools.includes(t))) f.push(`did not use ${e.tools.join(' or ')} (used: ${r.tools.join(', ') || 'none'})`);
  for (const m of e.mentions ?? []) if (!text.includes(m.toLowerCase())) f.push(`does not mention "${m}"`);
  if (e.mentionsAny && !e.mentionsAny.some((m) => text.includes(m.toLowerCase()))) f.push(`mentions none of ${e.mentionsAny.join(' / ')}`);
  for (const a of e.avoid ?? []) if (text.includes(a.toLowerCase())) f.push(`says "${a}"`);
  if (e.jobOpening && !r.jobOpening) f.push('no job opening card attached');
  return f;
}

async function ask(item: BankItem, userIds: Record<BankRole, string>): Promise<Result> {
  const started = Date.now();
  const since = new Date(started - 1000);
  const first = await AssistantOrchestrator.handle({ userId: userIds[item.role], message: item.q });
  let reply = first;
  if (item.then) reply = await AssistantOrchestrator.handle({ userId: userIds[item.role], message: item.then, conversationId: first.conversationId });
  const tools = await toolsUsed(first.conversationId, since);
  const base = {
    id: item.id,
    role: item.role,
    q: item.q,
    then: item.then,
    status: reply.message.status ?? 'ANSWERED',
    answer: reply.message.content,
    tools,
    links: (reply.message.links ?? []).map((l) => `${l.label} → ${l.path}`),
    jobOpening: Boolean(reply.message.action || first.message.action),
    ms: Date.now() - started,
  };
  // Leave the user's conversation list as it was.
  const actor = await resolveAiActor(userIds[item.role]);
  await ConversationService.archive(actor, first.conversationId).catch(() => undefined);
  return { ...base, failures: check(item, base) };
}

async function main() {
  const items = QUESTION_BANK.filter((i) => !ONLY || ONLY.some((p) => i.id.startsWith(p)));
  const userIds = {
    HR: await userIdOf(ASKERS.HR),
    SUPERVISOR: await userIdOf(ASKERS.SUPERVISOR),
    EMPLOYEE: await userIdOf(ASKERS.EMPLOYEE),
  } as Record<BankRole, string>;
  console.log(`Asking ${items.length} questions (${CONCURRENCY} at a time)…`);

  const results: Result[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const item = items[next++];
        try {
          const r = await ask(item, userIds);
          results.push(r);
          console.log(`${r.failures.length ? 'FAIL' : 'ok  '} ${item.id.padEnd(28)} ${r.status.padEnd(14)} ${(r.ms / 1000).toFixed(1)}s ${r.failures.join('; ')}`);
        } catch (err: any) {
          results.push({ id: item.id, role: item.role, q: item.q, status: 'CRASH', answer: String(err?.message ?? err), tools: [], links: [], jobOpening: false, ms: 0, failures: ['crashed'] });
          console.log(`CRASH ${item.id}: ${err?.message ?? err}`);
        }
      }
    })
  );

  results.sort((a, b) => items.findIndex((i) => i.id === a.id) - items.findIndex((i) => i.id === b.id));
  const failed = results.filter((r) => r.failures.length);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const md = [
    `# AI Assistance question bank — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    `${results.length - failed.length} of ${results.length} passed.`,
    '',
    ...results.map((r) =>
      [
        `## ${r.failures.length ? '❌' : '✅'} ${r.id} (${r.role})`,
        `**Q:** ${r.q}${r.then ? `  \n**Then:** ${r.then}` : ''}`,
        `**Status:** ${r.status} · **Tools:** ${r.tools.join(', ') || 'none'} · ${(r.ms / 1000).toFixed(1)}s${r.jobOpening ? ' · job opening card' : ''}`,
        r.failures.length ? `**Problems:** ${r.failures.join('; ')}` : '',
        '',
        r.answer,
        r.links.length ? `\nLinks: ${r.links.join(' · ')}` : '',
        '',
      ].join('\n')
    ),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  console.log(`\n${results.length - failed.length}/${results.length} passed. Report: ${path.join(OUT, 'report.md')}`);
  await prisma.$disconnect();
  process.exitCode = failed.length ? 1 : 0;
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exitCode = 1;
});
