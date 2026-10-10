import { InfoSection, InfoGrid, InfoField } from "@/components/ui/info-section";
import { STATUS_TONE_CHIP } from "@/components/ui/status-tone";
import { cn } from "@/lib/utils";
import { formatEmploymentDate, isProfessional } from "@/lib/employment";
import { credentialValidity, graduatedLabel } from "@/lib/employeeRecord";

/**
 * The optional HSJ employee-record fields, shown the same way on the HR profile
 * and on My Profile. A blank field reads "Not provided"; a field that cannot
 * apply says so ("Not applicable") — it is never shown as missing.
 */

const dateOrBlank = (v: unknown) => (v ? formatEmploymentDate(v as string) : undefined);

function Validity({ validUntil }: { validUntil: unknown }) {
  const v = credentialValidity(validUntil);
  if (!v) return null;
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", STATUS_TONE_CHIP[v.tone])}>{v.label}</span>
  );
}

/** Blood type, spouse and children — inside the Personal Details grid. */
export function PersonalRecordFields({ employee }: { employee: any }) {
  const single = employee.civilStatus === "SINGLE";
  return (
    <>
      <InfoField label="Blood Type" value={employee.bloodType} />
      <InfoField label="Spouse Name" value={single ? "Not applicable" : employee.spouseName} />
      <InfoField
        label="Number of Children"
        value={employee.numberOfChildren === null || employee.numberOfChildren === undefined ? undefined : String(employee.numberOfChildren)}
      />
    </>
  );
}

/** Where the employee stays at Hospicio — inside the Addresses grid. */
export function ResidenceFields({ employee }: { employee: any }) {
  return (
    <>
      <InfoField label="HSJ Residence" value={employee.hsjResidence} />
      <InfoField label="Unit / Dorm" value={employee.residenceDorm} />
    </>
  );
}

/** PRC license, TESDA national certificate and education — one tab. */
export function EducationLicensesSections({ employee }: { employee: any }) {
  const licensed = isProfessional(employee);
  const hasNc = !!String(employee.ncCertificateNumber ?? "").trim();
  return (
    <>
      <InfoSection
        title="Professional License (PRC)"
        description="For licensed professionals only. Validity is worked out from the valid-until date."
      >
        <InfoGrid>
          <InfoField label="PRC License #" value={employee.prcLicenseNumber || "Not applicable — no PRC license on file"} />
          <InfoField label="Profession" value={employee.professionalRole || (licensed ? undefined : "Not applicable")} />
          {licensed && (
            <>
              <InfoField label="Issued" value={dateOrBlank(employee.prcIssuedDate)} />
              <InfoField label="Valid Until" value={dateOrBlank(employee.prcValidUntil)} />
              {employee.prcValidUntil && <InfoField label="Validity" value={<Validity validUntil={employee.prcValidUntil} />} />}
            </>
          )}
        </InfoGrid>
      </InfoSection>

      <InfoSection title="National Certificate (TESDA)" description="For example NC II. Only for roles that hold one.">
        <InfoGrid>
          <InfoField label="Certificate Number" value={employee.ncCertificateNumber || "Not applicable — no national certificate on file"} />
          <InfoField label="Qualification" value={employee.ncQualification || (hasNc ? undefined : "Not applicable")} />
          {hasNc && (
            <>
              <InfoField label="Valid Until" value={dateOrBlank(employee.ncValidUntil)} />
              {employee.ncValidUntil && <InfoField label="Validity" value={<Validity validUntil={employee.ncValidUntil} />} />}
            </>
          )}
        </InfoGrid>
      </InfoSection>

      <InfoSection title="Education" description="As recorded by HR. Copies of licenses, certificates and diplomas go under Documents.">
        <InfoGrid>
          <InfoField label="Primary School" value={employee.primarySchool} />
          <InfoField label="Secondary School" value={employee.secondarySchool} />
          <InfoField label="Tertiary School" value={employee.tertiarySchool} />
          <InfoField label="Course" value={employee.tertiaryCourse} />
          <InfoField label="Graduated" value={graduatedLabel(employee.tertiaryGraduated) ?? undefined} />
          <InfoField label="Diploma" value={employee.diploma} />
          <InfoField label="Vocational Qualification" value={employee.vocationalQualification} span />
        </InfoGrid>
      </InfoSection>
    </>
  );
}
