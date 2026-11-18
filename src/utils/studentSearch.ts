import { Student } from 'types';

const BENGALI_TO_ENGLISH_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

export function bengaliDigitsToEnglish(str: string): string {
  return str.replace(/[০-৯]/g, (m) => BENGALI_TO_ENGLISH_DIGITS[m] || m);
}

export function normalizeStudentSearchText(text?: string | null): string {
  if (!text) return '';
  return String(text)
    .normalize('NFC')
    .replace(/[\u200B\uFEFF]/g, '')
    .replace(/[:ঃ.,\-_/()'\"।]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function toLooseBengaliSearchText(text: string): string {
  return text
    .replace(/ী/g, 'ি')
    .replace(/ূ/g, 'ু')
    .replace(/ড়/g, 'র')
    .replace(/ঢ়/g, 'র')
    .replace(/য়/g, 'য')
    .replace(/ঁ/g, '');
}

export interface ParsedStudentSearch {
  strictQuery: string;
  looseQuery: string;
  tokens: string[];
  looseTokens: string[];
  primaryServerToken: string;
  rollNum: number | null;
}

export function parseStudentSearchQuery(rawQuery: string): ParsedStudentSearch {
  const strictQuery = normalizeStudentSearchText(rawQuery);
  const looseQuery = toLooseBengaliSearchText(strictQuery);
  const tokens = strictQuery ? strictQuery.split(' ').filter(Boolean) : [];
  const looseTokens = tokens.map(toLooseBengaliSearchText).filter(Boolean);

  // Pick longest token for server-side ILIKE pre-filter so generic prefixes like "মো" don't crowd results
  const rawTokens = rawQuery
    .normalize('NFC')
    .replace(/[,()]/g, ' ')
    .replace(/[:ঃ.,\-_/()'\"।]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const primaryServerToken =
    rawTokens.length > 0
      ? [...rawTokens].sort((a, b) => b.length - a.length)[0]
      : '';

  const englishSearch = bengaliDigitsToEnglish(rawQuery.trim());
  const rollMatch = englishSearch.match(/^(?:roll|রোল|no|নং)?\s*[:#-]?\s*(\d+)$/i);
  const rollNum = rollMatch ? parseInt(rollMatch[1], 10) : null;

  return {
    strictQuery,
    looseQuery,
    tokens,
    looseTokens,
    primaryServerToken,
    rollNum,
  };
}

export function scoreStudentSearchMatch(
  student: Partial<Student>,
  rawQuery: string,
  parsed?: ParsedStudentSearch
): number {
  const p = parsed || parseStudentSearchQuery(rawQuery);
  if (!p.strictQuery && p.rollNum === null) return 0;

  const bnName = normalizeStudentSearchText(student.student_name);
  const enName = normalizeStudentSearchText(student.name_en);
  const combinedStrict = `${bnName} ${enName}`.trim();
  const combinedLoose = toLooseBengaliSearchText(combinedStrict);

  const bnWords = bnName ? bnName.split(' ') : [];
  const enWords = enName ? enName.split(' ') : [];
  const allWords = [...bnWords, ...enWords];
  const allLooseWords = allWords.map(toLooseBengaliSearchText);

  if (p.rollNum !== null && student.roll != null && Number(student.roll) === p.rollNum) {
    return 1;
  }

  if (p.tokens.length === 0) return -1;

  const strictMatchesAll = p.tokens.every((tok) => combinedStrict.includes(tok));
  if (strictMatchesAll) {
    if (bnName === p.strictQuery || enName === p.strictQuery) return 0;
    if (bnName.startsWith(p.strictQuery) || enName.startsWith(p.strictQuery)) return 2;
    if (p.tokens.length === 1 && allWords.some((w) => w.startsWith(p.tokens[0]))) return 3;
    if (p.tokens.every((tok) => allWords.some((w) => w.startsWith(tok)))) return 4;
    return 5;
  }

  const looseMatchesAll = p.looseTokens.every((tok) => combinedLoose.includes(tok));
  if (looseMatchesAll) {
    if (p.looseTokens.every((tok) => allLooseWords.some((w) => w.startsWith(tok)))) return 5;
    return 6;
  }

  return -1;
}

export function filterAndRankStudents<T extends Partial<Student>>(
  students: T[],
  rawQuery: string
): T[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return students;

  const parsed = parseStudentSearchQuery(trimmed);
  const scored: Array<{ student: T; score: number }> = [];

  for (const s of students) {
    const score = scoreStudentSearchMatch(s, trimmed, parsed);
    if (score >= 0) {
      scored.push({ student: s, score });
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const aActive = a.student.is_active !== false ? 0 : 1;
    const bActive = b.student.is_active !== false ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const rollA = a.student.roll != null ? Number(a.student.roll) : 999999;
    const rollB = b.student.roll != null ? Number(b.student.roll) : 999999;
    if (rollA !== rollB) return rollA - rollB;
    return (a.student.student_name || '').localeCompare(b.student.student_name || '', 'bn');
  });

  return scored.map((item) => item.student);
}
