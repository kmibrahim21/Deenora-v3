import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { HifzRecord, Institution, Language, Student } from '../types';
import { getBase64Image } from './admissionFormPdf';
import { downloadBlob } from './fileDownloader';
import { toBnDigit } from './calendarUtils';

export type HifzReportPeriod = 'weekly' | 'monthly' | 'yearly';

export interface GenerateHifzReportOptions {
  madrasah: Institution | null;
  periodType: HifzReportPeriod;
  startDate: string;
  endDate: string;
  periodLabel: string;
  classLabel: string;
  selectedStudent: Student | null;
  students: Student[];
  records: HifzRecord[];
  classesMap: Record<string, string>;
  lang: Language;
}

const escapeHtml = (value: unknown): string => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const DEPT_LABELS: Record<'hifz' | 'nazera' | 'qaida', { bn: string; en: string }> = {
  hifz: { bn: 'হিফজ', en: 'Hifz' },
  nazera: { bn: 'নাজেরা', en: 'Nazera' },
  qaida: { bn: 'কায়দা', en: 'Qaida' },
};

export const GRADE_LABELS: Record<'mumtaz' | 'jayyid_jiddan' | 'jayyid' | 'iada', { bn: string; en: string; score: number }> = {
  mumtaz: { bn: 'মুমতাজ', en: 'Mumtaz', score: 4 },
  jayyid_jiddan: { bn: 'জায়্যিদ জিদ্দান', en: 'Jayyid Jiddan', score: 3 },
  jayyid: { bn: 'জায়্যিদ', en: 'Jayyid', score: 2 },
  iada: { bn: "ই'আদাহ", en: 'Iada', score: 1 },
};

export const SABQI_LABELS: Record<'done' | 'partial' | 'missed', { bn: string; en: string }> = {
  done: { bn: 'শোনা হয়েছে', en: 'Done' },
  partial: { bn: 'আংশিক', en: 'Partial' },
  missed: { bn: 'হয়নি', en: 'Missed' },
};

export const TILAWAT_LABELS: Record<'done' | 'partial' | 'none', { bn: string; en: string }> = {
  done: { bn: 'সম্পন্ন', en: 'Done' },
  partial: { bn: 'আংশিক', en: 'Partial' },
  none: { bn: 'হয়নি', en: 'None' },
};

const formatNum = (n: number | string, isBn: boolean) => (isBn ? toBnDigit(n) : String(n));

const formatDateDisplay = (isoDate: string, isBn: boolean) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isBn ? toBnDigit(formatted) : formatted;
};

const calcRecordPages = (r: HifzRecord): number => {
  const from = r.page_from != null && !isNaN(Number(r.page_from)) ? Number(r.page_from) : null;
  const to = r.page_to != null && !isNaN(Number(r.page_to)) ? Number(r.page_to) : null;
  if (from !== null && to !== null && to >= from) return to - from + 1;
  if (from !== null || to !== null) return 1;
  return 0;
};

const getAvgGradeLabel = (records: HifzRecord[], isBn: boolean): { text: string; color: string; bg: string } => {
  const scores: number[] = [];
  for (const r of records) {
    if (r.grade && GRADE_LABELS[r.grade]) {
      scores.push(GRADE_LABELS[r.grade].score);
    }
  }
  if (scores.length === 0) return { text: '—', color: '#64748b', bg: '#f1f5f9' };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 3.5) return { text: isBn ? 'মুমতাজ' : 'Mumtaz', color: '#047857', bg: '#ecfdf5' };
  if (avg >= 2.5) return { text: isBn ? 'জায়্যিদ জিদ্দান' : 'Jayyid Jiddan', color: '#1d4ed8', bg: '#eff6ff' };
  if (avg >= 1.5) return { text: isBn ? 'জায়্যিদ' : 'Jayyid', color: '#b45309', bg: '#fffbeb' };
  return { text: isBn ? "ই'আদাহ" : 'Iada', color: '#be123c', bg: '#fff1f2' };
};

const getGradeStyle = (grade?: HifzRecord['grade']) => {
  if (grade === 'mumtaz') return { color: '#047857', bg: '#ecfdf5' };
  if (grade === 'jayyid_jiddan') return { color: '#1d4ed8', bg: '#eff6ff' };
  if (grade === 'jayyid') return { color: '#b45309', bg: '#fffbeb' };
  if (grade === 'iada') return { color: '#be123c', bg: '#fff1f2' };
  return { color: '#64748b', bg: '#f1f5f9' };
};

export const generateHifzReportPdf = async (opts: GenerateHifzReportOptions): Promise<void> => {
  const {
    madrasah,
    periodType,
    startDate,
    endDate,
    periodLabel,
    classLabel,
    selectedStudent,
    students,
    records,
    classesMap,
    lang,
  } = opts;

  const isBn = lang === 'bn';
  const periodTitle =
    periodType === 'weekly'
      ? isBn ? 'সাপ্তাহিক হিফজ ও সবক রিপোর্ট' : 'Weekly Hifz & Sabaq Report'
      : periodType === 'monthly'
        ? isBn ? 'মাসিক হিফজ ও সবক রিপোর্ট' : 'Monthly Hifz & Sabaq Report'
        : isBn ? 'বাৎসরিক হিফজ ও সবক রিপোর্ট' : 'Yearly Hifz & Sabaq Report';

  const logoBase64 = madrasah?.logo_url ? await getBase64Image(madrasah.logo_url) : null;
  const printDateStr = formatDateDisplay(new Date().toISOString().slice(0, 10), isBn);

  // Build rows depending on mode
  let tableHeaderHtml = '';
  let rowHtmlItems: string[] = [];

  const totalEntriesCount = records.length;
  const totalPagesAll = records.reduce((acc, r) => acc + calcRecordPages(r), 0);
  const overallAvgGrade = getAvgGradeLabel(records, isBn);
  const activeStudentsCount = new Set(records.map((r) => r.student_id)).size;
  const totalTilawatDaysAll = records.filter((r) => r.tilawat_status === 'done' || r.tilawat_status === 'partial').length;
  const totalSabinaCountAll = records.filter((r) => r.sabina_completed === true).length;

  if (selectedStudent) {
    // Individual student detailed timeline report
    const sorted = [...records].sort((a, b) => a.record_date.localeCompare(b.record_date));
    tableHeaderHtml = `
      <tr style="background:#065f46;color:#ffffff;">
        <th style="padding:6px 4px;border:1px solid #047857;width:10%;text-align:center;">${isBn ? 'তারিখ' : 'Date'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:7%;text-align:center;">${isBn ? 'বিভাগ' : 'Dept'}</th>
        <th style="padding:6px 5px;border:1px solid #047857;width:19%;text-align:left;">${isBn ? 'নতুন সবক' : 'New Sabaq'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:11%;text-align:center;">${isBn ? 'সাত সবক' : 'Sabqi'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:11%;text-align:center;">${isBn ? 'আমুখতা' : 'Amukhta'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:11%;text-align:center;">${isBn ? 'তিলাওয়াত' : 'Tilawat'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:11%;text-align:center;">${isBn ? 'সবিনা' : 'Sabina'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:8%;text-align:center;">${isBn ? 'ভুল' : 'Errors'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:12%;text-align:center;">${isBn ? 'মান ও মন্তব্য' : 'Grade'}</th>
      </tr>
    `;

    rowHtmlItems = sorted.map((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const deptText = DEPT_LABELS[r.department]?.[isBn ? 'bn' : 'en'] || r.department;
      const paraPart = r.para_no ? `${isBn ? 'পারা' : 'Para'} ${formatNum(r.para_no, isBn)}` : '';
      const pagePart =
        r.page_from != null && r.page_to != null
          ? `${isBn ? 'পৃঃ' : 'P.'} ${formatNum(r.page_from, isBn)}–${formatNum(r.page_to, isBn)}`
          : r.page_from != null
            ? `${isBn ? 'পৃঃ' : 'P.'} ${formatNum(r.page_from, isBn)}`
            : '';
      const linePart = r.lines_count ? `${formatNum(r.lines_count, isBn)} ${isBn ? 'লাইন' : 'lines'}` : '';
      const sabaqMain = [paraPart, pagePart, linePart].filter(Boolean).join(' · ') || '—';
      const surahLine = r.surah_name ? `<div style="font-size:9.5px;color:#475569;margin-top:2px;">${escapeHtml(r.surah_name)}</div>` : '';

      const sabqiText = r.sabqi_status ? SABQI_LABELS[r.sabqi_status]?.[isBn ? 'bn' : 'en'] || '' : '—';
      const sabqiPg = r.sabqi_pages ? ` (${formatNum(r.sabqi_pages, isBn)} ${isBn ? 'পৃঃ' : 'p'})` : '';

      const amukhtaParts = [
        r.amukhta_para ? `${isBn ? 'পারা' : 'P.'} ${escapeHtml(isBn ? toBnDigit(String(r.amukhta_para)) : String(r.amukhta_para))}` : '',
        r.amukhta_amount ? escapeHtml(r.amukhta_amount) : '',
      ].filter(Boolean);
      const amukhtaText = amukhtaParts.join(' · ') || '—';

      let tilawatHtml = '<span style="color:#94a3b8;">—</span>';
      if (r.tilawat_status === 'done' || r.tilawat_status === 'partial') {
        const tLabel = TILAWAT_LABELS[r.tilawat_status][isBn ? 'bn' : 'en'];
        const tColor = r.tilawat_status === 'done' ? '#047857' : '#b45309';
        const tBg = r.tilawat_status === 'done' ? '#ecfdf5' : '#fffbeb';
        tilawatHtml = `
          <span style="display:inline-block;padding:1.5px 5px;border-radius:5px;font-weight:700;font-size:9.5px;color:${tColor};background:${tBg};">${escapeHtml(tLabel)}</span>
          ${r.tilawat_amount ? `<div style="font-size:9px;color:#334155;margin-top:2px;font-weight:600;">${escapeHtml(r.tilawat_amount)}</div>` : ''}
        `;
      }

      let sabinaHtml = '<span style="color:#94a3b8;">—</span>';
      if (r.sabina_completed === true) {
        const sGradeText = r.sabina_grade ? GRADE_LABELS[r.sabina_grade]?.[isBn ? 'bn' : 'en'] : '';
        sabinaHtml = `
          <span style="display:inline-block;padding:1.5px 5px;border-radius:5px;font-weight:800;font-size:9.5px;color:#b45309;background:#fef3c7;">★ ${escapeHtml(r.sabina_paras || (isBn ? 'সম্পন্ন' : 'Done'))}</span>
          ${sGradeText ? `<div style="font-size:9px;color:#92400e;margin-top:2px;font-weight:700;">${escapeHtml(sGradeText)}</div>` : ''}
        `;
      }

      const lokma = Number(r.mistakes_lokma || 0);
      const tajweed = Number(r.mistakes_tajweed || 0);
      const gradeStyle = getGradeStyle(r.grade);
      const gradeText = r.grade ? GRADE_LABELS[r.grade]?.[isBn ? 'bn' : 'en'] : '—';

      return `
        <tr style="background:${bg};">
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#0f172a;white-space:nowrap;font-size:10px;">${formatDateDisplay(r.record_date, isBn)}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#065f46;font-size:10px;">${escapeHtml(deptText)}</td>
          <td style="padding:5px;border:1px solid #cbd5e1;text-align:left;color:#0f172a;font-weight:600;font-size:10px;">${escapeHtml(sabaqMain)}${surahLine}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;color:#334155;font-size:10px;">${escapeHtml(sabqiText + sabqiPg)}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;color:#334155;font-size:10px;">${amukhtaText}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;">${tilawatHtml}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;">${sabinaHtml}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;font-size:10px;color:${lokma + tajweed > 0 ? '#be123c' : '#475569'};">${formatNum(lokma, isBn)}/${formatNum(tajweed, isBn)}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;">
            <span style="display:inline-block;padding:2px 6px;border-radius:6px;font-weight:700;font-size:9.5px;color:${gradeStyle.color};background:${gradeStyle.bg};">${escapeHtml(gradeText)}</span>
            ${r.remarks ? `<div style="font-size:9px;color:#64748b;margin-top:2px;">${escapeHtml(r.remarks)}</div>` : ''}
          </td>
        </tr>
      `;
    });
  } else {
    // Class Summary table (all students)
    const recordsByStudent = new Map<string, HifzRecord[]>();
    for (const r of records) {
      const list = recordsByStudent.get(r.student_id) || [];
      list.push(r);
      recordsByStudent.set(r.student_id, list);
    }

    tableHeaderHtml = `
      <tr style="background:#065f46;color:#ffffff;">
        <th style="padding:6px 4px;border:1px solid #047857;width:5%;text-align:center;">${isBn ? 'ক্র.' : 'SL'}</th>
        <th style="padding:6px 5px;border:1px solid #047857;width:19%;text-align:left;">${isBn ? 'নাম ও রোল' : 'Name & Roll'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:7%;text-align:center;">${isBn ? 'বিভাগ' : 'Dept'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:7%;text-align:center;">${isBn ? 'দিন' : 'Days'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:7%;text-align:center;">${isBn ? 'পৃষ্ঠা' : 'Pages'}</th>
        <th style="padding:6px 5px;border:1px solid #047857;width:15%;text-align:center;">${isBn ? 'শেষ পারা ও পৃষ্ঠা' : 'Last Para & Page'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:11%;text-align:center;">${isBn ? 'তিলাওয়াত' : 'Tilawat'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:11%;text-align:center;">${isBn ? 'সাপ্তাহিক সবিনা' : 'Sabina'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:10%;text-align:center;">${isBn ? 'গড় মান' : 'Avg Grade'}</th>
        <th style="padding:6px 4px;border:1px solid #047857;width:8%;text-align:center;">${isBn ? 'ভুল' : 'Errors'}</th>
      </tr>
    `;

    rowHtmlItems = students.map((stu, idx) => {
      const stuRecords = (recordsByStudent.get(stu.id) || []).sort((a, b) => b.record_date.localeCompare(a.record_date));
      const latest = stuRecords[0];
      const totalDays = stuRecords.length;
      const totalPages = stuRecords.reduce((sum, r) => sum + calcRecordPages(r), 0);
      const totalLokma = stuRecords.reduce((sum, r) => sum + Number(r.mistakes_lokma || 0), 0);
      const totalTajweed = stuRecords.reduce((sum, r) => sum + Number(r.mistakes_tajweed || 0), 0);
      const avgGrade = getAvgGradeLabel(stuRecords, isBn);

      // Daily Tilawat summary per student
      const tilawatRecords = stuRecords.filter((r) => r.tilawat_status === 'done' || r.tilawat_status === 'partial');
      const tilawatDays = tilawatRecords.length;
      const latestTilawatAmt = tilawatRecords.find((r) => r.tilawat_amount)?.tilawat_amount || '';
      const tilawatCellHtml =
        tilawatDays > 0
          ? `<div style="font-weight:800;color:#047857;font-size:10px;">${formatNum(tilawatDays, isBn)} ${isBn ? 'দিন' : 'd'}</div>${latestTilawatAmt ? `<div style="font-size:9px;color:#475569;margin-top:1px;">${escapeHtml(latestTilawatAmt)}</div>` : ''}`
          : '<span style="color:#94a3b8;">—</span>';

      // Weekly Sabina summary per student
      const sabinaRecords = stuRecords.filter((r) => r.sabina_completed === true);
      const sabinaCount = sabinaRecords.length;
      const sabinaParasList = Array.from(
        new Set(sabinaRecords.map((r) => (r.sabina_paras || '').trim()).filter(Boolean))
      ).slice(0, 2);
      const sabinaCellHtml =
        sabinaCount > 0
          ? `<span style="display:inline-block;padding:1.5px 5px;border-radius:5px;font-weight:800;font-size:9.5px;color:#b45309;background:#fef3c7;">★ ${formatNum(sabinaCount, isBn)} ${isBn ? 'বার' : 'x'}</span>${sabinaParasList.length > 0 ? `<div style="font-size:9px;color:#92400e;margin-top:1px;font-weight:600;">${escapeHtml(sabinaParasList.join(', '))}</div>` : ''}`
          : '<span style="color:#94a3b8;">—</span>';

      const deptKey: 'hifz' | 'nazera' | 'qaida' =
        latest?.department ||
        (stu.department === 'nazera' ? 'nazera' : 'hifz');
      const deptText = totalDays > 0 || stu.department ? DEPT_LABELS[deptKey]?.[isBn ? 'bn' : 'en'] : '—';

      let lastPos = '—';
      if (latest) {
        const pNo = latest.para_no ? `${isBn ? 'পারা' : 'P.'} ${formatNum(latest.para_no, isBn)}` : '';
        const pPg =
          latest.page_from != null && latest.page_to != null
            ? `${isBn ? 'পৃঃ' : 'Pg'} ${formatNum(latest.page_from, isBn)}–${formatNum(latest.page_to, isBn)}`
            : latest.page_from != null
              ? `${isBn ? 'পৃঃ' : 'Pg'} ${formatNum(latest.page_from, isBn)}`
              : '';
        lastPos = [pNo, pPg].filter(Boolean).join(', ') || latest.surah_name || '—';
      }

      const rollLabel = stu.roll != null ? `${isBn ? 'রোল' : 'Roll'}: ${formatNum(stu.roll, isBn)}` : '';
      const clsName = classesMap[stu.class_id] || '';
      const subMeta = [rollLabel, classLabel === (isBn ? 'সকল ক্লাস' : 'All Classes') ? clsName : ''].filter(Boolean).join(' · ');

      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `
        <tr style="background:${bg};">
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#475569;font-size:10px;">${formatNum(idx + 1, isBn)}</td>
          <td style="padding:5px;border:1px solid #cbd5e1;text-align:left;">
            <div style="font-weight:800;color:#0f172a;font-size:11px;">${escapeHtml(stu.student_name)}</div>
            ${subMeta ? `<div style="font-size:9px;color:#64748b;margin-top:1px;">${escapeHtml(subMeta)}</div>` : ''}
          </td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#065f46;font-size:10px;">${escapeHtml(deptText)}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#0f172a;font-size:10px;">${formatNum(totalDays, isBn)}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#0f172a;font-size:10px;">${formatNum(totalPages, isBn)}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#1e293b;font-size:10px;">${escapeHtml(lastPos)}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;">${tilawatCellHtml}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;">${sabinaCellHtml}</td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;">
            <span style="display:inline-block;padding:2px 6px;border-radius:6px;font-weight:700;font-size:9.5px;color:${avgGrade.color};background:${avgGrade.bg};">${escapeHtml(avgGrade.text)}</span>
          </td>
          <td style="padding:5px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:700;font-size:10px;color:${totalLokma + totalTajweed > 0 ? '#be123c' : '#475569'};">${formatNum(totalLokma, isBn)}/${formatNum(totalTajweed, isBn)}</td>
        </tr>
      `;
    });
  }

  if (rowHtmlItems.length === 0) {
    rowHtmlItems.push(`
      <tr>
        <td colspan="${selectedStudent ? 9 : 10}" style="padding:28px;border:1px solid #cbd5e1;text-align:center;color:#64748b;font-weight:700;">
          ${isBn ? 'নির্বাচিত সময়কালে কোনো সবক রেকর্ড পাওয়া যায়নি।' : 'No Hifz/Sabaq records found for the selected period.'}
        </td>
      </tr>
    `);
  }

  // Paginate rows cleanly so tables never split mid-row
  const FIRST_PAGE_ROWS = 18;
  const NEXT_PAGE_ROWS = 24;
  const pagesRows: string[][] = [];
  if (rowHtmlItems.length <= FIRST_PAGE_ROWS) {
    pagesRows.push(rowHtmlItems);
  } else {
    pagesRows.push(rowHtmlItems.slice(0, FIRST_PAGE_ROWS));
    let cursor = FIRST_PAGE_ROWS;
    while (cursor < rowHtmlItems.length) {
      pagesRows.push(rowHtmlItems.slice(cursor, cursor + NEXT_PAGE_ROWS));
      cursor += NEXT_PAGE_ROWS;
    }
  }

  const buildPageHtml = (rowsSlice: string[], pageIndex: number, totalPagesCount: number) => {
    const isFirst = pageIndex === 0;
    const isLast = pageIndex === totalPagesCount - 1;

    const fullHeaderHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2.5px solid #065f46;padding-bottom:10px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${
            logoBase64
              ? `<img src="${logoBase64}" style="width:58px;height:58px;object-fit:contain;border-radius:12px;border:1.5px solid #d1fae5;padding:3px;background:#ffffff;" />`
              : `<div style="width:54px;height:54px;border-radius:12px;background:#ecfdf5;border:1.5px solid #a7f3d0;display:flex;align-items:center;justify-content:center;color:#065f46;font-weight:900;font-size:20px;">হ</div>`
          }
          <div>
            <h1 style="margin:0;font-size:20px;font-weight:900;color:#064e3b;line-height:1.25;">${escapeHtml(madrasah?.name || (isBn ? 'মাদরাসার নাম' : 'Madrasah Name'))}</h1>
            <div style="font-size:11px;color:#475569;margin-top:2px;font-weight:600;">
              ${escapeHtml(madrasah?.address || '')}${madrasah?.address && madrasah?.phone ? ' · ' : ''}${madrasah?.phone ? `${isBn ? 'ফোন: ' : 'Phone: '}${escapeHtml(isBn ? toBnDigit(madrasah.phone) : madrasah.phone)}` : ''}
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block;background:#065f46;color:#ffffff;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:800;">
            ${escapeHtml(periodTitle)}
          </div>
          <div style="font-size:10.5px;color:#475569;margin-top:4px;font-weight:700;">
            ${isBn ? 'সময়কাল:' : 'Period:'} ${escapeHtml(formatDateDisplay(startDate, isBn))} – ${escapeHtml(formatDateDisplay(endDate, isBn))}
          </div>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:10.5px;color:#064e3b;font-weight:700;">
        <div>
          <span>${isBn ? 'জামাত / শ্রেণি:' : 'Class:'} <strong>${escapeHtml(classLabel)}</strong></span>
          ${
            selectedStudent
              ? `<span style="margin-left:12px;">${isBn ? 'শিক্ষার্থী:' : 'Student:'} <strong>${escapeHtml(selectedStudent.student_name)}</strong>${selectedStudent.roll != null ? ` (${isBn ? 'রোল' : 'Roll'}: ${formatNum(selectedStudent.roll, isBn)})` : ''}</span>`
              : `<span style="margin-left:12px;">${isBn ? 'শিক্ষার্থী:' : 'Students:'} <strong>${formatNum(students.length, isBn)}</strong> (${isBn ? 'সক্রিয়' : 'Active'}: ${formatNum(activeStudentsCount, isBn)})</span>`
          }
        </div>
        <div>
          <span>${isBn ? 'মোট এন্ট্রি:' : 'Entries:'} <strong>${formatNum(totalEntriesCount, isBn)}</strong></span>
          <span style="margin-left:10px;">${isBn ? 'পৃষ্ঠা:' : 'Pages:'} <strong>${formatNum(totalPagesAll, isBn)}</strong></span>
          <span style="margin-left:10px;">${isBn ? 'তিলাওয়াত:' : 'Tilawat:'} <strong>${formatNum(totalTilawatDaysAll, isBn)} ${isBn ? 'দিন' : 'd'}</strong></span>
          <span style="margin-left:10px;color:#b45309;">${isBn ? 'সবিনা:' : 'Sabina:'} <strong>${formatNum(totalSabinaCountAll, isBn)} ${isBn ? 'বার' : 'x'}</strong></span>
          <span style="margin-left:10px;">${isBn ? 'গড় মান:' : 'Avg:'} <strong>${escapeHtml(overallAvgGrade.text)}</strong></span>
        </div>
      </div>
    `;

    const continuationHeaderHtml = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #065f46;padding-bottom:6px;margin-bottom:10px;font-size:11px;color:#064e3b;font-weight:800;">
        <span>${escapeHtml(madrasah?.name || '')} — ${escapeHtml(periodTitle)} (${escapeHtml(classLabel)})</span>
        <span>${escapeHtml(periodLabel)}</span>
      </div>
    `;

    const signatureFooterHtml = isLast
      ? `
        <div style="margin-top:auto;padding-top:26px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;padding:0 18px;">
            <div style="text-align:center;width:210px;">
              <div style="border-top:1.5px solid #334155;padding-top:5px;font-size:11.5px;font-weight:800;color:#0f172a;">
                ${isBn ? 'ওস্তাদের স্বাক্ষর' : "Teacher's Signature"}
              </div>
              <div style="font-size:9.5px;color:#64748b;margin-top:2px;">${isBn ? 'তারিখ:' : 'Date:'} ${printDateStr}</div>
            </div>
            <div style="text-align:center;width:230px;">
              <div style="border-top:1.5px solid #334155;padding-top:5px;font-size:11.5px;font-weight:800;color:#0f172a;">
                ${isBn ? 'মুহতামিম / প্রধান শিক্ষকের স্বাক্ষর' : 'Muhtamim / Principal Signature'}
              </div>
              <div style="font-size:9.5px;color:#64748b;margin-top:2px;">${escapeHtml(madrasah?.name || '')}</div>
            </div>
          </div>
        </div>
      `
      : '';

    return `
      <div class="hifz-pdf-page" style="width:794px;height:1123px;box-sizing:border-box;padding:34px 32px 26px 32px;background:#ffffff;color:#0f172a;font-family:'Noto Sans Bengali','SolaimanLipi','Hind Siliguri',sans-serif;display:flex;flex-direction:column;position:relative;overflow:hidden;">
        ${isFirst ? fullHeaderHtml : continuationHeaderHtml}
        <table style="width:100%;border-collapse:collapse;font-size:11px;line-height:1.35;">
          <thead>${tableHeaderHtml}</thead>
          <tbody>${rowsSlice.join('')}</tbody>
        </table>
        ${signatureFooterHtml}
        <div style="margin-top:${isLast ? '14px' : 'auto'};padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9.5px;color:#64748b;font-weight:600;">
          <span>${isBn ? 'মুদ্রণের তারিখ:' : 'Printed:'} ${printDateStr}</span>
          <span>${isBn ? `পৃষ্ঠা ${formatNum(pageIndex + 1, isBn)} / ${formatNum(totalPagesCount, isBn)}` : `Page ${pageIndex + 1} of ${totalPagesCount}`}</span>
        </div>
      </div>
    `;
  };

  // Mount offscreen container
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.zIndex = '-1';
  host.style.background = '#ffffff';
  host.innerHTML = pagesRows.map((slice, i) => buildPageHtml(slice, i, pagesRows.length)).join('');
  document.body.appendChild(host);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready.catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 200));

    const pageNodes = Array.from(host.querySelectorAll('.hifz-pdf-page')) as HTMLElement[];
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    for (let i = 0; i < pageNodes.length; i++) {
      const canvas = await html2canvas(pageNodes[i], {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.94);
      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    const safeClass = (selectedStudent?.student_name || classLabel || 'Hifz')
      .replace(/[^\w\u0980-\u09FF-]+/g, '_')
      .slice(0, 40);
    const fileName = `Hifz_${periodType}_${safeClass}_${startDate}_to_${endDate}.pdf`;

    const blob = pdf.output('blob');
    await downloadBlob(blob, fileName, 'application/pdf');
  } catch (err) {
    console.error('[HifzReportPDF] Canvas export failed, trying print fallback:', err);
    // Print fallback inside hidden iframe (avoids window.open popup blocking in iframe)
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${escapeHtml(periodTitle)}</title><style>@page{size:A4 portrait;margin:0;}body{margin:0;background:#fff;}.hifz-pdf-page{page-break-after:always;}</style></head><body>${host.innerHTML}</body></html>`);
      frameDoc.close();
      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          try { document.body.removeChild(printFrame); } catch {}
        }, 1500);
      }, 300);
    } else {
      throw err;
    }
  } finally {
    try {
      document.body.removeChild(host);
    } catch {}
  }
};
