import { supabase } from '../supabase';

export interface StudentLimitCheckResult {
  limit: number;
  currentCount: number;
  remainingQuota: number;
  isLimitReached: boolean;
  isSharedBranchLimit: boolean;
  isBranch: boolean;
  rootInstitutionId: string;
  rootInstitutionName?: string;
  familyInstitutionIds: string[];
}

/**
 * Checks student limitation for an institution.
 * If shared_branch_student_limit is enabled (or the institution is part of a branch network),
 * the limit set on the root institution is treated as a shared pool across the root and all child branches combined.
 */
export async function checkStudentLimit(
  institutionId: string,
  providedConfig?: any
): Promise<StudentLimitCheckResult> {
  const defaultResult: StudentLimitCheckResult = {
    limit: 0,
    currentCount: 0,
    remainingQuota: Infinity,
    isLimitReached: false,
    isSharedBranchLimit: false,
    isBranch: false,
    rootInstitutionId: institutionId,
    familyInstitutionIds: [institutionId]
  };

  if (!institutionId || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return defaultResult;
  }

  try {
    // 1. Fetch current institution config fresh from DB
    const { data: currentInst, error: currErr } = await supabase
      .from('institutions')
      .select('id, name, config_json')
      .eq('id', institutionId)
      .single();

    if (currErr || !currentInst) {
      return defaultResult;
    }

    let parsedConfig: any = currentInst.config_json;
    if (typeof parsedConfig === 'string') {
      try { parsedConfig = JSON.parse(parsedConfig); } catch { parsedConfig = {}; }
    }

    const parentId = parsedConfig?.parent_institution_id;
    const isBranch = Boolean(parentId && parentId !== institutionId);
    const rootId = isBranch ? parentId : institutionId;

    let rootConfig = parsedConfig;
    let rootName = currentInst.name;

    // If it's a child branch, fetch the root institution to get its limit & config
    if (isBranch) {
      const { data: rootInst } = await supabase
        .from('institutions')
        .select('id, name, config_json')
        .eq('id', rootId)
        .single();

      if (rootInst) {
        rootName = rootInst.name;
        let rConfig: any = rootInst.config_json;
        if (typeof rConfig === 'string') {
          try { rConfig = JSON.parse(rConfig); } catch { rConfig = {}; }
        }
        rootConfig = rConfig || {};
      }
    }

    const limit = Number(rootConfig?.student_limit || 0);

    // If no limit is configured (0 or negative = unlimited)
    if (limit <= 0) {
      return {
        ...defaultResult,
        rootInstitutionId: rootId,
        rootInstitutionName: rootName,
        isBranch
      };
    }

    // Check if shared branch student limit is enabled
    // Default to true when part of a branch network, unless explicitly set to false
    const isSharedBranchLimit = rootConfig?.shared_branch_student_limit !== false;

    let targetIds = [institutionId];

    if (isSharedBranchLimit) {
      // Find all family institutions: root + all child branches
      const { data: childBranches } = await supabase
        .from('institutions')
        .select('id')
        .filter('config_json->>parent_institution_id', 'eq', rootId);

      const branchIds = (childBranches || []).map(b => b.id);
      targetIds = Array.from(new Set([rootId, ...branchIds]));
    }

    // Count active students in all target institutions
    const { count, error: countErr } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .in('institution_id', targetIds)
      .neq('is_active', false);

    const currentCount = (countErr || count === null) ? 0 : count;
    const isLimitReached = currentCount >= limit;
    const remainingQuota = Math.max(0, limit - currentCount);

    return {
      limit,
      currentCount,
      remainingQuota,
      isLimitReached,
      isSharedBranchLimit: isSharedBranchLimit && targetIds.length > 1,
      isBranch,
      rootInstitutionId: rootId,
      rootInstitutionName: rootName,
      familyInstitutionIds: targetIds
    };
  } catch (err) {
    console.warn('Error in checkStudentLimit:', err);
    return defaultResult;
  }
}
