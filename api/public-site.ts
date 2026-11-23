import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const supabase = getSupabaseAdmin();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTO_BYTES = 150 * 1024; // 150KB limit

function toEnDigits(str: string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str || '').replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
}

function parseConfigJson(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function sanitizeText(val: any, maxLen = 200): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function isSafePhotoUrl(url: string): boolean {
  if (!url) return true;
  if (url.startsWith('data:image/')) {
    return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function estimateByteSize(str: string): number {
  if (!str) return 0;
  if (str.startsWith('data:image/')) {
    const commaIdx = str.indexOf(',');
    const b64 = commaIdx !== -1 ? str.slice(commaIdx + 1) : str;
    return Math.ceil((b64.length * 3) / 4);
  }
  return Buffer.byteLength(str, 'utf8');
}

function isPublicWebsiteEnabled(inst: any): boolean {
  if (!inst) return false;
  const cfg = parseConfigJson(inst.config_json);
  return cfg?.modules?.public_website === true;
}

async function findActiveInstitution(codeOrId: string) {
  const clean = sanitizeText(codeOrId, 80);
  if (!clean) return null;
  const cleanLower = clean.toLowerCase();

  const safeCols =
    'id, name, address, phone, contact_email, logo_url, institution_type, is_active, status, config_json';

  // Reject SQL/PostgREST wildcard characters in slug/code lookups
  const hasWildcard = /[%_*\\]/.test(clean);

  // 1. Lookup by Super Admin custom slug inside config_json->public_site->>slug (case-insensitive exact match)
  if (!hasWildcard) {
    const { data: bySlug, error: slugErr } = await supabase
      .from('institutions')
      .select(`${safeCols}, institute_code`)
      .filter('config_json->public_site->>slug', 'ilike', cleanLower)
      .limit(1);

    if (!slugErr && bySlug && bySlug.length > 0) {
      const inst = bySlug[0];
      const storedSlug = String(parseConfigJson(inst.config_json)?.public_site?.slug || '').trim().toLowerCase();
      if (storedSlug === cleanLower) {
        return inst.is_active === false ? null : inst;
      }
    } else if (
      slugErr &&
      (slugErr.code === '42703' || slugErr.code === 'PGRST204' || /institute_code/i.test(slugErr.message || ''))
    ) {
      const { data: bySlugFallback } = await supabase
        .from('institutions')
        .select(safeCols)
        .filter('config_json->public_site->>slug', 'ilike', cleanLower)
        .limit(1);

      if (bySlugFallback && bySlugFallback.length > 0) {
        const inst = bySlugFallback[0];
        const storedSlug = String(parseConfigJson(inst.config_json)?.public_site?.slug || '').trim().toLowerCase();
        if (storedSlug === cleanLower) {
          return inst.is_active === false ? null : inst;
        }
      }
    }

    // 2. Lookup by top-level institute_code (case-insensitive exact match)
    const { data: byTopCode, error: topErr } = await supabase
      .from('institutions')
      .select(`${safeCols}, institute_code`)
      .ilike('institute_code', clean)
      .limit(1);

    if (!topErr && byTopCode && byTopCode.length > 0) {
      const inst = byTopCode[0];
      if (String(inst.institute_code || '').trim().toLowerCase() === cleanLower) {
        return inst.is_active === false ? null : inst;
      }
    }

    // 3. Lookup inside config_json->>institute_code (case-insensitive exact match)
    const { data: byJsonCode, error: jsonErr } = await supabase
      .from('institutions')
      .select(safeCols)
      .ilike('config_json->>institute_code', clean)
      .limit(1);

    if (!jsonErr && byJsonCode && byJsonCode.length > 0) {
      const inst = byJsonCode[0];
      const jsonCode = String(parseConfigJson(inst.config_json)?.institute_code || '').trim().toLowerCase();
      if (jsonCode === cleanLower) {
        return inst.is_active === false ? null : inst;
      }
    }
  }

  // 4. Direct fallback lookup by UUID
  if (UUID_REGEX.test(clean)) {
    const { data, error } = await supabase
      .from('institutions')
      .select(`${safeCols}, institute_code`)
      .eq('id', clean)
      .maybeSingle();

    if (!error && data) {
      return data.is_active === false ? null : data;
    }
    // Retry without top-level institute_code column if not present in schema
    if (error && (error.code === '42703' || error.code === 'PGRST204' || /institute_code/i.test(error.message || ''))) {
      const { data: fallback } = await supabase
        .from('institutions')
        .select(safeCols)
        .eq('id', clean)
        .maybeSingle();
      return fallback && fallback.is_active !== false ? fallback : null;
    }
    return null;
  }

  return null;
}

function buildPublicInstitution(inst: any) {
  const cfg = parseConfigJson(inst.config_json);
  const rawPublicSite = cfg?.public_site && typeof cfg.public_site === 'object' ? cfg.public_site : {};
  // Strip any accidental sensitive keys from public_site
  const safePublicSite: Record<string, any> = {};
  const allowedPublicKeys = [
    'slug',
    'tagline',
    'about',
    'banner_text',
    'admission_open',
    'admission_note',
    'facebook_url',
    'youtube_url',
    'website_url',
    'established_year',
    'office_hours',
    'map_url',
  ];
  for (const key of allowedPublicKeys) {
    if (rawPublicSite[key] !== undefined) {
      safePublicSite[key] = rawPublicSite[key];
    }
  }

  return {
    id: inst.id,
    name: inst.name || '',
    address: inst.address || '',
    phone: inst.phone || '',
    contact_email: inst.contact_email || '',
    logo_url: inst.logo_url || '',
    institute_code: inst.institute_code || cfg?.institute_code || '',
    institution_type: inst.institution_type || 'madrasah',
    public_site: safePublicSite,
  };
}

function parseNoticeMessage(rawMessage: any): string {
  if (!rawMessage) return '';
  const str = String(rawMessage);
  if (str.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object') {
        return String(parsed.body || parsed.message || parsed.text || parsed.content || str);
      }
    } catch {
      // Plain text notice
    }
  }
  return str;
}

export default async function handler(req: any, res: any) {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const queryAction = sanitizeText(url.searchParams.get('action') || req.query?.action, 40);

    // Handle POST: Online Admission Submission
    if (req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      let body = req.body;
      if (typeof body === 'string' && body.trim().startsWith('{')) {
        try {
          body = JSON.parse(body);
        } catch {
          return res.status(400).json({ error: 'Invalid JSON body' });
        }
      }
      body = body || {};

      const action = sanitizeText(body.action || queryAction, 40);
      if (action !== 'submit_admission') {
        return res.status(400).json({ error: 'Unsupported action' });
      }

      const institution_id = sanitizeText(body.institution_id, 60);
      const class_id = sanitizeText(body.class_id, 60);
      const student_name = sanitizeText(body.student_name, 140);
      const student_name_en = sanitizeText(body.student_name_en, 140);
      const date_of_birth = sanitizeText(body.date_of_birth, 20);
      const rawGender = sanitizeText(body.gender, 20).toLowerCase();
      const gender = rawGender === 'male' || rawGender === 'female' ? rawGender : '';
      const father_name = sanitizeText(body.father_name, 140);
      const rawPhone = sanitizeText(body.guardian_phone, 30);
      const guardian_phone = toEnDigits(rawPhone).replace(/[^\d+]/g, '');
      const address = sanitizeText(body.address, 300);
      const previous_institution = sanitizeText(body.previous_institution, 180);
      const photo_url = typeof body.photo_url === 'string' ? body.photo_url.trim() : '';

      // Validate Captcha
      const captchaA = Number(toEnDigits(String(body.captchaA ?? '')));
      const captchaB = Number(toEnDigits(String(body.captchaB ?? '')));
      const captchaAnswer = Number(toEnDigits(String(body.captchaAnswer ?? '')));
      if (
        !Number.isInteger(captchaA) ||
        !Number.isInteger(captchaB) ||
        captchaA < 1 ||
        captchaA > 50 ||
        captchaB < 1 ||
        captchaB > 50 ||
        !Number.isFinite(captchaAnswer) ||
        captchaA + captchaB !== captchaAnswer
      ) {
        return res.status(400).json({ error: 'নিরাপত্তা যাচাই (গণিত উত্তর) সঠিক নয়। আবার চেষ্টা করুন।' });
      }

      // Validate required fields
      if (!UUID_REGEX.test(institution_id)) {
        return res.status(400).json({ error: 'সঠিক প্রতিষ্ঠান পাওয়া যায়নি।' });
      }
      if (!student_name || student_name.length < 2) {
        return res.status(400).json({ error: 'শিক্ষার্থীর নাম সঠিকভাবে লিখুন।' });
      }
      if (!UUID_REGEX.test(class_id)) {
        return res.status(400).json({ error: 'ভর্তিচ্ছু শ্রেণি নির্বাচন করুন।' });
      }
      const digitsOnlyPhone = guardian_phone.replace(/\D/g, '');
      if (digitsOnlyPhone.length < 10 || digitsOnlyPhone.length > 15) {
        return res.status(400).json({ error: 'সঠিক অভিভাবকের মোবাইল নম্বর দিন (১১ ডিজিট)।' });
      }
      if (date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
        return res.status(400).json({ error: 'জন্ম তারিখের ফরম্যাট সঠিক নয়।' });
      }

      // Validate photo size & safety
      if (photo_url) {
        if (!isSafePhotoUrl(photo_url)) {
          return res.status(400).json({ error: 'ছবির ফরম্যাট সঠিক নয়।' });
        }
        if (estimateByteSize(photo_url) > MAX_PHOTO_BYTES) {
          return res.status(400).json({ error: 'ছবির সাইজ ১৫০ KB-এর বেশি হতে পারবে না।' });
        }
      }

      // Verify institution is active, has public_website enabled, and class belongs to this institution (tenant isolation)
      const [{ data: instRow }, { data: classRow }] = await Promise.all([
        supabase.from('institutions').select('id, is_active, config_json').eq('id', institution_id).maybeSingle(),
        supabase.from('classes').select('id, institution_id').eq('id', class_id).eq('institution_id', institution_id).maybeSingle(),
      ]);

      if (!instRow || instRow.is_active === false) {
        return res.status(404).json({ error: 'প্রতিষ্ঠানটি সক্রিয় নয়।' });
      }
      if (!isPublicWebsiteEnabled(instRow)) {
        return res.status(403).json({
          error: 'এই প্রতিষ্ঠানের অনলাইন ভর্তি পোর্টাল বর্তমানে বন্ধ রয়েছে।',
          code: 'SITE_DISABLED',
        });
      }
      if (!classRow) {
        return res.status(400).json({ error: 'নির্বাচিত শ্রেণিটি এই প্রতিষ্ঠানের নয়।' });
      }

      const insertPayload: Record<string, any> = {
        institution_id,
        class_id,
        student_name,
        name_en: student_name_en || null,
        date_of_birth: date_of_birth || null,
        gender: gender || null,
        father_name: father_name || null,
        guardian_name: father_name || student_name,
        guardian_phone,
        address: address || null,
        previous_institution: previous_institution || null,
        photo_url: photo_url || null,
        status: 'pending',
      };

      const extractMissingColumn = (errMsg: string): string | null => {
        const patterns = [
          /Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i,
          /column ['"]?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)['"]? of relation/i,
          /column ['"]?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)['"]? does not exist/i,
        ];
        for (const re of patterns) {
          const m = errMsg.match(re);
          if (m?.[1]) return m[1];
        }
        return null;
      };

      let attemptPayload = { ...insertPayload };
      let inserted: any = null;
      let insertErr: any = null;
      let returnIdSupported = true;

      for (let attempt = 0; attempt < 12; attempt++) {
        const resInsert = returnIdSupported
          ? await supabase
              .from('online_admissions')
              .insert(attemptPayload)
              .select('id')
              .single()
          : await supabase
              .from('online_admissions')
              .insert(attemptPayload);

        inserted = resInsert.data;
        insertErr = resInsert.error;
        if (!insertErr) break;

        const msg = String(insertErr.message || '');

        // If anon INSERT policy exists without SELECT policy, retry once without .select('id').single()
        if (returnIdSupported && insertErr.code === '42501') {
          returnIdSupported = false;
          continue;
        }

        if (
          insertErr.code === 'PGRST204' ||
          insertErr.code === '42703' ||
          /column .* does not exist|Could not find the .* column/i.test(msg)
        ) {
          const colMatch = extractMissingColumn(msg);
          if (colMatch && Object.prototype.hasOwnProperty.call(attemptPayload, colMatch)) {
            delete attemptPayload[colMatch];
            continue;
          }
        }
        break;
      }

      if (insertErr) {
        console.error('[public-site] submit_admission insert error:', insertErr);
        return res.status(500).json({
          error: 'আবেদন জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
        });
      }

      return res.status(200).json({
        success: true,
        applicationId: inserted?.id || '',
      });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const code = sanitizeText(url.searchParams.get('code') || req.query?.code, 80);
    if (!code) {
      return res.status(400).json({ error: 'Institution code is required' });
    }

    // Handle GET ?action=result (On-demand single-student result lookup)
    if (queryAction === 'result') {
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');

      const examId = sanitizeText(url.searchParams.get('examId') || req.query?.examId, 60);
      const classId = sanitizeText(url.searchParams.get('classId') || req.query?.classId, 60);
      const rawRoll = sanitizeText(url.searchParams.get('roll') || req.query?.roll, 20);
      const rollNum = parseInt(toEnDigits(rawRoll).replace(/\D/g, ''), 10);

      if (!UUID_REGEX.test(examId) || !UUID_REGEX.test(classId) || !Number.isFinite(rollNum) || rollNum <= 0) {
        return res.status(400).json({ error: 'সঠিক পরীক্ষা, শ্রেণি এবং রোল নম্বর দিন।' });
      }

      const inst = await findActiveInstitution(code);
      if (!inst) {
        return res.status(404).json({ error: 'প্রতিষ্ঠান পাওয়া যায়নি।' });
      }
      if (!isPublicWebsiteEnabled(inst)) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(403).json({
          error: 'এই প্রতিষ্ঠানের পাবলিক ওয়েবসাইট বর্তমানে বন্ধ রয়েছে।',
          code: 'SITE_DISABLED',
        });
      }

      // Find student scoped strictly to institution_id + class_id + roll (NEVER select phone numbers)
      const { data: studentRow, error: stuErr } = await supabase
        .from('students')
        .select('id, student_name, roll, class_id')
        .eq('institution_id', inst.id)
        .eq('class_id', classId)
        .eq('roll', rollNum)
        .limit(1)
        .maybeSingle();

      if (stuErr || !studentRow) {
        return res.status(404).json({ error: 'এই শ্রেণি ও রোল নম্বরে কোনো শিক্ষার্থী পাওয়া যায়নি।' });
      }

      const { data: classRow } = await supabase
        .from('classes')
        .select('class_name')
        .eq('id', classId)
        .eq('institution_id', inst.id)
        .maybeSingle();

      const cfg = parseConfigJson(inst.config_json);
      const isBefaq = cfg.result_engine === 'befaq';

      let marksList: Array<{
        subject_name: string;
        marks_obtained: number;
        full_marks: number;
        pass_marks: number;
      }> = [];
      let examName = '';

      if (isBefaq) {
        const { data: befaqExam } = await supabase
          .from('befaq_exams')
          .select('id, exam_name')
          .eq('id', examId)
          .eq('institution_id', inst.id)
          .maybeSingle();
        examName = befaqExam?.exam_name || '';

        const { data: bMarks } = await supabase
          .from('befaq_results')
          .select('marks_obtained, subject_id, befaq_subjects(subject_name, total_marks, passing_marks)')
          .eq('exam_id', examId)
          .eq('student_id', studentRow.id);

        if (bMarks && bMarks.length > 0) {
          marksList = bMarks.map((m: any) => {
            const sub = Array.isArray(m.befaq_subjects) ? m.befaq_subjects[0] : m.befaq_subjects;
            return {
              subject_name: sub?.subject_name || 'বিষয়',
              marks_obtained: Number(m.marks_obtained || 0),
              full_marks: Number(sub?.total_marks || 100),
              pass_marks: Number(sub?.passing_marks || 33),
            };
          });
        }
      }

      // Standard exams / exam_marks / exam_subjects (also fallback if befaq yielded empty)
      if (marksList.length === 0) {
        const { data: schoolExam } = await supabase
          .from('exams')
          .select('id, exam_name')
          .eq('id', examId)
          .eq('institution_id', inst.id)
          .maybeSingle();
        if (schoolExam?.exam_name) examName = schoolExam.exam_name;

        const { data: sMarks } = await supabase
          .from('exam_marks')
          .select('marks_obtained, subject_id, exam_subjects(subject_name, full_marks, pass_marks)')
          .eq('exam_id', examId)
          .eq('student_id', studentRow.id);

        if (sMarks && sMarks.length > 0) {
          marksList = sMarks.map((m: any) => {
            const sub = Array.isArray(m.exam_subjects) ? m.exam_subjects[0] : m.exam_subjects;
            return {
              subject_name: sub?.subject_name || 'বিষয়',
              marks_obtained: Number(m.marks_obtained || 0),
              full_marks: Number(sub?.full_marks || 100),
              pass_marks: Number(sub?.pass_marks || 33),
            };
          });
        }
      }

      if (marksList.length === 0) {
        return res.status(404).json({
          error: 'নির্বাচিত পরীক্ষায় এই শিক্ষার্থীর কোনো ফলাফল এখনো প্রকাশিত হয়নি।',
        });
      }

      const total_marks = marksList.reduce((acc, m) => acc + m.marks_obtained, 0);
      const max_total = marksList.reduce((acc, m) => acc + m.full_marks, 0);

      return res.status(200).json({
        student_name: studentRow.student_name,
        roll: studentRow.roll,
        class_name: classRow?.class_name || '',
        exam_name: examName,
        marks: marksList,
        total_marks,
        max_total,
      });
    }

    // Default GET /api/public-site?code=<institute_code>
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    const inst = await findActiveInstitution(code);
    if (!inst) {
      return res.status(404).json({ error: 'প্রতিষ্ঠানটি পাওয়া যায়নি বা বর্তমানে নিষ্ক্রিয় রয়েছে।' });
    }
    if (!isPublicWebsiteEnabled(inst)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({
        error: 'এই প্রতিষ্ঠানের পাবলিক ওয়েবসাইট বর্তমানে বন্ধ রয়েছে।',
        code: 'SITE_DISABLED',
      });
    }

    const cfg = parseConfigJson(inst.config_json);
    const isBefaq = cfg.result_engine === 'befaq';

    const [
      classesRes,
      noticesRes,
      examsRes,
      befaqExamsRes,
      studentCountRes,
      teacherCountRes,
    ] = await Promise.all([
      supabase
        .from('classes')
        .select('id, class_name, sort_order')
        .eq('institution_id', inst.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('messages')
        .select('id, title, message, created_at')
        .eq('institution_id', inst.id)
        .in('class_name', ['All', 'APP_NOTICE'])
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('exams')
        .select('id, exam_name, exam_date, created_at, is_published, class_id')
        .eq('institution_id', inst.id)
        .order('created_at', { ascending: false })
        .limit(50),
      isBefaq
        ? supabase
            .from('befaq_exams')
            .select('id, exam_name, exam_year, created_at, is_published, class_id')
            .eq('institution_id', inst.id)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', inst.id)
        .neq('is_active', false),
      supabase
        .from('teachers')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', inst.id),
    ]);

    const classes = (classesRes.data || []).map((c: any) => ({
      id: c.id,
      class_name: c.class_name,
    }));

    const notices = (noticesRes.data || []).map((n: any) => ({
      id: n.id,
      title: n.title || 'নোটিশ',
      message: parseNoticeMessage(n.message),
      created_at: n.created_at,
    }));

    const rawExams =
      isBefaq && befaqExamsRes.data && befaqExamsRes.data.length > 0
        ? befaqExamsRes.data
        : examsRes.data || [];

    const publishedExams = rawExams
      .filter((e: any) => e.is_published !== false)
      .map((e: any) => ({
        id: e.id,
        exam_name: e.exam_name || '',
        exam_year:
          e.exam_year ||
          (e.exam_date ? String(e.exam_date).slice(0, 4) : e.created_at ? String(e.created_at).slice(0, 4) : ''),
        class_id: e.class_id || null,
      }));

    return res.status(200).json({
      institution: buildPublicInstitution(inst),
      classes,
      notices,
      exams: publishedExams,
      stats: {
        student_count: studentCountRes.count || 0,
        teacher_count: teacherCountRes.count || 0,
      },
    });
  } catch (err: any) {
    console.error('[public-site] Unhandled error:', err);
    return res.status(500).json({ error: 'সার্ভারে সাময়িক সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।' });
  }
}
