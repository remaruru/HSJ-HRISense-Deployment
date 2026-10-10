/**
 * Where a person's profile opens for the signed-in user — the same rule as the
 * route guards in routeTree.tsx (and the API behind them):
 *   your own record        → My Profile (/profile)
 *   HR (FULL), anyone else → Employee Management (/employees/:id)
 *   a supervisor           → My Team (/my-team/:id); the API answers only for
 *                            their direct reports
 *   anyone else            → My Profile
 */
export function personProfilePath(
  user: { permissionTier?: string; employee?: { id?: string } | null } | null | undefined,
  employeeId: string
): string {
  if (user?.employee?.id && user.employee.id === employeeId) return '/profile';
  if (user?.permissionTier === 'FULL') return `/employees/${employeeId}`;
  if (user?.permissionTier === 'SUPERVISOR') return `/my-team/${employeeId}`;
  return '/profile';
}
