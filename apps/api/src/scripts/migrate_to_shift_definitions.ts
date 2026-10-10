import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('Starting ShiftDefinition migration...');
  
  const templates = await prisma.scheduleTemplate.findMany({
    where: { isActive: true, isArchived: false, version: 1 }
  });

  console.log(`Found ${templates.length} active templates.`);

  if (templates.length === 0) {
    console.log('No templates to migrate. Exiting.');
    return;
  }

  let createdCount = 0;

  for (const t of templates) {
    let category: 'OFFICE' | 'SHIFT' = 'SHIFT';
    if (t.name.includes('Office')) {
      category = 'OFFICE';
    }

    let startTime = '00:00:00';
    let endTime = '00:00:00';

    if (t.name.includes('8AM–12NN')) {
      startTime = '08:00:00';
      endTime = '12:00:00';
    } else if (t.name.includes('9AM–12NN')) {
      startTime = '09:00:00';
      endTime = '12:00:00';
    } else if (t.name.includes('1PM–6PM')) {
      startTime = '13:00:00';
      endTime = '18:00:00';
    } else if (t.name.includes('6AM–2PM')) {
      startTime = '06:00:00';
      endTime = '14:00:00';
    } else if (t.name.includes('2PM–10PM')) {
      startTime = '14:00:00';
      endTime = '22:00:00';
    } else if (t.name.includes('10PM–6AM')) {
      startTime = '22:00:00';
      endTime = '06:00:00';
    }

    // Check if it already exists
    const existing = await prisma.shiftDefinition.findFirst({
      where: { name: t.name }
    });

    if (!existing) {
      await prisma.shiftDefinition.create({
        data: {
          name: t.name,
          description: t.description,
          category,
          startTime,
          endTime,
          isActive: true,
          version: 1,
          isArchived: false,
          createdById: t.createdById,
        }
      });
      createdCount++;
      console.log(`Created ShiftDefinition: ${t.name}`);
    } else {
      console.log(`ShiftDefinition already exists: ${t.name}`);
    }
  }

  console.log(`Migration complete. Created ${createdCount} ShiftDefinitions.`);
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
