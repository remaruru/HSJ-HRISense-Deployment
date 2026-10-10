const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOverrides() {
  try {
    const overrideCount = await prisma.employeeScheduleOverride.count();
    console.log(`Overrides Count: ${overrideCount}`);

    const logsCount = await prisma.scheduleHistoryLog.count({
      where: {
        action: 'OVERRIDE_CREATED'
      }
    });
    console.log(`Override History Logs Count: ${logsCount}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkOverrides();
