import { format, isSameDay } from 'date-fns';

export const BN_MONTHS = [
  { en: 'Boishakh', bn: 'বৈশাখ', days: 31 },
  { en: 'Jyaistha', bn: 'জ্যৈষ্ঠ', days: 31 },
  { en: 'Ashar', bn: 'আষাঢ়', days: 31 },
  { en: 'Srabon', bn: 'শ্রাবণ', days: 31 },
  { en: 'Bhadra', bn: 'ভাদ্র', days: 31 },
  { en: 'Ashwin', bn: 'আশ্বিন', days: 31 },
  { en: 'Kartik', bn: 'কার্তিক', days: 30 },
  { en: 'Agrahayan', bn: 'অগ্রহায়ণ', days: 30 },
  { en: 'Poush', bn: 'পৌষ', days: 30 },
  { en: 'Magh', bn: 'মাঘ', days: 30 },
  { en: 'Falgun', bn: 'ফাল্গুন', days: 30 }, // 31 in leap year
  { en: 'Chaitra', bn: 'চৈত্র', days: 30 }
];

export const isLeapYear = (year: number) => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

export const toBnDigit = (num: string | number) => 
  num.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[parseInt(d)]);

export const getBengaliDate = (date: Date, offset: number = 2) => {
  const adjustedDate = new Date(date);
  adjustedDate.setDate(date.getDate() + offset);

  const day = adjustedDate.getDate();
  const month = adjustedDate.getMonth();
  const year = adjustedDate.getFullYear();

  let bnYear = year - 593;
  if (month < 3 || (month === 3 && day < 14)) {
    bnYear = year - 594;
  }

  const boishakh1 = new Date(year, 3, 14);
  if (adjustedDate < boishakh1) {
    boishakh1.setFullYear(year - 1);
  }

  const diffTime = Math.abs(adjustedDate.getTime() - boishakh1.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let remainingDays = diffDays;
  let bnMonthIdx = 0;
  
  for (let i = 0; i < 12; i++) {
    let daysInMonth = BN_MONTHS[i].days;
    if (i === 10 && isLeapYear(boishakh1.getFullYear() + 1)) {
      daysInMonth = 31;
    }
    
    if (remainingDays < daysInMonth) {
      bnMonthIdx = i;
      break;
    }
    remainingDays -= daysInMonth;
    bnMonthIdx = (i + 1) % 12;
  }

  const bnDay = remainingDays + 1;

  return {
    day: bnDay,
    dayBn: toBnDigit(bnDay),
    month: BN_MONTHS[bnMonthIdx],
    year: bnYear,
    yearBn: toBnDigit(bnYear),
    monthIdx: bnMonthIdx,
    full: `${bnDay} ${BN_MONTHS[bnMonthIdx].bn} ${bnYear}`,
    fullBn: `${toBnDigit(bnDay)} ${BN_MONTHS[bnMonthIdx].bn} ${toBnDigit(bnYear)}`
  };
};

const HIJRI_MONTHS_BN = [
  'মুহাররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি', 
  'জমাদিউল আউয়াল', 'জমাদিউস সানি', 'রজব', 'শাবান', 
  'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ'
];

export const getHijriDate = (date: Date, offset: number = -1) => {
  try {
    const adjustedDate = new Date(date);
    adjustedDate.setDate(date.getDate() + offset);

    // Use numeric month to get index (1-12)
    const enFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-civil', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    
    const monthFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-civil', {
      month: 'long'
    });

    const partsEn = enFormatter.formatToParts(adjustedDate);
    const day = partsEn.find(p => p.type === 'day')?.value || '';
    const monthNum = parseInt(partsEn.find(p => p.type === 'month')?.value || '1');
    const year = partsEn.find(p => p.type === 'year')?.value || '';
    
    const monthEn = monthFormatter.format(adjustedDate);
    const monthBn = HIJRI_MONTHS_BN[monthNum - 1] || monthEn;
    
    const dayBn = toBnDigit(day);
    const yearBn = toBnDigit(year);

    return {
      day,
      dayBn,
      month: monthEn,
      monthBn,
      year,
      yearBn,
      full: `${day} ${monthEn} ${year}`,
      fullBn: `${dayBn} ${monthBn} ${yearBn}`
    };
  } catch (e) {
    console.error('Hijri calculation error:', e);
    return {
      day: '', dayBn: '', month: '', monthBn: '', year: '', yearBn: '',
      full: 'Error', fullBn: 'তারিখ পাওয়া যায়নি'
    };
  }
};

// Predefined Islamic Holidays (Approximate for 2026)
export const ISLAMIC_HOLIDAYS = [
  { date: '2026-02-18', title: 'Ramadan Starts', type: 'islamic' },
  { date: '2026-03-20', title: 'Eid-ul-Fitr', type: 'islamic' },
  { date: '2026-05-27', title: 'Eid-ul-Adha', type: 'islamic' },
  { date: '2026-07-26', title: 'Ashura', type: 'islamic' },
  { date: '2026-02-03', title: 'Shab-e-Barat', type: 'islamic' },
  { date: '2026-08-25', title: 'Milad-un-Nabi', type: 'islamic' },
];

export const getEventsForDate = (date: Date, customEvents: any[] = []) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  const holidays = ISLAMIC_HOLIDAYS.filter(h => h.date === dateStr);
  
  const events = customEvents.filter(e => {
    if (!e.event_date) return false;
    // If it's already yyyy-MM-dd string
    if (e.event_date === dateStr) return true;
    // If it's a full ISO string, extract the date part
    try {
      const eDate = new Date(e.event_date);
      return format(eDate, 'yyyy-MM-dd') === dateStr;
    } catch (err) {
      return false;
    }
  });
  
  return [...holidays, ...events];
};
