import { PermissionTier } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { HrContactService } from '../../hr-contact.service';
import { AiActor, TIER_LABEL } from '../actor/ai-actor';
import { describeRecords, ScopeRoute } from '../guard/role-scope';

/**
 * The server's own answers to the questions `classifyScope` routes here. They use
 * only the HR office contact, HR staff names and job roles, and the asker's own
 * supervisor's name and job role, so they cannot show a record nobody asked for.
 */

const FOLLOW_UPS: Record<PermissionTier, string[]> = {
  STANDARD: ['Which compliance requirements do I still need?', 'How many leave days do I have left?'],
  SUPERVISOR: ['Which team members have compliance items needing attention?', 'Which leave requests are waiting for my endorsement?'],
  FULL: [],
};

/** One bullet per HR job role, with the people who hold it. Demo accounts named after their role are not repeated. */
function hrStaffLines(staff: Array<{ name: string; jobRole: string | null }>): string[] {
  const byRole = new Map<string, string[]>();
  for (const p of staff) {
    const role = p.jobRole ?? 'HR staff';
    if (!byRole.has(role)) byRole.set(role, []);
    if (p.name !== role) byRole.get(role)!.push(p.name);
  }
  return [...byRole].map(([role, names]) => (names.length ? `- **${role}:** ${names.join(', ')}` : `- **${role}**`));
}

async function howToReachHr(connect = false): Promise<string> {
  const { office, staff } = await HrContactService.directory();
  const people = hrStaffLines(staff);
  const details = [
    office.phone ? `- **Phone:** ${office.phone}` : '',
    office.email ? `- **Email:** ${office.email}` : '',
    office.location ? `- **Office:** ${office.location}` : '',
  ].filter(Boolean);
  if (!details.length) {
    return [
      `${connect ? "I can't call or connect you to HR myself. " : ''}HR has not recorded an office phone or email in HRISense yet, so please go to the HR office or speak with the HR staff in person.`,
      people.join('\n'),
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  const lead = connect ? "I can't call or connect you to HR myself, but here is how to reach them:" : 'You can reach HR here:';
  return [lead, [...details, ...people].join('\n')].join('\n\n');
}

async function mySupervisor(actor: AiActor): Promise<string | null> {
  const me = await prisma.employee.findUnique({
    where: { id: actor.employeeId },
    select: { immediateSupervisor: { select: { firstName: true, lastName: true, jobRole: { select: { title: true } } } } },
  });
  const s = me?.immediateSupervisor;
  if (!s) return null;
  const name = `${s.firstName} ${s.lastName}`.trim();
  return s.jobRole?.title && s.jobRole.title !== name ? `**${name}**, the ${s.jobRole.title}` : `**${name}**`;
}

export async function answerScopedQuestion(route: ScopeRoute, question: string, actor: AiActor) {
  const followUps = FOLLOW_UPS[actor.tier];
  const role = TIER_LABEL[actor.tier];

  switch (route) {
    case 'HR_CONTACT': {
      const connect = /\b(connect|talk|speak|call|message)\b/i.test(question);
      return { status: 'ANSWERED' as const, content: await howToReachHr(connect), followUps };
    }
    case 'HR_DETAILS':
      return {
        status: 'ANSWERED' as const,
        content: `I can't show HR staff's profiles or personal details, because they are outside your access as ${role === 'Employee' ? 'an' : 'a'} ${role}.\n\n${await howToReachHr()}`,
        followUps,
      };
    case 'SUPERVISOR_NAME': {
      const who = await mySupervisor(actor);
      return {
        status: 'ANSWERED' as const,
        content: who ? `Your immediate supervisor is ${who}.` : 'HRISense has no immediate supervisor recorded for you yet. HR can help with this.',
        followUps,
      };
    }
    case 'SUPERVISOR_DETAILS': {
      const who = await mySupervisor(actor);
      return {
        status: 'NOT_AUTHORIZED' as const,
        content: who
          ? `I can't provide details about your supervisor, ${who}, because that is outside your access. HR can help if you need to reach them.`
          : "HRISense has no immediate supervisor recorded for you yet, and I can't provide another person's details. HR can help with this.",
        followUps: ['How do I contact HR?', ...followUps.slice(0, 1)],
      };
    }
    case 'OTHER_RECORDS': {
      const { topic, confidential } = describeRecords(question);
      return {
        status: 'NOT_AUTHORIZED' as const,
        content: `You can only see your own records, so I can't show other employees' ${topic}. ${confidential ? 'These are confidential and handled by HR.' : 'HR monitors that.'} If you need something about your own records, just ask.`,
        followUps: ['How do I contact HR?', ...followUps.slice(0, 1)],
      };
    }
  }
}
