import { prisma } from '../config/prisma';
import { createAuditLog } from '../lib/audit';

export class ApplicantNoteService {
  static async addNote(applicationId: string, note: string, userId: string) {
    const applicantNote = await prisma.applicantNote.create({
      data: {
        applicationId,
        note,
        createdById: userId,
      }
    });

    await createAuditLog({
      action: 'APPLICANT_NOTE_ADDED',
      actorUserId: userId,
      entityType: 'JobApplication',
      entityId: applicationId,
      metadata: { noteId: applicantNote.id }
    });

    return applicantNote;
  }
}
