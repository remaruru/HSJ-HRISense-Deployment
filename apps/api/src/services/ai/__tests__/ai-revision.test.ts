/**
 * Unit tests for the November 2026 AI revision (panel comments) — no database,
 * no network:
 *   • links that open the exact record (query rules per page and tier);
 *   • experience = before Hospicio + length of service; age; the input check;
 *   • work groups (caretakers, nursing …) map to real role codes;
 *   • a cut-off answer is salvaged instead of failing;
 *   • Hospicio work words are not mistaken for off-topic questions;
 *   • PDF and Excel exports of an answer;
 *   • job opening drafts and the policy text for each tier.
 * Database-backed checks are in ai-assistant.integration.test.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionTier } from '@prisma/client';
import { z } from 'zod';
import type { AiActor } from '../actor/ai-actor';
import { EMPLOYEE_TABS, validateLink } from '../links/app-links';
import { ageOn, experienceFigures, WORK_GROUPS } from '../tools/people.tools';
import { normalizePriorExperienceYears } from '../../employee.service';
import { parseHrContact } from '../../hr-contact.service';
import { salvageCutOffAnswer, trimJobOpeningRepeat } from '../assistant/assistant.orchestrator';
import { classifyInput } from '../guard/input-guard';
import { classifyScope, describeRecords } from '../guard/role-scope';
import { answerToBlocks, chartTable, exportToExcel, exportToPdf } from '../export/ai-export';
import { DraftStore, jobOpeningDraftSchema, messageActionSchema } from '../actions/job-opening-draft';
import { buildSystemPolicy, submitAnswerSchema, SUGGESTIONS } from '../policy/ai-policy';
import { toolsForTier } from '../tools/registry';
import { zodToJsonSchema } from '../tools/json-schema';
import ExcelJS from 'exceljs';

const SELF = '11111111-1111-4111-8111-111111111111';
const REPORT = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const ROLE = '44444444-4444-4444-8444-444444444444';

const actor = (tier: PermissionTier, directReportIds: string[] = []): AiActor => ({
  userId: 'user-1',
  employeeId: SELF,
  tier,
  roleCode: 'ROLE',
  roleTitle: 'Role',
  unitName: 'Unit',
  firstName: 'Test',
  displayName: 'Test Person',
  permissions: [],
  directReportIds,
});
const HR = actor(PermissionTier.FULL);
const SUPERVISOR = actor(PermissionTier.SUPERVISOR, [REPORT]);
const EMPLOYEE = actor(PermissionTier.STANDARD);

describe('links that open the exact record', () => {
  test('HR: a section of an employee record, the Compliance pop-ups, an opening, an application', () => {
    assert.equal(validateLink(HR, { path: `/employees/${OTHER}?tab=compliance`, label: 'x' })?.path, `/employees/${OTHER}?tab=compliance`);
    assert.equal(validateLink(HR, { path: `/compliance?employee=${OTHER}`, label: 'x' })?.path, `/compliance?employee=${OTHER}`);
    assert.equal(validateLink(HR, { path: `/compliance?requirement=${ROLE}`, label: 'x' })?.path, `/compliance?requirement=${ROLE}`);
    assert.equal(validateLink(HR, { path: `/recruitment/openings/${ROLE}`, label: 'x' })?.path, `/recruitment/openings/${ROLE}`);
    assert.equal(validateLink(HR, { path: `/recruitment/applicants/${ROLE}`, label: 'x' })?.path, `/recruitment/applicants/${ROLE}`);
    assert.equal(validateLink(HR, { path: `/employees?jobRoleId=${ROLE}`, label: 'x' })?.path, `/employees?jobRoleId=${ROLE}`);
  });

  test('every tier: a training activity and their own profile section', () => {
    for (const who of [HR, SUPERVISOR, EMPLOYEE]) {
      assert.equal(validateLink(who, { path: `/training?activity=${ROLE}`, label: 'x' })?.path, `/training?activity=${ROLE}`);
    }
    assert.equal(validateLink(EMPLOYEE, { path: '/profile?section=compliance', label: 'x' })?.path, '/profile?section=compliance');
  });

  test('bad values and unknown parameters are dropped; the page stays only where allowed', () => {
    assert.equal(validateLink(HR, { path: `/employees/${OTHER}?tab=passwords`, label: 'x' })?.path, `/employees/${OTHER}`);
    assert.equal(validateLink(HR, { path: '/compliance?employee=not-a-uuid&evil=1', label: 'x' })?.path, '/compliance');
    assert.equal(validateLink(HR, { path: '/employees?hireDateTo=2016-01-01&sortBy=salary', label: 'x' })?.path, '/employees?hireDateTo=2016-01-01');
    assert.equal(validateLink(HR, { path: `/training?activity=${ROLE}#frag`, label: 'x' })?.path, `/training?activity=${ROLE}`);
  });

  test('non-HR cannot be sent to HR pages, other people, or recruitment records', () => {
    assert.equal(validateLink(EMPLOYEE, { path: `/compliance?employee=${SELF}`, label: 'x' }), null);
    assert.equal(validateLink(SUPERVISOR, { path: `/recruitment/applicants/${ROLE}`, label: 'x' }), null);
    assert.equal(validateLink(EMPLOYEE, { path: `/employees/${OTHER}?tab=contact`, label: 'x' }), null);
    // A supervisor's report opens on My Team, where tabs are not passed on.
    assert.equal(validateLink(SUPERVISOR, { path: `/employees/${REPORT}?tab=compliance`, label: 'x' })?.path, `/my-team/${REPORT}`);
  });

  test('the tab list matches the employee record sections', () => {
    for (const t of ['compliance', 'training', 'evaluations', 'leave-balances', 'contact']) assert.ok((EMPLOYEE_TABS as readonly string[]).includes(t), t);
  });
});

describe('experience, length of service and age', () => {
  test('total experience = before Hospicio + service at Hospicio', () => {
    const f = experienceFigures(new Date('2019-06-03'), 4.5, '2026-11-05');
    assert.equal(f.lengthOfService?.years, 7);
    assert.equal(f.lengthOfService?.months, 5);
    assert.equal(f.priorExperienceYears, 4.5);
    assert.equal(f.serviceYears, 7.4);
    assert.equal(f.totalExperienceYears, Math.round((f.serviceYears! + 4.5) * 10) / 10);
  });

  test('not recorded stays null; service only counts as total', () => {
    const f = experienceFigures(new Date('2024-01-01'), null, '2026-11-05');
    assert.equal(f.priorExperienceYears, null);
    assert.equal(f.totalExperienceYears, f.serviceYears);
  });

  test('age in completed years on the given day', () => {
    assert.equal(ageOn(new Date('1992-10-28'), '2026-10-27'), 33);
    assert.equal(ageOn(new Date('1992-10-28'), '2026-10-28'), 34);
    assert.equal(ageOn(null, '2026-10-28'), null);
  });

  test('HR input: blank is "not recorded"; 0–60 kept to one decimal; anything else refused', () => {
    assert.equal(normalizePriorExperienceYears(''), null);
    assert.equal(normalizePriorExperienceYears(null), null);
    assert.equal(normalizePriorExperienceYears('4.55'), 4.6);
    assert.equal(normalizePriorExperienceYears(0), 0);
    for (const bad of ['-1', '61', 'ten', 'NaN']) assert.throws(() => normalizePriorExperienceYears(bad), /0 to 60/, bad);
  });
});

describe('work groups', () => {
  test('each group has a unique key and no role code is in two groups', () => {
    const keys = WORK_GROUPS.map((g) => g.key);
    assert.equal(new Set(keys).size, keys.length);
    const codes = WORK_GROUPS.flatMap((g) => [...g.roleCodes]);
    assert.equal(new Set(codes).size, codes.length);
  });

  test('caretakers are the residential homes and the dormitory — not coordinators or heads', () => {
    const care = WORK_GROUPS.find((g) => g.key === 'caretakers')!;
    assert.ok(care.roleCodes.includes('ST_MARY_STAFF' as never));
    assert.ok(care.roleCodes.includes('DORMITORY_STAFF' as never));
    assert.ok(!care.roleCodes.some((c) => /COORDINATOR|HEAD/.test(c)));
    assert.deepEqual([...WORK_GROUPS.find((g) => g.key === 'nursing')!.roleCodes], ['CLINIC_STAFF']);
  });
});

describe('robustness', () => {
  test('a cut-off answer keeps the text that arrived', () => {
    const raw = '{"answer":"Here are the ten longest-serving staff:\\n| Name | Years |\\n| A | 24 |\\n| B | 2';
    const out = salvageCutOffAnswer(raw) as any;
    assert.equal(out.status, 'ANSWERED');
    assert.match(out.answer, /^Here are the ten longest-serving staff:\n\| Name/);
    assert.match(out.answer, /cut short/);
    assert.deepEqual(salvageCutOffAnswer('{"status":"ANSW'), {});
  });

  test('Hospicio work words are in scope; recipes and poems still are not', () => {
    for (const q of [
      'I need an experienced kitchen person to train the new cook. Who should I look at?',
      'do we hav any nurss in the clinik',
      'sino-sino ang mga tagapag-alaga ng mga bata?',
      'who cooks for the kids?',
    ]) {
      assert.equal(classifyInput(q, PermissionTier.FULL).verdict, 'ALLOW', q);
    }
    assert.equal(classifyInput('Give me a recipe for adobo', PermissionTier.FULL).verdict, 'OFF_TOPIC');
    assert.equal(classifyInput('Write me a poem about the sea', PermissionTier.FULL).verdict, 'OFF_TOPIC');
  });

  test('a Prisma enum becomes a JSON Schema string enum for the model', () => {
    const schema = zodToJsonSchema(z.object({ t: z.nativeEnum(PermissionTier) })) as any;
    assert.deepEqual([...schema.properties.t.enum].sort(), ['FULL', 'STANDARD', 'SUPERVISOR']);
  });
});

describe('exports', () => {
  const chart = {
    type: 'bar' as const,
    title: 'Years of service by employee',
    xKey: 'employee',
    xLabel: 'Employee',
    unit: 'years',
    series: [{ key: 'serviceYears', label: 'Years of service' }],
    data: [
      { employee: 'St. Mary Staff', serviceYears: 23.1 },
      { employee: 'Rendu A Staff', serviceYears: 21.3 },
    ],
  };
  const answer = 'The **longest-serving** caretakers:\n\n| Name | Years |\n|---|---|\n| St. Mary Staff | 23.1 |\n| Rendu A Staff | 21.3 |\n\n- Both are in Pastoral Care\n1. First\n2. Second';

  test('the answer text becomes paragraphs, lists and tables (bold marks removed)', () => {
    const blocks = answerToBlocks(answer);
    assert.deepEqual(blocks.map((b) => b.kind), ['paragraph', 'table', 'bullets', 'numbered']);
    assert.equal((blocks[0] as any).text, 'The longest-serving caretakers:');
    assert.deepEqual((blocks[1] as any).header, ['Name', 'Years']);
    assert.equal((blocks[1] as any).rows.length, 2, 'the --- separator row is not data');
    assert.deepEqual(chartTable(chart).header, ['Employee', 'Years of service (years)']);
  });

  test('PDF and Excel are real files carrying the answer and the chart data', async () => {
    const spec = {
      label: 'AI Assistance',
      meta: ['Exported Nov 7, 2026, 4:00 PM'],
      sections: [{ blocks: answerToBlocks(answer), charts: [chart] }],
      links: [{ label: "Open St. Mary Staff's profile", path: `/employees/${OTHER}` }],
    };
    const pdf = await exportToPdf(spec);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > 2000);

    const xlsx = await exportToExcel(spec);
    assert.equal(xlsx.subarray(0, 2).toString(), 'PK', 'xlsx is a zip');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as any);
    const names = wb.worksheets.map((w) => w.name);
    // Excel limits sheet names to 31 characters.
    assert.deepEqual(names.slice(0, 3), ['Answer', 'Table 1', 'Chart 1 - Years of service by e']);
    const chartSheet = wb.worksheets[2];
    const values = chartSheet.getColumn(2).values.filter((v) => typeof v === 'number');
    assert.deepEqual(values, [23.1, 21.3], 'chart numbers stay numbers');
  });
});

describe('job opening drafts', () => {
  const draft = {
    title: 'Clinic Staff',
    jobRoleId: ROLE,
    jobRoleTitle: 'Clinic Staff',
    unitId: ROLE,
    unitName: 'Health Services',
    departmentId: null,
    departmentName: null,
    employmentType: 'REGULAR' as const,
    vacancies: 2,
    description: 'Provides first aid and nursing care to the children.',
    responsibilities: '- Give first aid\n- Keep health records',
    qualifications: '- Registered Nurse\n- At least 10 years of related experience',
    requiredDocuments: null,
    openingDate: '2026-11-05',
    closingDate: '2026-12-05',
  };

  test('only validated drafts are stored; ids live in one request', () => {
    const store = new DraftStore();
    assert.equal(store.add(draft), 'job1');
    assert.equal(store.get('job1')?.vacancies, 2);
    assert.equal(store.get('job2'), undefined);
    assert.throws(() => store.add({ ...draft, vacancies: 0 }));
    assert.throws(() => jobOpeningDraftSchema.parse({ ...draft, extra: 'x' }), 'unknown fields are refused');
    assert.ok(messageActionSchema.safeParse({ kind: 'JOB_OPENING', state: 'DRAFT', draft }).success);
    assert.ok(!messageActionSchema.safeParse({ kind: 'JOB_OPENING', state: 'LIVE', draft }).success);
  });

  test('the answer text does not repeat what the card shows', () => {
    const text = [
      "I've prepared a job opening for **Clinic Staff** with **2 vacancies**. Here are the details:",
      '',
      '- **Title**: Clinic Staff',
      '- **Vacancies**: 2',
      '- **Closing Date**: 2026-12-05',
      '',
      '### Description',
      'Provides nursing care to the children.',
      '',
      '### Responsibilities',
      '- Give first aid',
      '- Keep health records',
      '',
      '---',
      'Note: there is already **1 opening** for this role. Here is the draft ID: job1.',
      'Review the card and press Publish when ready.',
    ].join('\n');
    const out = trimJobOpeningRepeat(text, draft);
    assert.match(out, /prepared a job opening for \*\*Clinic Staff\*\* with \*\*2 vacancies\*\*\./);
    assert.match(out, /press Publish/);
    for (const gone of ['Title', 'Closing Date', 'first aid', 'nursing care', 'draft ID', '---', 'Here are the details']) assert.ok(!out.includes(gone), gone);
    // Nothing of the model's own left → a one-line summary.
    assert.match(trimJobOpeningRepeat('- **Title**: Clinic Staff\n- **Vacancies**: 2', draft), /Review it on the card below/);
  });

  test('submit_answer accepts a draft id, nothing else', () => {
    assert.ok(submitAnswerSchema.safeParse({ answer: 'x', status: 'ANSWERED', jobOpeningDraftId: 'job1' }).success);
    assert.ok(!submitAnswerSchema.safeParse({ answer: 'x', status: 'ANSWERED', jobOpeningDraftId: 'publish-now' }).success);
  });

  test('only HR is offered the recruitment tools; everyone gets the people lookups', () => {
    const names = (t: PermissionTier) => toolsForTier(t).map((x) => x.name);
    for (const t of [PermissionTier.SUPERVISOR, PermissionTier.STANDARD]) {
      assert.ok(!names(t).includes('prepare_job_opening') && !names(t).includes('compare_applicants'));
      assert.ok(names(t).includes('find_employees') && names(t).includes('get_org_catalog'));
    }
    assert.ok(names(PermissionTier.FULL).includes('prepare_job_opening'));
  });

  test('role-scope routing: the questions with one right answer', () => {
    const { STANDARD: E, SUPERVISOR: S, FULL: H } = PermissionTier;
    const cases: Array<[string, PermissionTier, string]> = [
      ['provide hr details', S, 'HR_DETAILS'],
      ['what about hr profile', S, 'HR_DETAILS'],
      ['provide the hr details', E, 'HR_DETAILS'],
      ["Show me the HR officer's profile and birthday", S, 'HR_DETAILS'],
      ['connect me to hr', E, 'HR_CONTACT'],
      ['How do I contact HR?', E, 'HR_CONTACT'],
      ['what is the hr number', S, 'HR_CONTACT'],
      ['who is hr', E, 'HR_CONTACT'],
      ["provide the supervisor's details", E, 'SUPERVISOR_DETAILS'],
      ["What is my supervisor's phone number?", E, 'SUPERVISOR_DETAILS'],
      ['who is my supervisor?', E, 'SUPERVISOR_NAME'],
      ["who's employee lack of documents", E, 'OTHER_RECORDS'],
      ['can you show psychological results of employees', E, 'OTHER_RECORDS'],
      ["What is my co-worker's phone number and address?", E, 'OTHER_RECORDS'],
      ["show everyone's birthdays", E, 'OTHER_RECORDS'],
    ];
    for (const [q, tier, route] of cases) assert.equal(classifyScope(q, tier), route, q);
  });

  test('role-scope routing leaves everything else to the model', () => {
    const { STANDARD: E, SUPERVISOR: S, FULL: H } = PermissionTier;
    const cases: Array<[string, PermissionTier]> = [
      ['Did HR approve my leave?', E],
      ['Can HR see my medical records?', E],
      ['What does HR do with my profile?', E],
      ['How do I update my contact number?', E],
      ['How do employees file leave?', E],
      ['Which compliance requirements do I still need?', E],
      ['What is my attendance this month?', E],
      ['Can my supervisor see my details?', E],
      ['How do I endorse a leave request?', S],
      // A supervisor's employees are their direct reports, which they may see.
      ["who's employee lack of documents", S],
      // Filipino and Taglish are answered by the model, in that language.
      ['ano po number ng HR?', E],
      ['paano ko makokontak ang hr', S],
      // HR may ask anything within its own access.
      ['provide hr details', H],
      ["provide the supervisor's details", H],
      ["who's employee lack of documents", H],
    ];
    for (const [q, tier] of cases) assert.equal(classifyScope(q, tier), null, q);
  });

  test('the answer names what was asked about', () => {
    assert.deepEqual(describeRecords('psychological results of employees'), { topic: 'psychological results', confidential: true });
    assert.deepEqual(describeRecords("who's employee lack of documents"), { topic: 'compliance documents', confidential: false });
  });

  test('everyone can look up how to reach HR', () => {
    for (const t of [PermissionTier.FULL, PermissionTier.SUPERVISOR, PermissionTier.STANDARD]) {
      assert.ok(toolsForTier(t).some((x) => x.name === 'get_hr_contacts'));
    }
  });

  test('the HR office contact accepts real values and rejects the rest', () => {
    const ok = parseHrContact({ phone: ' (02) 8123-4567 local 101 ', email: 'hr@example.org', location: 'Ground floor' });
    assert.equal(ok.phone, '(02) 8123-4567 local 101', 'trimmed');
    assert.deepEqual(parseHrContact({ phone: '', email: '', location: '' }), { phone: '', email: '', location: '' }, 'empty clears a field');
    assert.throws(() => parseHrContact({ phone: 'call me', email: '', location: '' }), /phone number/);
    assert.throws(() => parseHrContact({ phone: '', email: 'not-an-email', location: '' }), /valid email/);
    assert.throws(() => parseHrContact({ phone: '', email: '', location: '', role: 'FULL' }));
  });

  test('the policy keeps supervisors and employees inside the hierarchy', () => {
    for (const p of [buildSystemPolicy(SUPERVISOR, '2026-11-07', 'SATURDAY'), buildSystemPolicy(EMPLOYEE, '2026-11-07', 'SATURDAY')]) {
      assert.match(p, /First decide WHOSE information/);
      assert.match(p, /Call get_hr_contacts/);
      assert.match(p, /Never answer a question about someone else with the user's own records/);
      assert.match(p, /OUTSIDE their access/);
    }
    assert.match(buildSystemPolicy(SUPERVISOR, '2026-11-07', 'SATURDAY'), /their direct reports only/);
  });

  test('the policy tells everyone to answer only what was asked', () => {
    for (const a of [HR, SUPERVISOR, EMPLOYEE]) {
      const p = buildSystemPolicy(a, '2026-11-07', 'SATURDAY');
      assert.match(p, /Answer the question that was asked, then stop/);
      assert.match(p, /least privilege/);
    }
  });

  test('the policy tells HR about job openings and everyone about Hospicio words', () => {
    const hr = buildSystemPolicy(HR, '2026-11-05', 'THURSDAY');
    const emp = buildSystemPolicy(EMPLOYEE, '2026-11-05', 'THURSDAY');
    assert.match(hr, /prepare_job_opening/);
    assert.ok(!/prepare_job_opening/.test(emp), 'employees are not told about the HR tool');
    for (const p of [hr, emp]) {
      assert.match(p, /Clinic Staff/);
      assert.match(p, /BEFORE Hospicio \+ length of service AT Hospicio/);
      assert.match(p, /Never call a person "the best"/);
      assert.match(p, /READ-ONLY/);
    }
    assert.ok(SUGGESTIONS.FULL.some((s) => /job opening/i.test(s)));
  });
});
