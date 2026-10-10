/**
 * Shared TypeScript contracts for HRISense.
 *
 * ── Why this file was rewritten ───────────────────────────────────────────────
 * The previous contents declared a role model that HRISense does not have —
 * `SUPER_ADMIN`, `HR_MANAGER`, `DEPARTMENT_HEAD`, `NURSE`, `DOCTOR`,
 * `PHARMACIST`, … — along with enum shapes and a `JobPosition` model that no
 * longer match the Prisma schema. Nothing imported it, so the drift went
 * unnoticed, but it was a standing source of confusion about the access model.
 *
 * This file now contains only contracts that are TRUE of the current system.
 * Anything richer belongs next to its own module; the Prisma schema
 * (`apps/api/prisma/schema.prisma`) remains the single source of truth for the
 * data model.
 */

export type UUID = string;
export type ISO8601 = string;

/* ─── Access model ────────────────────────────────────────────────────────────
 * HRISense has exactly THREE permission tiers, carried on `JobRole.permissionTier`
 * and copied into the access token. There is NO generic system administrator
 * role: a job title such as "Assistant Administrator" is an ordinary HSJ job
 * title and carries no elevated system rights.
 */
export type PermissionTier = 'FULL' | 'SUPERVISOR' | 'STANDARD';

/** Friendly labels used in the interface. */
export const PERMISSION_TIER_LABELS: Record<PermissionTier, string> = {
  FULL: 'HR Personnel',
  SUPERVISOR: 'Supervisor',
  STANDARD: 'Employee',
};

/** Scope attached to a granular permission. */
export type PermissionScope = 'OWN' | 'SUBORDINATES' | 'ALL';

/* ─── API envelope ───────────────────────────────────────────────────────────
 * Every HRISense endpoint responds in one of these two shapes.
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  warnings?: string[];
}

export interface ApiError {
  success: false;
  error: string;
  errors?: Array<{ field: string; message: string }>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Shape returned by paginated list endpoints. */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/* ─── Authenticated user payload ──────────────────────────────────────────────
 * What `POST /auth/login` and `GET /auth/me` return. Both endpoints return the
 * same user shape — including `mustChangePassword`, which the route guards read.
 */
export interface AuthenticatedUser {
  id: UUID;
  email: string;
  mustChangePassword: boolean;
  permissionTier: PermissionTier;
  /** Flattened `module.action.scope` strings. */
  permissions: string[];
  employee: {
    id: UUID;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    jobRole: {
      title: string;
      code: string;
      permissionTier: PermissionTier;
    };
  };
}
