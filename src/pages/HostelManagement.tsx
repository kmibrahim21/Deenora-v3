import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  BedDouble,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Edit3,
  Heart,
  Home,
  Loader2,
  LogOut,
  Minus,
  Moon,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunrise,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { supabase } from 'supabase';
import {
  AcademicYear,
  Class,
  HostelAllocation,
  HostelFeeCategory,
  HostelLeave,
  HostelMealLog,
  HostelMealStatus,
  HostelNightRollStatus,
  HostelResidentialType,
  HostelRoom,
  HostelRoomGender,
  Institution,
  Language,
  Profile,
  Student,
} from 'types';
import { sortMadrasahClasses } from 'pages/Classes';
import { getTodayDateString, toBnDigit } from 'utils/calendarUtils';
import { useBackHandler } from 'utils/backHandler';
import {
  extractStudentExtraFields,
  packStudentNotesWithExtra,
} from 'utils/studentExtraFields';
import { SmartDatePicker } from 'components/common/SmartDatePicker';

interface HostelManagementProps {
  madrasah: Institution | null;
  onBack: () => void;
  lang: Language;
  activeYear?: AcademicYear | null;
  profile?: Profile | null;
  kitchenOnlyMode?: boolean;
  onLogout?: () => void;
}

type HostelTab = 'rooms' | 'directory' | 'meals' | 'gatepass';
type MealKey = 'morning' | 'noon' | 'night';

const normalizeResidentialType = (raw?: string | null): HostelResidentialType => {
  const s = (raw || '').trim().toLowerCase();
  if (s) {
    if (s.includes('ডে') || s.includes('day_care') || s.includes('day-care') || s.includes('day care') || s.includes('daycare')) {
      return 'day_care';
    }
    if (s.includes('অনাবাসিক') || s.includes('non_residential') || s.includes('non-residential') || s.includes('non residential') || s.includes('day_scholar') || s.includes('day scholar')) {
      return 'non_residential';
    }
    if (s.includes('আবাসিক') || s.includes('residential') || s.includes('boarding') || s.includes('hostel')) {
      return 'residential';
    }
  }
  return 'non_residential';
};

const residentialTypeToNoteLabel = (type: HostelResidentialType): string => {
  if (type === 'residential') return 'আবাসিক (Residential)';
  if (type === 'day_care') return 'ডে-কেয়ার (Day-Care)';
  return 'অনাবাসিক (Non-Residential)';
};

const formatNum = (val: number | string, isBn: boolean): string => {
  const str = typeof val === 'number' ? val.toLocaleString('en-US') : String(val);
  return isBn ? toBnDigit(str) : str;
};

const formatMealCount = (val: number, isBn: boolean): string => {
  const rounded = Math.round(val * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return isBn ? toBnDigit(str) : str;
};

const shiftDateStr = (dateStr: string, deltaDays: number): string => {
  const parts = dateStr.split('-').map((p) => parseInt(p, 10));
  const d =
    parts.length === 3 && !parts.some(isNaN)
      ? new Date(parts[0], parts[1] - 1, parts[2] + deltaDays)
      : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatReadableDate = (dateStr: string, isBn: boolean): string => {
  const parts = dateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const bnMonths = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
  const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const bnDays = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const enDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNum = isBn ? toBnDigit(parts[2]) : String(parts[2]);
  const yearNum = isBn ? toBnDigit(parts[0]) : String(parts[0]);
  const monthName = isBn ? bnMonths[parts[1] - 1] : enMonths[parts[1] - 1];
  const weekday = isBn ? bnDays[d.getDay()] : enDays[d.getDay()];
  return `${weekday}, ${dayNum} ${monthName} ${yearNum}`;
};

const normalizeMealStatus = (raw?: unknown): HostelMealStatus => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'half' || s === '0.5') return 'half';
  if (s === 'off' || s === 'absent' || s === 'leave' || s === '0') return 'off';
  return 'present';
};

const cycleMealStatus = (cur: HostelMealStatus): HostelMealStatus => {
  if (cur === 'present') return 'half';
  if (cur === 'half') return 'off';
  return 'present';
};

const isMissingTableError = (err: any): boolean => {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
};

const isLeaveCoveringDate = (leave: any, targetDate: string): boolean => {
  if (!leave) return false;
  const status = String(leave.status || '').trim().toLowerCase();
  if (['cancelled', 'canceled', 'rejected', 'returned', 'completed', 'closed'].includes(status)) {
    return false;
  }
  const rawStart =
    leave.start_date ||
    leave.from_date ||
    leave.leave_from ||
    leave.out_date ||
    leave.leave_date ||
    leave.date;
  if (!rawStart) return false;
  const startDate = String(rawStart).slice(0, 10);
  const rawEnd =
    leave.end_date ||
    leave.to_date ||
    leave.leave_to ||
    leave.expected_return_date ||
    leave.return_date ||
    startDate;
  const endDate = String(rawEnd).slice(0, 10);
  return targetDate >= startDate && targetDate <= endDate;
};

const HostelManagement: React.FC<HostelManagementProps> = ({
  madrasah,
  onBack,
  lang,
  profile,
  kitchenOnlyMode = false,
  onLogout,
}) => {
  const isBn = lang === 'bn';
  const isDark = madrasah?.theme === 'dark';

  const [activeTab, setActiveTab] = useState<HostelTab>(kitchenOnlyMode ? 'meals' : 'rooms');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [schemaMissing, setSchemaMissing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Core data
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [allocations, setAllocations] = useState<HostelAllocation[]>([]);

  // Tab 1 Filters
  const [roomSearch, setRoomSearch] = useState('');
  const [roomGenderFilter, setRoomGenderFilter] = useState<'all' | HostelRoomGender>('all');
  const [showInactiveRooms, setShowInactiveRooms] = useState(false);

  // Tab 2 Filters
  const [dirSearch, setDirSearch] = useState('');
  const [dirClassFilter, setDirClassFilter] = useState('all');
  const [dirResFilter, setDirResFilter] = useState<'all' | HostelResidentialType>('all');
  const [dirFeeFilter, setDirFeeFilter] = useState<'all' | HostelFeeCategory>('all');

  // Room Add/Edit Modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HostelRoom | null>(null);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomForm, setRoomForm] = useState({
    building_name: 'মূল ভবন',
    floor_name: '',
    room_number: '',
    room_title: '',
    gender: 'male' as HostelRoomGender,
    capacity: '6',
    monthly_seat_fee: '0',
    warden_name: '',
    warden_phone: '',
    is_active: true,
  });

  // Delete Room Confirmation
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<HostelRoom | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);

  // Assign Seat Modal
  const [assignModalRoom, setAssignModalRoom] = useState<HostelRoom | null>(null);
  const [assignStudentSearch, setAssignStudentSearch] = useState('');
  const [assignClassFilter, setAssignClassFilter] = useState('all');
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignSeatNumber, setAssignSeatNumber] = useState('');
  const [assignFeeCategory, setAssignFeeCategory] = useState<HostelFeeCategory>('full_paid');
  const [assignMonthlyFee, setAssignMonthlyFee] = useState('0');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Transfer Room Modal
  const [transferTarget, setTransferTarget] = useState<{
    allocation: HostelAllocation;
    student: Student;
    fromRoom: HostelRoom;
  } | null>(null);
  const [transferToRoomId, setTransferToRoomId] = useState('');
  const [transferSeatNumber, setTransferSeatNumber] = useState('');
  const [transferSyncFee, setTransferSyncFee] = useState(true);
  const [transferSaving, setTransferSaving] = useState(false);

  // Vacate Seat Modal
  const [vacateTarget, setVacateTarget] = useState<{
    allocation: HostelAllocation;
    student: Student;
    room: HostelRoom;
  } | null>(null);
  const [vacateSaving, setVacateSaving] = useState(false);

  // Directory Student Edit Modal
  const [editStudentTarget, setEditStudentTarget] = useState<{
    student: Student;
    allocation: HostelAllocation | null;
    currentResType: HostelResidentialType;
  } | null>(null);
  const [editResType, setEditResType] = useState<HostelResidentialType>('residential');
  const [editFeeCategory, setEditFeeCategory] = useState<HostelFeeCategory>('full_paid');
  const [editMonthlyFee, setEditMonthlyFee] = useState('0');
  const [editStudentNotes, setEditStudentNotes] = useState('');
  const [editStudentSaving, setEditStudentSaving] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  // Phase 3: Gate Pass & Night Roll Modals
  const [gatePassModalOpen, setGatePassModalOpen] = useState(false);
  const [printGatePassTarget, setPrintGatePassTarget] = useState<HostelLeave | null>(null);

  // Android / browser back handling for open modals
  const anyModalOpen =
    roomModalOpen ||
    !!deleteRoomTarget ||
    !!assignModalRoom ||
    !!transferTarget ||
    !!vacateTarget ||
    !!editStudentTarget ||
    gatePassModalOpen ||
    !!printGatePassTarget;

  const handleCloseTopModal = useCallback((): boolean => {
    if (printGatePassTarget) {
      setPrintGatePassTarget(null);
      return true;
    }
    if (gatePassModalOpen) {
      setGatePassModalOpen(false);
      return true;
    }
    if (vacateTarget) {
      setVacateTarget(null);
      return true;
    }
    if (deleteRoomTarget) {
      setDeleteRoomTarget(null);
      return true;
    }
    if (transferTarget) {
      setTransferTarget(null);
      return true;
    }
    if (assignModalRoom) {
      setAssignModalRoom(null);
      return true;
    }
    if (editStudentTarget) {
      setEditStudentTarget(null);
      return true;
    }
    if (roomModalOpen) {
      setRoomModalOpen(false);
      return true;
    }
    return false;
  }, [
    printGatePassTarget,
    gatePassModalOpen,
    vacateTarget,
    deleteRoomTarget,
    transferTarget,
    assignModalRoom,
    editStudentTarget,
    roomModalOpen,
  ]);

  useBackHandler('hostel-management-modals', handleCloseTopModal, anyModalOpen, 20);

  const fetchAllData = useCallback(
    async (silent = false) => {
      if (!madrasah?.id) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setErrorMsg(null);
      setSchemaMissing(false);

      try {
        const [classesRes, studentsRes, roomsRes, allocRes] = await Promise.all([
          supabase
            .from('classes')
            .select('id, institution_id, class_name, sort_order')
            .eq('institution_id', madrasah.id),
          supabase
            .from('students')
            .select('id, institution_id, class_id, student_name, registration_number, roll, guardian_name, guardian_phone, photo_url, notes, is_active')
            .eq('institution_id', madrasah.id)
            .neq('is_active', false)
            .order('roll', { ascending: true, nullsFirst: false })
            .order('student_name', { ascending: true }),
          supabase
            .from('hostel_rooms')
            .select('*')
            .eq('institution_id', madrasah.id)
            .order('building_name', { ascending: true })
            .order('floor_name', { ascending: true })
            .order('room_number', { ascending: true }),
          supabase
            .from('hostel_allocations')
            .select('*')
            .eq('institution_id', madrasah.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false }),
        ]);

        if (classesRes.error) throw classesRes.error;
        if (studentsRes.error) throw studentsRes.error;

        setClasses(sortMadrasahClasses((classesRes.data || []) as Class[]));
        setStudents((studentsRes.data || []) as Student[]);

        const missingTableErr = (err: any) => {
          if (!err) return false;
          const msg = String(err.message || '').toLowerCase();
          return (
            err.code === '42P01' ||
            err.code === 'PGRST205' ||
            msg.includes('does not exist') ||
            msg.includes('could not find the table')
          );
        };

        if (missingTableErr(roomsRes.error) || missingTableErr(allocRes.error)) {
          setSchemaMissing(true);
          setRooms([]);
          setAllocations([]);
        } else {
          if (roomsRes.error) throw roomsRes.error;
          if (allocRes.error) throw allocRes.error;
          setRooms((roomsRes.data || []) as HostelRoom[]);
          setAllocations((allocRes.data || []) as HostelAllocation[]);
        }
      } catch (err: any) {
        console.error('HostelManagement load error:', err);
        setErrorMsg(
          err?.message ||
            (isBn ? 'হোস্টেল তথ্য লোড করতে সমস্যা হয়েছে।' : 'Failed to load hostel data.')
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [madrasah?.id, isBn]
  );

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Lookup maps
  const classMap = useMemo(() => {
    const map = new Map<string, Class>();
    classes.forEach((c) => map.set(c.id, c));
    return map;
  }, [classes]);

  const studentMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const roomMap = useMemo(() => {
    const map = new Map<string, HostelRoom>();
    rooms.forEach((r) => map.set(r.id, r));
    return map;
  }, [rooms]);

  // Latest active allocation per student (prefer one with room_id if duplicates ever exist)
  const activeAllocationByStudent = useMemo(() => {
    const map = new Map<string, HostelAllocation>();
    for (const alloc of allocations) {
      if (alloc.status !== 'active') continue;
      if (!studentMap.has(alloc.student_id)) continue;
      const existing = map.get(alloc.student_id);
      if (!existing || (!existing.room_id && alloc.room_id)) {
        map.set(alloc.student_id, alloc);
      }
    }
    return map;
  }, [allocations, studentMap]);

  // Active seated allocations grouped by room_id
  const allocationsByRoom = useMemo(() => {
    const map = new Map<string, Array<{ allocation: HostelAllocation; student: Student }>>();
    for (const alloc of activeAllocationByStudent.values()) {
      if (!alloc.room_id) continue;
      const stu = studentMap.get(alloc.student_id);
      if (!stu) continue;
      const list = map.get(alloc.room_id) || [];
      list.push({ allocation: alloc, student: stu });
      map.set(alloc.room_id, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) =>
        (a.allocation.seat_number || '').localeCompare(b.allocation.seat_number || '', undefined, {
          numeric: true,
        })
      );
      map.set(key, list);
    }
    return map;
  }, [activeAllocationByStudent, studentMap]);

  // Merged directory rows (every active student with normalized residential_type + allocation)
  const directoryRows = useMemo(() => {
    return students.map((student) => {
      const alloc = activeAllocationByStudent.get(student.id) || null;
      const extra = extractStudentExtraFields(student);
      const residentialType: HostelResidentialType = alloc
        ? alloc.residential_type
        : normalizeResidentialType(extra.residential_status);
      const feeCategory: HostelFeeCategory = alloc?.fee_category || 'full_paid';
      const monthlyBoardingFee = alloc ? Number(alloc.monthly_boarding_fee || 0) : 0;
      const room = alloc?.room_id ? roomMap.get(alloc.room_id) || null : null;
      const className = classMap.get(student.class_id)?.class_name || '';

      return {
        student,
        allocation: alloc,
        room,
        className,
        residentialType,
        feeCategory,
        monthlyBoardingFee,
      };
    });
  }, [students, activeAllocationByStudent, roomMap, classMap]);

  // Top KPI stats
  const kpis = useMemo(() => {
    const activeRooms = rooms.filter((r) => r.is_active);
    const totalRooms = activeRooms.length;
    const totalBeds = activeRooms.reduce((sum, r) => sum + Number(r.capacity || 0), 0);

    let seatedCount = 0;
    activeRooms.forEach((r) => {
      seatedCount += (allocationsByRoom.get(r.id) || []).length;
    });

    const activeBoarders = directoryRows.filter((row) => row.residentialType === 'residential').length;
    const availableSeats = Math.max(0, totalBeds - seatedCount);
    const lillahCount = directoryRows.filter((row) => row.feeCategory === 'lillah_free').length;
    const halfFreeCount = directoryRows.filter((row) => row.feeCategory === 'half_free').length;

    return {
      totalRooms,
      totalBeds,
      seatedCount,
      activeBoarders,
      availableSeats,
      lillahCount,
      halfFreeCount,
    };
  }, [rooms, allocationsByRoom, directoryRows]);

  // Filtered rooms for Tab 1
  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    return rooms.filter((room) => {
      if (!showInactiveRooms && !room.is_active) return false;
      if (roomGenderFilter !== 'all' && room.gender !== roomGenderFilter) return false;
      if (!q) return true;
      const occupants = allocationsByRoom.get(room.id) || [];
      const occupantMatch = occupants.some(
        (o) =>
          o.student.student_name.toLowerCase().includes(q) ||
          String(o.student.roll ?? '').includes(q)
      );
      return (
        room.room_number.toLowerCase().includes(q) ||
        (room.room_title || '').toLowerCase().includes(q) ||
        (room.building_name || '').toLowerCase().includes(q) ||
        (room.floor_name || '').toLowerCase().includes(q) ||
        (room.warden_name || '').toLowerCase().includes(q) ||
        occupantMatch
      );
    });
  }, [rooms, showInactiveRooms, roomGenderFilter, roomSearch, allocationsByRoom]);

  // Filtered directory rows for Tab 2
  const filteredDirectory = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    return directoryRows.filter((row) => {
      if (dirClassFilter !== 'all' && row.student.class_id !== dirClassFilter) return false;
      if (dirResFilter !== 'all' && row.residentialType !== dirResFilter) return false;
      if (dirFeeFilter !== 'all' && row.feeCategory !== dirFeeFilter) return false;
      if (!q) return true;
      return (
        row.student.student_name.toLowerCase().includes(q) ||
        String(row.student.roll ?? '').includes(q) ||
        (row.student.guardian_phone || '').toLowerCase().includes(q) ||
        (row.student.registration_number || '').toLowerCase().includes(q) ||
        (row.room?.room_number || '').toLowerCase().includes(q)
      );
    });
  }, [directoryRows, dirClassFilter, dirResFilter, dirFeeFilter, dirSearch]);

  // Directory counts for filter chips
  const dirCounts = useMemo(() => {
    let residential = 0;
    let non_residential = 0;
    let day_care = 0;
    let full_paid = 0;
    let half_free = 0;
    let lillah_free = 0;

    for (const row of directoryRows) {
      if (dirClassFilter !== 'all' && row.student.class_id !== dirClassFilter) continue;
      if (row.residentialType === 'residential') residential++;
      else if (row.residentialType === 'day_care') day_care++;
      else non_residential++;

      if (row.feeCategory === 'lillah_free') lillah_free++;
      else if (row.feeCategory === 'half_free') half_free++;
      else full_paid++;
    }
    return {
      total: residential + non_residential + day_care,
      residential,
      non_residential,
      day_care,
      full_paid,
      half_free,
      lillah_free,
    };
  }, [directoryRows, dirClassFilter]);

  // Sync student notes residential_status cleanly without losing other ADM_EXTRA keys
  const syncStudentNotesResidentialStatus = async (
    student: Student,
    resType: HostelResidentialType
  ) => {
    if (!madrasah?.id) return;
    const existingExtra = extractStudentExtraFields(student);
    const updatedNotes = packStudentNotesWithExtra(student.notes, {
      ...existingExtra,
      residential_status: residentialTypeToNoteLabel(resType),
    });

    const { error } = await supabase
      .from('students')
      .update({ notes: updatedNotes })
      .eq('id', student.id)
      .eq('institution_id', madrasah.id);

    if (error) {
      console.warn('Could not sync students.notes residential_status:', error);
    }
  };

  // Helper: suggest next available seat number in a room
  const getNextSeatSuggestion = useCallback(
    (roomId: string, capacity: number): string => {
      const occupants = allocationsByRoom.get(roomId) || [];
      const used = new Set(occupants.map((o) => (o.allocation.seat_number || '').trim()));
      for (let i = 1; i <= Math.max(capacity, occupants.length + 1); i++) {
        const str = String(i);
        if (!used.has(str)) return str;
      }
      return String(occupants.length + 1);
    },
    [allocationsByRoom]
  );

  // Room Modal Handlers
  const openAddRoomModal = () => {
    setEditingRoom(null);
    setRoomForm({
      building_name: rooms[0]?.building_name || (isBn ? 'মূল ভবন' : 'Main Building'),
      floor_name: '',
      room_number: '',
      room_title: '',
      gender: 'male',
      capacity: '6',
      monthly_seat_fee: '0',
      warden_name: '',
      warden_phone: '',
      is_active: true,
    });
    setRoomModalOpen(true);
  };

  const openEditRoomModal = (room: HostelRoom) => {
    setEditingRoom(room);
    setRoomForm({
      building_name: room.building_name || '',
      floor_name: room.floor_name || '',
      room_number: room.room_number || '',
      room_title: room.room_title || '',
      gender: room.gender || 'male',
      capacity: String(room.capacity ?? 6),
      monthly_seat_fee: String(room.monthly_seat_fee ?? 0),
      warden_name: room.warden_name || '',
      warden_phone: room.warden_phone || '',
      is_active: room.is_active !== false,
    });
    setRoomModalOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id) return;

    const buildingName = roomForm.building_name.trim();
    const roomNumber = roomForm.room_number.trim();
    const capacityNum = parseInt(roomForm.capacity, 10);
    const feeNum = parseFloat(roomForm.monthly_seat_fee || '0');

    if (!buildingName || !roomNumber) {
      showToast('error', isBn ? 'ভবনের নাম ও রুম নম্বর অবশ্যই দিতে হবে।' : 'Building name and room number are required.');
      return;
    }
    if (isNaN(capacityNum) || capacityNum < 1 || capacityNum > 200) {
      showToast('error', isBn ? 'সিট সংখ্যা ১ থেকে ২০০ এর মধ্যে হতে হবে।' : 'Capacity must be between 1 and 200.');
      return;
    }
    if (isNaN(feeNum) || feeNum < 0) {
      showToast('error', isBn ? 'মাসিক সিট ফি ০ বা তার বেশি হতে হবে।' : 'Monthly seat fee must be 0 or greater.');
      return;
    }

    // Duplicate building + room_number check within institution
    const duplicate = rooms.find(
      (r) =>
        r.id !== editingRoom?.id &&
        r.building_name.trim().toLowerCase() === buildingName.toLowerCase() &&
        r.room_number.trim().toLowerCase() === roomNumber.toLowerCase()
    );
    if (duplicate) {
      showToast(
        'error',
        isBn
          ? `${buildingName}-এ রুম ${roomNumber} ইতিমধ্যে রয়েছে।`
          : `Room ${roomNumber} already exists in ${buildingName}.`
      );
      return;
    }

    if (editingRoom) {
      const currentOccupied = (allocationsByRoom.get(editingRoom.id) || []).length;
      if (capacityNum < currentOccupied) {
        showToast(
          'error',
          isBn
            ? `এই রুমে বর্তমানে ${toBnDigit(currentOccupied)} জন শিক্ষার্থী আছে। সিট সংখ্যা তার কম করা যাবে না।`
            : `Room currently has ${currentOccupied} assigned students. Capacity cannot be lower.`
        );
        return;
      }
    }

    setRoomSaving(true);
    try {
      const payload = {
        institution_id: madrasah.id,
        building_name: buildingName,
        floor_name: roomForm.floor_name.trim() || null,
        room_number: roomNumber,
        room_title: roomForm.room_title.trim() || null,
        gender: roomForm.gender,
        capacity: capacityNum,
        monthly_seat_fee: feeNum,
        warden_name: roomForm.warden_name.trim() || null,
        warden_phone: roomForm.warden_phone.trim() || null,
        is_active: roomForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingRoom) {
        const { error } = await supabase
          .from('hostel_rooms')
          .update(payload)
          .eq('id', editingRoom.id)
          .eq('institution_id', madrasah.id);
        if (error) throw error;
        showToast('success', isBn ? 'রুমের তথ্য সফলভাবে আপডেট হয়েছে।' : 'Room updated successfully.');
      } else {
        const { error } = await supabase.from('hostel_rooms').insert(payload);
        if (error) throw error;
        showToast('success', isBn ? 'নতুন রুম সফলভাবে যোগ করা হয়েছে।' : 'New room added successfully.');
      }

      setRoomModalOpen(false);
      await fetchAllData(true);
    } catch (err: any) {
      console.error('Save room error:', err);
      showToast('error', err?.message || (isBn ? 'রুম সংরক্ষণ করতে সমস্যা হয়েছে।' : 'Failed to save room.'));
    } finally {
      setRoomSaving(false);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!madrasah?.id || !deleteRoomTarget) return;
    const occupants = allocationsByRoom.get(deleteRoomTarget.id) || [];
    if (occupants.length > 0) {
      showToast(
        'error',
        isBn
          ? 'রুমে শিক্ষার্থী থাকা অবস্থায় মুছে ফেলা যাবে না। আগে তাদের সিট পরিবর্তন বা খালি করুন।'
          : 'Cannot delete a room with assigned students. Transfer or vacate them first.'
      );
      setDeleteRoomTarget(null);
      return;
    }

    setDeletingRoom(true);
    try {
      const { error } = await supabase
        .from('hostel_rooms')
        .delete()
        .eq('id', deleteRoomTarget.id)
        .eq('institution_id', madrasah.id);
      if (error) throw error;
      showToast('success', isBn ? 'রুম মুছে ফেলা হয়েছে।' : 'Room deleted successfully.');
      setDeleteRoomTarget(null);
      await fetchAllData(true);
    } catch (err: any) {
      console.error('Delete room error:', err);
      showToast('error', err?.message || (isBn ? 'রুম মুছতে সমস্যা হয়েছে।' : 'Failed to delete room.'));
    } finally {
      setDeletingRoom(false);
    }
  };

  // Assign Seat Modal Handlers
  const openAssignSeatModal = (room: HostelRoom) => {
    setAssignModalRoom(room);
    setAssignStudentSearch('');
    setAssignClassFilter('all');
    setAssignStudentId('');
    setAssignSeatNumber(getNextSeatSuggestion(room.id, room.capacity));
    setAssignFeeCategory('full_paid');
    setAssignMonthlyFee(String(room.monthly_seat_fee ?? 0));
    setAssignNotes('');
  };

  const computeSuggestedFee = (baseFee: number, category: HostelFeeCategory): string => {
    if (category === 'lillah_free') return '0';
    if (category === 'half_free') return String(Math.round(baseFee / 2));
    return String(baseFee);
  };

  const handleAssignFeeCategoryChange = (cat: HostelFeeCategory) => {
    setAssignFeeCategory(cat);
    const baseFee = Number(assignModalRoom?.monthly_seat_fee || 0);
    setAssignMonthlyFee(computeSuggestedFee(baseFee, cat));
  };

  const assignableStudents = useMemo(() => {
    if (!assignModalRoom) return [];
    const q = assignStudentSearch.trim().toLowerCase();
    return directoryRows
      .filter((row) => {
        if (assignClassFilter !== 'all' && row.student.class_id !== assignClassFilter) return false;
        // Hide students already seated in any room (they should use Transfer instead)
        if (row.room) return false;
        if (!q) return true;
        return (
          row.student.student_name.toLowerCase().includes(q) ||
          String(row.student.roll ?? '').includes(q) ||
          (row.student.guardian_phone || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Show residential students without a room first!
        const aScore = a.residentialType === 'residential' ? 0 : 1;
        const bScore = b.residentialType === 'residential' ? 0 : 1;
        if (aScore !== bScore) return aScore - bScore;
        return a.student.student_name.localeCompare(b.student.student_name);
      });
  }, [assignModalRoom, directoryRows, assignClassFilter, assignStudentSearch]);

  const handleConfirmAssignSeat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id || !assignModalRoom) return;

    if (!assignStudentId) {
      showToast('error', isBn ? 'একজন শিক্ষার্থী নির্বাচন করুন।' : 'Please select a student.');
      return;
    }

    const currentOccupants = allocationsByRoom.get(assignModalRoom.id) || [];
    if (currentOccupants.length >= assignModalRoom.capacity) {
      showToast('error', isBn ? 'এই রুমে আর কোনো খালি সিট নেই।' : 'No available seats left in this room.');
      return;
    }

    const feeNum = parseFloat(assignMonthlyFee || '0');
    if (isNaN(feeNum) || feeNum < 0) {
      showToast('error', isBn ? 'সঠিক মাসিক ফি দিন।' : 'Please enter a valid monthly fee.');
      return;
    }

    const student = studentMap.get(assignStudentId);
    if (!student) return;

    setAssignSaving(true);
    try {
      const today = getTodayDateString();
      const existingAlloc = activeAllocationByStudent.get(assignStudentId);

      // If student already had an unseated active directory record, archive/close it first for clean 1-active-row invariant
      if (existingAlloc) {
        const { error: vacatePrevErr } = await supabase
          .from('hostel_allocations')
          .update({
            status: 'vacated',
            vacated_at: today,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAlloc.id)
          .eq('institution_id', madrasah.id);
        if (vacatePrevErr) throw vacatePrevErr;
      }

      const { error: insertErr } = await supabase.from('hostel_allocations').insert({
        institution_id: madrasah.id,
        student_id: assignStudentId,
        room_id: assignModalRoom.id,
        seat_number: assignSeatNumber.trim() || null,
        residential_type: 'residential',
        fee_category: assignFeeCategory,
        monthly_boarding_fee: feeNum,
        status: 'active',
        allocated_at: today,
        notes: assignNotes.trim() || null,
      });
      if (insertErr) throw insertErr;

      await syncStudentNotesResidentialStatus(student, 'residential');

      showToast(
        'success',
        isBn
          ? `${student.student_name}-কে রুম ${assignModalRoom.room_number}-এ সিট বরাদ্দ করা হয়েছে।`
          : `Assigned ${student.student_name} to Room ${assignModalRoom.room_number}.`
      );
      setAssignModalRoom(null);
      await fetchAllData(true);
    } catch (err: any) {
      console.error('Assign seat error:', err);
      showToast('error', err?.message || (isBn ? 'সিট বরাদ্দ করতে সমস্যা হয়েছে।' : 'Failed to assign seat.'));
    } finally {
      setAssignSaving(false);
    }
  };

  // Transfer Room Modal Handlers
  const availableTransferRooms = useMemo(() => {
    if (!transferTarget) return [];
    return rooms
      .filter((r) => {
        if (!r.is_active) return false;
        if (r.id === transferTarget.fromRoom.id) return false;
        const occ = (allocationsByRoom.get(r.id) || []).length;
        return occ < r.capacity;
      })
      .map((r) => ({
        room: r,
        occupied: (allocationsByRoom.get(r.id) || []).length,
      }));
  }, [rooms, transferTarget, allocationsByRoom]);

  const openTransferModal = (allocation: HostelAllocation, student: Student, fromRoom: HostelRoom) => {
    setTransferTarget({ allocation, student, fromRoom });
    const firstAvailable = rooms.find((r) => {
      if (!r.is_active || r.id === fromRoom.id) return false;
      return (allocationsByRoom.get(r.id) || []).length < r.capacity;
    });
    if (firstAvailable) {
      setTransferToRoomId(firstAvailable.id);
      setTransferSeatNumber(getNextSeatSuggestion(firstAvailable.id, firstAvailable.capacity));
    } else {
      setTransferToRoomId('');
      setTransferSeatNumber('');
    }
    setTransferSyncFee(false);
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id || !transferTarget || !transferToRoomId) return;

    const destRoom = roomMap.get(transferToRoomId);
    if (!destRoom) return;
    const destOccupied = (allocationsByRoom.get(destRoom.id) || []).length;
    if (destOccupied >= destRoom.capacity) {
      showToast('error', isBn ? 'নির্বাচিত রুমে কোনো খালি সিট নেই।' : 'Target room has no available seats.');
      return;
    }

    setTransferSaving(true);
    try {
      const today = getTodayDateString();

      // 1. Mark current allocation as vacated (preserves full transfer history)
      const { error: closeErr } = await supabase
        .from('hostel_allocations')
        .update({
          status: 'vacated',
          vacated_at: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transferTarget.allocation.id)
        .eq('institution_id', madrasah.id);
      if (closeErr) throw closeErr;

      const nextFee = transferSyncFee
        ? Number(computeSuggestedFee(Number(destRoom.monthly_seat_fee || 0), transferTarget.allocation.fee_category))
        : Number(transferTarget.allocation.monthly_boarding_fee || 0);

      // 2. Create new active allocation in target room
      const { error: insertErr } = await supabase.from('hostel_allocations').insert({
        institution_id: madrasah.id,
        student_id: transferTarget.student.id,
        room_id: destRoom.id,
        seat_number: transferSeatNumber.trim() || null,
        residential_type: 'residential',
        fee_category: transferTarget.allocation.fee_category,
        monthly_boarding_fee: nextFee,
        status: 'active',
        allocated_at: today,
        notes: transferTarget.allocation.notes || null,
      });
      if (insertErr) throw insertErr;

      showToast(
        'success',
        isBn
          ? `${transferTarget.student.student_name}-কে রুম ${destRoom.room_number}-এ স্থানান্তর করা হয়েছে।`
          : `Transferred ${transferTarget.student.student_name} to Room ${destRoom.room_number}.`
      );
      setTransferTarget(null);
      await fetchAllData(true);
    } catch (err: any) {
      console.error('Transfer room error:', err);
      showToast('error', err?.message || (isBn ? 'রুম পরিবর্তন করতে সমস্যা হয়েছে।' : 'Failed to transfer room.'));
    } finally {
      setTransferSaving(false);
    }
  };

  // Vacate Seat Handler
  const handleConfirmVacate = async () => {
    if (!madrasah?.id || !vacateTarget) return;
    setVacateSaving(true);
    try {
      const today = getTodayDateString();
      const { error } = await supabase
        .from('hostel_allocations')
        .update({
          status: 'vacated',
          vacated_at: today,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vacateTarget.allocation.id)
        .eq('institution_id', madrasah.id);
      if (error) throw error;

      showToast(
        'success',
        isBn
          ? `${vacateTarget.student.student_name}-এর সিট খালি করা হয়েছে।`
          : `Vacated seat for ${vacateTarget.student.student_name}.`
      );
      setVacateTarget(null);
      await fetchAllData(true);
    } catch (err: any) {
      console.error('Vacate seat error:', err);
      showToast('error', err?.message || (isBn ? 'সিট খালি করতে সমস্যা হয়েছে।' : 'Failed to vacate seat.'));
    } finally {
      setVacateSaving(false);
    }
  };

  // Tab 2: Quick Update Student Residential & Fee Category
  const openEditStudentModal = (row: (typeof directoryRows)[number]) => {
    setEditStudentTarget({
      student: row.student,
      allocation: row.allocation,
      currentResType: row.residentialType,
    });
    setEditResType(row.residentialType);
    setEditFeeCategory(row.feeCategory);
    setEditMonthlyFee(String(row.monthlyBoardingFee ?? 0));
    setEditStudentNotes(row.allocation?.notes || '');
  };

  const handleSaveStudentDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id || !editStudentTarget) return;

    const feeNum = parseFloat(editMonthlyFee || '0');
    if (isNaN(feeNum) || feeNum < 0) {
      showToast('error', isBn ? 'মাসিক ফি ০ বা তার বেশি হতে হবে।' : 'Monthly fee must be 0 or greater.');
      return;
    }

    setEditStudentSaving(true);
    try {
      const today = getTodayDateString();
      const { student, allocation } = editStudentTarget;
      const shouldKeepRoom = editResType === 'residential' && !!allocation?.room_id;

      if (allocation) {
        if (allocation.room_id && editResType !== 'residential') {
          // Switching away from residential vacates the room history cleanly and records the new status
          const { error: closeErr } = await supabase
            .from('hostel_allocations')
            .update({
              status: 'vacated',
              vacated_at: today,
              updated_at: new Date().toISOString(),
            })
            .eq('id', allocation.id)
            .eq('institution_id', madrasah.id);
          if (closeErr) throw closeErr;

          const { error: insertErr } = await supabase.from('hostel_allocations').insert({
            institution_id: madrasah.id,
            student_id: student.id,
            room_id: null,
            seat_number: null,
            residential_type: editResType,
            fee_category: editFeeCategory,
            monthly_boarding_fee: feeNum,
            status: 'active',
            allocated_at: today,
            notes: editStudentNotes.trim() || null,
          });
          if (insertErr) throw insertErr;
        } else {
          const { error: updErr } = await supabase
            .from('hostel_allocations')
            .update({
              residential_type: editResType,
              fee_category: editFeeCategory,
              monthly_boarding_fee: feeNum,
              room_id: shouldKeepRoom ? allocation.room_id : null,
              seat_number: shouldKeepRoom ? allocation.seat_number : null,
              notes: editStudentNotes.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', allocation.id)
            .eq('institution_id', madrasah.id);
          if (updErr) throw updErr;
        }
      } else {
        const { error: insertErr } = await supabase.from('hostel_allocations').insert({
          institution_id: madrasah.id,
          student_id: student.id,
          room_id: null,
          seat_number: null,
          residential_type: editResType,
          fee_category: editFeeCategory,
          monthly_boarding_fee: feeNum,
          status: 'active',
          allocated_at: today,
          notes: editStudentNotes.trim() || null,
        });
        if (insertErr) throw insertErr;
      }

      await syncStudentNotesResidentialStatus(student, editResType);

      showToast(
        'success',
        isBn
          ? `${student.student_name}-এর আবাসিক ও ফি তথ্য আপডেট হয়েছে।`
          : `Updated residential & fee profile for ${student.student_name}.`
      );
      setEditStudentTarget(null);
      await fetchAllData(true);
    } catch (err: any) {
      console.error('Update student residential profile error:', err);
      showToast(
        'error',
        err?.message || (isBn ? 'তথ্য আপডেট করতে সমস্যা হয়েছে।' : 'Failed to update residential profile.')
      );
    } finally {
      setEditStudentSaving(false);
    }
  };

  // UI label helpers
  const genderLabel = (g: HostelRoomGender) => {
    if (g === 'male') return isBn ? 'বালক / ছাত্র' : 'Boys / Male';
    if (g === 'female') return isBn ? 'বালিকা / ছাত্রী' : 'Girls / Female';
    return isBn ? 'সকলের জন্য' : 'Any';
  };

  const resBadge = (type: HostelResidentialType) => {
    if (type === 'residential') {
      return {
        label: isBn ? 'আবাসিক' : 'Residential',
        cls: isDark
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (type === 'day_care') {
      return {
        label: isBn ? 'ডে-কেয়ার' : 'Day-Care',
        cls: isDark
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: isBn ? 'অনাবাসিক' : 'Non-Residential',
      cls: isDark
        ? 'bg-slate-700/70 text-slate-300 border-slate-600'
        : 'bg-slate-100 text-slate-600 border-slate-200',
    };
  };

  const feeBadge = (cat: HostelFeeCategory) => {
    if (cat === 'lillah_free') {
      return {
        label: isBn ? 'লিল্লাহ/ফ্রি' : 'Lillah / Free',
        cls: isDark
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    if (cat === 'half_free') {
      return {
        label: isBn ? 'অর্ধ-ফ্রি' : 'Half-Free',
        cls: isDark
          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
          : 'bg-purple-50 text-purple-700 border-purple-200',
      };
    }
    return {
      label: isBn ? 'পূর্ণ ফি' : 'Full Paid',
      cls: isDark
        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
        : 'bg-blue-50 text-blue-700 border-blue-200',
    };
  };

  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-white'
    : 'bg-white border-blue-100/80 text-slate-800';
  const inputCls = isDark
    ? 'w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40'
    : 'w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white';

  // ===================== PHASE 2: DAILY MEAL ATTENDANCE & LIVE KITCHEN =====================
  const [mealDate, setMealDate] = useState<string>(() => getTodayDateString());
  const [mealSubView, setMealSubView] = useState<'attendance' | 'kitchen'>(
    kitchenOnlyMode ? 'kitchen' : 'attendance'
  );
  const [mealRoomFilter, setMealRoomFilter] = useState<string>('all');
  const [mealClassFilter, setMealClassFilter] = useState<string>('all');
  const [mealSearch, setMealSearch] = useState<string>('');

  const [mealLogs, setMealLogs] = useState<HostelMealLog[]>([]);
  const [mealLeaves, setMealLeaves] = useState<HostelLeave[]>([]);
  const [mealDraft, setMealDraft] = useState<
    Record<string, { morning: HostelMealStatus; noon: HostelMealStatus; night: HostelMealStatus }>
  >({});
  const [mealDirty, setMealDirty] = useState<boolean>(false);
  const [mealLoading, setMealLoading] = useState<boolean>(false);
  const [mealSaving, setMealSaving] = useState<boolean>(false);
  const [mealSchemaMissing, setMealSchemaMissing] = useState<boolean>(false);
  const mealColumnStyleRef = useRef<'short' | 'status'>('short');

  const [kitchenAutoRefresh, setKitchenAutoRefresh] = useState<boolean>(kitchenOnlyMode);
  const [lastKitchenSync, setLastKitchenSync] = useState<string>('');
  const [guestCounts, setGuestCounts] = useState<{ morning: number; noon: number; night: number }>({
    morning: 0,
    noon: 0,
    night: 0,
  });

  // Load persisted teacher/guest meal counts per institution + date
  useEffect(() => {
    if (!madrasah?.id) return;
    try {
      const raw = localStorage.getItem(`hostel_guest_meals_${madrasah.id}_${mealDate}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        setGuestCounts({
          morning: Math.max(0, Number(parsed?.morning || 0)),
          noon: Math.max(0, Number(parsed?.noon || 0)),
          night: Math.max(0, Number(parsed?.night || 0)),
        });
      } else {
        setGuestCounts({ morning: 0, noon: 0, night: 0 });
      }
    } catch {
      setGuestCounts({ morning: 0, noon: 0, night: 0 });
    }
  }, [madrasah?.id, mealDate]);

  const updateGuestCount = useCallback(
    (meal: MealKey, delta: number) => {
      setGuestCounts((prev) => {
        const nextVal = Math.max(0, Math.min(500, (prev[meal] || 0) + delta));
        const next = { ...prev, [meal]: nextVal };
        if (madrasah?.id) {
          try {
            localStorage.setItem(`hostel_guest_meals_${madrasah.id}_${mealDate}`, JSON.stringify(next));
          } catch {
            // ignore storage quota errors
          }
        }
        return next;
      });
    },
    [madrasah?.id, mealDate]
  );

  const [leaveSchemaMissing, setLeaveSchemaMissing] = useState<boolean>(false);

  const fetchMealData = useCallback(
    async (targetDate: string, silent = false) => {
      if (!madrasah?.id) return;
      if (!silent) setMealLoading(true);
      setMealSchemaMissing(false);
      setLeaveSchemaMissing(false);

      try {
        const [logsRes, leavesRes] = await Promise.all([
          supabase
            .from('hostel_meal_logs')
            .select('*')
            .eq('institution_id', madrasah.id)
            .eq('log_date', targetDate),
          supabase
            .from('hostel_leaves')
            .select('*')
            .eq('institution_id', madrasah.id)
            .order('created_at', { ascending: false }),
        ]);

        if (isMissingTableError(logsRes.error)) {
          setMealSchemaMissing(true);
          setMealLogs([]);
        } else if (logsRes.error) {
          throw logsRes.error;
        } else {
          const rows = (logsRes.data || []) as HostelMealLog[];
          if (rows.length > 0 && 'morning_status' in rows[0] && !('morning' in rows[0])) {
            mealColumnStyleRef.current = 'status';
          } else if (rows.length > 0 && 'morning' in rows[0]) {
            mealColumnStyleRef.current = 'short';
          }
          setMealLogs(rows);
        }

        if (leavesRes.error) {
          if (isMissingTableError(leavesRes.error)) {
            setLeaveSchemaMissing(true);
          } else {
            console.warn('Hostel leaves fetch warning:', leavesRes.error);
          }
          setMealLeaves([]);
        } else {
          setMealLeaves((leavesRes.data || []) as HostelLeave[]);
        }

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        setLastKitchenSync(isBn ? toBnDigit(`${hh}:${mm}`) : `${hh}:${mm}`);
      } catch (err: any) {
        console.error('HostelManagement meal load error:', err);
        if (!silent) {
          showToast(
            'error',
            err?.message || (isBn ? 'মিল হাজিরা লোড করতে সমস্যা হয়েছে।' : 'Failed to load meal logs.')
          );
        }
      } finally {
        if (!silent) setMealLoading(false);
      }
    },
    [madrasah?.id, isBn, showToast]
  );

  // ===================== PHASE 3: GATE PASS & NIGHT ROLL CALL STATE =====================
  const [gatePassSubView, setGatePassSubView] = useState<'leaves' | 'night_roll'>('leaves');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'all' | 'out' | 'returned'>('all');
  const [leaveSearch, setLeaveSearch] = useState<string>('');
  const [gatePassSaving, setGatePassSaving] = useState<boolean>(false);
  const [markingReturnId, setMarkingReturnId] = useState<string | null>(null);
  const [gatePassStudentSearch, setGatePassStudentSearch] = useState<string>('');
  const [gatePassForm, setGatePassForm] = useState({
    student_id: '',
    guardian_name: '',
    guardian_relation: 'বাবা',
    guardian_phone: '',
    leave_from: getTodayDateString(),
    expected_return: shiftDateStr(getTodayDateString(), 1),
    reason: '',
    approved_by: '',
  });

  // Night Roll Call state (stored in hostel_meal_logs.night_roll_status)
  const [nightRollRoomFilter, setNightRollRoomFilter] = useState<string>('all');
  const [nightRollSearch, setNightRollSearch] = useState<string>('');
  const [nightRollDraft, setNightRollDraft] = useState<Record<string, HostelNightRollStatus>>({});
  const [nightRollDirty, setNightRollDirty] = useState<boolean>(false);
  const [nightRollSaving, setNightRollSaving] = useState<boolean>(false);

  // Fetch meal logs & leaves when entering Meals/GatePass tab, kitchenOnlyMode, or changing date
  useEffect(() => {
    if (!madrasah?.id) return;
    if (kitchenOnlyMode || activeTab === 'meals' || activeTab === 'gatepass') {
      setMealDraft({});
      setMealDirty(false);
      setNightRollDraft({});
      setNightRollDirty(false);
      fetchMealData(mealDate);
    }
  }, [madrasah?.id, mealDate, activeTab, kitchenOnlyMode, fetchMealData]);

  // Live Kitchen auto-refresh every 60 seconds when enabled
  useEffect(() => {
    const isKitchenActive =
      kitchenOnlyMode || (activeTab === 'meals' && mealSubView === 'kitchen');
    if (!isKitchenActive || !kitchenAutoRefresh || !madrasah?.id) return;

    const timer = window.setInterval(() => {
      fetchMealData(mealDate, true);
      fetchAllData(true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [
    kitchenOnlyMode,
    activeTab,
    mealSubView,
    kitchenAutoRefresh,
    madrasah?.id,
    mealDate,
    fetchMealData,
    fetchAllData,
  ]);

  const mealLogByStudent = useMemo(() => {
    const map = new Map<string, HostelMealLog>();
    for (const log of mealLogs) {
      map.set(log.student_id, log);
    }
    return map;
  }, [mealLogs]);

  const activeLeaveByStudent = useMemo(() => {
    const map = new Map<string, HostelLeave>();
    for (const leave of mealLeaves) {
      if (isLeaveCoveringDate(leave, mealDate)) {
        map.set(leave.student_id, leave);
      }
    }
    return map;
  }, [mealLeaves, mealDate]);

  // All residential & day-care students eligible for daily meal attendance
  const mealEligibleRows = useMemo(() => {
    return directoryRows
      .filter(
        (row) => row.residentialType === 'residential' || row.residentialType === 'day_care'
      )
      .map((row) => {
        const savedLog = mealLogByStudent.get(row.student.id) || null;
        const activeLeave = activeLeaveByStudent.get(row.student.id) || null;
        const isOnLeave = Boolean(activeLeave);

        const defaultStatuses: {
          morning: HostelMealStatus;
          noon: HostelMealStatus;
          night: HostelMealStatus;
        } = savedLog
          ? {
              morning: normalizeMealStatus(savedLog.morning ?? savedLog.morning_status),
              noon: normalizeMealStatus(savedLog.noon ?? savedLog.noon_status),
              night: normalizeMealStatus(savedLog.night ?? savedLog.night_status),
            }
          : isOnLeave
          ? { morning: 'off', noon: 'off', night: 'off' }
          : { morning: 'present', noon: 'present', night: 'present' };

        const statuses = mealDraft[row.student.id] || defaultStatuses;

        return {
          ...row,
          savedLog,
          activeLeave,
          isOnLeave,
          statuses,
        };
      });
  }, [directoryRows, mealLogByStudent, activeLeaveByStudent, mealDraft]);

  const filteredMealRows = useMemo(() => {
    const q = mealSearch.trim().toLowerCase();
    return mealEligibleRows.filter((row) => {
      if (mealRoomFilter === 'unassigned' && row.room) return false;
      if (mealRoomFilter !== 'all' && mealRoomFilter !== 'unassigned' && row.room?.id !== mealRoomFilter) {
        return false;
      }
      if (mealClassFilter !== 'all' && row.student.class_id !== mealClassFilter) return false;
      if (!q) return true;
      return (
        row.student.student_name.toLowerCase().includes(q) ||
        String(row.student.roll ?? '').includes(q) ||
        (row.room?.room_number || '').toLowerCase().includes(q) ||
        (row.student.guardian_phone || '').toLowerCase().includes(q)
      );
    });
  }, [mealEligibleRows, mealRoomFilter, mealClassFilter, mealSearch]);

  const mealSummary = useMemo(() => {
    const calcMeal = (key: MealKey) => {
      let full = 0;
      let half = 0;
      let off = 0;
      for (const row of mealEligibleRows) {
        const st = row.statuses[key];
        if (st === 'present') full++;
        else if (st === 'half') half++;
        else off++;
      }
      const cookCount = full + half * 0.5;
      const guests = guestCounts[key] || 0;
      return {
        full,
        half,
        off,
        cookCount,
        guests,
        totalPlates: cookCount + guests,
      };
    };

    const totalEligible = mealEligibleRows.length;
    const loggedCount = mealEligibleRows.filter((r) => r.savedLog !== null).length;
    const onLeaveCount = mealEligibleRows.filter((r) => r.isOnLeave).length;
    const allOffCount = mealEligibleRows.filter(
      (r) =>
        r.statuses.morning === 'off' &&
        r.statuses.noon === 'off' &&
        r.statuses.night === 'off'
    ).length;

    return {
      totalEligible,
      loggedCount,
      onLeaveCount,
      allOffCount,
      morning: calcMeal('morning'),
      noon: calcMeal('noon'),
      night: calcMeal('night'),
    };
  }, [mealEligibleRows, guestCounts]);

  const handleToggleMealStatus = useCallback(
    (
      studentId: string,
      currentStatuses: { morning: HostelMealStatus; noon: HostelMealStatus; night: HostelMealStatus },
      meal: MealKey
    ) => {
      setMealDraft((prev) => {
        const base = prev[studentId] || currentStatuses;
        return {
          ...prev,
          [studentId]: {
            ...base,
            [meal]: cycleMealStatus(base[meal]),
          },
        };
      });
      setMealDirty(true);
    },
    []
  );

  const handleMarkAllPresent = useCallback(() => {
    const nextDraft: Record<
      string,
      { morning: HostelMealStatus; noon: HostelMealStatus; night: HostelMealStatus }
    > = {};
    let markedCount = 0;
    for (const row of mealEligibleRows) {
      if (row.isOnLeave) {
        nextDraft[row.student.id] = { morning: 'off', noon: 'off', night: 'off' };
      } else {
        nextDraft[row.student.id] = { morning: 'present', noon: 'present', night: 'present' };
        markedCount++;
      }
    }
    setMealDraft(nextDraft);
    setMealDirty(true);
    showToast(
      'success',
      isBn
        ? `${toBnDigit(markedCount)} জন আবাসিককে উপস্থিত করা হয়েছে। সংরক্ষণ করতে "সেভ করুন" চাপুন।`
        : `Marked ${markedCount} boarders present. Tap Save to persist.`
    );
  }, [mealEligibleRows, isBn, showToast]);

  const handleSaveMealLogs = useCallback(async () => {
    if (!madrasah?.id || mealEligibleRows.length === 0) return;

    setMealSaving(true);
    try {
      const nowIso = new Date().toISOString();

      const buildPayload = (style: 'short' | 'status', includeOptionalMeta: boolean) =>
        mealEligibleRows.map((row) => {
          const base: Record<string, any> = {
            institution_id: madrasah.id,
            student_id: row.student.id,
            log_date: mealDate,
          };
          if (style === 'short') {
            base.morning = row.statuses.morning;
            base.noon = row.statuses.noon;
            base.night = row.statuses.night;
          } else {
            base.morning_status = row.statuses.morning;
            base.noon_status = row.statuses.noon;
            base.night_status = row.statuses.night;
          }
          if (includeOptionalMeta) {
            base.notes = row.isOnLeave ? 'ছুটিতে' : null;
            base.marked_by = profile?.id || null;
            base.updated_at = nowIso;
          }
          return base;
        });

      let style = mealColumnStyleRef.current;
      let includeMeta = true;

      let res = await supabase
        .from('hostel_meal_logs')
        .upsert(buildPayload(style, includeMeta), {
          onConflict: 'institution_id,student_id,log_date',
        });

      // Defensive fallback if live Supabase table uses morning_status/noon_status/night_status or omits marked_by/updated_at
      if (res.error) {
        const msg = String(res.error.message || '').toLowerCase();
        if (msg.includes('morning') || msg.includes('noon') || msg.includes('night')) {
          style = style === 'short' ? 'status' : 'short';
          mealColumnStyleRef.current = style;
          res = await supabase
            .from('hostel_meal_logs')
            .upsert(buildPayload(style, includeMeta), {
              onConflict: 'institution_id,student_id,log_date',
            });
        }
      }

      if (res.error) {
        const msg = String(res.error.message || '').toLowerCase();
        if (msg.includes('marked_by') || msg.includes('updated_at') || msg.includes('notes')) {
          includeMeta = false;
          res = await supabase
            .from('hostel_meal_logs')
            .upsert(buildPayload(style, includeMeta), {
              onConflict: 'institution_id,student_id,log_date',
            });
        }
      }

      if (res.error) throw res.error;

      setMealDraft({});
      setMealDirty(false);
      await fetchMealData(mealDate, true);
      showToast(
        'success',
        isBn
          ? `${toBnDigit(mealEligibleRows.length)} জন শিক্ষার্থীর মিল হাজিরা সফলভাবে সংরক্ষিত হয়েছে।`
          : `Saved daily meal attendance for ${mealEligibleRows.length} students.`
      );
    } catch (err: any) {
      console.error('Save meal logs error:', err);
      showToast(
        'error',
        err?.message || (isBn ? 'মিল হাজিরা সংরক্ষণ করতে সমস্যা হয়েছে।' : 'Failed to save meal logs.')
      );
    } finally {
      setMealSaving(false);
    }
  }, [madrasah?.id, mealEligibleRows, mealDate, profile?.id, fetchMealData, isBn, showToast]);

  const handleRefreshKitchen = useCallback(async () => {
    await Promise.all([fetchAllData(true), fetchMealData(mealDate, true)]);
    showToast('success', isBn ? 'লাইভ মিল সংখ্যা আপডেট হয়েছে।' : 'Live kitchen counts updated.');
  }, [fetchAllData, fetchMealData, mealDate, isBn, showToast]);

  // ===================== PHASE 3: GATE PASS & NIGHT ROLL HELPERS / HANDLERS =====================
  const getLeaveFromDate = (lv: HostelLeave): string =>
    String(lv.leave_from || lv.start_date || lv.from_date || lv.out_date || '').slice(0, 10);

  const getLeaveExpectedReturn = (lv: HostelLeave): string =>
    String(lv.expected_return || lv.end_date || lv.to_date || lv.expected_return_date || '').slice(0, 10);

  const isLeaveReturned = (lv: HostelLeave): boolean => {
    const st = String(lv.status || '').trim().toLowerCase();
    return st === 'returned' || st === 'completed' || Boolean(lv.actual_return);
  };

  const residentialStudentsOnly = useMemo(() => {
    return directoryRows.filter((row) => row.residentialType === 'residential');
  }, [directoryRows]);

  const sendHostelParentNotification = useCallback(
    async (params: {
      student: Student;
      guardianPhone?: string | null;
      title: string;
      message: string;
    }) => {
      if (!madrasah?.id) return;
      const payload = {
        institution_id: madrasah.id,
        student_id: params.student.id,
        guardian_phone: params.guardianPhone || params.student.guardian_phone || null,
        title: params.title,
        message: params.message,
        type: 'hostel',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      // Insert into app_notifications (read by Parent Portal) and notifications (for compatibility)
      await Promise.allSettled([
        supabase.from('app_notifications').insert(payload),
        supabase.from('notifications').insert(payload),
      ]);
    },
    [madrasah?.id]
  );

  const openIssueGatePassModal = () => {
    const today = getTodayDateString();
    setGatePassStudentSearch('');
    setGatePassForm({
      student_id: '',
      guardian_name: '',
      guardian_relation: 'বাবা',
      guardian_phone: '',
      leave_from: today,
      expected_return: shiftDateStr(today, 1),
      reason: '',
      approved_by: profile?.full_name || '',
    });
    setGatePassModalOpen(true);
  };

  const handleSelectGatePassStudent = (studentId: string) => {
    const row = residentialStudentsOnly.find((r) => r.student.id === studentId);
    setGatePassForm((prev) => ({
      ...prev,
      student_id: studentId,
      guardian_name: row?.student.guardian_name || prev.guardian_name,
      guardian_phone: row?.student.guardian_phone || prev.guardian_phone,
      approved_by: prev.approved_by || row?.room?.warden_name || profile?.full_name || '',
    }));
  };

  const handleIssueGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id) return;

    if (!gatePassForm.student_id) {
      showToast('error', isBn ? 'একজন আবাসিক শিক্ষার্থী নির্বাচন করুন।' : 'Please select a residential student.');
      return;
    }
    const gName = gatePassForm.guardian_name.trim();
    const gPhone = gatePassForm.guardian_phone.trim();
    if (!gName || !gPhone) {
      showToast('error', isBn ? 'অভিভাবকের নাম ও মোবাইল নম্বর অবশ্যই দিতে হবে।' : 'Guardian name and phone are required.');
      return;
    }
    if (gatePassForm.expected_return < gatePassForm.leave_from) {
      showToast('error', isBn ? 'ফেরার তারিখ যাওয়ার তারিখের আগে হতে পারবে না।' : 'Expected return date cannot be before leave date.');
      return;
    }

    const stu = studentMap.get(gatePassForm.student_id);
    if (!stu) return;

    setGatePassSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const fullPayload: Record<string, any> = {
        institution_id: madrasah.id,
        student_id: gatePassForm.student_id,
        guardian_name: gName,
        guardian_relation: gatePassForm.guardian_relation.trim() || 'অভিভাবক',
        guardian_phone: gPhone,
        leave_from: gatePassForm.leave_from,
        expected_return: gatePassForm.expected_return,
        start_date: gatePassForm.leave_from,
        end_date: gatePassForm.expected_return,
        reason: gatePassForm.reason.trim() || null,
        approved_by: gatePassForm.approved_by.trim() || profile?.full_name || null,
        status: 'out',
        updated_at: nowIso,
      };

      let insertRes = await supabase.from('hostel_leaves').insert(fullPayload).select('*').single();

      // Defensive fallback if live Supabase table uses only Phase 3 columns (leave_from/expected_return) or only Phase 2 columns (start_date/end_date)
      if (insertRes.error) {
        const msg = String(insertRes.error.message || '').toLowerCase();
        if (msg.includes('start_date') || msg.includes('end_date')) {
          const { start_date: _s, end_date: _e, ...p3Only } = fullPayload;
          insertRes = await supabase.from('hostel_leaves').insert(p3Only).select('*').single();
        } else if (
          msg.includes('leave_from') ||
          msg.includes('expected_return') ||
          msg.includes('guardian_relation') ||
          msg.includes('approved_by')
        ) {
          insertRes = await supabase
            .from('hostel_leaves')
            .insert({
              institution_id: madrasah.id,
              student_id: gatePassForm.student_id,
              guardian_name: gName,
              guardian_phone: gPhone,
              start_date: gatePassForm.leave_from,
              end_date: gatePassForm.expected_return,
              reason: [
                gatePassForm.reason.trim(),
                gatePassForm.guardian_relation ? `(${gatePassForm.guardian_relation})` : '',
              ]
                .filter(Boolean)
                .join(' ') || null,
              status: 'out',
            })
            .select('*')
            .single();
        }
      }

      if (insertRes.error) throw insertRes.error;

      // Send Parent Portal notification
      const fromBn = formatReadableDate(gatePassForm.leave_from, true);
      const returnBn = formatReadableDate(gatePassForm.expected_return, true);
      await sendHostelParentNotification({
        student: stu,
        guardianPhone: gPhone,
        title: 'হোস্টেল গেট পাস ইস্যু হয়েছে',
        message: `${stu.student_name}-কে ${gName} (${gatePassForm.guardian_relation || 'অভিভাবক'})-এর জিম্মায় ${fromBn} তারিখে হোস্টেল থেকে বাড়ি যাওয়ার ছুটি (গেট পাস) দেওয়া হয়েছে। সম্ভাব্য ফেরার তারিখ: ${returnBn}।`,
      });

      setGatePassModalOpen(false);
      await fetchMealData(mealDate, true);
      showToast(
        'success',
        isBn
          ? `${stu.student_name}-এর গেট পাস সফলভাবে ইস্যু হয়েছে।`
          : `Gate Pass issued for ${stu.student_name}.`
      );
      if (insertRes.data) {
        setPrintGatePassTarget(insertRes.data as HostelLeave);
      }
    } catch (err: any) {
      console.error('Issue gate pass error:', err);
      showToast(
        'error',
        err?.message || (isBn ? 'গেট পাস ইস্যু করতে সমস্যা হয়েছে।' : 'Failed to issue gate pass.')
      );
    } finally {
      setGatePassSaving(false);
    }
  };

  const handleMarkReturned = async (leave: HostelLeave) => {
    if (!madrasah?.id) return;
    setMarkingReturnId(leave.id);
    try {
      const nowIso = new Date().toISOString();
      let updRes = await supabase
        .from('hostel_leaves')
        .update({
          status: 'returned',
          actual_return: nowIso,
          updated_at: nowIso,
        })
        .eq('id', leave.id)
        .eq('institution_id', madrasah.id);

      if (updRes.error && String(updRes.error.message || '').toLowerCase().includes('actual_return')) {
        updRes = await supabase
          .from('hostel_leaves')
          .update({
            status: 'returned',
            updated_at: nowIso,
          })
          .eq('id', leave.id)
          .eq('institution_id', madrasah.id);
      }

      if (updRes.error) throw updRes.error;

      const stu = studentMap.get(leave.student_id);
      if (stu) {
        await sendHostelParentNotification({
          student: stu,
          guardianPhone: leave.guardian_phone || stu.guardian_phone,
          title: 'হোস্টেলে প্রত্যাবর্তন নিশ্চিত',
          message: `আলহামদুলিল্লাহ, ${stu.student_name} ছুটি শেষে নিরাপদে হোস্টেলে ফিরে এসেছেন (${formatReadableDate(getTodayDateString(), true)})।`,
        });
      }

      await fetchMealData(mealDate, true);
      showToast(
        'success',
        isBn ? 'শিক্ষার্থীর হোস্টেলে ফেরা নিশ্চিত করা হয়েছে।' : 'Student marked as returned to hostel.'
      );
    } catch (err: any) {
      console.error('Mark returned error:', err);
      showToast(
        'error',
        err?.message || (isBn ? 'আপডেট করতে সমস্যা হয়েছে।' : 'Failed to mark student returned.')
      );
    } finally {
      setMarkingReturnId(null);
    }
  };

  // Filtered Gate Passes list
  const leaveCounts = useMemo(() => {
    let out = 0;
    let returned = 0;
    for (const lv of mealLeaves) {
      if (isLeaveReturned(lv)) returned++;
      else if (String(lv.status || '').toLowerCase() !== 'cancelled') out++;
    }
    return { all: mealLeaves.length, out, returned };
  }, [mealLeaves]);

  const filteredLeaves = useMemo(() => {
    const q = leaveSearch.trim().toLowerCase();
    return mealLeaves.filter((lv) => {
      const returned = isLeaveReturned(lv);
      if (leaveStatusFilter === 'out' && returned) return false;
      if (leaveStatusFilter === 'returned' && !returned) return false;
      if (!q) return true;
      const stu = studentMap.get(lv.student_id);
      const alloc = activeAllocationByStudent.get(lv.student_id);
      const rm = alloc?.room_id ? roomMap.get(alloc.room_id) : null;
      return (
        (stu?.student_name || '').toLowerCase().includes(q) ||
        (lv.guardian_name || '').toLowerCase().includes(q) ||
        (lv.guardian_phone || '').toLowerCase().includes(q) ||
        (lv.reason || '').toLowerCase().includes(q) ||
        (rm?.room_number || '').toLowerCase().includes(q)
      );
    });
  }, [mealLeaves, leaveStatusFilter, leaveSearch, studentMap, activeAllocationByStudent, roomMap]);

  // Night Roll Call derived rows & Room grouping
  const nightRollRows = useMemo(() => {
    return residentialStudentsOnly.map((row) => {
      const savedLog = mealLogByStudent.get(row.student.id) || null;
      const activeLeave = activeLeaveByStudent.get(row.student.id) || null;
      const isOnLeave = Boolean(activeLeave);

      const savedNight = savedLog?.night_roll_status;
      const defaultStatus: HostelNightRollStatus =
        savedNight === 'present' || savedNight === 'leave' || savedNight === 'absent'
          ? savedNight
          : isOnLeave
          ? 'leave'
          : 'present';

      const status = nightRollDraft[row.student.id] || defaultStatus;

      return {
        ...row,
        savedLog,
        activeLeave,
        isOnLeave,
        nightStatus: status,
      };
    });
  }, [residentialStudentsOnly, mealLogByStudent, activeLeaveByStudent, nightRollDraft]);

  const nightRollSummary = useMemo(() => {
    let present = 0;
    let leave = 0;
    let absent = 0;
    let saved = 0;
    for (const r of nightRollRows) {
      if (r.nightStatus === 'present') present++;
      else if (r.nightStatus === 'leave') leave++;
      else absent++;
      if (r.savedLog?.night_roll_status) saved++;
    }
    return { total: nightRollRows.length, present, leave, absent, saved };
  }, [nightRollRows]);

  const nightRollGroupedByRoom = useMemo(() => {
    const q = nightRollSearch.trim().toLowerCase();
    const filtered = nightRollRows.filter((row) => {
      if (nightRollRoomFilter === 'unassigned' && row.room) return false;
      if (
        nightRollRoomFilter !== 'all' &&
        nightRollRoomFilter !== 'unassigned' &&
        row.room?.id !== nightRollRoomFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.student.student_name.toLowerCase().includes(q) ||
        String(row.student.roll ?? '').includes(q) ||
        (row.room?.room_number || '').toLowerCase().includes(q) ||
        (row.room?.warden_name || '').toLowerCase().includes(q)
      );
    });

    const groups: Array<{
      key: string;
      room: HostelRoom | null;
      rows: typeof filtered;
    }> = [];

    const byRoomId = new Map<string, typeof filtered>();
    const unassigned: typeof filtered = [];

    for (const r of filtered) {
      if (r.room) {
        const list = byRoomId.get(r.room.id) || [];
        list.push(r);
        byRoomId.set(r.room.id, list);
      } else {
        unassigned.push(r);
      }
    }

    for (const room of rooms) {
      const list = byRoomId.get(room.id);
      if (list && list.length > 0) {
        list.sort((a, b) =>
          (a.allocation?.seat_number || '').localeCompare(b.allocation?.seat_number || '', undefined, {
            numeric: true,
          })
        );
        groups.push({ key: room.id, room, rows: list });
      }
    }

    if (unassigned.length > 0) {
      groups.push({ key: 'unassigned', room: null, rows: unassigned });
    }

    return groups;
  }, [nightRollRows, rooms, nightRollRoomFilter, nightRollSearch]);

  const handleSetNightRollStatus = useCallback(
    (studentId: string, status: HostelNightRollStatus) => {
      setNightRollDraft((prev) => ({ ...prev, [studentId]: status }));
      setNightRollDirty(true);
    },
    []
  );

  const handleMarkAllNightPresent = useCallback(() => {
    const draft: Record<string, HostelNightRollStatus> = {};
    let count = 0;
    for (const r of nightRollRows) {
      if (r.isOnLeave) {
        draft[r.student.id] = 'leave';
      } else {
        draft[r.student.id] = 'present';
        count++;
      }
    }
    setNightRollDraft(draft);
    setNightRollDirty(true);
    showToast(
      'success',
      isBn
        ? `${toBnDigit(count)} জনকে রাতের হাজিরায় উপস্থিত করা হয়েছে। সংরক্ষণ করতে সেভ চাপুন।`
        : `Marked ${count} boarders present for night roll. Tap Save to persist.`
    );
  }, [nightRollRows, isBn, showToast]);

  const handleSaveNightRoll = useCallback(async () => {
    if (!madrasah?.id || nightRollRows.length === 0) return;
    setNightRollSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const buildRows = (style: 'short' | 'status', includeMeta: boolean) =>
        nightRollRows.map((row) => {
          const saved = row.savedLog;
          const defMeal: HostelMealStatus = row.isOnLeave ? 'off' : 'present';
          const m = saved ? normalizeMealStatus(saved.morning ?? saved.morning_status) : defMeal;
          const n = saved ? normalizeMealStatus(saved.noon ?? saved.noon_status) : defMeal;
          const ng = saved ? normalizeMealStatus(saved.night ?? saved.night_status) : defMeal;

          const base: Record<string, any> = {
            institution_id: madrasah.id,
            student_id: row.student.id,
            log_date: mealDate,
            night_roll_status: row.nightStatus,
          };
          if (style === 'short') {
            base.morning = m;
            base.noon = n;
            base.night = ng;
          } else {
            base.morning_status = m;
            base.noon_status = n;
            base.night_status = ng;
          }
          if (includeMeta) {
            base.updated_at = nowIso;
          }
          return base;
        });

      let style = mealColumnStyleRef.current;
      let res = await supabase
        .from('hostel_meal_logs')
        .upsert(buildRows(style, true), {
          onConflict: 'institution_id,student_id,log_date',
        });

      if (res.error) {
        const msg = String(res.error.message || '').toLowerCase();
        if (msg.includes('morning') || msg.includes('noon') || msg.includes('night')) {
          if (!msg.includes('night_roll_status')) {
            style = style === 'short' ? 'status' : 'short';
            mealColumnStyleRef.current = style;
            res = await supabase
              .from('hostel_meal_logs')
              .upsert(buildRows(style, true), {
                onConflict: 'institution_id,student_id,log_date',
              });
          }
        }
      }

      if (res.error && String(res.error.message || '').toLowerCase().includes('updated_at')) {
        res = await supabase
          .from('hostel_meal_logs')
          .upsert(buildRows(style, false), {
            onConflict: 'institution_id,student_id,log_date',
          });
      }

      if (res.error) {
        if (String(res.error.message || '').toLowerCase().includes('night_roll_status')) {
          throw new Error(
            isBn
              ? 'ডাটাবেসে night_roll_status কলামটি নেই। Phase 3 SQL মাইগ্রেশন রান করুন।'
              : 'Column night_roll_status is missing. Please run Phase 3 SQL migration.'
          );
        }
        throw res.error;
      }

      setNightRollDraft({});
      setNightRollDirty(false);
      await fetchMealData(mealDate, true);
      showToast(
        'success',
        isBn
          ? `${toBnDigit(nightRollRows.length)} জন আবাসিকের রাতের হাজিরা সংরক্ষিত হয়েছে।`
          : `Saved night roll call for ${nightRollRows.length} boarders.`
      );
    } catch (err: any) {
      console.error('Save night roll error:', err);
      showToast(
        'error',
        err?.message || (isBn ? 'রাতের হাজিরা সেভ করতে সমস্যা হয়েছে।' : 'Failed to save night roll call.')
      );
    } finally {
      setNightRollSaving(false);
    }
  }, [madrasah?.id, nightRollRows, mealDate, fetchMealData, isBn, showToast]);

  const mealPillStyle = (status: HostelMealStatus, isOnLeave: boolean) => {
    if (status === 'present') {
      return {
        label: isBn ? 'উপস্থিত' : 'Present',
        weight: isBn ? '১.০' : '1.0',
        cls: isDark
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100',
        dotCls: 'bg-emerald-500',
      };
    }
    if (status === 'half') {
      return {
        label: isBn ? 'হাফ' : 'Half',
        weight: isBn ? '০.৫' : '0.5',
        cls: isDark
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
        dotCls: 'bg-amber-500',
      };
    }
    return {
      label: isOnLeave ? (isBn ? 'ছুটিতে' : 'Leave') : isBn ? 'বন্ধ' : 'Off',
      weight: isBn ? '০' : '0',
      cls: isDark
        ? 'bg-rose-500/15 text-rose-300 border-rose-500/35 hover:bg-rose-500/25'
        : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
      dotCls: 'bg-rose-500',
    };
  };

  // Shared Live Kitchen / বাবুর্চি ড্যাশবোর্ড renderer (used in standalone Cook mode AND inside Tab 3)
  const renderKitchenDashboard = (standalone: boolean) => {
    const mealCards = [
      {
        key: 'morning' as MealKey,
        title: isBn ? 'সকালের নাস্তা' : 'Morning Breakfast',
        subtitle: isBn ? 'ফজর / সকাল' : 'Morning Meal',
        icon: Sunrise,
        stats: mealSummary.morning,
        gradient: 'from-amber-500 to-orange-600',
        softBg: isDark
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-gradient-to-br from-amber-50 to-orange-50/70 border-amber-200',
        numColor: isDark ? 'text-amber-300' : 'text-amber-700',
        pillBg: isDark ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100/90 text-amber-900',
      },
      {
        key: 'noon' as MealKey,
        title: isBn ? 'দুপুরের খাবার' : 'Noon Lunch',
        subtitle: isBn ? 'যোহর / দুপুর' : 'Noon Meal',
        icon: Sun,
        stats: mealSummary.noon,
        gradient: 'from-emerald-500 to-teal-600',
        softBg: isDark
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-gradient-to-br from-emerald-50 to-teal-50/70 border-emerald-200',
        numColor: isDark ? 'text-emerald-300' : 'text-emerald-700',
        pillBg: isDark ? 'bg-emerald-500/20 text-emerald-200' : 'bg-emerald-100/90 text-emerald-900',
      },
      {
        key: 'night' as MealKey,
        title: isBn ? 'রাতের খাবার' : 'Night Dinner',
        subtitle: isBn ? 'এশা / রাত' : 'Night Meal',
        icon: Moon,
        stats: mealSummary.night,
        gradient: 'from-indigo-500 to-blue-700',
        softBg: isDark
          ? 'bg-indigo-500/10 border-indigo-500/30'
          : 'bg-gradient-to-br from-indigo-50 to-blue-50/70 border-indigo-200',
        numColor: isDark ? 'text-indigo-300' : 'text-indigo-700',
        pillBg: isDark ? 'bg-indigo-500/20 text-indigo-200' : 'bg-indigo-100/90 text-indigo-900',
      },
    ];

    const isTodaySelected = mealDate === getTodayDateString();
    const attendanceComplete =
      mealSummary.totalEligible > 0 && mealSummary.loggedCount >= mealSummary.totalEligible;

    return (
      <div className="space-y-4">
        {/* Date + Refresh + Auto-Refresh Control Strip */}
        <div className={`rounded-3xl border p-4 shadow-xs ${cardSurface}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Date Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setMealDate((d) => shiftDateStr(d, -1))}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                aria-label={isBn ? 'আগের দিন' : 'Previous day'}
              >
                <ChevronLeft size={18} />
              </button>

              <SmartDatePicker
                value={mealDate}
                onChange={setMealDate}
                lang={lang}
                isDark={isDark}
                renderTrigger={(open) => (
                  <button
                    type="button"
                    onClick={open}
                    className={`h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-black inline-flex items-center gap-2 transition-all cursor-pointer ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white hover:border-blue-500'
                        : 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-50'
                    }`}
                  >
                    <Calendar size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{formatReadableDate(mealDate, isBn)}</span>
                  </button>
                )}
              />

              <button
                type="button"
                onClick={() => setMealDate((d) => shiftDateStr(d, 1))}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                aria-label={isBn ? 'পরের দিন' : 'Next day'}
              >
                <ChevronRight size={18} />
              </button>

              {!isTodaySelected && (
                <button
                  type="button"
                  onClick={() => setMealDate(getTodayDateString())}
                  className="h-10 px-3 rounded-xl bg-blue-600 text-white text-xs font-black active:scale-95 transition-all cursor-pointer"
                >
                  {isBn ? 'আজ' : 'Today'}
                </button>
              )}
            </div>

            {/* Live Sync + Auto-Refresh Controls */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setKitchenAutoRefresh((v) => !v)}
                className={`h-10 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
                  kitchenAutoRefresh
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    kitchenAutoRefresh ? 'bg-white animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span>{isBn ? 'অটো রিফ্রেশ' : 'Auto Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={handleRefreshKitchen}
                disabled={refreshing || mealLoading}
                className={`h-10 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <RefreshCw size={15} className={refreshing || mealLoading ? 'animate-spin' : ''} />
                <span>{isBn ? 'আপডেট করুন' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Attendance Progress Status Bar */}
          <div
            className={`mt-3.5 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              attendanceComplete
                ? isDark
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : isDark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  attendanceComplete
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {attendanceComplete ? <CheckCircle2 size={17} /> : <Clock size={17} />}
              </div>
              <div>
                <p className="text-sm sm:text-base font-black leading-tight">
                  {isBn
                    ? `হাজিরা নেওয়া হয়েছে ${formatNum(mealSummary.loggedCount, isBn)} / মোট আবাসিক ${formatNum(mealSummary.totalEligible, isBn)}`
                    : `Attendance Logged ${mealSummary.loggedCount} / Total Boarders ${mealSummary.totalEligible}`}
                </p>
                <p className="text-[11px] font-semibold opacity-80 mt-0.5">
                  {attendanceComplete
                    ? isBn
                      ? 'সকল আবাসিক ও ডে-কেয়ার শিক্ষার্থীর আজকের মিল হাজিরা নিশ্চিত করা হয়েছে।'
                      : 'All active residential & day-care meal logs are confirmed for this date.'
                    : isBn
                    ? 'যাদের হাজিরা এখনো সেভ হয়নি (ছুটিতে না থাকলে), তাদের রান্নার হিসাবে উপস্থিত ধরা হয়েছে।'
                    : 'Unlogged non-leave active boarders are counted as present by default.'}
                </p>
              </div>
            </div>

            {lastKitchenSync && (
              <div className="text-[11px] font-bold opacity-80 shrink-0 inline-flex items-center gap-1 self-end sm:self-center">
                <Clock size={12} />
                <span>
                  {isBn ? 'সর্বশেষ আপডেট:' : 'Synced:'} {lastKitchenSync}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3 Big High-Contrast Kitchen KPI Cards */}
        {mealLoading ? (
          <div className={`rounded-3xl border p-12 flex flex-col items-center justify-center gap-3 ${cardSurface}`}>
            <Loader2 size={32} className="animate-spin text-amber-600" />
            <p className="text-sm font-bold">
              {isBn ? 'রান্নার হিসাব লোড হচ্ছে...' : 'Loading live kitchen counts...'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mealCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className={`rounded-3xl border-2 p-5 sm:p-6 shadow-sm flex flex-col justify-between gap-4 ${card.softBg}`}
                >
                  {/* Card Top Title */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center shadow-md shrink-0`}
                      >
                        <Icon size={24} />
                      </div>
                      <div>
                        <h3 className={`text-lg sm:text-xl font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {card.title}
                        </h3>
                        <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {card.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Giant Cooking Headcount */}
                  <div
                    className={`rounded-2xl p-4 text-center border ${
                      isDark
                        ? 'bg-slate-900/75 border-slate-700/80'
                        : 'bg-white/95 border-white shadow-xs'
                    }`}
                  >
                    <p className={`text-xs font-extrabold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {card.stats.guests > 0
                        ? isBn
                          ? 'মোট প্লেট (শিক্ষার্থী + শিক্ষক/মেহমান)'
                          : 'Total Plates (Students + Guests)'
                        : isBn
                        ? 'মোট রান্না হবে'
                        : 'Total to Cook'}
                    </p>
                    <div className={`mt-1 flex items-baseline justify-center gap-2 ${card.numColor}`}>
                      <span className="text-5xl sm:text-6xl font-black tabular-nums tracking-tight leading-none">
                        {formatMealCount(card.stats.totalPlates, isBn)}
                      </span>
                      <span className="text-lg font-black">
                        {isBn ? 'জন' : 'plates'}
                      </span>
                    </div>

                    {card.stats.guests > 0 && (
                      <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${card.pillBg}`}>
                        <span>
                          {isBn
                            ? `শিক্ষার্থী ${formatMealCount(card.stats.cookCount, isBn)} + শিক্ষক/মেহমান ${formatNum(card.stats.guests, isBn)}`
                            : `Students ${formatMealCount(card.stats.cookCount, isBn)} + Guests ${card.stats.guests}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Breakdown Pills: Full + Half and Off/Leave */}
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`rounded-2xl px-3 py-2.5 text-center border ${
                        isDark
                          ? 'bg-slate-900/60 border-slate-700 text-slate-200'
                          : 'bg-white/80 border-slate-200/80 text-slate-800'
                      }`}
                    >
                      <span className={`block text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'পূর্ণ + হাফ মিল' : 'Full + Half'}
                      </span>
                      <span className="text-sm sm:text-base font-black tabular-nums">
                        {isBn
                          ? `পূর্ণ ${formatNum(card.stats.full, isBn)} + হাফ ${formatNum(card.stats.half, isBn)}`
                          : `${card.stats.full} Full + ${card.stats.half} Half`}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl px-3 py-2.5 text-center border ${
                        isDark
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                          : 'bg-rose-50/90 border-rose-200 text-rose-800'
                      }`}
                    >
                      <span className="block text-[10px] font-bold opacity-80">
                        {isBn ? 'বন্ধ / ছুটি' : 'Off / Leave'}
                      </span>
                      <span className="text-sm sm:text-base font-black tabular-nums">
                        {formatNum(card.stats.off, isBn)} {isBn ? 'জন' : 'off'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Teacher / Guest Extra Meal Counter Card (persisted in localStorage per institution + date) */}
        <div className={`rounded-3xl border p-4 sm:p-5 shadow-xs ${cardSurface}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
                <Users size={19} />
              </div>
              <div>
                <h3 className="text-base font-black">
                  {isBn ? 'শিক্ষক / মেহমান সংখ্যা (অতিরিক্ত প্লেট)' : 'Teachers / Guests Extra Count'}
                </h3>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isBn
                    ? 'উস্তাদ, স্টাফ বা মেহমানের খাবার সংখ্যা যোগ করলে উপরের মোট প্লেটে স্বয়ংক্রিয়ভাবে যুক্ত হবে।'
                    : 'Add teachers, staff, or guests per meal to see grand total plates instantly.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                {
                  key: 'morning' as MealKey,
                  label: isBn ? 'সকাল (শিক্ষক/মেহমান)' : 'Morning Guests',
                  studentCount: mealSummary.morning.cookCount,
                  totalPlates: mealSummary.morning.totalPlates,
                },
                {
                  key: 'noon' as MealKey,
                  label: isBn ? 'দুপুর (শিক্ষক/মেহমান)' : 'Noon Guests',
                  studentCount: mealSummary.noon.cookCount,
                  totalPlates: mealSummary.noon.totalPlates,
                },
                {
                  key: 'night' as MealKey,
                  label: isBn ? 'রাত (শিক্ষক/মেহমান)' : 'Night Guests',
                  studentCount: mealSummary.night.cookCount,
                  totalPlates: mealSummary.night.totalPlates,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className={`rounded-2xl border p-3.5 flex flex-col gap-3 ${
                  isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50/90 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black">{item.label}</span>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                    {isBn ? 'মোট:' : 'Total:'} {formatMealCount(item.totalPlates, isBn)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => updateGuestCount(item.key, -1)}
                    disabled={guestCounts[item.key] <= 0}
                    className={`w-12 h-11 rounded-xl border flex items-center justify-center font-black transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white hover:bg-slate-700'
                        : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                    }`}
                    aria-label="Decrease"
                  >
                    <Minus size={18} />
                  </button>

                  <div className="text-center">
                    <span className="text-2xl font-black tabular-nums">
                      {formatNum(guestCounts[item.key], isBn)}
                    </span>
                    <span className={`block text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isBn ? 'অতিরিক্ত' : 'extra'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateGuestCount(item.key, 1)}
                    className="w-12 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black shadow-sm transition-all active:scale-95 cursor-pointer"
                    aria-label="Increase"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Helpful footer note for standalone Cook view */}
        {standalone && (
          <p className={`text-center text-xs font-semibold pb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {isBn
              ? 'আবাসিক শিক্ষার্থীদের রুম ও মিল হাজিরা পরিবর্তন হলে এখানে স্বয়ংক্রিয়ভাবে আপডেট হবে।'
              : 'Meal counts update automatically whenever hostel attendance or leave records change.'}
          </p>
        )}
      </div>
    );
  };

  // ===================== STANDALONE COOK / LIVE KITCHEN SCREEN =====================
  if (kitchenOnlyMode) {
    return (
      <div
        className={`min-h-screen w-full max-w-full overflow-x-clip pb-10 font-noto ${
          isDark ? 'bg-slate-950 text-white' : 'bg-slate-100/90 text-slate-900'
        }`}
      >
        {/* Floating Toast */}
        {toast && (
          <div
            className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold animate-in slide-in-from-top-3 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-rose-600 text-white border-rose-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
            <span className="leading-snug">{toast.text}</span>
          </div>
        )}

        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
          {/* Ultra-clean Cook Header (no admin menus or student editing) */}
          <div className={`rounded-3xl border p-4 sm:p-5 shadow-sm ${cardSurface}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/25">
                  <ChefHat size={26} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg sm:text-2xl font-black tracking-tight truncate">
                      {isBn ? 'লাইভ বাবুর্চি / কিচেন ড্যাশবোর্ড' : 'Live Kitchen Dashboard'}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      {isBn ? 'লাইভ' : 'LIVE'}
                    </span>
                  </div>
                  <p className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {madrasah?.name || ''}
                    {profile?.full_name ? ` • ${profile.full_name}` : ''}
                  </p>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className={`h-10 px-4 rounded-xl border text-xs sm:text-sm font-black inline-flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
                    isDark
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                      : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <LogOut size={16} />
                  <span>{isBn ? 'লগআউট' : 'Logout'}</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className={`rounded-3xl border p-12 flex flex-col items-center justify-center gap-3 ${cardSurface}`}>
              <Loader2 size={32} className="animate-spin text-amber-600" />
              <p className="text-sm font-bold">
                {isBn ? 'কিচেন ড্যাশবোর্ড লোড হচ্ছে...' : 'Loading kitchen dashboard...'}
              </p>
            </div>
          ) : schemaMissing || mealSchemaMissing ? (
            <div className={`rounded-3xl border p-8 text-center space-y-3 ${cardSurface}`}>
              <AlertCircle size={32} className="mx-auto text-amber-500" />
              <h2 className="text-base font-black">
                {isBn ? 'মিল টেবিল এখনো সেটআপ করা হয়নি' : 'Meal Tables Not Configured Yet'}
              </h2>
              <p className={`text-xs sm:text-sm max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn
                  ? 'প্রতিষ্ঠানের অ্যাডমিনকে হোস্টেল মিল ডাটাবেস টেবিল (hostel_meal_logs) চালু করতে বলুন।'
                  : 'Please ask your institution administrator to run the hostel meal logs database migration.'}
              </p>
            </div>
          ) : (
            renderKitchenDashboard(true)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto overflow-x-clip pb-24 sm:pb-10 space-y-4 sm:space-y-5 font-noto animate-in fade-in duration-300">
      {/* Floating Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold animate-in slide-in-from-top-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
          <span className="leading-snug">{toast.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className={`rounded-3xl border p-4 sm:p-5 shadow-xs ${cardSurface}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600'
              }`}
              aria-label={isBn ? 'ফিরে যান' : 'Back'}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
              <BedDouble size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-black tracking-tight leading-snug">
                {isBn ? 'হোস্টেল ও আবাসিক ব্যবস্থাপনা' : 'Hostel & Residential Management'}
              </h1>
              <p className={`text-[11px] sm:text-xs font-medium leading-snug mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isBn
                  ? 'রুম, সিট বরাদ্দ, আবাসিক তালিকা ও দৈনিক মিল-কিচেন'
                  : 'Rooms, seat allocation, residential directory & daily kitchen meals'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                fetchAllData(true);
                if (activeTab === 'meals' || activeTab === 'gatepass') {
                  fetchMealData(mealDate, true);
                }
              }}
              disabled={refreshing || mealLoading}
              className={`h-10 px-3.5 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                activeTab === 'rooms' && !schemaMissing ? '' : 'flex-1 sm:flex-none'
              } ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RefreshCw size={15} className={refreshing || mealLoading ? 'animate-spin' : ''} />
              <span>{isBn ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
            {activeTab === 'rooms' && !schemaMissing && (
              <button
                type="button"
                onClick={openAddRoomModal}
                className="flex-1 sm:flex-none h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>{isBn ? 'নতুন রুম' : 'Add Room'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Summary KPI Cards */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <div className={`rounded-2xl border p-3.5 ${isDark ? 'bg-slate-800/70 border-slate-700/80' : 'bg-blue-50/60 border-blue-100'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'মোট রুম' : 'Total Rooms'}
              </span>
              <Building2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
            </div>
            <div className="mt-1.5 text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
              {formatNum(kpis.totalRooms, isBn)}
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 ${isDark ? 'bg-slate-800/70 border-slate-700/80' : 'bg-indigo-50/60 border-indigo-100'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'মোট সিট' : 'Total Beds'}
              </span>
              <BedDouble size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>
            <div className="mt-1.5 text-2xl font-black tabular-nums text-indigo-700 dark:text-indigo-300">
              {formatNum(kpis.totalBeds, isBn)}
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 ${isDark ? 'bg-slate-800/70 border-slate-700/80' : 'bg-emerald-50/60 border-emerald-100'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'আবাসিক শিক্ষার্থী' : 'Active Boarders'}
              </span>
              <Users size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
              <span className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatNum(kpis.activeBoarders, isBn)}
              </span>
              <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                ({formatNum(kpis.seatedCount, isBn)} {isBn ? 'সিটে' : 'seated'})
              </span>
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 ${isDark ? 'bg-slate-800/70 border-slate-700/80' : 'bg-amber-50/60 border-amber-100'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {isBn ? 'খালি সিট' : 'Available Seats'}
              </span>
              <DoorOpen size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
            <div className="mt-1.5 text-2xl font-black tabular-nums text-amber-700 dark:text-amber-300">
              {formatNum(kpis.availableSeats, isBn)}
            </div>
          </div>

          <div
            className={`col-span-2 sm:col-span-1 rounded-2xl border p-3.5 flex items-center justify-between sm:block ${
              isDark ? 'bg-slate-800/70 border-slate-700/80' : 'bg-rose-50/60 border-rose-100'
            }`}
          >
            <div className="flex items-center sm:justify-between gap-2">
              <Heart size={16} className="text-rose-600 dark:text-rose-400 shrink-0 sm:order-2" />
              <span className={`text-xs sm:text-[11px] font-bold sm:order-1 ${isDark ? 'text-slate-300 sm:text-slate-400' : 'text-slate-700 sm:text-slate-600'}`}>
                {isBn ? 'লিল্লাহ / ফ্রি বোর্ডিং' : 'Lillah / Free'}
              </span>
            </div>
            <div className="sm:mt-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl font-black tabular-nums text-rose-700 dark:text-rose-300">
                {formatNum(kpis.lillahCount, isBn)}
              </span>
              {kpis.halfFreeCount > 0 && (
                <span className={`text-[10.5px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  (+{formatNum(kpis.halfFreeCount, isBn)} {isBn ? 'অর্ধ-ফ্রি' : 'half'})
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4-Tab Bar (Smooth Horizontal Scrollable Pill Strip on Mobile, 4-Col Grid on sm+) */}
      <div className={`rounded-2xl border p-1.5 shadow-xs ${cardSurface}`}>
        <div className="flex sm:grid sm:grid-cols-4 gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
          {[
            {
              id: 'rooms' as HostelTab,
              icon: BedDouble,
              shortLabel: isBn ? 'রুম ও সিট' : 'Rooms & Seats',
              fullLabel: isBn ? 'রুম ও সিট বোর্ড' : 'Rooms & Seats',
            },
            {
              id: 'directory' as HostelTab,
              icon: Users,
              shortLabel: isBn ? 'আবাসিক তালিকা' : 'Residential',
              fullLabel: isBn ? 'আবাসিক ও লিল্লাহ তালিকা' : 'Residential & Lillah',
            },
            {
              id: 'meals' as HostelTab,
              icon: Utensils,
              shortLabel: isBn ? 'মিল ও বাবুর্চি' : 'Meals & Cook',
              fullLabel: isBn ? 'মিল ও বাবুর্চি ড্যাশবোর্ড' : 'Meals & Kitchen',
            },
            {
              id: 'gatepass' as HostelTab,
              icon: ShieldCheck,
              shortLabel: isBn ? 'গেট পাস ও হাজিরা' : 'Gate Pass',
              fullLabel: isBn ? 'গেট পাস ও রাতের হাজিরা' : 'Gate Pass & Night Roll',
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap min-h-[42px] flex items-center justify-center gap-2 px-3.5 sm:px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25'
                    : isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="lg:hidden">{tab.shortLabel}</span>
                <span className="hidden lg:inline truncate">{tab.fullLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading / Error / Schema Missing States */}
      {loading ? (
        <div className={`rounded-3xl border p-12 flex flex-col items-center justify-center gap-3 ${cardSurface}`}>
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            {isBn ? 'হোস্টেল ও আবাসিক তথ্য লোড হচ্ছে...' : 'Loading hostel & residential data...'}
          </p>
        </div>
      ) : schemaMissing ? (
        <div className={`rounded-3xl border p-6 sm:p-8 text-center space-y-3 ${cardSurface}`}>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-black">
            {isBn ? 'ডাটাবেস টেবিল সেটআপ প্রয়োজন' : 'Database Tables Setup Required'}
          </h2>
          <p className={`text-sm max-w-xl mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {isBn
              ? 'হোস্টেল মডিউলের জন্য Supabase ডাটাবেসে hostel_rooms এবং hostel_allocations টেবিল দুটি এখনো তৈরি করা হয়নি। প্রজেক্টের মাইগ্রেশন ফাইলটি রান করে পুনরায় চেষ্টা করুন।'
              : 'The hostel_rooms and hostel_allocations tables are not yet created in Supabase. Please run the Phase 1 hostel migration SQL and refresh.'}
          </p>
          <button
            type="button"
            onClick={() => fetchAllData()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw size={15} />
            <span>{isBn ? 'পুনরায় যাচাই করুন' : 'Check Again'}</span>
          </button>
        </div>
      ) : errorMsg ? (
        <div className={`rounded-3xl border p-6 text-center space-y-3 ${cardSurface}`}>
          <AlertCircle size={30} className="mx-auto text-rose-500" />
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{errorMsg}</p>
          <button
            type="button"
            onClick={() => fetchAllData()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
          >
            {isBn ? 'আবার চেষ্টা করুন' : 'Retry'}
          </button>
        </div>
      ) : (
        <>
          {/* ===================== TAB 1: ROOMS & SEAT ALLOCATION ===================== */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 ${cardSurface}`}>
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                  />
                  <input
                    type="text"
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    placeholder={
                      isBn
                        ? 'রুম, ভবন, ওয়ার্ডেন বা শিক্ষার্থীর নাম দিয়ে খুঁজুন...'
                        : 'Search room, building, warden, or student...'
                    }
                    className={`${inputCls} pl-10`}
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                  {(
                    [
                      { id: 'all', label: isBn ? 'সকল' : 'All' },
                      { id: 'male', label: isBn ? 'ছাত্র' : 'Boys' },
                      { id: 'female', label: isBn ? 'ছাত্রী' : 'Girls' },
                      { id: 'any', label: isBn ? 'সকলের' : 'Any' },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setRoomGenderFilter(g.id)}
                      className={`shrink-0 whitespace-nowrap min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                        roomGenderFilter === g.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}

                  <label className={`shrink-0 whitespace-nowrap min-h-[38px] inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer px-2.5 rounded-xl border ${isDark ? 'border-slate-700/80 text-slate-300' : 'border-slate-200/80 text-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={showInactiveRooms}
                      onChange={(e) => setShowInactiveRooms(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{isBn ? 'নিষ্ক্রিয় রুম' : 'Inactive'}</span>
                  </label>
                </div>
              </div>

              {/* Rooms Grid */}
              {filteredRooms.length === 0 ? (
                <div className={`rounded-3xl border p-10 text-center space-y-3 ${cardSurface}`}>
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <BedDouble size={28} />
                  </div>
                  <h3 className="text-base font-black">
                    {rooms.length === 0
                      ? isBn
                        ? 'এখনো কোনো হোস্টেল রুম যোগ করা হয়নি'
                        : 'No Hostel Rooms Added Yet'
                      : isBn
                      ? 'কোনো রুম খুঁজে পাওয়া যায়নি'
                      : 'No Matching Rooms Found'}
                  </h3>
                  <p className={`text-xs sm:text-sm max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn
                      ? 'প্রথমে ভবন ও রুম নম্বর দিয়ে রুম তৈরি করুন, এরপর আবাসিক শিক্ষার্থীদের সিট বরাদ্দ করুন।'
                      : 'Create hostel rooms with building, capacity, and monthly fee, then allocate seats to boarders.'}
                  </p>
                  <button
                    type="button"
                    onClick={openAddRoomModal}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>{isBn ? 'প্রথম রুম যোগ করুন' : 'Add First Room'}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredRooms.map((room) => {
                    const occupants = allocationsByRoom.get(room.id) || [];
                    const filled = occupants.length;
                    const capacity = Math.max(1, Number(room.capacity || 1));
                    const available = Math.max(0, capacity - filled);
                    const occupancyPct = Math.min(100, Math.round((filled / capacity) * 100));
                    const isFull = available === 0;

                    const barColor =
                      occupancyPct >= 100
                        ? 'bg-rose-500'
                        : occupancyPct >= 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500';

                    return (
                      <div
                        key={room.id}
                        className={`rounded-3xl border p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-xs transition-all ${
                          !room.is_active ? 'opacity-70' : ''
                        } ${cardSurface}`}
                      >
                        <div className="space-y-3.5">
                          {/* Room Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="px-3 py-2 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-center shrink-0 min-w-[62px] shadow-sm">
                                <span className="block text-[9px] font-bold uppercase opacity-80">
                                  {isBn ? 'রুম' : 'Room'}
                                </span>
                                <span className="block text-base font-black leading-tight">
                                  {isBn ? toBnDigit(room.room_number) : room.room_number}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h3 className="text-sm sm:text-base font-black leading-snug break-words">
                                    {room.room_title ||
                                      `${room.building_name} - ${isBn ? 'রুম' : 'Room'} ${
                                        isBn ? toBnDigit(room.room_number) : room.room_number
                                      }`}
                                  </h3>
                                  {!room.is_active && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                      {isBn ? 'নিষ্ক্রিয়' : 'Inactive'}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs font-medium mt-0.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {room.building_name}
                                  {room.floor_name ? ` • ${room.floor_name}` : ''}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      isDark
                                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                                        : 'bg-slate-50 border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {genderLabel(room.gender)}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      isDark
                                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                                        : 'bg-blue-50 border-blue-200 text-blue-700'
                                    }`}
                                  >
                                    ৳{formatNum(Number(room.monthly_seat_fee || 0), isBn)}/{isBn ? 'মাস' : 'mo'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditRoomModal(room)}
                                title={isBn ? 'রুম সম্পাদনা' : 'Edit Room'}
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors active:scale-95 cursor-pointer ${
                                  isDark
                                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-blue-400'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteRoomTarget(room)}
                                title={isBn ? 'রুম মুছুন' : 'Delete Room'}
                                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors active:scale-95 cursor-pointer ${
                                  isDark
                                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-rose-400'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Occupancy Bar + Available Seats Badge */}
                          <div className={`rounded-2xl p-3 border ${isDark ? 'bg-slate-800/60 border-slate-700/70' : 'bg-slate-50/90 border-slate-200/70'}`}>
                            <div className="flex items-center justify-between gap-2 text-xs font-bold mb-1.5">
                              <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                                {isBn ? 'সিট অবস্থান:' : 'Occupancy:'}{' '}
                                <span className="font-black tabular-nums">
                                  {formatNum(filled, isBn)} / {formatNum(capacity, isBn)}
                                </span>
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                  isFull
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {isFull
                                  ? isBn
                                    ? 'সিট পূর্ণ'
                                    : 'Full'
                                  : isBn
                                  ? `${formatNum(available, isBn)}টি সিট খালি`
                                  : `${available} seats free`}
                              </span>
                            </div>
                            <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                style={{ width: `${occupancyPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Warden Info */}
                          {(room.warden_name || room.warden_phone) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className={`flex items-center gap-1.5 font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                <UserCheck size={14} className="text-indigo-500 shrink-0" />
                                <span>
                                  {isBn ? 'নিগরান/ওয়ার্ডেন:' : 'Warden:'}{' '}
                                  <strong className={isDark ? 'text-white' : 'text-slate-800'}>
                                    {room.warden_name || '—'}
                                  </strong>
                                </span>
                              </div>
                              {room.warden_phone && (
                                <a
                                  href={`tel:${room.warden_phone}`}
                                  className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-500/20 active:scale-95 transition-all tabular-nums"
                                >
                                  <Phone size={13} />
                                  <span>{room.warden_phone}</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Assigned Students List */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400">
                              <span>
                                {isBn ? 'বরাদ্দকৃত শিক্ষার্থী' : 'Assigned Boarders'} ({formatNum(filled, isBn)})
                              </span>
                            </div>
                            {occupants.length === 0 ? (
                              <div
                                className={`rounded-2xl border border-dashed p-3.5 text-center text-xs font-medium ${
                                  isDark
                                    ? 'border-slate-700 text-slate-500'
                                    : 'border-slate-200 text-slate-400'
                                }`}
                              >
                                {isBn
                                  ? 'এই রুমে এখনো কোনো শিক্ষার্থী বরাদ্দ করা হয়নি।'
                                  : 'No students assigned to this room yet.'}
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                                {occupants.map(({ allocation, student }) => {
                                  const clsName = classMap.get(student.class_id)?.class_name || '';
                                  const fb = feeBadge(allocation.fee_category);
                                  return (
                                    <div
                                      key={allocation.id}
                                      className={`rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                        isDark
                                          ? 'bg-slate-800/50 border-slate-700/70'
                                          : 'bg-white border-slate-200/80'
                                      }`}
                                    >
                                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                        <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center shrink-0">
                                          {allocation.seat_number
                                            ? isBn
                                              ? toBnDigit(allocation.seat_number)
                                              : allocation.seat_number
                                            : '#'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs sm:text-sm font-bold leading-snug break-words">
                                            {student.student_name}
                                          </p>
                                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                                            {clsName && <span>{clsName}</span>}
                                            {student.roll != null && (
                                              <span>
                                                • {isBn ? 'রোল' : 'Roll'} {formatNum(student.roll, isBn)}
                                              </span>
                                            )}
                                            <span className={`px-1.5 py-0.2 rounded-md border text-[9.5px] font-bold ${fb.cls}`}>
                                              {fb.label}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                                        {student.guardian_phone && (
                                          <a
                                            href={`tel:${student.guardian_phone}`}
                                            title={student.guardian_phone}
                                            className={`min-h-[34px] px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 transition-colors active:scale-95 ${
                                              isDark
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                            }`}
                                          >
                                            <Phone size={12} />
                                            <span className="sm:hidden">{isBn ? 'কল' : 'Call'}</span>
                                          </a>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => openTransferModal(allocation, student, room)}
                                          title={isBn ? 'রুম পরিবর্তন' : 'Transfer Room'}
                                          className={`min-h-[34px] px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 transition-colors active:scale-95 cursor-pointer ${
                                            isDark
                                              ? 'bg-slate-800 border-slate-700 text-blue-300 hover:bg-blue-500/20'
                                              : 'bg-blue-50/70 border-blue-200/80 text-blue-700 hover:bg-blue-100'
                                          }`}
                                        >
                                          <ArrowRightLeft size={12} />
                                          <span>{isBn ? 'পরিবর্তন' : 'Move'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setVacateTarget({ allocation, student, room })}
                                          title={isBn ? 'সিট খালি করুন' : 'Vacate Seat'}
                                          className={`min-h-[34px] px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 transition-colors active:scale-95 cursor-pointer ${
                                            isDark
                                              ? 'bg-slate-800 border-slate-700 text-rose-300 hover:bg-rose-500/20'
                                              : 'bg-rose-50/70 border-rose-200/80 text-rose-700 hover:bg-rose-100'
                                          }`}
                                        >
                                          <UserMinus size={12} />
                                          <span>{isBn ? 'খালি' : 'Vacate'}</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Room Card Footer CTA */}
                        <button
                          type="button"
                          disabled={isFull || !room.is_active}
                          onClick={() => openAssignSeatModal(room)}
                          className={`w-full h-10 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
                            isFull || !room.is_active
                              ? isDark
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 active:scale-[0.99] cursor-pointer'
                          }`}
                        >
                          <UserPlus size={15} />
                          <span>
                            {!room.is_active
                              ? isBn
                                ? 'রুম নিষ্ক্রিয় আছে'
                                : 'Room Inactive'
                              : isFull
                              ? isBn
                                ? 'কোনো সিট খালি নেই'
                                : 'Room Full'
                              : isBn
                              ? 'সিট বরাদ্দ করুন'
                              : 'Assign Seat'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===================== TAB 2: RESIDENTIAL & FEE DIRECTORY ===================== */}
          {activeTab === 'directory' && (
            <div className="space-y-4">
              {/* Search & Filter Panel */}
              <div className={`rounded-3xl border p-4 space-y-3.5 shadow-xs ${cardSurface}`}>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8 relative">
                    <Search
                      size={16}
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    />
                    <input
                      type="text"
                      value={dirSearch}
                      onChange={(e) => setDirSearch(e.target.value)}
                      placeholder={
                        isBn
                          ? 'শিক্ষার্থীর নাম, রোল, অভিভাবকের ফোন বা রুম নম্বর খুঁজুন...'
                          : 'Search student name, roll, guardian phone, or room...'
                      }
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <select
                      value={dirClassFilter}
                      onChange={(e) => setDirClassFilter(e.target.value)}
                      className={inputCls}
                    >
                      <option value="all">{isBn ? 'সকল শ্রেণি / জামাত' : 'All Classes'}</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.class_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Residential Type Filter Pills */}
                <div className="flex sm:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                  {(
                    [
                      { id: 'all', label: isBn ? 'সকল' : 'All', count: dirCounts.total },
                      {
                        id: 'residential',
                        label: isBn ? 'আবাসিক' : 'Residential',
                        count: dirCounts.residential,
                      },
                      {
                        id: 'non_residential',
                        label: isBn ? 'অনাবাসিক' : 'Non-Residential',
                        count: dirCounts.non_residential,
                      },
                      {
                        id: 'day_care',
                        label: isBn ? 'ডে-কেয়ার' : 'Day-Care',
                        count: dirCounts.day_care,
                      },
                    ] as const
                  ).map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setDirResFilter(pill.id)}
                      className={`shrink-0 whitespace-nowrap min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                        dirResFilter === pill.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                          dirResFilter === pill.id
                            ? 'bg-white/20 text-white'
                            : isDark
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        {formatNum(pill.count, isBn)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Fee Category Filter Pills */}
                <div className="flex sm:flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                  <span className={`shrink-0 whitespace-nowrap text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn ? 'ফি:' : 'Fee:'}
                  </span>
                  {(
                    [
                      { id: 'all', label: isBn ? 'সকল ফি' : 'All Fees', count: dirCounts.total },
                      { id: 'full_paid', label: isBn ? 'পূর্ণ ফি' : 'Full Paid', count: dirCounts.full_paid },
                      { id: 'half_free', label: isBn ? 'অর্ধ-ফ্রি' : 'Half-Free', count: dirCounts.half_free },
                      {
                        id: 'lillah_free',
                        label: isBn ? 'লিল্লাহ/এতিম' : 'Lillah / Free',
                        count: dirCounts.lillah_free,
                      },
                    ] as const
                  ).map((pill) => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setDirFeeFilter(pill.id)}
                      className={`shrink-0 whitespace-nowrap min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                        dirFeeFilter === pill.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : isDark
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                          dirFeeFilter === pill.id
                            ? 'bg-white/20 text-white'
                            : isDark
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatNum(pill.count, isBn)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Directory List */}
              {filteredDirectory.length === 0 ? (
                <div className={`rounded-3xl border p-10 text-center space-y-2 ${cardSurface}`}>
                  <Users size={30} className="mx-auto text-slate-400" />
                  <p className="text-sm font-bold">
                    {isBn ? 'এই ফিল্টারে কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students match the selected filters.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className={`px-1 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {isBn
                      ? `মোট ${formatNum(filteredDirectory.length, isBn)} জন শিক্ষার্থী দেখানো হচ্ছে`
                      : `Showing ${filteredDirectory.length} students`}
                  </div>

                  {filteredDirectory.map((row) => {
                    const rb = resBadge(row.residentialType);
                    const fb = feeBadge(row.feeCategory);
                    return (
                      <div
                        key={row.student.id}
                        className={`rounded-2xl border p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs transition-all ${cardSurface}`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          {row.student.photo_url ? (
                            <img
                              src={row.student.photo_url}
                              alt={row.student.student_name}
                              className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/20 text-blue-700 dark:text-blue-300 font-black text-base flex items-center justify-center shrink-0">
                              {row.student.student_name.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="text-sm sm:text-base font-black leading-snug break-words">
                                {row.student.student_name}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rb.cls}`}>
                                {rb.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${fb.cls}`}>
                                {fb.label}
                              </span>
                            </div>

                            <div className={`mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              <span>
                                {row.className}
                                {row.student.roll != null
                                  ? ` • ${isBn ? 'রোল' : 'Roll'} ${formatNum(row.student.roll, isBn)}`
                                  : ''}
                              </span>
                              {row.room ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                  {isBn ? 'রুম' : 'Room'} {isBn ? toBnDigit(row.room.room_number) : row.room.room_number}
                                  {row.allocation?.seat_number
                                    ? ` (${isBn ? 'সিট' : 'Seat'} ${
                                        isBn ? toBnDigit(row.allocation.seat_number) : row.allocation.seat_number
                                      })`
                                    : ''}
                                </span>
                              ) : row.residentialType === 'residential' ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">
                                  {isBn ? 'রুম বরাদ্দ হয়নি' : 'No room assigned'}
                                </span>
                              ) : null}
                              {row.student.guardian_phone && (
                                <a
                                  href={`tel:${row.student.guardian_phone}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-500/20 transition-colors tabular-nums"
                                >
                                  <Phone size={11} />
                                  <span>{row.student.guardian_phone}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                          <div className="text-left sm:text-right">
                            <span className={`block text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {isBn ? 'বোর্ডিং ফি/মাস' : 'Boarding Fee/mo'}
                            </span>
                            <span className="text-sm font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                              ৳{formatNum(row.monthlyBoardingFee, isBn)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEditStudentModal(row)}
                            className={`min-h-[38px] px-4 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                              isDark
                                ? 'bg-slate-800 border-slate-700 text-blue-300 hover:bg-blue-500/20'
                                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            <Edit3 size={14} />
                            <span>{isBn ? 'আপডেট' : 'Update'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===================== TAB 3: DAILY MEAL ATTENDANCE & LIVE KITCHEN ===================== */}
          {activeTab === 'meals' && (
            <div className="space-y-4">
              {/* Sub-View Switcher: Daily Meal Attendance vs Live Cook Dashboard */}
              <div className={`rounded-2xl border p-1.5 shadow-xs ${cardSurface}`}>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMealSubView('attendance')}
                    className={`min-h-[42px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-[0.98] cursor-pointer ${
                      mealSubView === 'attendance'
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Utensils size={16} className="shrink-0" />
                    <span className="sm:hidden">{isBn ? 'মিল হাজিরা' : 'Meal Roll'}</span>
                    <span className="hidden sm:inline truncate">
                      {isBn ? 'দৈনিক মিল হাজিরা ও ছুটি' : 'Daily Meal Attendance'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMealSubView('kitchen')}
                    className={`min-h-[42px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-[0.98] cursor-pointer ${
                      mealSubView === 'kitchen'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm shadow-orange-500/20'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ChefHat size={16} className="shrink-0" />
                    <span className="sm:hidden">{isBn ? 'বাবুর্চি ভিউ' : 'Kitchen View'}</span>
                    <span className="hidden sm:inline truncate">
                      {isBn ? 'লাইভ বাবুর্চি ড্যাশবোর্ড' : 'Live Kitchen View'}
                    </span>
                  </button>
                </div>
              </div>

              {mealSchemaMissing ? (
                <div className={`rounded-3xl border p-6 sm:p-8 text-center space-y-3 ${cardSurface}`}>
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                    <AlertCircle size={28} />
                  </div>
                  <h2 className="text-lg font-black">
                    {isBn ? 'মিল হাজিরা টেবিল সেটআপ প্রয়োজন' : 'Meal Logs Table Setup Required'}
                  </h2>
                  <p className={`text-sm max-w-xl mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isBn
                      ? 'দৈনিক মিল হাজিরা ও বাবুর্চি ড্যাশবোর্ডের জন্য Supabase ডাটাবেসে hostel_meal_logs টেবিলটি এখনো তৈরি করা হয়নি। Phase 2 মাইগ্রেশন SQL রান করে পুনরায় যাচাই করুন।'
                      : 'The hostel_meal_logs table is not yet created in Supabase. Please run the Phase 2 hostel migration SQL and refresh.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchMealData(mealDate)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={15} />
                    <span>{isBn ? 'পুনরায় যাচাই করুন' : 'Check Again'}</span>
                  </button>
                </div>
              ) : mealSubView === 'kitchen' ? (
                renderKitchenDashboard(false)
              ) : (
                <div className="space-y-4">
                  {/* Compact Daily Meal Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'আবাসিক ও ডে-কেয়ার' : 'Active Boarders'}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-black tabular-nums">
                          {formatNum(mealSummary.totalEligible, isBn)}
                        </span>
                        <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          ({formatNum(mealSummary.loggedCount, isBn)} {isBn ? 'সেভড' : 'saved'})
                        </span>
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-rose-500/10 border-rose-500/25' : 'bg-rose-50/70 border-rose-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                        {isBn ? 'ছুটিতে / সম্পূর্ণ বন্ধ' : 'On Leave / Off'}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-black tabular-nums text-rose-700 dark:text-rose-300">
                          {formatNum(mealSummary.allOffCount, isBn)}
                        </span>
                        {mealSummary.onLeaveCount > 0 && (
                          <span className="text-[10px] font-bold text-rose-600/80 dark:text-rose-300/80">
                            ({formatNum(mealSummary.onLeaveCount, isBn)} {isBn ? 'ছুটি' : 'leave'})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-amber-500/10 border-amber-500/25' : 'bg-amber-50/70 border-amber-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                        {isBn ? 'সকাল (নাস্তা)' : 'Morning'}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-black tabular-nums text-amber-700 dark:text-amber-300">
                          {formatMealCount(mealSummary.morning.cookCount, isBn)}
                        </span>
                        <span className="text-[10px] font-bold opacity-75">
                          ({formatNum(mealSummary.morning.full, isBn)}+{formatNum(mealSummary.morning.half, isBn)}{isBn ? 'হাফ' : 'h'})
                        </span>
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-emerald-50/70 border-emerald-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                        {isBn ? 'দুপুর (খাবার)' : 'Noon'}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatMealCount(mealSummary.noon.cookCount, isBn)}
                        </span>
                        <span className="text-[10px] font-bold opacity-75">
                          ({formatNum(mealSummary.noon.full, isBn)}+{formatNum(mealSummary.noon.half, isBn)}{isBn ? 'হাফ' : 'h'})
                        </span>
                      </div>
                    </div>

                    <div
                      className={`col-span-2 sm:col-span-1 rounded-2xl border p-3.5 sm:p-3 flex items-center justify-between sm:block ${
                        isDark ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-indigo-50/70 border-indigo-200/80'
                      }`}
                    >
                      <span className={`block text-xs sm:text-[11px] font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                        {isBn ? 'রাত (খাবার)' : 'Night'}
                      </span>
                      <div className="sm:mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-black tabular-nums text-indigo-700 dark:text-indigo-300">
                          {formatMealCount(mealSummary.night.cookCount, isBn)}
                        </span>
                        <span className="text-[10.5px] font-bold opacity-75">
                          ({formatNum(mealSummary.night.full, isBn)}+{formatNum(mealSummary.night.half, isBn)}{isBn ? 'হাফ' : 'h'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date Picker, Filters & Bulk Actions Card */}
                  <div className={`rounded-3xl border p-4 space-y-3.5 shadow-xs ${cardSurface}`}>
                    {/* Row 1: Date Picker + Quick Bulk Actions */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-center flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setMealDate((d) => shiftDateStr(d, -1))}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                            isDark
                              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                          aria-label={isBn ? 'আগের দিন' : 'Previous day'}
                        >
                          <ChevronLeft size={18} />
                        </button>

                        <SmartDatePicker
                          value={mealDate}
                          onChange={setMealDate}
                          lang={lang}
                          isDark={isDark}
                          renderTrigger={(open) => (
                            <button
                              type="button"
                              onClick={open}
                              className={`h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-black inline-flex items-center gap-2 transition-all cursor-pointer ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 text-white hover:border-blue-500'
                                  : 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-50'
                              }`}
                            >
                              <Calendar size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                              <span>{formatReadableDate(mealDate, isBn)}</span>
                            </button>
                          )}
                        />

                        <button
                          type="button"
                          onClick={() => setMealDate((d) => shiftDateStr(d, 1))}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                            isDark
                              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                          aria-label={isBn ? 'পরের দিন' : 'Next day'}
                        >
                          <ChevronRight size={18} />
                        </button>

                        {mealDate !== getTodayDateString() && (
                          <button
                            type="button"
                            onClick={() => setMealDate(getTodayDateString())}
                            className="h-10 px-3 rounded-xl bg-blue-600 text-white text-xs font-black active:scale-95 transition-all cursor-pointer"
                          >
                            {isBn ? 'আজ' : 'Today'}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMarkAllPresent}
                          disabled={mealEligibleRows.length === 0 || mealSaving}
                          className={`h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                            isDark
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          <Check size={15} />
                          <span>{isBn ? 'সকল আবাসিককে উপস্থিত দিন' : 'Mark All Present'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveMealLogs}
                          disabled={mealEligibleRows.length === 0 || mealSaving}
                          className={`h-10 px-4 rounded-xl text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                            mealDirty
                              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30 ring-2 ring-blue-400/50'
                              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                          }`}
                        >
                          {mealSaving ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Save size={15} />
                          )}
                          <span>{isBn ? 'সেভ করুন' : 'Save Attendance'}</span>
                          {mealDirty && (
                            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Search + Room Filter + Class Filter */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="sm:col-span-5 relative">
                        <Search
                          size={15}
                          className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${
                            isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        />
                        <input
                          type="text"
                          value={mealSearch}
                          onChange={(e) => setMealSearch(e.target.value)}
                          placeholder={
                            isBn ? 'নাম, রোল বা রুম খুঁজুন...' : 'Search student, roll, room...'
                          }
                          className={`${inputCls} pl-10`}
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <select
                          value={mealRoomFilter}
                          onChange={(e) => setMealRoomFilter(e.target.value)}
                          className={inputCls}
                        >
                          <option value="all">{isBn ? 'সকল রুম' : 'All Rooms'}</option>
                          <option value="unassigned">{isBn ? 'রুম বরাদ্দ হয়নি' : 'Unassigned Room'}</option>
                          {rooms
                            .filter((r) => r.is_active)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {isBn ? `রুম ${toBnDigit(r.room_number)}` : `Room ${r.room_number}`}
                                {r.room_title ? ` — ${r.room_title}` : ''}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <select
                          value={mealClassFilter}
                          onChange={(e) => setMealClassFilter(e.target.value)}
                          className={inputCls}
                        >
                          <option value="all">{isBn ? 'সকল শ্রেণি' : 'All Classes'}</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.class_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Tap Legend */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        {isBn
                          ? 'মিল বাটনে ১ বার ট্যাপ করলে পর্যায়ক্রমে পরিবর্তন হবে:'
                          : 'Tap any meal pill to cycle state:'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          {isBn ? 'উপস্থিত (১.০)' : 'Present (1.0)'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          {isBn ? 'হাফ (০.৫)' : 'Half (0.5)'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          {isBn ? 'বন্ধ / ছুটিতে (০)' : 'Off / Leave (0)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Student Meal Attendance List */}
                  {mealLoading ? (
                    <div className={`rounded-3xl border p-10 flex flex-col items-center justify-center gap-3 ${cardSurface}`}>
                      <Loader2 size={28} className="animate-spin text-blue-600" />
                      <p className="text-sm font-bold">
                        {isBn ? 'দৈনিক মিল তালিকা লোড হচ্ছে...' : 'Loading meal attendance list...'}
                      </p>
                    </div>
                  ) : mealEligibleRows.length === 0 ? (
                    <div className={`rounded-3xl border p-10 text-center space-y-3 ${cardSurface}`}>
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Utensils size={28} />
                      </div>
                      <h3 className="text-base font-black">
                        {isBn
                          ? 'কোনো আবাসিক বা ডে-কেয়ার শিক্ষার্থী পাওয়া যায়নি'
                          : 'No Residential or Day-Care Students Found'}
                      </h3>
                      <p className={`text-xs sm:text-sm max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn
                          ? 'প্রথমে "রুম ও সিট বোর্ড" অথবা "আবাসিক ও লিল্লাহ তালিকা" থেকে শিক্ষার্থীদের আবাসিক বা ডে-কেয়ার হিসেবে নির্ধারণ করুন।'
                          : 'Assign students as Residential or Day-Care in Tab 1 or Tab 2 first.'}
                      </p>
                    </div>
                  ) : filteredMealRows.length === 0 ? (
                    <div className={`rounded-3xl border p-8 text-center ${cardSurface}`}>
                      <p className="text-sm font-bold">
                        {isBn ? 'এই ফিল্টারে কোনো শিক্ষার্থী পাওয়া যায়নি।' : 'No students match the selected filter.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isBn
                            ? `মোট ${formatNum(filteredMealRows.length, isBn)} জন শিক্ষার্থী`
                            : `Showing ${filteredMealRows.length} students`}
                        </span>
                        {mealDirty && (
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                            {isBn ? '• অসংরক্ষিত পরিবর্তন রয়েছে' : '• Unsaved changes'}
                          </span>
                        )}
                      </div>

                      {filteredMealRows.map((row) => {
                        const morningPill = mealPillStyle(row.statuses.morning, row.isOnLeave);
                        const noonPill = mealPillStyle(row.statuses.noon, row.isOnLeave);
                        const nightPill = mealPillStyle(row.statuses.night, row.isOnLeave);
                        const isDrafted = Boolean(mealDraft[row.student.id]);

                        return (
                          <div
                            key={row.student.id}
                            className={`rounded-2xl border p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all ${
                              row.isOnLeave
                                ? isDark
                                  ? 'bg-rose-950/20 border-rose-500/30'
                                  : 'bg-rose-50/40 border-rose-200/80'
                                : isDrafted
                                ? isDark
                                  ? 'bg-blue-950/25 border-blue-500/40'
                                  : 'bg-blue-50/35 border-blue-200'
                                : cardSurface
                            }`}
                          >
                            {/* Student Info */}
                            <div className="flex items-center gap-3 min-w-0">
                              {row.student.photo_url ? (
                                <img
                                  src={row.student.photo_url}
                                  alt={row.student.student_name}
                                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/20 text-blue-700 dark:text-blue-300 font-black text-sm flex items-center justify-center shrink-0">
                                  {row.student.student_name.charAt(0)}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className="text-sm font-black leading-snug break-words">
                                    {row.student.student_name}
                                  </h4>
                                  {row.residentialType === 'day_care' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                      {isBn ? 'ডে-কেয়ার' : 'Day-Care'}
                                    </span>
                                  )}
                                  {row.isOnLeave && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                                      {isBn ? 'ছুটিতে' : 'On Leave'}
                                    </span>
                                  )}
                                  {row.savedLog && !isDrafted && (
                                    <span
                                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                                      title={isBn ? 'ডাটাবেসে সংরক্ষিত' : 'Saved'}
                                    >
                                      <CheckCircle2 size={12} />
                                    </span>
                                  )}
                                </div>

                                <div
                                  className={`mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold ${
                                    isDark ? 'text-slate-400' : 'text-slate-500'
                                  }`}
                                >
                                  <span>
                                    {row.className}
                                    {row.student.roll != null
                                      ? ` • ${isBn ? 'রোল' : 'Roll'} ${formatNum(row.student.roll, isBn)}`
                                      : ''}
                                  </span>
                                  {row.room && (
                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                      {isBn ? 'রুম' : 'Room'}{' '}
                                      {isBn ? toBnDigit(row.room.room_number) : row.room.room_number}
                                      {row.allocation?.seat_number
                                        ? ` (${isBn ? toBnDigit(row.allocation.seat_number) : row.allocation.seat_number})`
                                        : ''}
                                    </span>
                                  )}
                                  {row.student.guardian_phone && (
                                    <a
                                      href={`tel:${row.student.guardian_phone}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold tabular-nums"
                                    >
                                      <Phone size={10} />
                                      <span>{row.student.guardian_phone}</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* 3 Fast 1-Tap Meal Toggle Pills: Morning, Noon, Night */}
                            <div className="grid grid-cols-3 gap-2 md:w-[345px] shrink-0">
                              {(
                                [
                                  {
                                    key: 'morning' as MealKey,
                                    title: isBn ? 'সকাল' : 'Morning',
                                    pill: morningPill,
                                  },
                                  {
                                    key: 'noon' as MealKey,
                                    title: isBn ? 'দুপুর' : 'Noon',
                                    pill: noonPill,
                                  },
                                  {
                                    key: 'night' as MealKey,
                                    title: isBn ? 'রাত' : 'Night',
                                    pill: nightPill,
                                  },
                                ] as const
                              ).map((m) => (
                                <button
                                  key={m.key}
                                  type="button"
                                  onClick={() =>
                                    handleToggleMealStatus(row.student.id, row.statuses, m.key)
                                  }
                                  className={`min-h-[54px] px-2 py-2.5 rounded-xl border text-center transition-all active:scale-95 cursor-pointer select-none ${m.pill.cls}`}
                                >
                                  <span className="block text-[10px] font-bold opacity-80 leading-none">
                                    {m.title}
                                  </span>
                                  <span className="mt-1.5 flex items-center justify-center gap-1 text-xs font-black leading-none">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.pill.dotCls}`} />
                                    <span className="whitespace-nowrap">{m.pill.label}</span>
                                  </span>
                                  <span className="block mt-0.5 text-[9.5px] font-extrabold opacity-75 tabular-nums">
                                    {m.pill.weight}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sticky Bottom Save Bar (Always reachable on mobile above bottom nav; shown on desktop when unsaved) */}
                  {mealEligibleRows.length > 0 && (
                    <div
                      className={`sticky bottom-24 md:bottom-4 z-30 pt-2 ${
                        mealDirty ? '' : 'md:hidden'
                      }`}
                    >
                      <div className="max-w-xl mx-auto rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 py-3 shadow-2xl border border-slate-700/90 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black truncate flex items-center gap-1.5">
                            {mealDirty && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                            <span>
                              {mealDirty
                                ? isBn
                                  ? 'মিল হাজিরায় পরিবর্তন হয়েছে'
                                  : 'Unsaved Meal Attendance'
                                : isBn
                                ? 'আজকের মিল হিসাব'
                                : 'Today’s Meal Summary'}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-300 font-semibold truncate">
                            {isBn
                              ? `সকাল ${formatMealCount(mealSummary.morning.cookCount, isBn)} • দুপুর ${formatMealCount(mealSummary.noon.cookCount, isBn)} • রাত ${formatMealCount(mealSummary.night.cookCount, isBn)}`
                              : `M: ${formatMealCount(mealSummary.morning.cookCount, isBn)} • N: ${formatMealCount(mealSummary.noon.cookCount, isBn)} • D: ${formatMealCount(mealSummary.night.cookCount, isBn)}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveMealLogs}
                          disabled={mealSaving}
                          className="min-h-[42px] px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shrink-0 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                        >
                          {mealSaving ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Save size={15} />
                          )}
                          <span>{isBn ? 'সেভ করুন' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===================== TAB 4: GATE PASS & NIGHT ROLL CALL (PHASE 3) ===================== */}
          {activeTab === 'gatepass' && (
            <div className="space-y-4">
              {/* Sub-View Switcher: Gate Pass vs Night Roll Call */}
              <div className={`rounded-2xl border p-1.5 shadow-xs ${cardSurface}`}>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGatePassSubView('leaves')}
                    className={`min-h-[42px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-[0.98] cursor-pointer ${
                      gatePassSubView === 'leaves'
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck size={16} className="shrink-0" />
                    <span className="sm:hidden">{isBn ? 'গেট পাস' : 'Gate Pass'}</span>
                    <span className="hidden sm:inline truncate">
                      {isBn ? 'গেট পাস / বাড়ি যাওয়ার ছুটি' : 'Gate Pass & Leaves'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGatePassSubView('night_roll')}
                    className={`min-h-[42px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-[0.98] cursor-pointer ${
                      gatePassSubView === 'night_roll'
                        ? 'bg-gradient-to-r from-slate-800 to-indigo-700 text-white shadow-sm shadow-indigo-600/20'
                        : isDark
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Moon size={16} className="shrink-0" />
                    <span className="sm:hidden">{isBn ? 'রাতের হাজিরা' : 'Night Roll'}</span>
                    <span className="hidden sm:inline truncate">
                      {isBn ? 'রাতের নেগরানি হাজিরা' : 'Night Roll Call'}
                    </span>
                  </button>
                </div>
              </div>

              {/* ---------------- SECTION A: GATE PASS / LEAVES ---------------- */}
              {gatePassSubView === 'leaves' ? (
                leaveSchemaMissing ? (
                  <div className={`rounded-3xl border p-8 text-center space-y-3 ${cardSurface}`}>
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                      <AlertCircle size={28} />
                    </div>
                    <h2 className="text-lg font-black">
                      {isBn ? 'গেট পাস টেবিল সেটআপ প্রয়োজন' : 'Gate Pass Table Setup Required'}
                    </h2>
                    <p className={`text-sm max-w-xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {isBn
                        ? 'Supabase ডাটাবেসে hostel_leaves টেবিলটি এখনো তৈরি করা হয়নি। মাইগ্রেশন SQL রান করে পুনরায় যাচাই করুন।'
                        : 'The hostel_leaves table is not created in Supabase yet. Run the hostel migration SQL and refresh.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Top Action & Filter Bar */}
                    <div className={`rounded-3xl border p-4 space-y-3.5 shadow-xs ${cardSurface}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                          {(
                            [
                              { id: 'all', label: isBn ? 'সকল' : 'All', count: leaveCounts.all },
                              { id: 'out', label: isBn ? 'বাইরে আছেন' : 'Out', count: leaveCounts.out },
                              { id: 'returned', label: isBn ? 'ফিরে এসেছেন' : 'Returned', count: leaveCounts.returned },
                            ] as const
                          ).map((pill) => (
                            <button
                              key={pill.id}
                              type="button"
                              onClick={() => setLeaveStatusFilter(pill.id)}
                              className={`shrink-0 whitespace-nowrap min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-black border inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                                leaveStatusFilter === pill.id
                                  ? pill.id === 'out'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                    : pill.id === 'returned'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : isDark
                                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>{pill.label}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                                  leaveStatusFilter === pill.id
                                    ? 'bg-white/20 text-white'
                                    : isDark
                                    ? 'bg-slate-700 text-slate-300'
                                    : 'bg-slate-200/80 text-slate-700'
                                }`}
                              >
                                {formatNum(pill.count, isBn)}
                              </span>
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={openIssueGatePassModal}
                          className="w-full sm:w-auto min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                        >
                          <Plus size={16} />
                          <span>{isBn ? 'নতুন গেট পাস ইস্যু' : 'Issue Gate Pass'}</span>
                        </button>
                      </div>

                      <div className="relative">
                        <Search
                          size={15}
                          className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${
                            isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        />
                        <input
                          type="text"
                          value={leaveSearch}
                          onChange={(e) => setLeaveSearch(e.target.value)}
                          placeholder={
                            isBn
                              ? 'শিক্ষার্থী, অভিভাবকের নাম, ফোন বা রুম নম্বর দিয়ে খুঁজুন...'
                              : 'Search student, guardian name, phone, or room...'
                          }
                          className={`${inputCls} pl-10`}
                        />
                      </div>
                    </div>

                    {/* Gate Pass List */}
                    {mealLoading ? (
                      <div className={`rounded-3xl border p-10 flex flex-col items-center justify-center gap-3 ${cardSurface}`}>
                        <Loader2 size={28} className="animate-spin text-indigo-600" />
                        <p className="text-sm font-bold">
                          {isBn ? 'গেট পাস তালিকা লোড হচ্ছে...' : 'Loading gate passes...'}
                        </p>
                      </div>
                    ) : filteredLeaves.length === 0 ? (
                      <div className={`rounded-3xl border p-10 text-center space-y-3 ${cardSurface}`}>
                        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                          <ShieldCheck size={28} />
                        </div>
                        <h3 className="text-base font-black">
                          {mealLeaves.length === 0
                            ? isBn
                              ? 'এখনো কোনো গেট পাস ইস্যু করা হয়নি'
                              : 'No Gate Passes Issued Yet'
                            : isBn
                            ? 'এই ফিল্টারে কোনো গেট পাস নেই'
                            : 'No Matching Gate Passes'}
                        </h3>
                        <p className={`text-xs sm:text-sm max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isBn
                            ? 'আবাসিক শিক্ষার্থীর বাড়ি যাওয়ার ছুটি নিরাপদে রেকর্ড করতে নতুন গেট পাস ইস্যু করুন। ছুটি থাকলে মিল ও রাতের হাজিরা স্বয়ংক্রিয়ভাবে ছুটিতে দেখাবে।'
                            : 'Issue digital gate passes for residential boarders. Active leaves automatically reflect in meal counts and night roll call.'}
                        </p>
                        <button
                          type="button"
                          onClick={openIssueGatePassModal}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black inline-flex items-center gap-2 shadow-md cursor-pointer"
                        >
                          <Plus size={16} />
                          <span>{isBn ? 'প্রথম গেট পাস ইস্যু করুন' : 'Issue First Gate Pass'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredLeaves.map((leave) => {
                          const stu = studentMap.get(leave.student_id);
                          const alloc = activeAllocationByStudent.get(leave.student_id);
                          const rm = alloc?.room_id ? roomMap.get(alloc.room_id) : null;
                          const clsName = stu ? classMap.get(stu.class_id)?.class_name || '' : '';
                          const returned = isLeaveReturned(leave);
                          const fromDate = getLeaveFromDate(leave);
                          const expDate = getLeaveExpectedReturn(leave);

                          return (
                            <div
                              key={leave.id}
                              className={`rounded-3xl border p-4 sm:p-5 shadow-xs transition-all ${
                                returned
                                  ? cardSurface
                                  : isDark
                                  ? 'bg-amber-950/15 border-amber-500/35 text-white'
                                  : 'bg-amber-50/35 border-amber-200/90 text-slate-800'
                              }`}
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="space-y-2.5 min-w-0 flex-1">
                                  <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-blue-500/20 text-indigo-700 dark:text-indigo-300 font-black text-base flex items-center justify-center shrink-0">
                                      {(stu?.student_name || '?').charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <h4 className="text-sm sm:text-base font-black leading-snug break-words">
                                          {stu?.student_name || (isBn ? 'শিক্ষার্থী' : 'Student')}
                                        </h4>
                                        <span
                                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                            returned
                                              ? isDark
                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              : isDark
                                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                              : 'bg-amber-100 text-amber-800 border-amber-300'
                                          }`}
                                        >
                                          {returned
                                            ? isBn
                                              ? 'ফিরে এসেছেন'
                                              : 'Returned'
                                            : isBn
                                            ? 'বাইরে আছেন'
                                            : 'Out / On Leave'}
                                        </span>
                                      </div>

                                      <div
                                        className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold ${
                                          isDark ? 'text-slate-400' : 'text-slate-500'
                                        }`}
                                      >
                                        {clsName && (
                                          <span>
                                            {clsName}
                                            {stu?.roll != null
                                              ? ` • ${isBn ? 'রোল' : 'Roll'} ${formatNum(stu.roll, isBn)}`
                                              : ''}
                                          </span>
                                        )}
                                        {rm && (
                                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                            {isBn ? 'রুম' : 'Room'}{' '}
                                            {isBn ? toBnDigit(rm.room_number) : rm.room_number}
                                            {alloc?.seat_number
                                              ? ` (${isBn ? 'সিট' : 'Seat'} ${
                                                  isBn ? toBnDigit(alloc.seat_number) : alloc.seat_number
                                                })`
                                              : ''}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Guardian & Dates Metadata Grid */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                    <div
                                      className={`rounded-2xl border px-3 py-2 text-xs ${
                                        isDark
                                          ? 'bg-slate-800/70 border-slate-700'
                                          : 'bg-white/90 border-slate-200/80'
                                      }`}
                                    >
                                      <span className={`block text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {isBn ? 'গ্রহণকারী অভিভাবক' : 'Picked Up By'}
                                      </span>
                                      <span className="font-black block truncate mt-0.5">
                                        {leave.guardian_name || '—'}
                                        {leave.guardian_relation ? ` (${leave.guardian_relation})` : ''}
                                      </span>
                                      {leave.guardian_phone && (
                                        <a
                                          href={`tel:${leave.guardian_phone}`}
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 hover:underline tabular-nums"
                                        >
                                          <Phone size={11} />
                                          <span>{leave.guardian_phone}</span>
                                        </a>
                                      )}
                                    </div>

                                    <div
                                      className={`rounded-2xl border px-3 py-2 text-xs ${
                                        isDark
                                          ? 'bg-slate-800/70 border-slate-700'
                                          : 'bg-white/90 border-slate-200/80'
                                      }`}
                                    >
                                      <span className={`block text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {isBn ? 'ছুটির সময়কাল' : 'Leave Duration'}
                                      </span>
                                      <span className="font-black block mt-0.5">
                                        {fromDate ? formatReadableDate(fromDate, isBn) : '—'}
                                      </span>
                                      <span className={`block text-[11px] font-bold mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {isBn ? 'ফেরার কথা:' : 'Expected:'}{' '}
                                        {expDate ? formatReadableDate(expDate, isBn) : '—'}
                                      </span>
                                    </div>

                                    <div
                                      className={`rounded-2xl border px-3 py-2 text-xs ${
                                        isDark
                                          ? 'bg-slate-800/70 border-slate-700'
                                          : 'bg-white/90 border-slate-200/80'
                                      }`}
                                    >
                                      <span className={`block text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {isBn ? 'কারণ ও অনুমোদন' : 'Reason & Approved By'}
                                      </span>
                                      <span className="font-bold block truncate mt-0.5">
                                        {leave.reason || (isBn ? 'উল্লেখ নেই' : 'Not specified')}
                                      </span>
                                      {leave.approved_by && (
                                        <span className={`block text-[10.5px] font-semibold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                          {isBn ? 'অনুমোদন:' : 'By:'} {leave.approved_by}
                                        </span>
                                      )}
                                      {returned && leave.actual_return && (
                                        <span className="block text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                          {isBn ? 'ফিরেছেন:' : 'Returned:'}{' '}
                                          {formatReadableDate(String(leave.actual_return).slice(0, 10), isBn)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap sm:flex-nowrap lg:flex-col items-stretch gap-2 shrink-0 lg:w-48">
                                  {!returned && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkReturned(leave)}
                                      disabled={markingReturnId === leave.id}
                                      className="flex-1 h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                                    >
                                      {markingReturnId === leave.id ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <CheckCircle2 size={15} />
                                      )}
                                      <span>{isBn ? 'হোস্টেলে ফিরেছেন' : 'Mark Returned'}</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setPrintGatePassTarget(leave)}
                                    className={`flex-1 h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                                      isDark
                                        ? 'bg-slate-800 border-slate-700 text-blue-300 hover:bg-blue-500/20'
                                        : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                    }`}
                                  >
                                    <Printer size={15} />
                                    <span>{isBn ? 'গেট পাস প্রিন্ট' : 'Print Gate Pass'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* ---------------- SECTION B: NIGHT ROLL CALL (ROOM-GROUPED) ---------------- */
                <div className="space-y-4">
                  {/* Night Roll Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isBn ? 'মোট আবাসিক' : 'Total Boarders'}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-xl font-black tabular-nums">
                          {formatNum(nightRollSummary.total, isBn)}
                        </span>
                        <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          ({formatNum(nightRollSummary.saved, isBn)} {isBn ? 'সেভড' : 'saved'})
                        </span>
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-emerald-50/70 border-emerald-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                        {isBn ? 'উপস্থিত (রুম)' : 'Present'}
                      </span>
                      <span className="mt-1 block text-xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                        {formatNum(nightRollSummary.present, isBn)}
                      </span>
                    </div>

                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-amber-500/10 border-amber-500/25' : 'bg-amber-50/70 border-amber-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                        {isBn ? 'ছুটিতে (গেট পাস)' : 'On Leave'}
                      </span>
                      <span className="mt-1 block text-xl font-black tabular-nums text-amber-700 dark:text-amber-300">
                        {formatNum(nightRollSummary.leave, isBn)}
                      </span>
                    </div>

                    <div className={`rounded-2xl border p-3 ${isDark ? 'bg-rose-500/10 border-rose-500/25' : 'bg-rose-50/70 border-rose-200/80'}`}>
                      <span className={`block text-[11px] font-bold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                        {isBn ? 'অনুপস্থিত' : 'Absent'}
                      </span>
                      <span className="mt-1 block text-xl font-black tabular-nums text-rose-700 dark:text-rose-300">
                        {formatNum(nightRollSummary.absent, isBn)}
                      </span>
                    </div>
                  </div>

                  {/* Date + Filter + Save Bar */}
                  <div className={`rounded-3xl border p-4 space-y-3.5 shadow-xs ${cardSurface}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-center flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setMealDate((d) => shiftDateStr(d, -1))}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                            isDark
                              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <ChevronLeft size={18} />
                        </button>

                        <SmartDatePicker
                          value={mealDate}
                          onChange={setMealDate}
                          lang={lang}
                          isDark={isDark}
                          renderTrigger={(open) => (
                            <button
                              type="button"
                              onClick={open}
                              className={`h-10 px-3.5 rounded-xl border text-xs sm:text-sm font-black inline-flex items-center gap-2 transition-all cursor-pointer ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 text-white hover:border-blue-500'
                                  : 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-50'
                              }`}
                            >
                              <Calendar size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                              <span>{formatReadableDate(mealDate, isBn)}</span>
                            </button>
                          )}
                        />

                        <button
                          type="button"
                          onClick={() => setMealDate((d) => shiftDateStr(d, 1))}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                            isDark
                              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <ChevronRight size={18} />
                        </button>

                        {mealDate !== getTodayDateString() && (
                          <button
                            type="button"
                            onClick={() => setMealDate(getTodayDateString())}
                            className="h-10 px-3 rounded-xl bg-blue-600 text-white text-xs font-black active:scale-95 transition-all cursor-pointer"
                          >
                            {isBn ? 'আজ' : 'Today'}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMarkAllNightPresent}
                          disabled={nightRollRows.length === 0 || nightRollSaving}
                          className={`h-10 px-3.5 rounded-xl border text-xs font-black inline-flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                            isDark
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          <Check size={15} />
                          <span>{isBn ? 'সকলকে উপস্থিত দিন' : 'Mark All Present'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveNightRoll}
                          disabled={nightRollRows.length === 0 || nightRollSaving}
                          className={`h-10 px-4 rounded-xl text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                            nightRollDirty
                              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30 ring-2 ring-indigo-400/50'
                              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                          }`}
                        >
                          {nightRollSaving ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Save size={15} />
                          )}
                          <span>{isBn ? 'রাতের হাজিরা সেভ করুন' : 'Save Night Roll'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="sm:col-span-7 relative">
                        <Search
                          size={15}
                          className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${
                            isDark ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        />
                        <input
                          type="text"
                          value={nightRollSearch}
                          onChange={(e) => setNightRollSearch(e.target.value)}
                          placeholder={
                            isBn ? 'শিক্ষার্থী, রুম বা নেগরানের নাম খুঁজুন...' : 'Search student, room, or warden...'
                          }
                          className={`${inputCls} pl-10`}
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <select
                          value={nightRollRoomFilter}
                          onChange={(e) => setNightRollRoomFilter(e.target.value)}
                          className={inputCls}
                        >
                          <option value="all">{isBn ? 'সকল রুম' : 'All Rooms'}</option>
                          <option value="unassigned">{isBn ? 'রুম বরাদ্দ হয়নি' : 'Unassigned Room'}</option>
                          {rooms
                            .filter((r) => r.is_active)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {isBn ? `রুম ${toBnDigit(r.room_number)}` : `Room ${r.room_number}`}
                                {r.warden_name ? ` — ${r.warden_name}` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Room-Grouped Night Roll Call Cards */}
                  {mealLoading ? (
                    <div className={`rounded-3xl border p-10 flex flex-col items-center justify-center gap-3 ${cardSurface}`}>
                      <Loader2 size={28} className="animate-spin text-indigo-600" />
                      <p className="text-sm font-bold">
                        {isBn ? 'রাতের হাজিরা লোড হচ্ছে...' : 'Loading night roll call...'}
                      </p>
                    </div>
                  ) : nightRollGroupedByRoom.length === 0 ? (
                    <div className={`rounded-3xl border p-10 text-center space-y-2 ${cardSurface}`}>
                      <Moon size={30} className="mx-auto text-slate-400" />
                      <p className="text-sm font-bold">
                        {isBn
                          ? 'রাতের হাজিরার জন্য কোনো আবাসিক শিক্ষার্থী পাওয়া যায়নি।'
                          : 'No residential boarders found for night roll call.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {nightRollGroupedByRoom.map((group) => (
                        <div key={group.key} className={`rounded-3xl border overflow-hidden shadow-xs ${cardSurface}`}>
                          {/* Room Header with Warden Info */}
                          <div
                            className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                              isDark
                                ? 'bg-slate-800/80 border-slate-700'
                                : 'bg-indigo-50/70 border-indigo-100'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black shrink-0">
                                {group.room
                                  ? `${isBn ? 'রুম' : 'Room'} ${
                                      isBn ? toBnDigit(group.room.room_number) : group.room.room_number
                                    }`
                                  : isBn
                                  ? 'রুম ছাড়া'
                                  : 'Unassigned'}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-black truncate">
                                  {group.room
                                    ? group.room.room_title ||
                                      `${group.room.building_name}${
                                        group.room.floor_name ? ` • ${group.room.floor_name}` : ''
                                      }`
                                    : isBn
                                    ? 'রুম বরাদ্দ হয়নি এমন আবাসিক শিক্ষার্থী'
                                    : 'Unassigned Residential Boarders'}
                                </h4>
                                <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {isBn
                                    ? `মোট ${formatNum(group.rows.length, isBn)} জন`
                                    : `${group.rows.length} boarders`}
                                </p>
                              </div>
                            </div>

                            {group.room && (group.room.warden_name || group.room.warden_phone) && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`inline-flex items-center gap-1 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <UserCheck size={14} className="text-indigo-500" />
                                  <span>
                                    {isBn ? 'নেগরান:' : 'Warden:'} {group.room.warden_name || '—'}
                                  </span>
                                </span>
                                {group.room.warden_phone && (
                                  <a
                                    href={`tel:${group.room.warden_phone}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] tabular-nums"
                                  >
                                    <Phone size={11} />
                                    <span>{group.room.warden_phone}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Room Students List */}
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.rows.map((row) => (
                              <div
                                key={row.student.id}
                                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                  <span className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center shrink-0">
                                    {row.allocation?.seat_number
                                      ? isBn
                                        ? toBnDigit(row.allocation.seat_number)
                                        : row.allocation.seat_number
                                      : '#'}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="text-sm font-black leading-snug break-words">
                                        {row.student.student_name}
                                      </p>
                                      {row.isOnLeave && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                          {isBn ? 'গেট পাস সক্রিয়' : 'Gate Pass Active'}
                                        </span>
                                      )}
                                    </div>
                                    <div className={`mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                      <span>
                                        {row.className}
                                        {row.student.roll != null
                                          ? ` • ${isBn ? 'রোল' : 'Roll'} ${formatNum(row.student.roll, isBn)}`
                                          : ''}
                                      </span>
                                      {row.student.guardian_phone && (
                                        <a
                                          href={`tel:${row.student.guardian_phone}`}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold tabular-nums"
                                        >
                                          <Phone size={10} />
                                          <span>{row.student.guardian_phone}</span>
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* 3 Fast 1-Tap Status Buttons: Present, Leave, Absent */}
                                <div className="grid grid-cols-3 gap-2 sm:w-[300px] shrink-0">
                                  {(
                                    [
                                      {
                                        id: 'present' as HostelNightRollStatus,
                                        label: isBn ? 'উপস্থিত' : 'Present',
                                        activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
                                      },
                                      {
                                        id: 'leave' as HostelNightRollStatus,
                                        label: isBn ? 'ছুটিতে' : 'Leave',
                                        activeCls: 'bg-amber-500 text-white border-amber-500 shadow-xs',
                                      },
                                      {
                                        id: 'absent' as HostelNightRollStatus,
                                        label: isBn ? 'অনুপস্থিত' : 'Absent',
                                        activeCls: 'bg-rose-600 text-white border-rose-600 shadow-xs',
                                      },
                                    ] as const
                                  ).map((opt) => {
                                    const active = row.nightStatus === opt.id;
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleSetNightRollStatus(row.student.id, opt.id)}
                                        className={`min-h-[42px] px-2 rounded-xl border text-xs font-black transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                                          active
                                            ? opt.activeCls
                                            : isDark
                                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sticky Bottom Save Bar for Night Roll Call (Always reachable on mobile above bottom nav) */}
                  {nightRollRows.length > 0 && (
                    <div
                      className={`sticky bottom-24 md:bottom-4 z-30 pt-2 ${
                        nightRollDirty ? '' : 'md:hidden'
                      }`}
                    >
                      <div className="max-w-xl mx-auto rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white px-4 py-3 shadow-2xl border border-slate-700/90 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black truncate flex items-center gap-1.5">
                            {nightRollDirty && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                            <span>
                              {nightRollDirty
                                ? isBn
                                  ? 'রাতের হাজিরায় পরিবর্তন হয়েছে'
                                  : 'Unsaved Night Roll Call'
                                : isBn
                                ? 'রাতের হাজিরা সারসংক্ষেপ'
                                : 'Night Roll Summary'}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-300 font-semibold truncate">
                            {isBn
                              ? `উপস্থিত ${formatNum(nightRollSummary.present, isBn)} • ছুটি ${formatNum(nightRollSummary.leave, isBn)} • অনুপস্থিত ${formatNum(nightRollSummary.absent, isBn)}`
                              : `P: ${nightRollSummary.present} • L: ${nightRollSummary.leave} • A: ${nightRollSummary.absent}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveNightRoll}
                          disabled={nightRollSaving}
                          className="min-h-[42px] px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs sm:text-sm font-black inline-flex items-center gap-1.5 shrink-0 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                        >
                          {nightRollSaving ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Save size={15} />
                          )}
                          <span>{isBn ? 'সেভ করুন' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================== MODAL: ADD / EDIT ROOM ===================== */}
      {roomModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto">
            <div
              className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden ${cardSurface}`}
            >
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-inherit shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Building2 size={18} />
                  </div>
                  <h3 className="text-base font-black truncate">
                    {editingRoom
                      ? isBn
                        ? 'রুমের তথ্য সম্পাদনা'
                        : 'Edit Hostel Room'
                      : isBn
                      ? 'নতুন হোস্টেল রুম যোগ করুন'
                      : 'Add New Hostel Room'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveRoom} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'ভবনের নাম *' : 'Building Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={roomForm.building_name}
                      onChange={(e) => setRoomForm({ ...roomForm, building_name: e.target.value })}
                      placeholder={isBn ? 'যেমন: মূল ভবন / হিফজ ভবন' : 'e.g. Main Building'}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'তলা (Floor)' : 'Floor'}
                    </label>
                    <input
                      type="text"
                      value={roomForm.floor_name}
                      onChange={(e) => setRoomForm({ ...roomForm, floor_name: e.target.value })}
                      placeholder={isBn ? 'যেমন: ২য় তলা' : 'e.g. 2nd Floor'}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'রুম নম্বর *' : 'Room Number *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={roomForm.room_number}
                      onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })}
                      placeholder={isBn ? 'যেমন: ২০১' : 'e.g. 201'}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'রুমের নাম/পরিচিতি' : 'Room Title (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={roomForm.room_title}
                      onChange={(e) => setRoomForm({ ...roomForm, room_title: e.target.value })}
                      placeholder={isBn ? 'যেমন: দারুল হিফজ কক্ষ' : 'e.g. Darul Hifz Room'}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'ধরন (লিঙ্গ)' : 'Gender'}
                    </label>
                    <select
                      value={roomForm.gender}
                      onChange={(e) =>
                        setRoomForm({ ...roomForm, gender: e.target.value as HostelRoomGender })
                      }
                      className={inputCls}
                    >
                      <option value="male">{isBn ? 'বালক / ছাত্র' : 'Boys / Male'}</option>
                      <option value="female">{isBn ? 'বালিকা / ছাত্রী' : 'Girls / Female'}</option>
                      <option value="any">{isBn ? 'সকলের জন্য' : 'Any'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'মোট সিট সংখ্যা *' : 'Capacity (Beds) *'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={roomForm.capacity}
                      onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'মাসিক সিট ফি (৳)' : 'Monthly Fee (৳)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={roomForm.monthly_seat_fee}
                      onChange={(e) => setRoomForm({ ...roomForm, monthly_seat_fee: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'নিগরান / ওয়ার্ডেনের নাম' : 'Warden Name'}
                    </label>
                    <input
                      type="text"
                      value={roomForm.warden_name}
                      onChange={(e) => setRoomForm({ ...roomForm, warden_name: e.target.value })}
                      placeholder={isBn ? 'যেমন: হাফেজ মাওলানা...' : 'Warden full name'}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'ওয়ার্ডেনের মোবাইল' : 'Warden Phone'}
                    </label>
                    <input
                      type="tel"
                      value={roomForm.warden_phone}
                      onChange={(e) => setRoomForm({ ...roomForm, warden_phone: e.target.value })}
                      placeholder="01XXXXXXXXX"
                      className={inputCls}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-xs font-bold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={roomForm.is_active}
                    onChange={(e) => setRoomForm({ ...roomForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{isBn ? 'রুমটি সক্রিয় আছে (সিট বরাদ্দের জন্য উন্মুক্ত)' : 'Room is active for seat allocation'}</span>
                </label>

                </div>

                <div className="shrink-0 border-t border-inherit px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRoomModalOpen(false)}
                    className={`min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={roomSaving}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-60 active:scale-95 transition-all cursor-pointer"
                  >
                    {roomSaving && <Loader2 size={15} className="animate-spin" />}
                    <span>{editingRoom ? (isBn ? 'আপডেট করুন' : 'Update Room') : isBn ? 'রুম সংরক্ষণ করুন' : 'Save Room'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ===================== MODAL: ASSIGN SEAT ===================== */}
      {assignModalRoom &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto">
            <div
              className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden ${cardSurface}`}
            >
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-inherit shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-black">
                    {isBn ? 'সিট বরাদ্দ করুন' : 'Assign Seat'}
                  </h3>
                  <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {assignModalRoom.building_name} • {isBn ? 'রুম' : 'Room'}{' '}
                    {isBn ? toBnDigit(assignModalRoom.room_number) : assignModalRoom.room_number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignModalRoom(null)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConfirmAssignSeat} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Student Filter + Picker */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold">
                    {isBn ? 'শিক্ষার্থী নির্বাচন করুন *' : 'Select Student *'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={assignStudentSearch}
                        onChange={(e) => setAssignStudentSearch(e.target.value)}
                        placeholder={isBn ? 'নাম বা রোল...' : 'Name or roll...'}
                        className={`${inputCls} pl-8 py-2 text-xs`}
                      />
                    </div>
                    <select
                      value={assignClassFilter}
                      onChange={(e) => setAssignClassFilter(e.target.value)}
                      className={`${inputCls} py-2 text-xs`}
                    >
                      <option value="all">{isBn ? 'সকল শ্রেণি' : 'All Classes'}</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.class_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`rounded-2xl border max-h-48 overflow-y-auto divide-y ${
                      isDark
                        ? 'border-slate-700 divide-slate-800 bg-slate-800/40'
                        : 'border-slate-200 divide-slate-100 bg-slate-50/70'
                    }`}
                  >
                    {assignableStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {isBn
                          ? 'সিট বরাদ্দের মতো কোনো শিক্ষার্থী পাওয়া যায়নি।'
                          : 'No unassigned active students found.'}
                      </div>
                    ) : (
                      assignableStudents.slice(0, 80).map((row) => {
                        const selected = assignStudentId === row.student.id;
                        const rb = resBadge(row.residentialType);
                        return (
                          <button
                            key={row.student.id}
                            type="button"
                            onClick={() => {
                              setAssignStudentId(row.student.id);
                              if (row.allocation?.fee_category) {
                                handleAssignFeeCategoryChange(row.allocation.fee_category);
                              }
                            }}
                            className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                              selected
                                ? isDark
                                  ? 'bg-blue-600/25 text-white'
                                  : 'bg-blue-50 text-blue-900'
                                : isDark
                                ? 'hover:bg-slate-800'
                                : 'hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold truncate">
                                {row.student.student_name}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {row.className}
                                {row.student.roll != null
                                  ? ` • ${isBn ? 'রোল' : 'Roll'} ${formatNum(row.student.roll, isBn)}`
                                  : ''}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${rb.cls}`}>
                              {rb.label}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Seat No, Fee Category, Monthly Boarding Fee */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'সিট নম্বর' : 'Seat Number'}
                    </label>
                    <input
                      type="text"
                      value={assignSeatNumber}
                      onChange={(e) => setAssignSeatNumber(e.target.value)}
                      placeholder={isBn ? 'যেমন: ১' : 'e.g. 1'}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'ফি ক্যাটাগরি' : 'Fee Category'}
                    </label>
                    <select
                      value={assignFeeCategory}
                      onChange={(e) => handleAssignFeeCategoryChange(e.target.value as HostelFeeCategory)}
                      className={inputCls}
                    >
                      <option value="full_paid">{isBn ? 'পূর্ণ ফি' : 'Full Paid'}</option>
                      <option value="half_free">{isBn ? 'অর্ধ-ফ্রি' : 'Half-Free'}</option>
                      <option value="lillah_free">{isBn ? 'পূর্ণ লিল্লাহ/এতিম' : 'Lillah / Free'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      {isBn ? 'মাসিক ফি (৳)' : 'Monthly Fee (৳)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={assignMonthlyFee}
                      onChange={(e) => setAssignMonthlyFee(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    {isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder={isBn ? 'বিশেষ কোনো তথ্য থাকলে লিখুন' : 'Any special note'}
                    className={inputCls}
                  />
                </div>

                </div>

                <div className="shrink-0 border-t border-inherit px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAssignModalRoom(null)}
                    className={`min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={assignSaving || !assignStudentId}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
                  >
                    {assignSaving && <Loader2 size={15} className="animate-spin" />}
                    <span>{isBn ? 'বরাদ্দ নিশ্চিত করুন' : 'Confirm Assignment'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ===================== MODAL: TRANSFER ROOM ===================== */}
      {transferTarget &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto">
            <div className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden ${cardSurface}`}>
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-inherit shrink-0">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-blue-600" />
                  <h3 className="text-base font-black">{isBn ? 'রুম পরিবর্তন' : 'Transfer Room'}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConfirmTransfer} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className={`rounded-2xl border p-3 text-xs space-y-1 ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <p className="font-black text-sm">{transferTarget.student.student_name}</p>
                  <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                    {isBn ? 'বর্তমান রুম:' : 'Current Room:'} {transferTarget.fromRoom.building_name} —{' '}
                    {isBn ? 'রুম' : 'Room'}{' '}
                    {isBn
                      ? toBnDigit(transferTarget.fromRoom.room_number)
                      : transferTarget.fromRoom.room_number}
                  </p>
                </div>

                {availableTransferRooms.length === 0 ? (
                  <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 p-4 text-xs font-bold text-amber-800 dark:text-amber-300">
                    {isBn
                      ? 'বর্তমানে খালি সিটসহ অন্য কোনো সক্রিয় রুম নেই।'
                      : 'No other active rooms with available seats right now.'}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        {isBn ? 'নতুন রুম নির্বাচন করুন *' : 'Target Room *'}
                      </label>
                      <select
                        required
                        value={transferToRoomId}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          setTransferToRoomId(nextId);
                          const target = roomMap.get(nextId);
                          if (target) {
                            setTransferSeatNumber(getNextSeatSuggestion(target.id, target.capacity));
                          }
                        }}
                        className={inputCls}
                      >
                        {availableTransferRooms.map(({ room, occupied }) => (
                          <option key={room.id} value={room.id}>
                            {room.building_name} — {isBn ? 'রুম' : 'Room'}{' '}
                            {isBn ? toBnDigit(room.room_number) : room.room_number} (
                            {formatNum(room.capacity - occupied, isBn)} {isBn ? 'খালি' : 'free'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">
                        {isBn ? 'নতুন সিট নম্বর' : 'New Seat Number'}
                      </label>
                      <input
                        type="text"
                        value={transferSeatNumber}
                        onChange={(e) => setTransferSeatNumber(e.target.value)}
                        className={inputCls}
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={transferSyncFee}
                        onChange={(e) => setTransferSyncFee(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        {isBn
                          ? 'নতুন রুমের মাসিক ফি অনুযায়ী বোর্ডিং ফি আপডেট করুন'
                          : 'Adjust boarding fee to target room rate'}
                      </span>
                    </label>
                  </>
                )}

                </div>

                <div className="shrink-0 border-t border-inherit px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTransferTarget(null)}
                    className={`min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={transferSaving || !transferToRoomId}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
                  >
                    {transferSaving && <Loader2 size={15} className="animate-spin" />}
                    <span>{isBn ? 'স্থানান্তর করুন' : 'Confirm Transfer'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ===================== MODAL: VACATE SEAT CONFIRM ===================== */}
      {vacateTarget &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto">
            <div className={`w-full max-w-sm rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl overflow-hidden ${cardSurface}`}>
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden" />
              <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                    <UserMinus size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black">{isBn ? 'সিট খালি করবেন?' : 'Vacate Seat?'}</h3>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {vacateTarget.student.student_name} • {isBn ? 'রুম' : 'Room'}{' '}
                      {isBn ? toBnDigit(vacateTarget.room.room_number) : vacateTarget.room.room_number}
                    </p>
                  </div>
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isBn
                    ? 'এই শিক্ষার্থীর বর্তমান সিটটি খালি করা হবে এবং পূর্ববর্তী বরাদ্দের ইতিহাস সংরক্ষিত থাকবে।'
                    : 'This student will be removed from the room and their seat history will remain preserved.'}
                </p>
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setVacateTarget(null)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={vacateSaving}
                    onClick={handleConfirmVacate}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 active:scale-95 transition-all cursor-pointer"
                  >
                    {vacateSaving && <Loader2 size={14} className="animate-spin" />}
                    <span>{isBn ? 'হ্যাঁ, খালি করুন' : 'Yes, Vacate'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================== MODAL: DELETE ROOM CONFIRM ===================== */}
      {deleteRoomTarget &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto">
            <div className={`w-full max-w-sm rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl overflow-hidden ${cardSurface}`}>
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden" />
              <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black">{isBn ? 'রুম মুছে ফেলবেন?' : 'Delete Room?'}</h3>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {deleteRoomTarget.building_name} • {isBn ? 'রুম' : 'Room'}{' '}
                      {isBn ? toBnDigit(deleteRoomTarget.room_number) : deleteRoomTarget.room_number}
                    </p>
                  </div>
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {isBn
                    ? 'আপনি কি নিশ্চিতভাবে এই রুমটি মুছে ফেলতে চান? রুমে শিক্ষার্থী থাকলে আগে সিট খালি করতে হবে।'
                    : 'Are you sure you want to delete this room? Rooms with active students cannot be deleted.'}
                </p>
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeleteRoomTarget(null)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={deletingRoom}
                    onClick={handleConfirmDeleteRoom}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60 active:scale-95 transition-all cursor-pointer"
                  >
                    {deletingRoom && <Loader2 size={14} className="animate-spin" />}
                    <span>{isBn ? 'মুছে ফেলুন' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================== MODAL: UPDATE RESIDENTIAL & FEE PROFILE ===================== */}
      {editStudentTarget &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto">
            <div className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden ${cardSurface}`}>
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-inherit shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Home size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black truncate">
                      {editStudentTarget.student.student_name}
                    </h3>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isBn ? 'আবাসিক ধরন ও ফি ক্যাটাগরি আপডেট' : 'Update Residential & Fee Category'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditStudentTarget(null)}
                  className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveStudentDirectory} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    {isBn ? 'আবাসিক ধরন' : 'Residential Type'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'residential', label: isBn ? 'আবাসিক' : 'Residential' },
                        { id: 'non_residential', label: isBn ? 'অনাবাসিক' : 'Non-Res' },
                        { id: 'day_care', label: isBn ? 'ডে-কেয়ার' : 'Day-Care' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setEditResType(opt.id);
                          if (opt.id === 'non_residential') setEditMonthlyFee('0');
                        }}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          editResType === opt.id
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {editStudentTarget.allocation?.room_id && editResType !== 'residential' && (
                  <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    {isBn
                      ? 'সতর্কতা: অনাবাসিক বা ডে-কেয়ার নির্বাচন করলে শিক্ষার্থীর বর্তমান হোস্টেল রুমের সিটটি স্বয়ংক্রিয়ভাবে খালি হয়ে যাবে।'
                      : 'Note: Changing from Residential will automatically vacate this student’s current hostel room seat.'}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5">
                    {isBn ? 'ফি ক্যাটাগরি' : 'Fee Category'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'full_paid', label: isBn ? 'পূর্ণ ফি' : 'Full Paid' },
                        { id: 'half_free', label: isBn ? 'অর্ধ-ফ্রি' : 'Half-Free' },
                        { id: 'lillah_free', label: isBn ? 'লিল্লাহ/ফ্রি' : 'Lillah Free' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setEditFeeCategory(opt.id);
                          if (opt.id === 'lillah_free') setEditMonthlyFee('0');
                        }}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          editFeeCategory === opt.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    {isBn ? 'মাসিক বোর্ডিং / খানা ফি (৳)' : 'Monthly Boarding Fee (৳)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={editMonthlyFee}
                    onChange={(e) => setEditMonthlyFee(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    {isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={editStudentNotes}
                    onChange={(e) => setEditStudentNotes(e.target.value)}
                    placeholder={isBn ? 'যেমন: এতিম / লিল্লাহ বোর্ডিং অনুমোদিত' : 'e.g. Orphan / Lillah approved'}
                    className={inputCls}
                  />
                </div>

                </div>

                <div className="shrink-0 border-t border-inherit px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditStudentTarget(null)}
                    className={`min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={editStudentSaving}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-60 active:scale-95 transition-all cursor-pointer"
                  >
                    {editStudentSaving && <Loader2 size={15} className="animate-spin" />}
                    <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ===================== MODAL: ISSUE GATE PASS ===================== */}
      {gatePassModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto">
            <div className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl border-t sm:border shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden ${cardSurface}`}>
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 sm:hidden shrink-0" />
              <div className="flex items-center justify-between px-5 py-4 border-b border-inherit shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black truncate">
                      {isBn ? 'নতুন গেট পাস ইস্যু করুন' : 'Issue Hostel Gate Pass'}
                    </h3>
                    <p className={`text-[11px] font-semibold truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isBn ? 'বাড়ি যাওয়ার ছুটি ও অভিভাবক যাচাইকরণ' : 'Home leave & guardian handover'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGatePassModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleIssueGatePass} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Student Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black block">
                    {isBn ? 'আবাসিক শিক্ষার্থী নির্বাচন করুন *' : 'Select Residential Student *'}
                  </label>
                  <input
                    type="text"
                    value={gatePassStudentSearch}
                    onChange={(e) => setGatePassStudentSearch(e.target.value)}
                    placeholder={isBn ? 'নাম, রোল বা রুম লিখে খুঁজুন...' : 'Filter by name, roll, or room...'}
                    className={inputCls}
                  />
                  <select
                    value={gatePassForm.student_id}
                    onChange={(e) => handleSelectGatePassStudent(e.target.value)}
                    required
                    className={inputCls}
                  >
                    <option value="">
                      {isBn ? '-- শিক্ষার্থী বাছাই করুন --' : '-- Choose student --'}
                    </option>
                    {residentialStudentsOnly
                      .filter((r) => {
                        const q = gatePassStudentSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          r.student.student_name.toLowerCase().includes(q) ||
                          String(r.student.roll ?? '').includes(q) ||
                          (r.room?.room_number || '').toLowerCase().includes(q)
                        );
                      })
                      .map((r) => (
                        <option key={r.student.id} value={r.student.id}>
                          {r.student.student_name}
                          {r.room ? ` — ${isBn ? 'রুম' : 'Room'} ${r.room.room_number}` : ''}
                          {r.className ? ` (${r.className})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Guardian Name & Relation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black block mb-1">
                      {isBn ? 'অভিভাবকের নাম *' : 'Guardian Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={gatePassForm.guardian_name}
                      onChange={(e) =>
                        setGatePassForm((p) => ({ ...p, guardian_name: e.target.value }))
                      }
                      placeholder={isBn ? 'যিনি শিক্ষার্থীকে নিয়ে যাবেন' : 'Person picking up student'}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black block mb-1">
                      {isBn ? 'সম্পর্ক' : 'Relation'}
                    </label>
                    <select
                      value={gatePassForm.guardian_relation}
                      onChange={(e) =>
                        setGatePassForm((p) => ({ ...p, guardian_relation: e.target.value }))
                      }
                      className={inputCls}
                    >
                      {['বাবা', 'মা', 'বড় ভাই', 'চাচা', 'মামা', 'দাদা / নানা', 'অভিভাবক'].map((rel) => (
                        <option key={rel} value={rel}>
                          {rel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Guardian Phone & Approved By */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black block mb-1">
                      {isBn ? 'অভিভাবকের মোবাইল *' : 'Guardian Phone *'}
                    </label>
                    <input
                      type="tel"
                      required
                      value={gatePassForm.guardian_phone}
                      onChange={(e) =>
                        setGatePassForm((p) => ({ ...p, guardian_phone: e.target.value }))
                      }
                      placeholder="01XXXXXXXXX"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black block mb-1">
                      {isBn ? 'অনুমোদনকারী (নেগরান/সুপার)' : 'Approved By'}
                    </label>
                    <input
                      type="text"
                      value={gatePassForm.approved_by}
                      onChange={(e) =>
                        setGatePassForm((p) => ({ ...p, approved_by: e.target.value }))
                      }
                      placeholder={isBn ? 'উস্তাদের নাম' : 'Warden / Admin name'}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black block mb-1">
                      {isBn ? 'যাওয়ার তারিখ *' : 'Leave From *'}
                    </label>
                    <SmartDatePicker
                      value={gatePassForm.leave_from}
                      onChange={(val) =>
                        setGatePassForm((p) => ({
                          ...p,
                          leave_from: val,
                          expected_return: p.expected_return < val ? val : p.expected_return,
                        }))
                      }
                      lang={lang}
                      isDark={isDark}
                      renderTrigger={(open) => (
                        <button
                          type="button"
                          onClick={open}
                          className={`${inputCls} flex items-center justify-between text-left cursor-pointer`}
                        >
                          <span>{formatReadableDate(gatePassForm.leave_from, isBn)}</span>
                          <Calendar size={15} className="text-blue-600 shrink-0" />
                        </button>
                      )}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black block mb-1">
                      {isBn ? 'সম্ভাব্য ফেরার তারিখ *' : 'Expected Return *'}
                    </label>
                    <SmartDatePicker
                      value={gatePassForm.expected_return}
                      minDate={gatePassForm.leave_from}
                      onChange={(val) =>
                        setGatePassForm((p) => ({ ...p, expected_return: val }))
                      }
                      lang={lang}
                      isDark={isDark}
                      renderTrigger={(open) => (
                        <button
                          type="button"
                          onClick={open}
                          className={`${inputCls} flex items-center justify-between text-left cursor-pointer`}
                        >
                          <span>{formatReadableDate(gatePassForm.expected_return, isBn)}</span>
                          <Calendar size={15} className="text-indigo-600 shrink-0" />
                        </button>
                      )}
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="text-xs font-black block mb-1">
                    {isBn ? 'ছুটির কারণ' : 'Reason for Leave'}
                  </label>
                  <input
                    type="text"
                    value={gatePassForm.reason}
                    onChange={(e) => setGatePassForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder={
                      isBn ? 'যেমন: পারিবারিক অনুষ্ঠান / অসুস্থতা / সাপ্তাহিক ছুটি' : 'e.g. Family visit / Medical'
                    }
                    className={inputCls}
                  />
                </div>

                </div>

                <div className="shrink-0 border-t border-inherit px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGatePassModalOpen(false)}
                    className={`min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={gatePassSaving}
                    className="min-h-[42px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black inline-flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-60 active:scale-95 transition-all cursor-pointer"
                  >
                    {gatePassSaving && <Loader2 size={15} className="animate-spin" />}
                    <span>{isBn ? 'গেট পাস ইস্যু করুন' : 'Issue Gate Pass'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ===================== MODAL: PRINTABLE GATE PASS SLIP (THERMAL / A5) ===================== */}
      {printGatePassTarget &&
        createPortal(
          (() => {
            const lv = printGatePassTarget;
            const stu = studentMap.get(lv.student_id);
            const alloc = activeAllocationByStudent.get(lv.student_id);
            const rm = alloc?.room_id ? roomMap.get(alloc.room_id) : null;
            const clsName = stu ? classMap.get(stu.class_id)?.class_name || '' : '';
            const fromD = getLeaveFromDate(lv);
            const expD = getLeaveExpectedReturn(lv);
            const returned = isLeaveReturned(lv);

            return (
              <div
                id="hostel-gatepass-print-portal"
                className="fixed inset-0 z-[1100] bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-noto"
              >
                <style>{`
                  @media print {
                    body > *:not(#hostel-gatepass-print-portal) { display: none !important; }
                    #hostel-gatepass-print-portal {
                      position: static !important;
                      inset: auto !important;
                      background: #fff !important;
                      padding: 0 !important;
                      display: block !important;
                    }
                    #hostel-gatepass-print-portal .no-print { display: none !important; }
                    #hostel-gatepass-slip-card {
                      box-shadow: none !important;
                      border: 1.5px solid #000 !important;
                      max-width: 148mm !important;
                      margin: 0 auto !important;
                      border-radius: 0 !important;
                    }
                  }
                `}</style>
                <div className="w-full max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col gap-2.5 sm:gap-3 bg-slate-900/95 sm:bg-transparent rounded-t-3xl sm:rounded-none p-3 sm:p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0">
                  <div className="no-print w-10 h-1 rounded-full bg-slate-600 mx-auto sm:hidden shrink-0" />
                  {/* Action Bar (hidden when printing) */}
                  <div className="no-print shrink-0 flex items-center justify-between gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg">
                    <span className="text-xs font-black truncate">
                      {isBn ? 'গেট পাস প্রিন্ট প্রিভিউ (A5 / থার্মাল)' : 'Gate Pass Print Preview'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black inline-flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <Printer size={14} />
                        <span>{isBn ? 'প্রিন্ট করুন' : 'Print'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintGatePassTarget(null)}
                        className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Printable Slip Card */}
                  <div
                    id="hostel-gatepass-slip-card"
                    className="flex-1 overflow-y-auto bg-white text-slate-900 rounded-3xl border-2 border-slate-300 p-5 sm:p-6 shadow-2xl space-y-4"
                  >
                    {/* Institution Header */}
                    <div className="text-center border-b-2 border-dashed border-slate-300 pb-3 space-y-1">
                      {madrasah?.logo_url && (
                        <img
                          src={madrasah.logo_url}
                          alt={madrasah.name}
                          className="w-11 h-11 mx-auto rounded-xl object-contain"
                        />
                      )}
                      <h2 className="text-base sm:text-lg font-black leading-tight text-slate-900">
                        {madrasah?.name || ''}
                      </h2>
                      {madrasah?.address && (
                        <p className="text-[11px] font-medium text-slate-600">{madrasah.address}</p>
                      )}
                      {madrasah?.phone && (
                        <p className="text-[11px] font-bold text-slate-600 tabular-nums">
                          {isBn ? 'ফোন:' : 'Phone:'} {madrasah.phone}
                        </p>
                      )}
                      <div className="pt-1.5">
                        <span className="inline-block px-3.5 py-1 rounded-full border-2 border-slate-900 text-xs font-black uppercase tracking-wide">
                          {isBn ? 'হোস্টেল গেট পাস / ছুটির ছাড়পত্র' : 'HOSTEL GATE PASS'}
                        </span>
                      </div>
                    </div>

                    {/* Student & Room Details */}
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'শিক্ষার্থীর নাম:' : 'Student:'}
                        </span>
                        <span className="font-black text-right">{stu?.student_name || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'শ্রেণি / রোল:' : 'Class / Roll:'}
                        </span>
                        <span className="font-bold text-right">
                          {clsName || '—'}
                          {stu?.roll != null ? ` (রোল ${formatNum(stu.roll, isBn)})` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'রুম ও সিট:' : 'Room & Seat:'}
                        </span>
                        <span className="font-black text-right">
                          {rm
                            ? `${rm.building_name}, রুম ${isBn ? toBnDigit(rm.room_number) : rm.room_number}${
                                alloc?.seat_number
                                  ? ` (সিট ${isBn ? toBnDigit(alloc.seat_number) : alloc.seat_number})`
                                  : ''
                              }`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'অভিভাবক:' : 'Guardian:'}
                        </span>
                        <span className="font-black text-right">
                          {lv.guardian_name || '—'}
                          {lv.guardian_relation ? ` (${lv.guardian_relation})` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'অভিভাবক মোবাইল:' : 'Phone:'}
                        </span>
                        <span className="font-bold text-right tabular-nums">
                          {lv.guardian_phone || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'যাওয়ার তারিখ:' : 'Leave Date:'}
                        </span>
                        <span className="font-black text-right">
                          {fromD ? formatReadableDate(fromD, isBn) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'ফেরার তারিখ:' : 'Expected Return:'}
                        </span>
                        <span className="font-black text-right">
                          {expD ? formatReadableDate(expD, isBn) : '—'}
                        </span>
                      </div>
                      {lv.reason && (
                        <div className="flex justify-between gap-2 border-b border-slate-100 pb-1.5">
                          <span className="font-bold text-slate-500">
                            {isBn ? 'ছুটির কারণ:' : 'Reason:'}
                          </span>
                          <span className="font-bold text-right">{lv.reason}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 pb-1">
                        <span className="font-bold text-slate-500">
                          {isBn ? 'অবস্থা:' : 'Status:'}
                        </span>
                        <span className="font-black text-right">
                          {returned
                            ? isBn
                              ? 'হোস্টেলে ফিরে এসেছেন'
                              : 'Returned to Hostel'
                            : isBn
                            ? 'বাইরে আছেন (অনুমোদিত)'
                            : 'Out (Approved)'}
                        </span>
                      </div>
                    </div>

                    {/* Signature Lines */}
                    <div className="pt-6 border-t border-dashed border-slate-300 grid grid-cols-2 gap-6 text-center text-[11px] font-bold text-slate-700">
                      <div>
                        <div className="h-8" />
                        <div className="border-t border-slate-700 pt-1">
                          {isBn ? 'অভিভাবকের স্বাক্ষর' : 'Guardian Signature'}
                        </div>
                      </div>
                      <div>
                        <div className="h-8 flex items-end justify-center text-[10px] font-black text-slate-600 pb-0.5">
                          {lv.approved_by || rm?.warden_name || ''}
                        </div>
                        <div className="border-t border-slate-700 pt-1">
                          {isBn ? 'নেগরান / ওয়ার্ডেন স্বাক্ষর' : 'Warden Signature'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
};

export default HostelManagement;
