
/**
 * Global Type Definitions for Madrasah SaaS Management System
 */

export type Language = 'bn' | 'en';

export type UserRole = 'super_admin' | 'madrasah_admin' | 'accountant' | 'teacher';

export interface Institution {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  institution_type: 'madrasah' | 'school' | 'kindergarten' | 'nurani' | 'system';
  config_json: {
    modules: {
      attendance: boolean;
      results: boolean;
      admit_card: boolean;
      seat_plan: boolean;
      accounting: boolean;
      academic_year_promotion?: boolean;
      voice_broadcast?: boolean;
      sms?: boolean;
    };
    result_engine: 'school' | 'befaq' | 'qawmi_custom';
    result_system: 'grading' | 'marks' | 'hifz';
    attendance_type: 'daily' | 'period';
    fee_structure: 'monthly' | 'session';
    ui_mode: 'madrasah' | 'school';
    template_set?: string;
    fee_engine?: 'school' | 'qawmi' | 'kindergarten' | 'simple';
    accounting_mode?: 'qawmi_flexible' | 'school_system';
    attendance_settings?: {
      half_day_time?: string;
      full_day_time?: string;
    };
  };
  theme: string;
  status: 'active' | 'suspended' | 'trial';
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  email?: string;
  login_code?: string;
  balance: number;
  sms_balance: number;
  reve_api_key?: string;
  reve_secret_key?: string;
  reve_caller_id?: string;
  reve_client_id?: string;
  subscription_end?: string;
  voice_sender_id?: string;
}

export interface Voice {
  id: string;
  institution_id: string;
  title: string;
  file_url: string;
  provider_voice_id: string | null;
  provider_voice_name: string | null;
  admin_status: 'pending' | 'approved' | 'rejected' | 'draft';
  provider_status: 'pending' | 'approved' | 'rejected' | 'draft';
  created_at: string;
}

export interface BefaqExam {
  id: string;
  institution_id: string;
  exam_name: string;
  exam_year: string;
  marhala_id: string; // class_id
  is_active: boolean;
  created_at: string;
  classes?: Class;
}

export interface BefaqSubject {
  id: string;
  exam_id: string;
  subject_name: string;
  total_marks: number;
  passing_marks: number;
}

export interface BefaqResult {
  id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
}

export interface QawmiResultConfig {
  id: string;
  institution_id: string;
  config_name: string;
  grade_settings: any; // JSON
  pass_mark_settings: any; // JSON
  is_active: boolean;
}

export interface Profile {
  id: string;
  institution_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  permissions?: {
    attendance?: boolean;
    fees?: boolean;
    results?: boolean;
    admit_card?: boolean;
    seat_plan?: boolean;
    accounting?: boolean;
    voice_broadcast?: boolean;
    sms?: boolean;
    dashboard?: boolean;
    institutions?: boolean;
    approvals?: boolean;
    tutorials?: boolean;
    can_manage_students?: boolean;
    can_manage_classes?: boolean;
    can_send_sms?: boolean;
    can_send_free_sms?: boolean;
    can_manage_exams?: boolean;
    can_manage_accounting?: boolean;
    can_use_voice_call?: boolean;
    can_manage_attendance?: boolean;
    can_manage_institutions?: boolean;
    can_manage_approvals?: boolean;
    can_manage_results?: boolean;
    can_manage_teachers?: boolean;
    can_manage_sms?: boolean;
    can_manage_settings?: boolean;
    can_view_reports?: boolean;
    allowed_classes?: string[];
  };
}

export interface Class {
  id: string;
  institution_id: string;
  class_name: string;
  sort_order?: number | null;
  created_at?: string;
}

export interface Student {
  id: string;
  institution_id: string;
  class_id: string;
  student_name: string;
  roll: number | null;
  guardian_name?: string;
  guardian_phone: string;
  guardian_phone_2?: string;
  photo_url?: string;
  student_type?: 'boarding' | 'day_scholar';
  department?: 'hifz' | 'nazera' | 'kitab' | 'other';
  sponsor_id?: string | null;
  created_at?: string;
  classes?: Class;
}

export interface Sponsor {
  id: string;
  institution_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface StudentSponsorship {
  id: string;
  student_id: string;
  sponsor_id: string;
  amount: number;
  start_date: string;
  end_date?: string;
  status: 'active' | 'inactive';
}

export interface Exam {
  id: string;
  institution_id: string;
  class_id: string;
  exam_name: string;
  exam_date: string;
  is_published: boolean;
  created_at: string;
  classes?: Class;
}

export interface ExamSubject {
  id: string;
  exam_id: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
}

export interface ExamMark {
  id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
}

export interface Attendance {
  id: string;
  institution_id: string;
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  date: string;
  recorded_by: string;
  students?: Student;
}

export interface LedgerEntry {
  id: string;
  institution_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string;
}

export interface FeeStructure {
  id: string;
  institution_id: string;
  class_id: string;
  fee_name: string;
  amount: number;
  created_at: string;
}

export interface Fee {
  id: string;
  institution_id: string;
  student_id: string;
  class_id: string;
  amount_paid: number;
  amount_due: number;
  discount?: number;
  month: string; // YYYY-MM
  status: 'paid' | 'unpaid' | 'partial';
  paid_at?: string;
  students?: Student;
}

export interface ExamRoom {
  id: string;
  room_name: string;
  capacity: number;
}

export interface SeatAssignment {
  student_id: string;
  student_name: string;
  class_name: string;
  roll: number;
  room_name: string;
  seat_number: number;
}

export interface FinalResult {
  id: string;
  institution_id: string;
  class_id: string;
  title: string;
  created_at: string;
  classes?: Class;
  exams?: FinalResultExam[];
}

export interface FinalResultExam {
  id: string;
  final_result_id: string;
  exam_id: string;
  weight: number;
  exam?: Exam;
}

export interface AcademicYear {
  id: string;
  institution_id: string;
  year_name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface PromotionLog {
  id: string;
  institution_id: string;
  student_id: string;
  from_class_id: string;
  to_class_id: string;
  academic_year_from_id: string;
  academic_year_to_id: string;
  executed_at: string;
  status: 'promoted' | 'retained' | 'conditional';
}

export interface TeacherPermissions {
  can_manage_attendance?: boolean;
  can_manage_results?: boolean;
  can_manage_students?: boolean;
  can_manage_exams?: boolean;
  can_manage_accounting?: boolean;
  can_manage_classes?: boolean;
  can_manage_settings?: boolean;
  can_send_sms?: boolean;
  can_send_free_sms?: boolean;
  can_use_voice_call?: boolean;
  can_view_reports?: boolean;
  can_manage_teachers?: boolean;
  allowed_classes?: string[];
}

export interface Teacher {
  id: string;
  user_id?: string;
  institution_id: string;
  name: string;
  phone: string;
  pin?: string;
  designation?: string;
  is_active: boolean;
  permissions?: TeacherPermissions;
  created_at: string;
}

export type View = 
  | 'home' 
  | 'classes' 
  | 'account' 
  | 'students' 
  | 'student-details' 
  | 'student-form' 
  | 'teachers'
  | 'class-form' 
  | 'admin-panel' 
  | 'transactions' 
  | 'wallet-sms' 
  | 'admin-dashboard' 
  | 'admin-approvals' 
  | 'data-management' 
  | 'accounting' 
  | 'attendance'
  | 'exams'
  | 'final-results'
  | 'academic-year'
  | 'voice-broadcast'
  | 'sms-voice-menu'
  | 'academic-calendar'
  | 'tutorials'
  | 'admin-voice-service'
  | 'admin-tutorials'
  | 'super-account';

export interface Tutorial {
  id: string;
  title: string;
  url: string;
  youtube_url: string;
  sort_order: number;
  created_at: string;
}

export interface AppState {
  currentView: View;
  selectedClassId?: string;
  selectedStudent?: Student;
  isEditing?: boolean;
}

export interface Transaction {
  id: string;
  institution_id: string;
  amount: number;
  transaction_id: string;
  sender_phone: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  sms_count?: number;
  institutions?: Institution;
}

export interface AdminSMSStock {
  id: string;
  remaining_sms: number;
  last_updated: string;
}

export interface SMSTemplate {
  id: string;
  institution_id: string;
  title: string;
  body: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  institution_id: string;
  title: string;
  description?: string;
  event_date: string; // YYYY-MM-DD
  event_type: 'islamic' | 'madrasah' | 'holiday' | 'closed';
  created_at: string;
}
