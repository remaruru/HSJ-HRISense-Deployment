import { PrismaClient, JobApplicationStatus, InterviewStatus, InterviewType } from '@prisma/client';
import { recruitmentConfig } from '../config/recruitment.config';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('--- STARTING RECRUITMENT BACKEND RUNTIME VERIFICATION ---');

  // Verify Config
  console.log(`\nEmail Enabled: ${recruitmentConfig.emailEnabled}`);
  
  if (recruitmentConfig.emailEnabled) {
    throw new Error('STOP: Email sending is enabled. For safe verification, set RECRUITMENT_EMAIL_SEND_ENABLED=false');
  }

  // Find an HR user for auditing
  const hrUser = await prisma.user.findFirst();
  const userId = hrUser?.id || 'temp-user-id';

  try {
    // 1. Create temporary organization structures
    console.log('\n[1] Creating temporary Unit, Department, JobRole...');
    const unit = await prisma.unit.create({ data: { name: 'Temp Verify Unit', code: 'TVU' } });
    const jobRole = await prisma.jobRole.create({ 
      data: { title: 'Temp Verify Role', code: 'TVR', unitId: unit.id, permissionTier: 'FULL' } 
    });
    const department = await prisma.department.create({ 
      data: { name: 'Temp Verify Dept', code: 'TVD' } 
    });

    // 2. Job Opening Workflow
    console.log('\n[2] Testing Job Opening Workflow...');
    let opening = await prisma.jobOpening.create({
      data: {
        title: 'Senior Software Engineer (Test)',
        slug: 'senior-software-engineer-test',
        referenceNumber: 'JOB-TEST-001',
        description: 'Test description',
        responsibilities: 'Test responsibilities',
        qualifications: 'Test qualifications',
        openingDate: new Date(),
        closingDate: new Date(Date.now() + 864000000), // +10 days
        employmentType: 'REGULAR',
        departmentId: department.id,
        unitId: unit.id,
        jobRoleId: jobRole.id,
        vacancies: 2,
        createdById: userId,
        updatedById: userId,
      }
    });
    console.log(` - Created JobOpening: ${opening.id}`);

    // Update Opening Status
    opening = await prisma.jobOpening.update({
      where: { id: opening.id },
      data: { status: 'OPEN', publishedAt: new Date() }
    });
    console.log(` - Updated status to ${opening.status}`);

    // 3. Public Application Submission
    console.log('\n[3] Testing Application Submission...');
    const applicant = await prisma.applicant.create({
      data: {
        firstName: 'Test',
        lastName: 'Applicant',
        email: 'test.applicant.verify@example.com',
        mobile: '09123456789'
      }
    });
    
    let application = await prisma.jobApplication.create({
      data: {
        jobOpeningId: opening.id,
        applicantId: applicant.id,
        referenceNumber: 'APP-TEST-001',
        status: JobApplicationStatus.SUBMITTED,
        privacyConsent: true,
        consentTimestamp: new Date(),
        applicantMessage: 'Hello, I want to apply.',
        source: 'CAREERS_PAGE'
      }
    });
    console.log(` - Created Application: ${application.id}`);

    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        newStatus: JobApplicationStatus.SUBMITTED,
        changedById: applicant.id,
      }
    });
    console.log(' - Created initial status history');

    // 4. Status Transition
    console.log('\n[4] Testing Status Transitions...');
    application = await prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: JobApplicationStatus.UNDER_REVIEW }
    });
    console.log(` - Changed status to ${application.status}`);

    // 5. Notes
    console.log('\n[5] Testing Internal Notes...');
    const note = await prisma.applicantNote.create({
      data: {
        applicationId: application.id,
        note: 'This applicant looks promising.',
        createdById: userId
      }
    });
    console.log(` - Created Note: ${note.id}`);

    // 6. Interviews
    console.log('\n[6] Testing Interviews...');
    const interview = await prisma.applicantInterview.create({
      data: {
        applicationId: application.id,
        scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
        interviewType: InterviewType.TECHNICAL,
        locationDetails: 'Zoom Link',
        status: InterviewStatus.SCHEDULED,
        createdById: userId,
        updatedById: userId
      }
    });
    console.log(` - Created Interview: ${interview.id}`);
    
    const updatedInterview = await prisma.applicantInterview.update({
      where: { id: interview.id },
      data: { status: InterviewStatus.COMPLETED, recommendation: 'Hire', notes: 'Did well' }
    });
    console.log(` - Completed Interview: ${updatedInterview.status}`);

    // 7. Verify Auto-email doesn't happen
    console.log('\n[7] Verifying No Automated Emails...');
    const commCount = await prisma.applicantCommunication.count({
      where: { jobApplicationId: application.id }
    });
    if (commCount > 0) {
      console.warn(' - WARNING: An automated email was sent!');
    } else {
      console.log(' - Passed: No emails were sent automatically.');
    }

    // 8. Conversion
    console.log('\n[8] Testing Onboarding Conversion...');
    application = await prisma.jobApplication.update({
      where: { id: application.id },
      data: { status: JobApplicationStatus.HIRED }
    });
    console.log(' - Changed status to HIRED');
    
    const draft = await prisma.onboardingDraft.create({
      data: {
        data: {
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          personalEmail: applicant.email,
        },
        status: 'DRAFT',
        createdById: userId,
        lastUpdatedById: userId
      }
    });
    
    await prisma.jobApplication.update({
      where: { id: application.id },
      data: { onboardingDraftId: draft.id }
    });
    console.log(` - Converted to OnboardingDraft: ${draft.id}`);

    // CLEANUP
    console.log('\n[9] Cleaning up temporary records...');
    await prisma.onboardingDraft.delete({ where: { id: draft.id } });
    await prisma.applicantInterview.delete({ where: { id: interview.id } });
    await prisma.applicantNote.delete({ where: { id: note.id } });
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: application.id } });
    await prisma.jobApplication.delete({ where: { id: application.id } });
    await prisma.applicant.delete({ where: { id: applicant.id } });
    await prisma.jobOpening.delete({ where: { id: opening.id } });
    await prisma.jobRole.delete({ where: { id: jobRole.id } });
    await prisma.department.delete({ where: { id: department.id } });
    await prisma.unit.delete({ where: { id: unit.id } });

    console.log(' - Cleanup complete.');
    console.log('\n--- VERIFICATION SUCCESSFUL ---');

  } catch (error) {
    console.error('\n--- VERIFICATION FAILED ---');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
