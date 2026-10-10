import { z } from 'zod';
import { getGuide, searchKnowledge } from '../knowledge/knowledge.service';
import { ALL_TIERS, AiTool, defineTool, ToolContext } from './tool-types';

/**
 * Knowledge tools: how HRISense works, from the Help Center guides and the
 * system reference. Both filter by the asker's tier before searching, so an
 * HR-only procedure is never retrievable by an employee.
 */

const EXCERPT = 1800;

const searchHelpTool = defineTool({
  name: 'search_help_center',
  description:
    'Searches HRISense\'s Help Center guides and system reference for how a feature works, what a status means, or the steps to do something. Returns the best matching guides/sections the asker is allowed to read, with their text. Use it for every "how do I…", "what does … mean", "why can\'t I…" question before answering.',
  tiers: ALL_TIERS,
  args: z.object({ query: z.string().min(2).max(200) }).strict(),
  async run(ctx: ToolContext, args: { query: string }) {
    const hits = searchKnowledge(args.query, ctx.actor.tier, 5);
    return {
      data: {
        results: hits.map((h) => ({
          kind: h.entry.kind,
          title: h.entry.title,
          module: h.entry.module,
          link: h.entry.link ?? null,
          slug: h.entry.slug ?? null,
          text: h.entry.text.length > EXCERPT ? `${h.entry.text.slice(0, EXCERPT)}…` : h.entry.text,
        })),
        note: hits.length ? undefined : 'Nothing in the Help Center or reference matched. Say you could not find it rather than guessing.',
      },
      rows: hits.length,
    };
  },
});

const guideTool = defineTool({
  name: 'get_help_guide',
  description: 'Full text of one Help Center guide by its slug (from search_help_center), if the asker may read it.',
  tiers: ALL_TIERS,
  args: z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80) }).strict(),
  async run(ctx: ToolContext, args: { slug: string }) {
    const guide = getGuide(args.slug, ctx.actor.tier);
    if (!guide) {
      return { data: { found: false, note: 'No guide with that slug is available to this user.' }, rows: 0 };
    }
    return { data: { found: true, title: guide.title, module: guide.module, link: guide.link, text: guide.text.slice(0, 6000) }, rows: 1 };
  },
});

export const KNOWLEDGE_TOOLS: AiTool[] = [searchHelpTool, guideTool];
