/**
 * Adds five SAMPLE Yearly Achievements pages (2022–2026) so the feature can be
 * seen before HR writes real ones.
 *
 *   npx tsx src/scripts/seed_sample_yearly_achievements.ts
 *
 * - Marked as samples (isSample): the page shows a "Sample" notice, and the text
 *   says it is example content. No real event, award or person is described.
 * - Ordinary records: HR edits, unpublishes or deletes them in the UI.
 * - Safe to run again: a year that already has a page is left alone.
 */
import 'dotenv/config';
import { prisma } from '../config/prisma';

const YEARS = [2022, 2023, 2024, 2025, 2026];

const ENTRIES = [
  {
    title: 'Sample achievement — a service milestone',
    description:
      'Example text. Describe a milestone in how Hospicio de San Jose served the people in its care this year: what was reached, who made it possible, and why it mattered. Replace this sample with an actual achievement, or delete it.',
  },
  {
    title: 'Sample achievement — a facility or program improvement',
    description:
      'Example text. Describe an improvement to a facility, unit or program, and the difference it made. This is placeholder content, not a real event.',
  },
  {
    title: 'Sample achievement — staff development',
    description:
      'Example text. Describe training, recognition or growth across the staff this year. Add a photo or a PDF if it helps tell the story.',
  },
];

async function main() {
  for (const year of YEARS) {
    const exists = await prisma.yearlyAchievementPage.findFirst({ where: { year, deletedAt: null } });
    if (exists) {
      console.log(`${year}: a page already exists — left as it is`);
      continue;
    }
    await prisma.yearlyAchievementPage.create({
      data: {
        year,
        title: `${year} Yearly Achievements (Sample)`,
        summary: `This is a SAMPLE page showing how ${year}'s Yearly Achievements will look. HR can replace this introduction and the achievements below with Hospicio's actual ${year} highlights, or delete the page.`,
        status: 'PUBLISHED',
        isSample: true,
        publishedAt: new Date(),
        entries: { create: ENTRIES.map((e, i) => ({ ...e, displayOrder: i + 1 })) },
      },
    });
    console.log(`${year}: sample page created`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
