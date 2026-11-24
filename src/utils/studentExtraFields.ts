import { Student } from 'types';

export interface StudentExtraFields {
  gender?: string | null;
  nationality?: string | null;
  religion?: string | null;
  father_name?: string | null;
  father_occupation?: string | null;
  father_nid?: string | null;
  mother_occupation?: string | null;
  mother_nid?: string | null;
  guardian_relation?: string | null;
  whatsapp_number?: string | null;
  emergency_phone?: string | null;
  permanent_address?: string | null;
  previous_institution?: string | null;
  previous_class?: string | null;
  tc_number?: string | null;
  biometric_id?: string | null;
  birth_reg_no?: string | null;
  department?: string | null;
  residential_status?: string | null;
  admission_fee?: string | null;
  monthly_fee?: string | null;
  receipt_number?: string | null;
  hifz_completed_paras?: number[];
  hifz_uncompleted_paras?: number[];
}

const ADM_TAG_PREFIX = '[ADM_EXTRA:';
const ADM_TAG_SUFFIX = ']';

const parseCompletedParas = (raw: unknown): number[] => {
  const nums: number[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const n = Number(item);
      if (Number.isInteger(n) && n >= 1 && n <= 30) nums.push(n);
    }
  } else if (typeof raw === 'string' && raw.trim().length > 0) {
    const parts = raw.split(/[\s,]+/);
    for (const p of parts) {
      const n = parseInt(p.trim(), 10);
      if (!isNaN(n) && n >= 1 && n <= 30) nums.push(n);
    }
  }
  return Array.from(new Set(nums)).sort((a, b) => a - b);
};

/**
 * Extracts extra admission fields from either direct properties or from the packed notes tag
 */
export function extractStudentExtraFields(student?: Student | null): StudentExtraFields {
  if (!student) return {};

  let parsedFromNotes: Record<string, any> = {};
  if (student.notes && student.notes.includes(ADM_TAG_PREFIX)) {
    try {
      const startIndex = student.notes.indexOf(ADM_TAG_PREFIX);
      const closingObjIndex = student.notes.indexOf('}]', startIndex);
      if (startIndex !== -1 && closingObjIndex !== -1) {
        const jsonStr = student.notes.substring(startIndex + ADM_TAG_PREFIX.length, closingObjIndex + 1);
        parsedFromNotes = JSON.parse(jsonStr);
      } else {
        const endIndex = student.notes.indexOf(ADM_TAG_SUFFIX, startIndex);
        if (startIndex !== -1 && endIndex !== -1) {
          const jsonStr = student.notes.substring(startIndex + ADM_TAG_PREFIX.length, endIndex);
          parsedFromNotes = JSON.parse(jsonStr);
        }
      }
    } catch (e) {
      console.warn('Failed to parse extra fields from notes:', e);
    }
  }

  const s = student as any;

  return {
    gender: (student.gender ?? parsedFromNotes.gender) || '',
    nationality: (student.nationality ?? parsedFromNotes.nationality) || '',
    religion: (student.religion ?? parsedFromNotes.religion) || '',
    father_name: (student.father_name ?? parsedFromNotes.father_name) || '',
    father_occupation: (student.father_occupation ?? parsedFromNotes.father_occupation) || '',
    father_nid: (s.father_nid ?? parsedFromNotes.father_nid) || '',
    mother_occupation: (student.mother_occupation ?? parsedFromNotes.mother_occupation) || '',
    mother_nid: (s.mother_nid ?? parsedFromNotes.mother_nid) || '',
    guardian_relation: (student.guardian_relation ?? parsedFromNotes.guardian_relation) || '',
    whatsapp_number: (s.whatsapp_number ?? parsedFromNotes.whatsapp_number) || '',
    emergency_phone: (s.emergency_phone ?? parsedFromNotes.emergency_phone) || '',
    permanent_address: (student.permanent_address ?? parsedFromNotes.permanent_address) || '',
    previous_institution: (student.previous_institution ?? parsedFromNotes.previous_institution) || '',
    previous_class: (student.previous_class ?? parsedFromNotes.previous_class) || '',
    tc_number: (s.tc_number ?? parsedFromNotes.tc_number) || '',
    biometric_id: (student.biometric_id ?? parsedFromNotes.biometric_id) || '',
    birth_reg_no: (s.birth_reg_no ?? parsedFromNotes.birth_reg_no) || '',
    department: (s.department ?? parsedFromNotes.department) || '',
    residential_status: (s.residential_status ?? parsedFromNotes.residential_status) || '',
    admission_fee: (s.admission_fee ?? parsedFromNotes.admission_fee) || '',
    monthly_fee: (s.monthly_fee ?? parsedFromNotes.monthly_fee) || '',
    receipt_number: (s.receipt_number ?? parsedFromNotes.receipt_number) || '',
    hifz_completed_paras: parseCompletedParas(s.hifz_completed_paras ?? parsedFromNotes.hifz_completed_paras),
    hifz_uncompleted_paras: parseCompletedParas(s.hifz_uncompleted_paras ?? parsedFromNotes.hifz_uncompleted_paras),
  };
}

const stripAdmExtraAndArtifacts = (notes: string): string =>
  notes
    .replace(/\[ADM_EXTRA:\{[^\n]*?\}\]/g, '')
    .replace(/\[ADM_EXTRA:.*?\]/g, '')
    .replace(/^\s*[}\]]+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Embeds extra fields into the notes string while preserving existing notes and other tags like [ACC_START:...]
 */
export function packStudentNotesWithExtra(currentNotes: string | undefined | null, extra: StudentExtraFields): string {
  const cleanNotes = stripAdmExtraAndArtifacts(currentNotes || '');

  const cleanExtra: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (k === 'hifz_completed_paras' || k === 'hifz_uncompleted_paras') {
      const paras = parseCompletedParas(v);
      if (paras.length > 0) {
        // Store as comma-separated string to guarantee no ']' bracket inside [ADM_EXTRA:...]
        cleanExtra[k] = paras.join(',');
      }
      continue;
    }
    if (v !== undefined && v !== null && typeof v === 'string' && v.trim().length > 0) {
      cleanExtra[k] = v.trim();
    }
  }

  if (Object.keys(cleanExtra).length === 0) {
    return cleanNotes;
  }

  const tag = `[ADM_EXTRA:${JSON.stringify(cleanExtra)}]`;
  return cleanNotes ? `${cleanNotes}\n${tag}` : tag;
}

/**
 * Strips technical tags when displaying notes to users
 */
export function getDisplayNotes(notes?: string | null): string {
  if (!notes) return '';
  return stripAdmExtraAndArtifacts(notes.replace(/\[ACC_START:.*?\]/g, ''));
}

export interface HifzParaProgressItem {
  paraNo: number;
  status: 'completed' | 'current' | 'remaining';
  maxPage: number;
  isAutoCompleted: boolean;
  isManualCompleted: boolean;
}

/**
 * Computes 30-Para progress combining:
 * 1) Automatic completion when a student moves past a recorded Para to a new Para, or completes page 20 of a Para
 * 2) Manual teacher ticks (hifz_completed_paras) and manual uncheck overrides (hifz_uncompleted_paras)
 */
export function computeHifzParaProgress(
  records: Array<{
    para_no?: number | string | null;
    page_from?: number | string | null;
    page_to?: number | string | null;
  }>,
  student?: Student | null
) {
  const latestWithPara = records.find(
    (r) => r.para_no != null && Number(r.para_no) >= 1 && Number(r.para_no) <= 30
  );
  const currentPara = latestWithPara ? Number(latestWithPara.para_no) : null;

  const extra = extractStudentExtraFields(student);
  const manualCompletedSet = new Set<number>(extra.hifz_completed_paras || []);
  const manualUncompletedSet = new Set<number>(extra.hifz_uncompleted_paras || []);

  const recordedParas = new Set<number>();
  const paraMaxPage: Record<number, number> = {};
  for (const rec of records) {
    const p = Number(rec.para_no);
    if (p >= 1 && p <= 30) {
      recordedParas.add(p);
      const pg = Math.max(Number(rec.page_to || 0), Number(rec.page_from || 0));
      if (pg > (paraMaxPage[p] || 0)) {
        paraMaxPage[p] = pg;
      }
    }
  }

  const paras: HifzParaProgressItem[] = Array.from({ length: 30 }, (_, idx) => {
    const paraNo = idx + 1;
    const maxPage = paraMaxPage[paraNo] || 0;
    const isManualCompleted = manualCompletedSet.has(paraNo);
    const isManualUncompleted = manualUncompletedSet.has(paraNo);
    const isAutoCompleted =
      (recordedParas.has(paraNo) && currentPara !== null && paraNo !== currentPara) ||
      maxPage >= 20;

    let status: 'completed' | 'current' | 'remaining' = 'remaining';
    if (isManualCompleted || (isAutoCompleted && !isManualUncompleted)) {
      status = 'completed';
    } else if (currentPara !== null && paraNo === currentPara) {
      status = 'current';
    }

    return {
      paraNo,
      status,
      maxPage,
      isAutoCompleted,
      isManualCompleted,
    };
  });

  const completedParasCount = paras.filter((p) => p.status === 'completed').length;
  return {
    paras,
    currentPara,
    completedParasCount,
    currentParaPage: currentPara ? paraMaxPage[currentPara] || 0 : 0,
  };
}
