import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { BRAND, calendarDate, drawBrandBand, drawPill, drawTable, humanize, phDateTime, stampFooters, type Tone } from '../lib/pdf-brand';
import { ComplianceService } from './compliance.service';

/**
 * An employee's profile as a PDF: the 201 record (employment, personal, contact,
 * government IDs, education and licences, emergency contacts) with the profile
 * photo, plus where they stand on compliance and their training history.
 *
 * Never included: medical or psychological findings and notes, documents'
 * contents, evaluation ratings or comments, leave reasons, passwords or tokens.
 * Compliance shows only each requirement's status, as the profile page does.
 */

const DOCUMENT_DIR = path.join(process.cwd(), 'uploads', 'documents');
const PREVIEW_PATH = /^\/documents\/([0-9a-f-]{36})\/preview$/i;

const COMPLIANCE_TONE: Record<string, Tone> = { VALID: 'good', EXPIRING_SOON: 'warning', EXPIRED: 'critical', MISSING: 'critical', NEEDS_REVIEW: 'review' };
const PARTICIPATION_TONE: Record<string, Tone> = { COMPLETED: 'good', ASSIGNED: 'neutral', DID_NOT_ATTEND: 'critical', EXCUSED: 'neutral', CANCELLED: 'neutral' };
const STATE_TONE: Record<string, Tone> = { ACTIVE: 'good', ON_LEAVE: 'warning' };

type Field = [label: string, value: string | null | undefined];

const yesNo = (v: boolean | null | undefined) => (v === null || v === undefined ? null : v ? 'Yes' : 'No');
const fullName = (p: { firstName: string; middleName?: string | null; lastName: string; suffix?: string | null }) =>
  [p.firstName, p.middleName, p.lastName, p.suffix].map((x) => x?.trim()).filter(Boolean).join(' ');

/** The stored profile photo, when it is a JPEG or PNG the PDF can show. */
async function photoBuffer(photoUrl: string | null): Promise<Buffer | null> {
  const id = photoUrl ? PREVIEW_PATH.exec(photoUrl)?.[1] : undefined;
  if (!id) return null;
  const doc = await prisma.employeeDocument.findFirst({ where: { id, deletedAt: null }, select: { storedFilename: true } });
  if (!doc) return null;
  const file = path.join(DOCUMENT_DIR, doc.storedFilename);
  if (!fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return jpeg || png ? buf : null;
}

export class EmployeeProfileExportService {
  static async toPdf(employeeId: string): Promise<{ buffer: Buffer; fileName: string; name: string }> {
    const e = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        employeeNumber: true, firstName: true, middleName: true, lastName: true, suffix: true,
        gender: true, dateOfBirth: true, placeOfBirth: true, civilStatus: true, nationality: true, religion: true,
        bloodType: true, spouseName: true, numberOfChildren: true,
        personalEmail: true, workEmail: true, mobilePhone: true, telephoneNumber: true, homePhone: true,
        presentAddress: true, permanentAddress: true, hsjResidence: true, residenceDorm: true,
        emergencyContactName: true, emergencyContactRel: true, emergencyContactPhone: true,
        employmentStatus: true, employmentState: true, hireDate: true, probationDate: true, regularizationDate: true,
        separationDate: true, separationReason: true, biometricCode: true,
        paternityLeaveEligible: true, soloParentLeaveEligible: true,
        prcLicenseNumber: true, professionalRole: true, prcIssuedDate: true, prcValidUntil: true,
        ncCertificateNumber: true, ncQualification: true, ncValidUntil: true,
        primarySchool: true, secondarySchool: true, tertiarySchool: true, tertiaryCourse: true, tertiaryGraduated: true,
        diploma: true, vocationalQualification: true,
        sssNumber: true, philhealthNumber: true, pagibigNumber: true, tinNumber: true, otherGovernmentIds: true,
        photoUrl: true,
        unit: { select: { name: true } },
        department: { select: { name: true } },
        jobRole: { select: { title: true } },
        immediateSupervisor: { select: { firstName: true, lastName: true, jobRole: { select: { title: true } } } },
        user: { select: { email: true } },
        emergencyContacts: { orderBy: { position: 'asc' }, select: { contactName: true, relationship: true, mobilePhone: true } },
        governmentIds: { orderBy: { position: 'asc' }, select: { idType: true, idNumber: true } },
      },
    });
    if (!e) throw new AppError('Employee not found', 404);

    const [photo, compliance, training] = await Promise.all([
      photoBuffer(e.photoUrl),
      ComplianceService.getEmployeeComplianceSummary(employeeId),
      prisma.trainingParticipant.findMany({
        where: { employeeId },
        orderBy: { trainingActivity: { startDate: 'desc' } },
        take: 20,
        select: { participationStatus: true, trainingActivity: { select: { title: true, type: true, startDate: true, endDate: true } } },
      }),
    ]);

    const name = fullName(e);
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true, info: { Title: `${name} — Employee Profile` } });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = 36;
      const width = doc.page.width - 72;
      const bottom = () => doc.page.height - 44;
      const ensure = (needed: number, y: number) => (y + needed <= bottom() ? y : (doc.addPage(), 40));

      // ── Header card ──
      let y = drawBrandBand(doc, 'Employee Profile');
      const cardH = 112;
      doc.save().roundedRect(left, y, width, cardH, 10).fill(BRAND.tealLight).restore();
      const size = 84;
      const px = left + 16;
      const py = y + (cardH - size) / 2;
      if (photo) {
        doc.save();
        doc.circle(px + size / 2, py + size / 2, size / 2).clip();
        doc.image(photo, px, py, { cover: [size, size], align: 'center', valign: 'center' });
        doc.restore();
        doc.save().circle(px + size / 2, py + size / 2, size / 2).lineWidth(2).strokeColor('#ffffff').stroke().restore();
      } else {
        const initials = `${e.firstName.trim()[0] ?? ''}${e.lastName.trim()[0] ?? ''}`.toUpperCase() || '?';
        doc.save().circle(px + size / 2, py + size / 2, size / 2).fill(BRAND.teal).restore();
        doc.font('Helvetica-Bold').fontSize(28).fillColor('#ffffff').text(initials, px, py + size / 2 - 14, { width: size, align: 'center' });
      }
      const tx = px + size + 18;
      const tw = width - (tx - left) - 16;
      doc.font('Helvetica-Bold').fontSize(19).fillColor(BRAND.ink).text(name, tx, y + 16, { width: tw });
      doc.font('Helvetica').fontSize(11).fillColor(BRAND.body).text(e.jobRole?.title ?? '—', tx, doc.y + 2, { width: tw });
      doc.fontSize(9.5).fillColor(BRAND.muted).text([e.unit?.name, e.department?.name].filter(Boolean).join('  ·  ') || '—', tx, doc.y + 2, { width: tw });
      let pillX = tx;
      const pillY = Math.min(doc.y + 8, y + cardH - 24);
      pillX += drawPill(doc, pillX, pillY, e.employeeNumber, 'neutral', 8) + 6;
      pillX += drawPill(doc, pillX, pillY, humanize(e.employmentStatus), 'neutral', 8) + 6;
      drawPill(doc, pillX, pillY, humanize(e.employmentState), STATE_TONE[e.employmentState] ?? 'neutral', 8);
      doc.font('Helvetica').fontSize(7.5).fillColor(BRAND.muted)
        .text(`Generated ${phDateTime()}`, left, y + cardH - 16, { width: width - 14, align: 'right', lineBreak: false });
      y += cardH + 18;

      // ── Sections ──
      const sectionTitle = (title: string) => {
        y = ensure(60, y);
        doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND.tealDark).text(title, left, y);
        y = doc.y + 3;
        doc.save().moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor(BRAND.teal).stroke().restore();
        y += 8;
      };
      const fields = (items: Field[]) => {
        const colW = (width - 20) / 2;
        for (let i = 0; i < items.length; i += 2) {
          const pair = items.slice(i, i + 2);
          doc.font('Helvetica').fontSize(9.5);
          const h = 14 + Math.max(...pair.map(([, v]) => doc.heightOfString(v || '—', { width: colW }))) + 8;
          y = ensure(h, y);
          pair.forEach(([label, value], k) => {
            const x = left + k * (colW + 20);
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(BRAND.muted).text(label.toUpperCase(), x, y, { width: colW, characterSpacing: 0.4 });
            doc.font('Helvetica').fontSize(9.5).fillColor(value ? BRAND.body : BRAND.muted).text(value || '—', x, y + 12, { width: colW });
          });
          y += h;
        }
        y += 6;
      };

      sectionTitle('Employment');
      const supervisor = e.immediateSupervisor
        ? `${e.immediateSupervisor.firstName} ${e.immediateSupervisor.lastName}${e.immediateSupervisor.jobRole?.title ? ` (${e.immediateSupervisor.jobRole.title})` : ''}`
        : null;
      fields([
        ['Employee number', e.employeeNumber],
        ['Job role', e.jobRole?.title],
        ['Unit', e.unit?.name],
        ['Department', e.department?.name],
        ['Immediate supervisor', supervisor],
        ['Employment status', humanize(e.employmentStatus)],
        ['Employment state', humanize(e.employmentState)],
        ['Date hired', calendarDate(e.hireDate)],
        ['Probation date', e.probationDate ? calendarDate(e.probationDate) : null],
        ['Regularization date', e.regularizationDate ? calendarDate(e.regularizationDate) : null],
        ...(e.separationDate ? ([['Separation date', calendarDate(e.separationDate)], ['Separation reason', e.separationReason]] as Field[]) : []),
        ['Sign-in email', e.user?.email ?? 'No sign-in account'],
        ['Timekeeping code', e.biometricCode],
        ['Paternity leave eligible', yesNo(e.paternityLeaveEligible)],
        ['Solo parent leave eligible', yesNo(e.soloParentLeaveEligible)],
      ]);

      sectionTitle('Personal Information');
      fields([
        ['Gender', humanize(e.gender)],
        ['Date of birth', calendarDate(e.dateOfBirth)],
        ['Place of birth', e.placeOfBirth],
        ['Civil status', humanize(e.civilStatus)],
        ['Nationality', e.nationality],
        ['Religion', e.religion],
        ['Blood type', e.bloodType],
        ['Spouse name', e.spouseName],
        ['Number of children', e.numberOfChildren === null || e.numberOfChildren === undefined ? null : String(e.numberOfChildren)],
      ]);

      sectionTitle('Contact Information');
      fields([
        ['Mobile number', e.mobilePhone],
        ['Telephone', e.telephoneNumber],
        ['Home phone', e.homePhone],
        ['Personal email', e.personalEmail],
        ['Work email', e.workEmail],
        ['HSJ residence', e.hsjResidence],
        ['Present address', e.presentAddress],
        ['Permanent address', e.permanentAddress],
        ['Unit / dorm', e.residenceDorm],
      ]);

      sectionTitle('Government IDs');
      fields([
        ['SSS', e.sssNumber],
        ['PhilHealth', e.philhealthNumber],
        ['Pag-IBIG', e.pagibigNumber],
        ['TIN', e.tinNumber],
        ...e.governmentIds.map((g) => [g.idType, g.idNumber] as Field),
        ...(e.otherGovernmentIds ? ([['Other IDs', e.otherGovernmentIds]] as Field[]) : []),
      ]);

      sectionTitle('Education');
      fields([
        ['Primary school', e.primarySchool],
        ['Secondary school', e.secondarySchool],
        ['Tertiary school', e.tertiarySchool],
        ['Course', e.tertiaryCourse],
        ['Graduated', yesNo(e.tertiaryGraduated)],
        ['Diploma', e.diploma],
        ['Vocational qualification', e.vocationalQualification],
      ]);

      // Licences only when the employee holds one; a page of blanks says nothing.
      sectionTitle('Licenses');
      const prc: Field[] = [
        ['PRC license number', e.prcLicenseNumber],
        ['Profession', e.professionalRole],
        ['PRC issued', e.prcIssuedDate ? calendarDate(e.prcIssuedDate) : null],
        ['PRC valid until', e.prcValidUntil ? calendarDate(e.prcValidUntil) : null],
      ];
      const tesda: Field[] = [
        ['TESDA certificate number', e.ncCertificateNumber],
        ['TESDA qualification', e.ncQualification],
        ['TESDA valid until', e.ncValidUntil ? calendarDate(e.ncValidUntil) : null],
      ];
      const held = [prc, tesda].filter((group) => group.some(([, v]) => v));
      if (held.length) held.forEach((group) => fields(group));
      else {
        doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(BRAND.muted).text('No PRC or TESDA license on record.', left, y);
        y = doc.y + 14;
      }

      sectionTitle('Emergency Contacts');
      const contacts = e.emergencyContacts.length
        ? e.emergencyContacts.map((c) => [c.contactName, c.relationship, c.mobilePhone])
        : [[e.emergencyContactName, e.emergencyContactRel, e.emergencyContactPhone]];
      y = drawTable(doc, [{ label: 'Name' }, { label: 'Relationship' }, { label: 'Mobile number' }], contacts, { x: left, y, width });
      y += 16;

      sectionTitle('Compliance Status');
      if (!compliance.length) {
        doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(BRAND.muted).text('No compliance requirements apply to this employee.', left, y);
        y = doc.y + 14;
      } else {
        const rows = compliance.map((c: any) => [
          c.requirement.title,
          humanize(c.requirement.category),
          humanize(c.status),
          c.latestRecordDate ? calendarDate(c.latestRecordDate) : '—',
          c.expiresAt ? calendarDate(c.expiresAt) : '—',
        ]);
        const tones = compliance.map((c: any) => [null, null, COMPLIANCE_TONE[c.status] ?? 'neutral', null, null] as Array<Tone | null>);
        y = drawTable(doc, [{ label: 'Requirement' }, { label: 'Category' }, { label: 'Status' }, { label: 'Latest record' }, { label: 'Expires' }], rows, { x: left, y, width, tones });
        y += 16;
      }

      sectionTitle('Training History');
      if (!training.length) {
        doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(BRAND.muted).text('No training or seminars on record.', left, y);
        y = doc.y + 14;
      } else {
        const rows = training.map((t) => [
          t.trainingActivity.title,
          humanize(t.trainingActivity.type),
          t.trainingActivity.startDate.getTime() === t.trainingActivity.endDate.getTime()
            ? calendarDate(t.trainingActivity.startDate)
            : `${calendarDate(t.trainingActivity.startDate)} – ${calendarDate(t.trainingActivity.endDate)}`,
          humanize(t.participationStatus),
        ]);
        const tones = training.map((t) => [null, null, null, PARTICIPATION_TONE[t.participationStatus] ?? 'neutral'] as Array<Tone | null>);
        y = drawTable(doc, [{ label: 'Activity' }, { label: 'Type' }, { label: 'Date' }, { label: 'Participation' }], rows, { x: left, y, width, tones });
      }

      stampFooters(doc, `HSJ HRISense · Employee profile of ${name} · Confidential: contains personal information`);
      doc.end();
    });

    const safe = name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Employee';
    return { buffer, fileName: `HRISense_Profile_${safe}_${e.employeeNumber}.pdf`, name };
  }
}

