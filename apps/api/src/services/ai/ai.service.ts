import { AIInsightType, AIRequestStatus, PermissionTier } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middleware/errorHandler';
import { AiAvailability, getAiAvailability, getAiConfig } from './config/ai-config';
import { getAiProvider } from './provider';
import { zodToJsonSchema } from './tools/json-schema';
import { WorkforceFactsService, WorkforceFacts } from './workforce-facts.service';
import { FACT_SOURCE_KEYS, factSourceGuide, inferSources, resolveSources, SourceRef } from './analysis/fact-sources';

export type { AiAvailability } from './config/ai-config';

/**
 * AI Assistance.
 *
 * ── Guarantees ───────────────────────────────────────────────────────────────
 * • ADVISORY ONLY. This service performs no mutations to employee, leave,
 *   compliance, evaluation, schedule or recruitment data. It cannot approve or
 *   reject anything. Its entire output is text for a human to read.
 * • Every observation is grounded in the deterministic fact sheet built by
 *   `WorkforceFactsService`. The facts are computed by SQL, not by the model.
 * • No confidential data is sent to the provider — see the WorkforceFacts docs.
 * • No attrition prediction. HRISense has no validated model or data basis for
 *   one, so it does not claim one.
 * • When no API key is configured the endpoint reports that AI Assistance is
 *   unavailable. It never falls back to invented content.
 */

const SYSTEM_PROMPT = `You are the AI Assistance feature inside HSJ HRISense, a workforce administration system for Hospicio de San Jose, a charitable care institution in the Philippines.

You will be given a JSON fact sheet of AGGREGATE workforce statistics. Your job is to help HR read it.

STRICT RULES:
1. Use ONLY the numbers in the fact sheet. Never invent a figure, a percentage, a confidence score, a department name, or a person.
2. You are ADVISORY. Never state or imply that you have taken, or will take, any action. Never recommend a decision about a specific individual.
3. Never predict attrition, resignation risk, or individual performance. You do not have the data for it.
4. Never discuss salary, payroll, payslips, or compensation — these are outside this system's scope.
5. "daysWithNoImportedRecord" means attendance data has not been imported for those employee-days. It does NOT mean anyone was absent. Never treat missing records as absences.
6. If a section has no data (nulls or zeroes), say plainly that there is no data yet rather than speculating.
7. Separate what the DATA SHOWS from what you are SUGGESTING HR LOOK AT.
8. Write plainly for non-technical HR staff. No jargon, no hype.

For every observation and area for review, set "sources" to the key(s) of the fact-sheet sections it is based on (most important first, at most 3), chosen ONLY from this list:
${factSourceGuide()}
Also keep "basis" as a short plain description of the fields used.

Deliver your analysis by calling the submit_analysis tool exactly once.`;

const observationSchema = z.object({
  title: z.string().describe('short title'),
  detail: z.string().describe('what the data shows (or what HR may want to look into), quoting the actual numbers'),
  basis: z.string().describe('which fact sheet fields this came from'),
  sources: z
    .array(z.enum(FACT_SOURCE_KEYS))
    .max(3)
    .describe('Keys of the fact-sheet sections this is based on, most important first.'),
});

/** The structured-output contract for the analysis, as a forced tool call. */
const ANALYSIS_TOOL = {
  name: 'submit_analysis',
  description: 'Deliver the workforce analysis.',
  parameters: zodToJsonSchema(
    z.object({
      summary: z.string().describe('2-4 plain sentences describing the current workforce picture.'),
      observations: z.array(observationSchema).describe('What the DATA SHOWS.'),
      areasForReview: z.array(observationSchema).describe('What HR may want to look into, phrased as suggestions.'),
      dataGaps: z.array(z.string()).describe('Plain statements about what the system cannot tell you yet.'),
    })
  ),
};

export interface AiAnalysisItem {
  title: string;
  detail: string;
  basis: string;
  /**
   * Where the figures came from: a link to the HRISense page and a chart built
   * on the server from the same fact sheet (never from the model's numbers).
   */
  sources: SourceRef[];
}

export interface AiAnalysis {
  summary: string;
  observations: AiAnalysisItem[];
  areasForReview: AiAnalysisItem[];
  dataGaps: string[];
}

export class AiService {
  /**
   * Whether AI Assistance is CONFIGURED in this environment.
   *
   * This deliberately makes no network call, so it never claims the provider is
   * reachable — only that a usable-looking key is present. The deterministic
   * workforce fact sheet does not depend on this and stays available either way.
   */
  static availability(): AiAvailability {
    return getAiAvailability();
  }

  /** The deterministic fact sheet — always available, with or without AI. */
  static async getFacts(periodDays = 30): Promise<WorkforceFacts> {
    return WorkforceFactsService.build(periodDays);
  }

  /**
   * Calls the configured provider and returns a grounded analysis.
   * Persists an `AIRequestLog` row for every attempt (never the API key).
   */
  static async analyse(
    facts: WorkforceFacts,
    requestedById: string,
    question?: string
  ): Promise<AiAnalysis> {
    const availability = AiService.availability();
    const provider = getAiProvider();
    if (!availability.available || !provider) {
      throw new AppError(availability.reason ?? 'AI Assistance is not configured on this server.', 503);
    }
    const config = getAiConfig();

    const userPrompt = question
      ? `HR question: ${question}

Workforce fact sheet:
${JSON.stringify(facts, null, 2)}`
      : `Workforce fact sheet:
${JSON.stringify(facts, null, 2)}`;

    const started = Date.now();
    const log = await prisma.aIRequestLog.create({
      data: {
        requestedById,
        // The prompt records the QUESTION and the period only — the full fact
        // sheet is regenerable and is not duplicated into the log.
        prompt: question ? `ANALYSIS + question: ${question}` : `ANALYSIS (period ${facts.periodDays}d)`,
        model: provider.model,
        provider: provider.name,
        channel: 'ANALYSIS',
        actorTier: PermissionTier.FULL,
        status: AIRequestStatus.PROCESSING,
      },
    });

    try {
      const completion = await provider.complete({
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [ANALYSIS_TOOL],
        toolChoice: { name: ANALYSIS_TOOL.name },
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
      });

      const call = completion.toolCalls.find((c) => c.name === ANALYSIS_TOOL.name);
      const raw = call?.arguments ?? completion.text ?? '';
      const parsed = AiService.parseAnalysis(raw, facts);
      const input = completion.usage.inputTokens;
      const output = completion.usage.outputTokens;

      await prisma.aIRequestLog.update({
        where: { id: log.id },
        data: {
          status: AIRequestStatus.COMPLETED,
          outcome: 'ANSWERED',
          response: raw.slice(0, 8000),
          promptTokens: input,
          completionTokens: output,
          tokensUsed: input !== null || output !== null ? (input ?? 0) + (output ?? 0) : null,
          durationMs: Date.now() - started,
        },
      });

      return parsed;
    } catch (err: any) {
      await prisma.aIRequestLog.update({
        where: { id: log.id },
        data: {
          status: AIRequestStatus.FAILED,
          outcome: 'ERROR',
          // Message only — never headers, keys or request bodies.
          error: String(err?.message ?? 'Unknown AI provider error').slice(0, 1000),
          durationMs: Date.now() - started,
        },
      });

      console.error('[AiService] Provider call failed:', err?.message);
      if (err?.kind === 'QUOTA' || err?.kind === 'AUTH') {
        // A configuration problem the administrator must fix, not a server fault:
        // a 4xx so the page shows the actual reason.
        throw new AppError(
          err.kind === 'QUOTA'
            ? 'The AI provider account has run out of credit, so a summary cannot be generated. The figures below are still accurate. Please tell your HRISense administrator.'
            : 'The AI provider rejected the configured key, so a summary cannot be generated. The figures below are still accurate. Please tell your HRISense administrator.',
          424
        );
      }
      throw new AppError(
        'AI Assistance could not generate a summary right now. The underlying data is still shown below.',
        502
      );
    }
  }

  /** Defensive parse — a malformed model response must not crash the endpoint. */
  static parseAnalysis(raw: string, facts: WorkforceFacts): AiAnalysis {
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('AI provider returned a response that could not be read.');
    }

    const known = new Set<string>(FACT_SOURCE_KEYS);
    const cache = new Map<string, SourceRef>();
    const asList = (value: any): AiAnalysisItem[] =>
      Array.isArray(value)
        ? value
            .filter((v) => v && typeof v === 'object')
            .map((v) => {
              const basis = String(v.basis ?? '').slice(0, 400);
              // Only keys from the closed list count; otherwise infer from the basis text.
              const cited = Array.isArray(v.sources) ? v.sources.map(String).filter((k: string) => known.has(k)) : [];
              return {
                title: String(v.title ?? '').slice(0, 200),
                detail: String(v.detail ?? '').slice(0, 2000),
                basis,
                sources: resolveSources(cited.length ? cited : inferSources(basis), facts, cache),
              };
            })
            .filter((v) => v.title && v.detail)
        : [];

    return {
      summary: String(data.summary ?? '').slice(0, 4000),
      observations: asList(data.observations),
      areasForReview: asList(data.areasForReview),
      dataGaps: Array.isArray(data.dataGaps)
        ? data.dataGaps.map((g: any) => String(g).slice(0, 500)).filter(Boolean)
        : [],
    };
  }

  /**
   * Persists the analysis as `AIInsight` rows so the dashboard can show genuinely
   * generated insights. Previous unexpired insights are cleared first so the
   * dashboard never mixes stale and fresh output.
   */
  static async persistInsights(analysis: AiAnalysis): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const rows = [
      ...analysis.observations.map((o) => ({
        type: AIInsightType.SUMMARY,
        title: o.title,
        content: `${o.detail}\n\nBased on: ${o.basis}`,
        isActionable: false,
      })),
      ...analysis.areasForReview.map((o) => ({
        type: AIInsightType.RECOMMENDATION,
        title: o.title,
        content: `${o.detail}\n\nBased on: ${o.basis}`,
        isActionable: true,
      })),
    ];

    if (rows.length === 0) return;

    try {
      await prisma.$transaction([
        prisma.aIInsight.deleteMany({
          where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        }),
        prisma.aIInsight.createMany({
          data: rows.map((r) => ({
            type: r.type,
            title: r.title,
            content: r.content,
            // HRISense does not fabricate confidence scores. These insights are
            // grounded restatements of real figures, so this is recorded as 1.
            confidenceScore: 1,
            module: 'workforce',
            isActionable: r.isActionable,
            expiresAt,
          })),
        }),
      ]);
    } catch (err) {
      console.error('[AiService] Failed to persist insights:', err);
    }
  }
}
