import { useAuth } from './useAuth';

export const usePermission = () => {
  const { user } = useAuth();

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;
    if (user.permissionTier === 'FULL') return true;

    // Check if any permission in user's permissions array matches module and action
    return user.permissions.some((p) => {
      const [pModule, pAction] = p.split('.');
      return pModule === module && pAction === action;
    });
  };

  const hasScope = (module: string, action: string, scope: 'OWN' | 'SUBORDINATES' | 'ALL'): boolean => {
    if (!user) return false;
    if (user.permissionTier === 'FULL') return true;

    return user.permissions.some((p) => {
      const [pModule, pAction, pScope] = p.split('.');
      return pModule === module && pAction === action && pScope === scope;
    });
  };

  /**
   * High-level check to determine if the user can perform an action on a resource owned by targetEmployeeId
   */
  const canAccess = (
    module: string,
    action: string,
    targetEmployeeId?: string,
    subordinateIds: string[] = []
  ): boolean => {
    if (!user) return false;
    if (user.permissionTier === 'FULL') return true;

    // If targetEmployeeId is not provided, just check if they have any permission for this action
    if (!targetEmployeeId) {
      return hasPermission(module, action);
    }

    // If target is themselves, check if they have OWN scope permission
    if (targetEmployeeId === user.employee.id) {
      return hasScope(module, action, 'OWN');
    }

    // If target is a subordinate, check if they have SUBORDINATES scope permission and target is indeed a subordinate
    if (subordinateIds.includes(targetEmployeeId)) {
      return hasScope(module, action, 'SUBORDINATES');
    }

    // Otherwise access is denied
    return false;
  };

  return {
    hasPermission,
    hasScope,
    canAccess,
    tier: user?.permissionTier || 'STANDARD',
    roleCode: user?.employee?.jobRole?.code || 'EMPLOYEE',
  };
};
