import { FeeCategory, FeeCategoryFrequency, FeeStructure } from '../types';

export const DEFAULT_FEE_CATEGORIES: FeeCategory[] = [
  {
    id: 'monthly_tuition',
    name: 'মাসিক বেতন',
    frequency: 'monthly',
    is_default: true,
    description: 'প্রতি মাসের নিয়মিত বেতন ও টিউশন ফি',
    color: 'blue'
  },
  {
    id: 'admission_fee',
    name: 'ভর্তি ফি',
    frequency: 'one_time',
    is_default: true,
    description: 'নতুন শিক্ষার্থী ভর্তিকালীন এককালীন ফি',
    color: 'emerald'
  },
  {
    id: 'exam_fee',
    name: 'পরীক্ষার ফি',
    frequency: 'exam',
    is_default: true,
    description: 'সাময়িক ও বার্ষিক পরীক্ষার ফি',
    color: 'purple'
  },
  {
    id: 'session_fee',
    name: 'সেশন ফি',
    frequency: 'annual',
    is_default: true,
    description: 'বার্ষিক সেশন চার্জ ও প্রতিষ্ঠান নবায়ন ফি',
    color: 'amber'
  },
  {
    id: 'other_fee',
    name: 'অন্যান্য ফি',
    frequency: 'custom',
    is_default: true,
    description: 'অনুষঙ্গিক, কোচিং বা বিশেষ ফি',
    color: 'slate'
  }
];

export const FREQUENCY_LABELS: Record<FeeCategoryFrequency, { bn: string; en: string; badgeBn: string }> = {
  monthly: {
    bn: 'মাসিক বেতন (প্রতি মাসে প্রদেয়)',
    en: 'Monthly Tuition (Recurring)',
    badgeBn: 'মাসিক বেতন'
  },
  one_time: {
    bn: 'এককালীন ফি (যেমন: ভর্তি ফি)',
    en: 'One-Time (e.g. Admission)',
    badgeBn: 'এককালীন ভর্তি'
  },
  annual: {
    bn: 'বার্ষিক ফি (যেমন: সেশন ফি)',
    en: 'Annual (e.g. Session)',
    badgeBn: 'বার্ষিক সেশন'
  },
  exam: {
    bn: 'পরীক্ষাকালীন ফি (টার্ম ফি)',
    en: 'Exam Term Fee',
    badgeBn: 'পরীক্ষার ফি'
  },
  custom: {
    bn: 'কাস্টম / প্রয়োজনমাফিক',
    en: 'Custom / As Needed',
    badgeBn: 'কাস্টম ফি'
  }
};

/**
 * Get configured fee categories for institution, falling back to defaults
 */
export function getInstitutionFeeCategories(madrasah: any): FeeCategory[] {
  if (!madrasah) return [...DEFAULT_FEE_CATEGORIES];

  let config = madrasah.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }

  const customCategories: FeeCategory[] = config?.fee_categories || [];

  // Ensure all default categories exist, append any user-defined categories
  const categoryMap = new Map<string, FeeCategory>();
  DEFAULT_FEE_CATEGORIES.forEach(cat => categoryMap.set(cat.id, { ...cat }));
  customCategories.forEach(cat => categoryMap.set(cat.id, { ...cat }));

  return Array.from(categoryMap.values());
}

/**
 * Get the category mapped to a fee structure
 */
export function getCategoryForStructure(
  structure: Partial<FeeStructure> | any,
  categories: FeeCategory[],
  madrasah?: any
): FeeCategory {
  let config = madrasah?.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }

  const structureCategories = config?.fee_structure_categories || {};
  const mappedCategoryId = structure?.category_id || (structure?.id ? structureCategories[structure.id] : null);

  if (mappedCategoryId) {
    const found = categories.find(c => c.id === mappedCategoryId);
    if (found) return found;
  }

  // Fallback to name-based suggestion
  return suggestCategoryForFeeName(structure?.fee_name || '', categories);
}

/**
 * Smart matcher: guesses the right category from arbitrary Bengali or English fee names
 */
export function suggestCategoryForFeeName(feeName: string, categories: FeeCategory[]): FeeCategory {
  const norm = (feeName || '').trim().toLowerCase();

  // 1. Check direct name match
  const exact = categories.find(c => c.name.toLowerCase() === norm);
  if (exact) return exact;

  // 2. Monthly Tuition / Salary patterns
  if (
    norm.includes('বেতন') ||
    norm.includes('টিউশন') ||
    norm.includes('মাসিক') ||
    norm.includes('monthly') ||
    norm.includes('tuition') ||
    norm.includes('খোরাকি') ||
    norm.includes('খাওয়া')
  ) {
    return categories.find(c => c.id === 'monthly_tuition') || categories[0];
  }

  // 3. Admission patterns
  if (
    norm.includes('ভর্তি') ||
    norm.includes('এডমিশন') ||
    norm.includes('admission') ||
    norm.includes('ফরম') ||
    norm.includes('রেজিস্ট্রেশন') ||
    norm.includes('registration')
  ) {
    return categories.find(c => c.id === 'admission_fee') || categories[1] || categories[0];
  }

  // 4. Exam patterns
  if (
    norm.includes('পরীক্ষা') ||
    norm.includes('exam') ||
    norm.includes('অর্ধবার্ষিক') ||
    norm.includes('বার্ষিক পরীক্ষা') ||
    norm.includes('টেস্ট') ||
    norm.includes('নম্বরপত্র')
  ) {
    return categories.find(c => c.id === 'exam_fee') || categories[2] || categories[0];
  }

  // 5. Session patterns
  if (
    norm.includes('সেশন') ||
    norm.includes('session') ||
    norm.includes('উন্নয়ন') ||
    norm.includes('নবায়ন') ||
    norm.includes('বিদ্যুৎ')
  ) {
    return categories.find(c => c.id === 'session_fee') || categories[3] || categories[0];
  }

  // 6. Default fallback
  return categories.find(c => c.id === 'other_fee') || categories[categories.length - 1] || DEFAULT_FEE_CATEGORIES[4];
}

/**
 * Save updated fee categories into institution config_json
 */
export async function saveInstitutionFeeCategories(
  supabase: any,
  madrasah: any,
  categories: FeeCategory[]
): Promise<any> {
  let config = madrasah.config_json || {};
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }

  const updatedConfig = {
    ...config,
    fee_categories: categories
  };

  const { error } = await supabase
    .from('institutions')
    .update({ config_json: updatedConfig })
    .eq('id', madrasah.id);

  if (error) throw error;
  return updatedConfig;
}

/**
 * Batch assign categories to multiple fee structures and save mapping
 */
export async function batchSaveFeeStructureCategories(
  supabase: any,
  madrasah: any,
  mapping: Record<string, string> // { [structureId]: categoryId }
): Promise<any> {
  let config = madrasah.config_json || {};
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }

  const existingMap = config.fee_structure_categories || {};
  const updatedMap = {
    ...existingMap,
    ...mapping
  };

  const updatedConfig = {
    ...config,
    fee_structure_categories: updatedMap
  };

  // 1. Update institution config_json (guaranteed persistence)
  const { error } = await supabase
    .from('institutions')
    .update({ config_json: updatedConfig })
    .eq('id', madrasah.id);

  if (error) throw error;

  // 2. Also try updating fee_structures table directly if category_id column exists
  try {
    for (const [structureId, categoryId] of Object.entries(mapping)) {
      await supabase
        .from('fee_structures')
        .update({ category_id: categoryId })
        .eq('id', structureId);
    }
  } catch (err) {
    // Graceful fallback if column does not exist
    console.warn('Direct fee_structures category_id update skipped or failed:', err);
  }

  return updatedConfig;
}

export const MONTH_DEFINITIONS = [
  { value: '01', nameBn: 'জানুয়ারি', nameEn: 'January' },
  { value: '02', nameBn: 'ফেব্রুয়ারি', nameEn: 'February' },
  { value: '03', nameBn: 'মার্চ', nameEn: 'March' },
  { value: '04', nameBn: 'এপ্রিল', nameEn: 'April' },
  { value: '05', nameBn: 'মে', nameEn: 'May' },
  { value: '06', nameBn: 'জুন', nameEn: 'June' },
  { value: '07', nameBn: 'জুলাই', nameEn: 'July' },
  { value: '08', nameBn: 'আগস্ট', nameEn: 'August' },
  { value: '09', nameBn: 'সেপ্টেম্বর', nameEn: 'September' },
  { value: '10', nameBn: 'অক্টোবর', nameEn: 'October' },
  { value: '11', nameBn: 'নভেম্বর', nameEn: 'November' },
  { value: '12', nameBn: 'ডিসেম্বর', nameEn: 'December' }
];

export function formatMonthLabel(yearMonthStr: string, lang: 'bn' | 'en' = 'bn'): string {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return yearMonthStr || '';
  const [year, month] = yearMonthStr.split('-');
  const found = MONTH_DEFINITIONS.find(m => m.value === month);
  if (!found) return yearMonthStr;

  const monthName = lang === 'bn' ? found.nameBn : found.nameEn;
  const yearText = lang === 'bn' ? year.replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]) : year;
  return `${monthName} ${yearText}`;
}

export function getLastDayOfMonth(yearMonthStr: string): string {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return '';
  const [yearStr, monthStr] = yearMonthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonthStr}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Save exam months for a fee structure in institution config_json
 */
export async function saveStructureExamMonths(
  supabase: any,
  madrasah: any,
  structureId: string,
  months: string[]
): Promise<any> {
  if (!madrasah?.id || !structureId) return;

  let config = madrasah.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }

  const existingExamMonths = config?.fee_structure_exam_months || {};
  const updatedExamMonths = {
    ...existingExamMonths,
    [structureId]: months
  };

  const updatedConfig = {
    ...config,
    fee_structure_exam_months: updatedExamMonths
  };

  // Mutate in-memory madrasah.config_json so React components reading madrasah.config_json immediately get the updated values
  if (madrasah) {
    madrasah.config_json = updatedConfig;
  }

  // Update institution config_json
  const { error } = await supabase
    .from('institutions')
    .update({ config_json: updatedConfig })
    .eq('id', madrasah.id);

  if (error) {
    console.warn('Failed to save exam months in config_json:', error);
  }

  return updatedConfig;
}

/**
 * Get configured exam months for a structure
 */
export function getStructureExamMonths(structureId: string, madrasah: any): string[] {
  if (!structureId || !madrasah) return [];
  let config = madrasah.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
      madrasah.config_json = config;
    } catch {
      config = {};
    }
  }
  return config?.fee_structure_exam_months?.[structureId] || [];
}

/**
 * Check if a fee structure applies to a given month (e.g. '2025-04')
 */
export function isStructureApplicableForMonth(
  structure: any,
  monthStr: string,
  madrasah?: any
): boolean {
  if (!structure || !monthStr) return true;

  // 1. Check if it's configured with specific exam months in config_json
  let config = madrasah?.config_json;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      config = {};
    }
  }

  const examMonthsMap = config?.fee_structure_exam_months || {};
  const examMonths = examMonthsMap[structure.id];
  if (Array.isArray(examMonths) && examMonths.length > 0) {
    const monthPart = monthStr.includes('-') ? monthStr.split('-')[1] : monthStr;
    const isMatched = examMonths.includes(monthPart) || examMonths.includes(monthStr);
    if (!isMatched) return false;
  }

  // 2. Check start_date
  if (structure.start_date) {
    const startMonth = structure.start_date.slice(0, 7);
    if (monthStr < startMonth) return false;
  }

  // 3. Check due_date
  if (structure.due_date) {
    const dueMonth = structure.due_date.slice(0, 7);
    if (monthStr > dueMonth) return false;
  }

  return true;
}
