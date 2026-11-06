/**
 * Realistic service history for the demo employees, so AI Assistance and the
 * Employee Directory can answer "who has at least 10 years of experience?",
 * "the 10 longest-serving caretakers" or "who is the oldest?" with real
 * differences instead of 47 identical rows.
 *
 * The demo data gave every DEV-… employee the same hire date (2024-01-01) and
 * birth date (1990-01-15). This step gives each one, deterministically:
 *   • a hire date between 1998 and 2025 (heads and the residential care staff
 *     tend to have served longer, newer roles less);
 *   • a birth date that makes them 21–38 years old when hired;
 *   • years of work experience before Hospicio (0–12, in half years).
 * The Clinic Staff demo employee is set on purpose to 7 years at Hospicio plus
 * 4.5 years before it — over 10 years of experience in all, but under 10 years
 * of service — so both readings of "10 years of experience" can be shown.
 *
 * Who: ONLY employees numbered DEV-…. The team's own TEAM-… accounts (real
 * names) are never touched.
 *
 * Safe for a hosted database:
 *   - Runs ONCE per database (a `system_settings` marker).
 *   - Changes a value only while it is still the original demo value (hire
 *     date 2024-01-01, birth date 1990-01-15, no prior experience), so anything
 *     HR has edited is left alone.
 *   - seed-demo.js calls it inside try/catch: a failure never blocks a deploy.
 * Leave credits follow the hire date: HRISense re-applies them the next time
 * an employee's leave is read or HR runs "Sync entitlements".
 */
'use strict';

const crypto = require('crypto');

const MARKER_KEY = 'demo.experience_seeded_v1';
const ORIGINAL_HIRE = '2024-01-01';
const ORIGINAL_BIRTH = '1990-01-15';

/** A seeded random number generator (mulberry32) for a key. */
function rng(key) {
  let a = crypto.createHash('sha1').update(`hrisense-demo-experience:${key}`).digest().readUInt32LE(0);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hire-year ranges by role: [earliest, latest]. Anything else: 2005–2025. */
const HIRE_RANGE = {
  SISTER: [1998, 2004],
  ASST_ADMIN: [2001, 2008],
  HEAD_PCH: [2000, 2007],
  HEAD_SSD: [2003, 2010],
  KITCHEN_SUPERVISOR: [2004, 2012],
  JANITORIAL_SUPERVISOR: [2005, 2013],
  MAINTENANCE_SUPERVISOR: [2003, 2011],
  HR_OFFICER: [2008, 2015],
  // Residential care (Pastoral Care / Homelife) — a spread from long-serving to new.
  RENDU_A_STAFF: [2001, 2006],
  RENDU_B_STAFF: [2009, 2014],
  RENDU_C_STAFF: [2018, 2022],
  ST_JOSEPH_STAFF: [2004, 2010],
  ST_MARY_STAFF: [1999, 2003],
  ST_VINCENT_STAFF: [2012, 2017],
  STA_LUISA_STAFF: [2006, 2011],
  SIGLIV_BOYS_STAFF: [2015, 2020],
  TAHAN_CENTER_STAFF: [2020, 2024],
  SANCTUARY_CENTER_STAFF: [2010, 2016],
  DORMITORY_STAFF: [2007, 2013],
};

/** Fixed values for the employees the AI examples are built on. */
const FIXED = {
  CLINIC_STAFF: { hire: '2019-06-03', prior: 4.5, ageAtHire: 27 },
};

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const day = (s) => new Date(`${s}T00:00:00.000Z`);

/** The planned values for one demo employee (pure, so it can be tested). */
function planFor(employeeNumber, roleCode) {
  const r = rng(employeeNumber);
  const fixed = FIXED[roleCode];
  let hire;
  if (fixed) {
    hire = day(fixed.hire);
  } else {
    const [lo, hi] = HIRE_RANGE[roleCode] ?? [2005, 2025];
    const year = lo + Math.floor(r() * (hi - lo + 1));
    // A weekday start, any month.
    const d = new Date(Date.UTC(year, Math.floor(r() * 12), 1 + Math.floor(r() * 27)));
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    hire = d;
  }
  const ageAtHire = fixed?.ageAtHire ?? 21 + Math.floor(r() * 18);
  const birth = new Date(Date.UTC(hire.getUTCFullYear() - ageAtHire, Math.floor(r() * 12), 1 + Math.floor(r() * 28)));
  // Experience before Hospicio cannot be longer than the years since age 20.
  const maxPrior = Math.max(0, Math.min(12, ageAtHire - 20));
  const prior = fixed ? fixed.prior : Math.round(r() * maxPrior * 2) / 2;
  return { hireDate: iso(hire), dateOfBirth: iso(birth), priorExperienceYears: prior };
}

async function seedDemoExperience({ prisma }) {
  if (await prisma.systemSetting.findUnique({ where: { key: MARKER_KEY } })) {
    console.log('\nDemo experience: already done on this database (left as it is).');
    return;
  }
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, employeeNumber: { startsWith: 'DEV-' } },
    select: {
      id: true, employeeNumber: true, hireDate: true, dateOfBirth: true, priorExperienceYears: true,
      jobRole: { select: { code: true } },
    },
    orderBy: { employeeNumber: 'asc' },
  });
  if (!employees.length) {
    console.log('\nDemo experience: skipped (no demo employees).');
    return;
  }

  let hires = 0;
  let births = 0;
  let priors = 0;
  for (const emp of employees) {
    const plan = planFor(emp.employeeNumber, emp.jobRole?.code ?? '');
    const data = {};
    if (emp.hireDate && iso(emp.hireDate) === ORIGINAL_HIRE) {
      data.hireDate = day(plan.hireDate);
      hires++;
    }
    if (emp.dateOfBirth && iso(emp.dateOfBirth) === ORIGINAL_BIRTH) {
      data.dateOfBirth = day(plan.dateOfBirth);
      births++;
    }
    if (emp.priorExperienceYears === null || emp.priorExperienceYears === undefined) {
      data.priorExperienceYears = plan.priorExperienceYears;
      priors++;
    }
    if (Object.keys(data).length) await prisma.employee.update({ where: { id: emp.id }, data });
  }

  await prisma.systemSetting.create({
    data: {
      key: MARKER_KEY,
      value: new Date().toISOString(),
      description: 'Demo hire dates, birth dates and prior experience were set by prisma/demo/seed-experience.js.',
    },
  });

  console.log('\nDemo experience');
  console.log(`  Demo employees:          ${employees.length}`);
  console.log(`  Hire dates set:          ${hires}`);
  console.log(`  Birth dates set:         ${births}`);
  console.log(`  Prior experience set:    ${priors}`);
}

module.exports = { seedDemoExperience, planFor, MARKER_KEY };
