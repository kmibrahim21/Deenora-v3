/**
 * Deenora Intelligent Pedagogical Remarks & Progress Evaluation Engine
 * 
 * Automatically analyzes student score distributions, subject proficiencies, 
 * attendance consistency, and moral character (Adab / Deeniyat) to produce 
 * context-sensitive, human-sounding remarks in Bengali and English for 
 * both School and Madrasah institutions.
 */

export type RemarkTone = 'nurturing' | 'academic' | 'deeniyat';

export interface StudentAcademicProfile {
  student_id: string;
  student_name: string;
  roll?: string | number;
  class_name?: string;
  total_marks?: number;
  max_marks?: number;
  percentage?: number;
  gpa?: string | number;
  grade?: string;
  rank?: string | number;
  attendance_rate?: number; // e.g. 92 (meaning 92%)
  total_present_days?: number;
  total_working_days?: number;
  institution_type?: 'school' | 'madrasah' | 'kindergarten' | 'college' | 'choching' | 'qawmi' | string;
  subjects?: Array<{
    subject_name: string;
    marks_obtained: number;
    full_marks?: number;
    grade?: string;
  }>;
  conduct_rating?: 'excellent' | 'good' | 'average'; // Adab / Akhlaq
}

export interface GeneratedSmartRemark {
  student_id: string;
  student_name: string;
  achievement_band: 'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'maqbool' | 'rasib';
  overall_assessment_bn: string;
  overall_assessment_en: string;
  strengths_bn: string[];
  strengths_en: string[];
  growth_areas_bn: string[];
  growth_areas_en: string[];
  conduct_bn: string;
  conduct_en: string;
  parent_tip_bn: string;
  parent_tip_en: string;
  full_remark_bn: string;
  full_remark_en: string;
}

// Bengali subject name normalizer for natural phrasing
const banglaSubjectMap: Record<string, string> = {
  bangla: 'বাংলা',
  bengali: 'বাংলা',
  english: 'ইংরেজি',
  math: 'গণিত',
  mathematics: 'গণিত',
  quran: 'আল-কুরআন',
  quran_mazid: 'কুরআন মাজিদ',
  hadith: 'হাদিস শরিফ',
  fiqh: 'ফিকহ',
  arabic: 'আরবি',
  arabic_1st: 'আরবি ১ম পত্র',
  arabic_2nd: 'আরবি ২য় পত্র',
  science: 'সাধারণ বিজ্ঞান',
  general_science: 'বিজ্ঞান',
  islamic_studies: 'ইসলাম শিক্ষা',
  social_science: 'সমাজ বিজ্ঞান',
  bgs: 'বাংলাদেশ ও বিশ্বপরিচয়',
  ict: 'আইসিটি',
  tajweed: 'তাজবীদ',
  hifz: 'হিফজুল কুরআন',
  nazera: 'নাজেরা',
  nahu: 'ইলমুন নাহু',
  sarf: 'ইলমুস সরফ',
  akayed: 'আকাইদ ও ফিকহ',
  tarikh: 'ইসলামের ইতিহাস',
  drawing: 'অঙ্কন'
};

function formatSubjectName(subName: string, isBn: boolean): string {
  if (!subName) return '';
  const cleanKey = subName.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (isBn) {
    return banglaSubjectMap[cleanKey] || subName;
  }
  return subName;
}

/**
 * Classify overall academic achievement band
 */
export function classifyAchievementBand(
  gpa: number, 
  percentage: number, 
  grade?: string
): 'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'maqbool' | 'rasib' {
  if (grade === 'F' || (gpa === 0 && percentage < 33)) {
    return 'rasib';
  }
  if (gpa >= 4.8 || percentage >= 80 || grade === 'A+') {
    return 'mumtaz';
  }
  if (gpa >= 4.0 || percentage >= 70 || grade === 'A') {
    return 'jayyid_jiddan';
  }
  if (gpa >= 3.25 || percentage >= 60 || grade === 'A-' || grade === 'B+') {
    return 'jayyid';
  }
  return 'maqbool';
}

/**
 * Generate individualized smart remarks for a student
 */
export function generateStudentRemark(
  profile: StudentAcademicProfile,
  tone: RemarkTone = 'nurturing',
  overrideInstType?: string
): GeneratedSmartRemark {
  const instType = (overrideInstType || profile.institution_type || 'madrasah').toLowerCase();
  const isSchool = instType === 'school' || instType === 'kindergarten' || instType === 'choching' || instType === 'college';

  const gpaNum = typeof profile.gpa === 'number' ? profile.gpa : parseFloat(String(profile.gpa || 0)) || 0;
  const percentage = profile.percentage ?? (profile.total_marks && profile.max_marks ? Math.round((profile.total_marks / profile.max_marks) * 100) : (gpaNum / 5) * 100);
  const band = classifyAchievementBand(gpaNum, percentage, profile.grade);

  // Analyze subject proficiencies
  const subjects = profile.subjects || [];
  const sortedSubs = [...subjects].sort((a, b) => {
    const aPct = a.full_marks ? (a.marks_obtained / a.full_marks) * 100 : a.marks_obtained;
    const bPct = b.full_marks ? (b.marks_obtained / b.full_marks) * 100 : b.marks_obtained;
    return bPct - aPct;
  });

  const strongSubjects = sortedSubs.filter(s => {
    const pct = s.full_marks ? (s.marks_obtained / s.full_marks) * 100 : s.marks_obtained;
    return pct >= 70 && s.grade !== 'F';
  });

  const weakSubjects = sortedSubs.filter(s => {
    const pct = s.full_marks ? (s.marks_obtained / s.full_marks) * 100 : s.marks_obtained;
    return pct < 50 || s.grade === 'F';
  });

  // Strengths formatting
  const topTwoStrongBn = strongSubjects.slice(0, 2).map(s => formatSubjectName(s.subject_name, true));
  const topTwoStrongEn = strongSubjects.slice(0, 2).map(s => formatSubjectName(s.subject_name, false));

  // Growth areas formatting
  const topTwoWeakBn = weakSubjects.slice(0, 2).map(s => formatSubjectName(s.subject_name, true));
  const topTwoWeakEn = weakSubjects.slice(0, 2).map(s => formatSubjectName(s.subject_name, false));

  // Attendance feedback
  const attRate = profile.attendance_rate ?? (profile.total_present_days && profile.total_working_days ? Math.round((profile.total_present_days / profile.total_working_days) * 100) : 85);
  const isHighAttendance = attRate >= 90;
  const isLowAttendance = attRate < 75;

  // Conduct
  const conduct = profile.conduct_rating || (band === 'mumtaz' || band === 'jayyid_jiddan' ? 'excellent' : 'good');

  let overall_bn = '';
  let overall_en = '';
  let conduct_bn = '';
  let conduct_en = '';
  let parent_tip_bn = '';
  let parent_tip_en = '';

  if (isSchool) {
    // School / Academic Account Phrases
    switch (band) {
      case 'mumtaz':
        overall_bn = 'অভিনন্দন! অনবদ্য মেধা ও অর্জিত ফলাফলের স্বাক্ষর রেখেছে। পাঠ্যবিষয়গুলোর মূল ধারণায় সুদৃঢ় অবস্থান রয়েছে।';
        overall_en = 'Congratulations! Demonstrates outstanding academic excellence and strong conceptual mastery.';
        break;
      case 'jayyid_jiddan':
        overall_bn = 'খুবই চমৎকার ফলাফল। শ্রেণিকক্ষে অত্যন্ত নিয়মিত ও পড়ার বিষয়ে মনোযোগী। সামান্য চর্চায় আরও ভালো করা সম্ভব।';
        overall_en = 'Very commendable performance. Attentive in class with great potential for top rankings.';
        break;
      case 'jayyid':
        overall_bn = 'সন্তোষজনক অগ্রগতি। বিষয়ভিত্তিক দুর্বলতা কাটিয়ে উঠতে নিয়মিত রুটিন মেনে অধ্যবসায় প্রয়োজন।';
        overall_en = 'Satisfactory progress. Regular practice in lagging subjects will yield even better marks.';
        break;
      case 'maqbool':
        overall_bn = 'শিক্ষার্থীর মেধা রয়েছে, তবে পরীক্ষায় কাঙ্ক্ষিত ফলাফলের জন্য দৈনন্দিন পাঠ প্রস্তুতিতে বাড়তি সময় দিতে হবে।';
        overall_en = 'Capable student who requires structured study time and daily homework review.';
        break;
      case 'rasib':
        overall_bn = 'বিশেষ যত্ন ও নিবিড় পরিচর্যা প্রয়োজন। নিয়মিত ক্লাসে উপস্থিতি এবং বিষয়াভিত্তিক শিক্ষকের সহায়তা আবশ্যক।';
        overall_en = 'Requires focused academic attention, regular class attendance, and active parental guidance.';
        break;
    }
  } else {
    // Madrasah / Islamic Account Phrases
    if (tone === 'deeniyat') {
      switch (band) {
        case 'mumtaz':
          overall_bn = 'মাশাআল্লাহ, কুরআন ও প্রাতিষ্ঠানিক সকল বিষয়ে অত্যন্ত প্রশংসনীয় নৈপুণ্য অর্জন করেছে।';
          overall_en = 'MashaAllah, exhibited exceptional diligence and outstanding academic and moral merit.';
          break;
        case 'jayyid_jiddan':
          overall_bn = 'আলহামদুলিল্লাহ, মেধা ও দ্বীনি শৃঙ্খলায় শিক্ষার্থী অত্যন্ত সম্ভাবনাময় অগ্রগতির স্বাক্ষর রেখেছে।';
          overall_en = 'Alhamdulillah, demonstrates remarkable dedication with consistent academic and character progress.';
          break;
        case 'jayyid':
          overall_bn = 'সন্তোষজনক অগ্রগতি। নিয়মিত মুতালায়া (পড়াশোনা) ও অধ্যবসায়ে আরও উন্নতির সুযোগ রয়েছে।';
          overall_en = 'Satisfactory progress. Continuous revision and focused self-study will elevate the rank.';
          break;
        case 'maqbool':
          overall_bn = 'দৈনন্দিন পড়ালেখায় আরও নিষ্ঠাবান হওয়া প্রয়োজন। নিয়মিত উপস্থিত থাকলে কাঙ্ক্ষিত ফল সম্ভব।';
          overall_en = 'Shows potential but requires steady dedication, punctual attendance, and consistent practice.';
          break;
        case 'rasib':
          overall_bn = 'বিশেষ যত্ন ও পুনর্বিবেচনা প্রয়োজন। পাঠে একাগ্রতা বাড়ানো এবং নিয়মিত ক্লাসে অংশগ্রহণ জরুরি।';
          overall_en = 'Requires intensive academic intervention, regular attendance, and close parental supervision.';
          break;
      }
    } else {
      switch (band) {
        case 'mumtaz':
          overall_bn = 'মাশাআল্লাহ, অসাধারণ মেধা ও নিষ্ঠার পরিচয় দিয়েছে। আমরা তার ধারাবাহিক সাফল্যে গর্বিত।';
          overall_en = 'Outstanding dedication and exemplary performance. Truly a model student.';
          break;
        case 'jayyid_jiddan':
          overall_bn = 'খুবই চমৎকার অগ্রগতি। ক্লাসে সক্রিয় অংশগ্রহণ ও আগ্রহ প্রশংসার দাবিদার।';
          overall_en = 'Very good progress with enthusiastic classroom engagement and steady growth.';
          break;
        case 'jayyid':
          overall_bn = 'সন্তোষজনক ফলাফল। আরেকটু অধ্যবসায় ও আত্মবিশ্বাস থাকলে আরও অনেক দূর এগিয়ে যাবে।';
          overall_en = 'Good, steady performance. With focused practice and confidence, greater heights are within reach.';
          break;
        case 'maqbool':
          overall_bn = 'চেষ্টা অব্যাহত রাখতে হবে। নিয়মিত ক্লাসের পড়া শেষ করা এবং শিক্ষকের নির্দেশনা মানা জরুরি।';
          overall_en = 'Shows promise. Consistent daily study habits and prompt homework submission are recommended.';
          break;
        case 'rasib':
          overall_bn = 'হতাশ না হয়ে নতুন উদ্যমে শুরু করতে হবে। আমরা প্রতিষ্ঠান থেকে সর্বোচ্চ সহযোগিতা দিতে প্রস্তুত।';
          overall_en = 'Encouraged to stay determined. With personalized teacher support and home care, improvement is assured.';
          break;
      }
    }
  }

  // Conduct assessment
  if (isSchool) {
    if (conduct === 'excellent') {
      conduct_bn = 'বিনয়ী, ভদ্র ও শ্রেণিশিক্ষকদের প্রতি অত্যন্ত শ্রদ্ধাশীল আচরণ প্রদর্শন করেছে।';
      conduct_en = 'Exhibits excellent discipline, politeness, and respect towards teachers.';
    } else if (conduct === 'good') {
      conduct_bn = 'শ্রেণিকক্ষে দায়িত্বশীল ও সহপাঠীদের সাথে সৌহার্দ্যপূর্ণ আচরণ করেছে।';
      conduct_en = 'Demonstrates positive classroom conduct and friendly peer cooperation.';
    } else {
      conduct_bn = 'শ্রেণিকক্ষের শৃঙ্খলা ও মনোযোগে কিছুটা সচেতনতা বৃদ্ধি কাম্য।';
      conduct_en = 'Greater focus on classroom attentiveness and discipline is recommended.';
    }
  } else {
    if (conduct === 'excellent') {
      conduct_bn = 'বিনয়ী, ভদ্র ও নিয়মানুবর্তী আচার-আচরণ প্রদর্শন করেছে।';
      conduct_en = 'Exhibits polite manners, discipline, and respectful conduct.';
    } else if (conduct === 'good') {
      conduct_bn = 'শ্রেণিকক্ষে দায়িত্বশীল ও শিক্ষকদের প্রতি শ্রদ্ধাশীল।';
      conduct_en = 'Demonstrates positive behavior and cooperation with peers and teachers.';
    } else {
      conduct_bn = 'শ্রেণিকক্ষের শৃঙ্খলা ও মনসংযোগে কিছুটা উন্নতির সুযোগ রয়েছে।';
      conduct_en = 'Further attention to classroom discipline and focus is encouraged.';
    }
  }

  // Parent guidance tip
  if (weakSubjects.length > 0) {
    const weakListBn = topTwoWeakBn.join(' ও ');
    const weakListEn = topTwoWeakEn.join(' and ');
    parent_tip_bn = `বাড়িতে বিশেষত ${weakListBn} বিষয়ে নিয়মিত রিভিশন ও দৈনিক অন্তত ১ ঘণ্টা নিবিড় অধ্যয়নে সহায়তা করুন।`;
    parent_tip_en = `Please provide dedicated home study time for ${weakListEn} and review daily notebook entries.`;
  } else if (isLowAttendance) {
    parent_tip_bn = 'বিনা কারণে ক্লাসে অনুপস্থিতি পরিহার করুন; নিয়মিত শ্রেণিকক্ষে উপস্থিত থাকলে ফল আরও ভালো হবে।';
    parent_tip_en = 'Ensure punctual daily attendance as consistent attendance directly impacts academic performance.';
  } else {
    parent_tip_bn = 'শিক্ষার্থীর বর্তমান উৎসাহ ও পড়ার রুটিন বজায় রাখতে অভিভাবক হিসেবে অনুপ্রেরণা অব্যাহত রাখুন।';
    parent_tip_en = 'Continue encouraging the student’s daily study routine and positive learning habits at home.';
  }

  // Build composite full remark
  const partsBn: string[] = [overall_bn];
  if (topTwoStrongBn.length > 0) {
    partsBn.push(`${topTwoStrongBn.join(' ও ')} বিষয়ে চমৎকার নৈপুণ্য দেখিয়েছে।`);
  }
  if (topTwoWeakBn.length > 0) {
    partsBn.push(`তবে ${topTwoWeakBn.join(' ও ')} বিষয়ে আরও মনোযোগ দেওয়া প্রয়োজন।`);
  }
  if (isHighAttendance) {
    partsBn.push('শ্রেণিকক্ষে চমৎকার নিয়মিত উপস্থিতির জন্য ধন্যবাদ।');
  } else if (isLowAttendance) {
    partsBn.push('উপস্থিতির হার বাড়ানোর প্রতি লক্ষ্য রাখা আবশ্যক।');
  }
  partsBn.push(conduct_bn);

  const partsEn: string[] = [overall_en];
  if (topTwoStrongEn.length > 0) {
    partsEn.push(`Showed high proficiency in ${topTwoStrongEn.join(' and ')}.`);
  }
  if (topTwoWeakEn.length > 0) {
    partsEn.push(`Extra focus and practice needed in ${topTwoWeakEn.join(' and ')}.`);
  }
  partsEn.push(conduct_en);

  return {
    student_id: profile.student_id,
    student_name: profile.student_name,
    achievement_band: band,
    overall_assessment_bn: overall_bn,
    overall_assessment_en: overall_en,
    strengths_bn: topTwoStrongBn,
    strengths_en: topTwoStrongEn,
    growth_areas_bn: topTwoWeakBn,
    growth_areas_en: topTwoWeakEn,
    conduct_bn,
    conduct_en,
    parent_tip_bn,
    parent_tip_en,
    full_remark_bn: partsBn.join(' '),
    full_remark_en: partsEn.join(' ')
  };
}

/**
 * Batch generate remarks for an entire class of students
 */
export function generateClassRemarks(
  students: StudentAcademicProfile[],
  tone: RemarkTone = 'nurturing',
  overrideInstType?: string
): Record<string, GeneratedSmartRemark> {
  const result: Record<string, GeneratedSmartRemark> = {};
  students.forEach(st => {
    result[st.student_id] = generateStudentRemark(st, tone, overrideInstType);
  });
  return result;
}
