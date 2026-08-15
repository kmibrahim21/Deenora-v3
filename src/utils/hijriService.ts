import { getHijriDate } from './calendarUtils';

export interface HijriData {
  hijriDay: string;
  hijriMonthAr: string;
  hijriMonthEn: string;
  hijriYear: string;
  weekdayAr: string;
  weekdayEn: string;
  weekdayBn: string;
  gregorianDate: string;
  isFromApi: boolean;
}

const CACHE_KEY = 'aladhan_hijri_cache_v3';

const WEEKDAYS_AR: Record<string, string> = {
  'Sunday': 'الأحد',
  'Monday': 'الإثنين',
  'Tuesday': 'الثلاثاء',
  'Wednesday': 'الأربعاء',
  'Thursday': 'الخميس',
  'Friday': 'الجمعة',
  'Saturday': 'السبت'
};

const WEEKDAYS_BN: Record<string, string> = {
  'Sunday': 'রবিবার',
  'Monday': 'সোমবার',
  'Tuesday': 'মঙ্গলবার',
  'Wednesday': 'বুধবার',
  'Thursday': 'বৃহস্পতিবার',
  'Friday': 'শুক্রবার',
  'Saturday': 'শনিবার'
};

const HIJRI_MONTHS_BN: Record<number, string> = {
  1: 'মুহাররম',
  2: 'সফর',
  3: 'রবিউল আউয়াল',
  4: 'রবিউস সানি',
  5: 'জমাদিউল আউয়াল',
  6: 'জমাদিউস সানি',
  7: 'রজব',
  8: 'শাবান',
  9: 'রমজান',
  10: 'শাওয়াল',
  11: 'জিলকদ',
  12: 'জিলহজ'
};

export function getTodayDateStringDDMMYYYY(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getTodayDateStringYYYYMMDD(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

// Fallback logic using calendarUtils
export function getFallbackHijriData(date: Date = new Date()): HijriData {
  const adjustedDate = new Date(date);
  // Remove the -1 day adjustment to follow standard Hijri calendar
  const localHijri = getHijriDate(adjustedDate);
  const weekdayEn = date.toLocaleDateString('en-US', { weekday: 'long' });
  const weekdayBn = WEEKDAYS_BN[weekdayEn] || weekdayEn;
  const weekdayAr = WEEKDAYS_AR[weekdayEn] || '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return {
    hijriDay: localHijri.day || '01',
    hijriMonthAr: localHijri.month || 'Muharram',
    hijriMonthEn: localHijri.month || 'Muharram',
    hijriYear: localHijri.year || '1447',
    weekdayAr,
    weekdayEn,
    weekdayBn,
    gregorianDate: `${day}-${month}-${year}`,
    isFromApi: false
  };
}

export async function fetchHijriDateFromApi(date: Date = new Date()): Promise<HijriData> {
  const adjustedDate = new Date(date);
  // Remove the -1 day adjustment to follow standard Hijri calendar
  const dateStr = getTodayDateStringDDMMYYYY(adjustedDate);
  const url = `https://api.aladhan.com/v1/gToH/${dateStr}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AlAdhan API error: status ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== 200 || !json.data || !json.data.hijri) {
    throw new Error('AlAdhan API returned invalid or empty data');
  }

  const hijri = json.data.hijri;

  // Use the ORIGINAL date for the weekday calculation so the day of the week remains correct
  const weekdayEn = date.toLocaleDateString('en-US', { weekday: 'long' });
  const weekdayBn = WEEKDAYS_BN[weekdayEn] || weekdayEn;
  const weekdayAr = WEEKDAYS_AR[weekdayEn] || hijri.weekday?.ar || '';

  return {
    hijriDay: hijri.day,
    hijriMonthAr: hijri.month?.ar || '',
    hijriMonthEn: hijri.month?.en || '',
    hijriYear: hijri.year,
    weekdayAr,
    weekdayEn,
    weekdayBn,
    gregorianDate: getTodayDateStringDDMMYYYY(date),
    isFromApi: true
  };
}

export interface CachedHijri {
  cachedAt: string; // YYYY-MM-DD
  data: HijriData;
}

export function calculateAndSaveOffset(data: HijriData): number {
  if (!data || !data.hijriDay) return -1;
  try {
    const today = new Date();
    let foundOffset = -1; // Default fallback if no match
    
    // We try to find an offset between -5 and +5 that aligns our local calculation with the API day
    for (let offset = -5; offset <= 5; offset++) {
      const local = getHijriDate(today, offset);
      if (local && local.day === data.hijriDay) {
        foundOffset = offset;
        break;
      }
    }
    
    localStorage.setItem('hijri_offset_v3', foundOffset.toString());
    localStorage.removeItem('hijri_offset_v2'); // Clean up old key
    return foundOffset;
  } catch (e) {
    console.error('Error calculating Hijri offset:', e);
    return -1;
  }
}

export function loadCachedHijriData(): CachedHijri | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedHijri;
    if (parsed && parsed.data) {
      calculateAndSaveOffset(parsed.data);
    }
    return parsed;
  } catch (e) {
    console.error('Error loading Hijri cache:', e);
    return null;
  }
}

export function saveHijriDataToCache(data: HijriData): void {
  try {
    const cacheData: CachedHijri = {
      cachedAt: getTodayDateStringYYYYMMDD(),
      data
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    calculateAndSaveOffset(data);
  } catch (e) {
    console.error('Error saving Hijri cache:', e);
  }
}
