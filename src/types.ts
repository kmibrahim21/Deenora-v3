
/**
 * Global Type Definitions for Madrasah SaaS Management System
 */

export type Language = 'bn' | 'en';

export type UserRole = 'super_admin' | 'madrasah_admin' | 'manager' | 'accountant' | 'teacher' | 'parent';

export interface SmsProviderConfig {
  reve: {
    masking_enabled: boolean;
    non_masking_enabled: boolean;
  };
  automas: {
    masking_enabled: boolean;
    non_masking_enabled: boolean;
  };
  primary: {
    masking: 'reve' | 'automas';
    non_masking: 'reve' | 'automas';
  };
  default_type?: 'masking' | 'non_masking';
  masking_rate?: number;
  non_masking_rate?: number;
}

export interface Institution {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  institute_code?: string;
  logo_url?: string;
  signature_url?: string;
  seal_url?: string;
  institution_type: 'madrasah' | 'school' | 'kindergarten' | 'choching' | 'system';
  config_json: {
    modules: {
      attendance: boolean;
      exam?: boolean;
      results?: boolean;
      admit_card?: boolean;
      seat_plan?: boolean;
      accounting: boolean;
      library?: boolean;
      academic_year_promotion?: boolean;
      voice_broadcast?: boolean;
      sms?: boolean;
      messages?: boolean;
      certificates?: boolean;
      student_photo?: boolean;
      id_cards?: boolean;
      exam_routine?: boolean;
      parent_portal?: boolean;
      donations?: boolean;
    };
    result_engine: 'school' | 'befaq' | 'qawmi_custom';
    class_result_engines?: Record<string, 'gpa' | 'befaq' | 'high_school' | 'school'>;
    merit_ranking_mode?: 'gpa_first' | 'total_marks_first' | 'off';
    optional_subject_total_mode?: 'exclude' | 'bonus_above_40' | 'include';
    result_system: 'grading' | 'marks' | 'hifz' | 'grading_optional' | 'high_school';
    attendance_type: 'daily' | 'period';
    fee_structure: 'monthly' | 'session';
    ui_mode: 'madrasah' | 'school';
    template_set?: string;
    fee_engine?: 'school' | 'qawmi' | 'kindergarten' | 'simple';
    accounting_mode?: 'qawmi_flexible' | 'school_system';
    student_limit?: number;
    branch_limit?: number;
    shared_branch_student_limit?: boolean;
    user_pin?: string;
    academic_year_start?: string;
    active_academic_year_id?: string;
    attendance_settings?: {
      start_time?: string;
      end_time?: string;
      half_day_time?: string;
      full_day_time?: string;
      sessions?: { id: string; name: string }[];
      class_sessions?: Record<string, { id: string; name: string }[]>;
      class_times?: Record<string, { start_time?: string; end_time?: string; half_day_time?: string; full_day_time?: string }>;
    };
    subscription?: {
      package_name?: string;
      package_rate?: number;
      subscription_type?: string;
      paid_months?: string[];
    };
    institute_code?: string;
    weekly_holidays?: number[];
    seal_url?: string;
    signature_url?: string;
    signature_height?: number;
    arabic_calligraphy_url?: string;
    arabic_calligraphy_width?: number;
    exam_manual_attendance?: Record<string, Record<string, string>>;
    package_name?: string;
    features?: {
      student_attendance_sms?: boolean;
      fee_collection_sms?: boolean;
      teacher_attendance_deduction?: boolean;
      teacher_salary_sms?: boolean;
    };
  };
  theme: string;
  status: 'active' | 'suspended' | 'trial';
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  email?: string; // Login email (read-only in settings)
  contact_email?: string; // Contact email used for PDFs
  balance: number;
  sms_balance: number;
  subscription_end?: string;
  voice_sender_id?: string;
  sms_rate?: number;
  voice_rate?: number;
  reve_api_key?: string;
  reve_secret_key?: string;
  reve_client_id?: string;
  reve_non_masking_id?: string;
  automas_api_key?: string;
  automas_masking_sender_id?: string;
  automas_non_masking_sender_id?: string;
  custom_subscription_fee?: number;
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
  academic_year_id?: string;
  is_published?: boolean;
  created_at: string;
  classes?: Class;
}

export interface BefaqSubject {
  id: string;
  exam_id: string;
  subject_name: string;
  total_marks: number;
  passing_marks: number;
  sort_order?: number;
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
  email?: string;
  role: UserRole;
  class_id?: string;
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
    read_only?: boolean;
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
    can_send_messages?: boolean;
    voice_dashboard?: boolean;
    donations?: boolean;
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
  biometric_id?: string;
  student_name: string;
  name_en?: string;
  admission_number?: string;
  roll: number | null;
  date_of_birth?: string;
  blood_group?: string;
  guardian_name?: string;
  mother_name?: string;
  guardian_phone: string;
  guardian_phone_2?: string;
  address?: string;
  notes?: string;
  photo_url?: string;
  student_type?: 'boarding' | 'day_scholar';
  department?: 'hifz' | 'nazera' | 'kitab' | 'other';
  sponsor_id?: string | null;
  academic_year_id?: string;
  registration_number?: string;
  section?: string;
  is_active?: boolean;
  created_at?: string;
  classes?: Class;
  gender?: string;
  nationality?: string;
  religion?: string;
  father_name?: string;
  father_occupation?: string;
  mother_occupation?: string;
  guardian_relation?: string;
  permanent_address?: string;
  previous_institution?: string;
  previous_class?: string;
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
  academic_year_id?: string;
  created_at: string;
  classes?: Class;
}

export interface ExamSubject {
  id: string;
  exam_id: string;
  subject_name: string;
  full_marks: number;
  pass_marks: number;
  cq_full_marks?: number;
  mcq_full_marks?: number;
  practical_full_marks?: number;
  sort_order?: number;
  is_optional?: boolean;
  pair_with_id?: string;
}

export interface ExamMark {
  id: string;
  exam_id: string;
  student_id: string;
  subject_id: string;
  marks_obtained: number;
  cq_marks?: number;
  mcq_marks?: number;
  practical_marks?: number;
}

export interface Attendance {
  id: string;
  institution_id: string;
  student_id: string;
  class_id?: string;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday' | 'leave';
  date: string;
  session?: string;
  late_minutes?: number;
  arrival_time?: string;
  check_in?: string;
  note?: string;
  recorded_by: string;
  academic_year_id?: string;
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
  academic_year_id?: string;
  created_at: string;
}

export type FeeCategoryFrequency = 'monthly' | 'one_time' | 'annual' | 'exam' | 'custom';

export interface FeeCategory {
  id: string;
  name: string;
  frequency: FeeCategoryFrequency;
  is_default?: boolean;
  description?: string;
  color?: string;
  created_at?: string;
}

export interface FeeStructure {
  id: string;
  institution_id: string;
  class_id: string;
  fee_name: string;
  amount: number;
  due_date?: string;
  start_date?: string;
  category_id?: string;
  category_name?: string;
  created_at: string;
  classes?: {
    class_name: string;
  };
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
  created_at?: string;
  academic_year_id?: string;
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
  academic_year_id?: string;
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
  hijri_start_date?: string;
  hijri_end_date?: string;
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
  can_upload_student_photos?: boolean;
  can_send_messages?: boolean;
  allowed_classes?: string[];
  teacher_id_number?: string;
}

export interface Teacher {
  id: string;
  teacher_id_number?: string;
  biometric_id?: string;
  user_id?: string;
  institution_id: string;
  name: string;
  phone: string;
  pin?: string;
  designation?: string;
  basic_salary?: number;
  monthly_salary?: number;
  address?: string;
  join_date?: string;
  leave_date?: string;
  sort_order?: number;
  is_active: boolean;
  photo_url?: string;
  permissions?: TeacherPermissions;
  created_at: string;
}

export interface ClassRoutine {
  id: string;
  institution_id: string;
  class_id: string;
  subject_name: string;
  teacher_id?: string;
  day: 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  start_time: string;
  end_time: string;
  room_number?: string;
  is_break?: boolean;
  note?: string;
  created_at?: string;
  classes?: Class;
  teachers?: Teacher;
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
  | 'admin-institutions'
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
  | 'messages'
  | 'library'
  | 'class-routine'
  | 'certificates'
  | 'id-cards'
  | 'super-account'
  | 'teacheraccount'
  | 'admission-form'
  | 'academic-documents'
  | 'profile-settings'
  | 'donations'
  | 'chat';

export type ConversationType = 'direct' | 'class_group' | 'announcement' | 'teacher_staff' | 'custom_group';

export interface Conversation {
  id: string;
  institution_id: string;
  type: ConversationType;
  name?: string;
  class_id?: string;
  section_id?: string;
  is_announcement_only?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
  unread_count?: number;
  last_message?: ChatMessage;
  members?: ConversationMember[];
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  institution_id: string;
  member_role: 'owner' | 'admin' | 'member';
  joined_at: string;
  left_at?: string;
  last_read_message_id?: string;
  last_read_at?: string;
  is_muted?: boolean;
  is_pinned?: boolean;
  profile?: Profile;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  institution_id: string;
  sender_id: string;
  sender_name?: string;
  class_name?: string;
  client_message_id?: string;
  message: string;
  message_type: 'text' | 'image' | 'document' | 'voice' | 'system_event';
  attachment_url?: string;
  attachment_name?: string;
  attachment_size?: number;
  voice_duration?: number;
  reply_to_message_id?: string;
  reply_to_message?: {
    id: string;
    sender_id?: string;
    sender_name: string;
    message: string;
    message_type?: string;
  };
  is_edited?: boolean;
  edited_at?: string;
  is_deleted?: boolean;
  deleted_for_me?: boolean;
  is_starred?: boolean;
  is_parent?: boolean;
  sender_role?: string;
  delivered_at?: string;
  read_at?: string;
  read_by?: Array<{ user_id: string; user_name: string; role?: string; read_at: string }>;
  delivered_to?: Array<{ user_id: string; user_name: string; role?: string; delivered_at: string }>;
  created_at: string;
  updated_at?: string;
  sender_profile?: Profile;
  status?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  synced?: 0 | 1;
  error?: string;
}

export interface ConversationSettings {
  isMuted?: boolean;
  muteUntil?: '8hours' | '1week' | 'always' | null;
  readReceipts?: boolean;
  mediaAutoDownload?: 'all' | 'wifi' | 'never';
  enterKeySends?: boolean;
  wallpaper?: 'default' | 'light' | 'dark' | 'mint' | 'emerald' | 'amber';
  isArchived?: boolean;
  isBlocked?: boolean;
}

// ---------------------------------------------------------------------------
// DEENORA CHAT V3: AUTOMATIC ARCHIVING & SUPABASE STORAGE OPTIMIZATION TYPES
// ---------------------------------------------------------------------------

export type ArchiveStatus = 'created' | 'verified' | 'cleaned_up' | 'failed';

export interface ChatArchiveMetadata {
  id: string; // archive_id (UUID)
  institution_id: string;
  conversation_id?: string; // specific conversation ID or 'all'
  conversation_name?: string;
  date_start: string; // ISO date string
  date_end: string; // ISO date string
  message_count: number;
  archive_size_bytes: number;
  compressed_size_bytes?: number;
  checksum: string; // SHA-256 hex string of encrypted payload
  encryption_version: string; // e.g. 'AES-256-GCM-V3'
  storage_location: 'supabase_storage' | 'local_encrypted' | 'google_drive';
  storage_path?: string;
  status: ArchiveStatus;
  crypto_metadata?: any;
  encrypted_package_url?: string;
  created_by?: string;
  verified_at?: string;
  cleaned_up_at?: string;
  created_at: string;
}

export interface ChatRetentionPolicy {
  institution_id: string;
  hot_retention_days: number; // default: 90 (0-90 days hot in Supabase)
  announcement_retention_mode: 'permanent' | 'days'; // default: 'permanent'
  announcement_retention_days?: number; // if mode is 'days', e.g. 365
  protect_pinned_messages: boolean; // default: true
  protect_starred_messages: boolean; // default: true
  auto_archive_enabled: boolean; // default: true
  archive_granularity: 'per_conversation_month' | 'per_institution_month' | 'per_academic_year';
  storage_destination: 'supabase_storage_cold' | 'local_encrypted' | 'google_drive';
  last_archive_run_at?: string;
  last_cleanup_run_at?: string;
  updated_at?: string;
}

export type ArchiveAuditAction =
  | 'archive_created'
  | 'archive_verified'
  | 'cleanup_started'
  | 'cleanup_completed'
  | 'cleanup_failed'
  | 'restore_performed';

export interface ChatArchiveAuditLog {
  id: string;
  institution_id: string;
  archive_id?: string;
  action: ArchiveAuditAction;
  affected_message_count?: number;
  date_range?: { start: string; end: string };
  details?: string;
  performed_by: string;
  created_at: string;
}

export interface ArchiveCandidateStats {
  total_supabase_messages: number;
  hot_messages_count: number;
  archive_candidate_count: number;
  oldest_message_date?: string;
  newest_message_date?: string;
  estimated_storage_bytes: number;
  verified_archives_count: number;
  cleaned_up_archives_count: number;
}

export interface ArchiveExecutionStep {
  step: 'identification' | 'packaging' | 'compression' | 'encryption' | 'checksum_verification' | 'metadata_recording' | 'cloud_cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  details?: string;
}

export interface ArchiveExecutionResult {
  success: boolean;
  archive_metadata?: ChatArchiveMetadata;
  verified: boolean;
  cleaned_up_count: number;
  error?: string;
  steps: ArchiveExecutionStep[];
}

export interface Donation {
  id: string;
  institution_id: string;
  donor_id?: string;
  donor_name: string;
  donor_phone?: string;
  donor_address?: string;
  amount: number;
  fund_category: 'general' | 'zakat' | 'lillah' | 'development' | 'orphan' | 'ramadan' | 'sadaqah' | 'other' | string;
  payment_method: 'cash' | 'bkash' | 'nagad' | 'rocket' | 'bank' | 'other';
  receipt_no: string;
  donation_date: string;
  note?: string;
  prayer_request?: string;
  is_monthly_pledge?: boolean;
  ledger_synced?: boolean;
  ledger_id?: string;
  collected_by?: string;
  created_at: string;
}

export interface Donor {
  id: string;
  institution_id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  donor_type: 'general' | 'monthly' | 'permanent' | 'corporate';
  monthly_pledge_amount?: number;
  total_donated?: number;
  notes?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Tutorial {
  id: string;
  title: string;
  url: string;
  youtube_url: string;
  category?: string;
  sort_order: number;
  created_at: string;
}

export interface AppState {
  currentView: View;
  selectedClassId?: string;
  selectedStudent?: Student;
  isEditing?: boolean;
  parentStudentId?: string;
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
  module?: 'sms' | 'voice' | 'subscription';
  metadata?: any;
  institutions?: Institution;
  approved_at?: string;
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
  end_date?: string; // YYYY-MM-DD
  class_id?: string;
  class_ids?: string[];
  event_type: 'islamic' | 'madrasah' | 'holiday' | 'closed';
  created_at: string;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  rate: number;
  features: string[];
  sort_order: number;
  created_at?: string;
}

export interface SystemSettings {
  id: string;
  reve_api_key?: string;
  reve_secret_key?: string;
  reve_caller_id?: string;
  reve_client_id?: string;
  reve_non_masking_id?: string;
  automas_api_key?: string;
  automas_masking_sender_id?: string;
  automas_non_masking_sender_id?: string;
  sms_provider_config?: SmsProviderConfig;
  bkash_number?: string;
  nagad_number?: string;
  sms_rate: number;
  voice_rate: number;
  manager_permissions?: Profile['permissions'];
  support_number?: string;
  updated_at?: string;
  global_update_active?: boolean;
  global_update_message?: string;
  global_update_version?: number;
}
