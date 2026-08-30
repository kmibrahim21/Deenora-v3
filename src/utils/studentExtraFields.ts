import { Student } from 'types';

export interface StudentExtraFields {
  gender?: string | null;
  nationality?: string | null;
  religion?: string | null;
  father_name?: string | null;
  father_occupation?: string | null;
  mother_occupation?: string | null;
  guardian_relation?: string | null;
  permanent_address?: string | null;
  previous_institution?: string | null;
  previous_class?: string | null;
  biometric_id?: string | null;
}

const ADM_TAG_PREFIX = '[ADM_EXTRA:';
const ADM_TAG_SUFFIX = ']';

/**
 * Extracts extra admission fields from either direct properties or from the packed notes tag
 */
export function extractStudentExtraFields(student?: Student | null): StudentExtraFields {
  if (!student) return {};

  let parsedFromNotes: StudentExtraFields = {};
  if (student.notes && student.notes.includes(ADM_TAG_PREFIX)) {
    try {
      const startIndex = student.notes.indexOf(ADM_TAG_PREFIX);
      const endIndex = student.notes.indexOf(ADM_TAG_SUFFIX, startIndex);
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = student.notes.substring(startIndex + ADM_TAG_PREFIX.length, endIndex);
        parsedFromNotes = JSON.parse(jsonStr);
      }
    } catch (e) {
      console.warn('Failed to parse extra fields from notes:', e);
    }
  }

  return {
    gender: (student.gender ?? parsedFromNotes.gender) || '',
    nationality: (student.nationality ?? parsedFromNotes.nationality) || '',
    religion: (student.religion ?? parsedFromNotes.religion) || '',
    father_name: (student.father_name ?? parsedFromNotes.father_name) || '',
    father_occupation: (student.father_occupation ?? parsedFromNotes.father_occupation) || '',
    mother_occupation: (student.mother_occupation ?? parsedFromNotes.mother_occupation) || '',
    guardian_relation: (student.guardian_relation ?? parsedFromNotes.guardian_relation) || '',
    permanent_address: (student.permanent_address ?? parsedFromNotes.permanent_address) || '',
    previous_institution: (student.previous_institution ?? parsedFromNotes.previous_institution) || '',
    previous_class: (student.previous_class ?? parsedFromNotes.previous_class) || '',
    biometric_id: (student.biometric_id ?? parsedFromNotes.biometric_id) || '',
  };
}

/**
 * Embeds extra fields into the notes string while preserving existing notes and other tags like [ACC_START:...]
 */
export function packStudentNotesWithExtra(currentNotes: string | undefined | null, extra: StudentExtraFields): string {
  let cleanNotes = currentNotes || '';
  // Remove existing ADM_EXTRA tag if present
  const regex = /\[ADM_EXTRA:.*?\]/g;
  cleanNotes = cleanNotes.replace(regex, '').trim();

  // Check if there are any non-empty extra fields
  const cleanExtra: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
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
  return notes
    .replace(/\[ADM_EXTRA:.*?\]/g, '')
    .replace(/\[ACC_START:.*?\]/g, '')
    .trim();
}
