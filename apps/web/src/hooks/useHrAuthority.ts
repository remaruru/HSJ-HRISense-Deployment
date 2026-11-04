import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from './useAuth';

/**
 * The HR authority rule (2026-11-04), for screens.
 *
 * Sister changes anyone's records. HR changes their own and anyone below HR,
 * but only reads another HR person's or Sister's. HR's OWN leave and records are
 * accepted automatically, so nobody approves, reviews or deletes their own.
 *
 * The API enforces all of this; screens use the hook only to hide actions the
 * API would refuse and to say why.
 */

interface HrAuthority {
  isSister: boolean;
  selfEmployeeId: string | null;
  lockedEmployeeIds: string[];
}

/** Shown where a record belongs to another HR person or Sister. */
export const HR_READ_ONLY_NOTE = "This person is HR or Sister. You can view their records, but only Sister can change them.";

let cache: { key: string; value: HrAuthority } | null = null;
let inflight: Promise<HrAuthority> | null = null;

export function useHrAuthority() {
  const { user } = useAuth();
  const isHr = user?.permissionTier === 'FULL';
  const selfId = user?.employee?.id ?? null;
  const key = `${user?.id ?? ''}:${selfId ?? ''}`;
  const [data, setData] = useState<HrAuthority | null>(cache?.key === key ? cache.value : null);

  useEffect(() => {
    if (!isHr) return;
    if (cache?.key === key) {
      setData(cache.value);
      return;
    }
    let live = true;
    if (!inflight) {
      inflight = api
        .get('/employees/hr-authority')
        .then((r) => r.data.data as HrAuthority)
        .finally(() => {
          inflight = null;
        });
    }
    inflight
      .then((value) => {
        cache = { key, value };
        if (live) setData(value);
      })
      .catch(() => {
        /* Screens fall back to showing the action; the API still refuses it. */
      });
    return () => {
      live = false;
    };
  }, [isHr, key]);

  return useMemo(() => {
    const locked = new Set(data?.lockedEmployeeIds ?? []);
    const isOwn = (employeeId?: string | null) => !!employeeId && employeeId === selfId;
    return {
      isHr,
      isSister: !!data?.isSister || user?.employee?.jobRole?.code === 'SISTER',
      /** The signed-in person's own record. */
      isOwn,
      /** Another HR person's or Sister's record: read-only for this viewer. */
      isLocked: (employeeId?: string | null) => !!employeeId && locked.has(employeeId),
      /** HR may change this person's records (their own included). */
      canManage: (employeeId?: string | null) => isHr && !!employeeId && !locked.has(employeeId),
      /** HR may decide on / review / delete this person's item: not their own, not another HR person's. */
      canDecide: (employeeId?: string | null) => isHr && !!employeeId && !locked.has(employeeId) && !isOwn(employeeId),
    };
  }, [data, isHr, selfId, user?.employee?.jobRole?.code]);
}
