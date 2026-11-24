import { supabase } from 'supabase';
import { HostelFeeCategory, HostelResidentialType } from 'types';
import { extractStudentExtraFields } from './studentExtraFields';

export interface StudentHostelFeeInfo {
  allocation_id: string | null;
  student_id: string;
  residential_type: HostelResidentialType;
  fee_category: HostelFeeCategory;
  room_id: string | null;
  room_number: string | null;
  building_name: string | null;
  seat_number: string | null;
  monthly_seat_fee: number;
  monthly_boarding_fee: number;
  suggested_hostel_fee: number;
}

export const HOSTEL_FEE_ITEM_NAME_BN = 'হোস্টেল ও বোর্ডিং ফি';
export const HOSTEL_FEE_ITEM_NAME_EN = 'Hostel & Boarding Fee';

export const normalizeHostelResidentialType = (raw?: string | null): HostelResidentialType => {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return 'non_residential';
  if (
    s.includes('ডে') ||
    s.includes('day_care') ||
    s.includes('day-care') ||
    s.includes('day care') ||
    s.includes('daycare')
  ) {
    return 'day_care';
  }
  if (
    s.includes('অনাবাসিক') ||
    s.includes('non_residential') ||
    s.includes('non-residential') ||
    s.includes('non residential') ||
    s.includes('day_scholar') ||
    s.includes('day scholar')
  ) {
    return 'non_residential';
  }
  if (
    s.includes('আবাসিক') ||
    s.includes('residential') ||
    s.includes('boarding') ||
    s.includes('hostel')
  ) {
    return 'residential';
  }
  return 'non_residential';
};

/**
 * Deterministic hostel/boarding monthly fee calculation.
 * - non_residential or lillah_free => 0
 * - half_free => 50% of (monthly_seat_fee + monthly_boarding_fee)
 * - full_paid => 100% of (monthly_seat_fee + monthly_boarding_fee)
 */
export const computeSuggestedHostelFee = (
  residentialType: HostelResidentialType,
  feeCategory: HostelFeeCategory,
  monthlySeatFee: number,
  monthlyBoardingFee: number
): number => {
  if (residentialType === 'non_residential' || feeCategory === 'lillah_free') {
    return 0;
  }
  const seat = Math.max(0, Number(monthlySeatFee) || 0);
  const boarding = Math.max(0, Number(monthlyBoardingFee) || 0);
  const gross = seat + boarding;
  if (gross <= 0) return 0;
  if (feeCategory === 'half_free') {
    return Math.round(gross * 0.5);
  }
  return Math.round(gross);
};

export const getHostelResidentialBadge = (
  type: HostelResidentialType,
  lang: 'bn' | 'en',
  isDark = false
) => {
  const isBn = lang === 'bn';
  if (type === 'residential') {
    return {
      label: isBn ? 'আবাসিক' : 'Residential',
      cls: isDark
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (type === 'day_care') {
    return {
      label: isBn ? 'ডে-কেয়ার' : 'Day-Care',
      cls: isDark
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        : 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: isBn ? 'অনাবাসিক' : 'Non-Res',
    cls: isDark
      ? 'bg-slate-700/80 text-slate-300 border-slate-600'
      : 'bg-slate-100 text-slate-600 border-slate-200',
  };
};

export const getHostelFeeCategoryBadge = (
  cat: HostelFeeCategory,
  lang: 'bn' | 'en',
  isDark = false
) => {
  const isBn = lang === 'bn';
  if (cat === 'lillah_free') {
    return {
      label: isBn ? 'লিল্লাহ ফ্রি' : 'Lillah Free',
      cls: isDark
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
        : 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  if (cat === 'half_free') {
    return {
      label: isBn ? 'অর্ধ-ফ্রি' : 'Half Free',
      cls: isDark
        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        : 'bg-purple-50 text-purple-700 border-purple-200',
    };
  }
  return {
    label: isBn ? 'পূর্ণ ফি' : 'Full Fee',
    cls: isDark
      ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      : 'bg-blue-50 text-blue-700 border-blue-200',
  };
};

/**
 * Fetches active hostel allocations + room monthly_seat_fee for an institution.
 * Returns a Map keyed by student_id. Degrades silently if tables are not yet created.
 */
export const fetchInstitutionHostelFeeMap = async (
  institutionId: string
): Promise<Map<string, StudentHostelFeeInfo>> => {
  const map = new Map<string, StudentHostelFeeInfo>();
  if (!institutionId) return map;

  try {
    const [allocRes, roomsRes] = await Promise.all([
      supabase
        .from('hostel_allocations')
        .select('id, student_id, room_id, seat_number, residential_type, fee_category, monthly_boarding_fee, status')
        .eq('institution_id', institutionId)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('hostel_rooms')
        .select('id, building_name, room_number, monthly_seat_fee')
        .eq('institution_id', institutionId),
    ]);

    if (allocRes.error || !Array.isArray(allocRes.data)) {
      return map;
    }

    const roomMap = new Map<
      string,
      { building_name: string | null; room_number: string | null; monthly_seat_fee: number }
    >();
    if (!roomsRes.error && Array.isArray(roomsRes.data)) {
      for (const r of roomsRes.data) {
        roomMap.set(r.id, {
          building_name: r.building_name || null,
          room_number: r.room_number || null,
          monthly_seat_fee: Number(r.monthly_seat_fee || 0),
        });
      }
    }

    for (const alloc of allocRes.data) {
      const existing = map.get(alloc.student_id);
      if (existing && (existing.room_id || !alloc.room_id)) continue;

      const room = alloc.room_id ? roomMap.get(alloc.room_id) : undefined;
      const resType: HostelResidentialType = alloc.residential_type || 'residential';
      const feeCat: HostelFeeCategory = alloc.fee_category || 'full_paid';
      const seatFee = room?.monthly_seat_fee || 0;
      const boardingFee = Number(alloc.monthly_boarding_fee || 0);

      map.set(alloc.student_id, {
        allocation_id: alloc.id,
        student_id: alloc.student_id,
        residential_type: resType,
        fee_category: feeCat,
        room_id: alloc.room_id || null,
        room_number: room?.room_number || null,
        building_name: room?.building_name || null,
        seat_number: alloc.seat_number || null,
        monthly_seat_fee: seatFee,
        monthly_boarding_fee: boardingFee,
        suggested_hostel_fee: computeSuggestedHostelFee(resType, feeCat, seatFee, boardingFee),
      });
    }
  } catch (err) {
    console.warn('fetchInstitutionHostelFeeMap notice:', err);
  }

  return map;
};

/**
 * Fetches active hostel allocation + room fee for a single student.
 */
export const fetchSingleStudentHostelFeeInfo = async (
  institutionId: string,
  studentId: string,
  studentNotes?: string | null
): Promise<StudentHostelFeeInfo> => {
  const extra = extractStudentExtraFields({ notes: studentNotes || '' } as any);
  const fallbackResType = normalizeHostelResidentialType(extra.residential_status);
  const fallback: StudentHostelFeeInfo = {
    allocation_id: null,
    student_id: studentId,
    residential_type: fallbackResType,
    fee_category: 'full_paid',
    room_id: null,
    room_number: null,
    building_name: null,
    seat_number: null,
    monthly_seat_fee: 0,
    monthly_boarding_fee: 0,
    suggested_hostel_fee: 0,
  };

  if (!institutionId || !studentId) return fallback;

  try {
    const { data: allocs, error } = await supabase
      .from('hostel_allocations')
      .select('id, student_id, room_id, seat_number, residential_type, fee_category, monthly_boarding_fee, status')
      .eq('institution_id', institutionId)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(2);

    if (error || !allocs || allocs.length === 0) return fallback;
    const alloc = allocs.find((a) => !!a.room_id) || allocs[0];

    let seatFee = 0;
    let roomNumber: string | null = null;
    let buildingName: string | null = null;

    if (alloc.room_id) {
      const { data: room } = await supabase
        .from('hostel_rooms')
        .select('building_name, room_number, monthly_seat_fee')
        .eq('id', alloc.room_id)
        .eq('institution_id', institutionId)
        .maybeSingle();
      if (room) {
        seatFee = Number(room.monthly_seat_fee || 0);
        roomNumber = room.room_number || null;
        buildingName = room.building_name || null;
      }
    }

    const resType: HostelResidentialType = alloc.residential_type || fallbackResType;
    const feeCat: HostelFeeCategory = alloc.fee_category || 'full_paid';
    const boardingFee = Number(alloc.monthly_boarding_fee || 0);

    return {
      allocation_id: alloc.id,
      student_id: studentId,
      residential_type: resType,
      fee_category: feeCat,
      room_id: alloc.room_id || null,
      room_number: roomNumber,
      building_name: buildingName,
      seat_number: alloc.seat_number || null,
      monthly_seat_fee: seatFee,
      monthly_boarding_fee: boardingFee,
      suggested_hostel_fee: computeSuggestedHostelFee(resType, feeCat, seatFee, boardingFee),
    };
  } catch (err) {
    console.warn('fetchSingleStudentHostelFeeInfo notice:', err);
    return fallback;
  }
};

export const resolveStudentHostelInfo = (
  student: { student_id?: string; id?: string; notes?: string | null },
  hostelMap: Map<string, StudentHostelFeeInfo>
): StudentHostelFeeInfo => {
  const sid = student.student_id || student.id || '';
  const fromMap = sid ? hostelMap.get(sid) : undefined;
  if (fromMap) return fromMap;
  const extra = extractStudentExtraFields({ notes: student.notes || '' } as any);
  const resType = normalizeHostelResidentialType(extra.residential_status);
  return {
    allocation_id: null,
    student_id: sid,
    residential_type: resType,
    fee_category: 'full_paid',
    room_id: null,
    room_number: null,
    building_name: null,
    seat_number: null,
    monthly_seat_fee: 0,
    monthly_boarding_fee: 0,
    suggested_hostel_fee: 0,
  };
};
