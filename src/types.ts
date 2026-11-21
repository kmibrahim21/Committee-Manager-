
/**
 * Global Type Definitions for Committee Manager SaaS Platform
 */

export type Language = 'bn' | 'en';

export type UserRole = 'super_admin' | 'manager' | 'org_admin' | 'accountant' | 'executive' | 'member';

export interface Institution {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  logo_url?: string;
  institution_type: 'committee' | 'association' | 'organization' | 'club' | 'foundation' | 'trust' | 'council' | 'union' | 'forum' | 'society' | 'federation' | 'governing_board' | 'ngo' | 'system' | 'madrasah' | 'school' | 'kindergarten' | 'nurani' | 'sangha';
  config_json: {
    songho_activities?: string[];
    songho_config?: Record<string, any>;
    songho_general_policy?: Record<string, any>;
    departments_config?: Record<string, any>;
    modules: {
      departments: boolean;
      attendance: boolean;
      meetings: boolean;
      minutes: boolean;
      events: boolean;
      accounting: boolean;
      membership_promotion?: boolean;
      voice_broadcast?: boolean;
      sms?: boolean;
      polls?: boolean;
      notices?: boolean;
      subscriptions?: boolean;
      // Association Submodules
      savings?: boolean;
      loans?: boolean;
      qard_hasan?: boolean;
      installments?: boolean;
      profit_distribution?: boolean;
      // Organization/NGO Submodules
      employees?: boolean;
      volunteers?: boolean;
      tasks?: boolean;
      projects?: boolean;
      payroll?: boolean;
      beneficiaries?: boolean;
      relief_mgmt?: boolean;
      donations?: boolean;
      monitoring?: boolean;
      gps_tracking?: boolean;
      // Club Submodules
      tournaments?: boolean;
      gallery?: boolean;
      certificates?: boolean;
      // Trust Submodules
      trustees?: boolean;
      properties?: boolean;
      assets?: boolean;
      legal_documents?: boolean;
      // Council/Federation/Board/Union Submodules
      regional_mgmt?: boolean;
      election?: boolean;
      welfare_fund?: boolean;
      legal_support?: boolean;
      training?: boolean;
      discussions?: boolean;
      multi_org?: boolean;
      branches?: boolean;
      delegates?: boolean;
      conferences?: boolean;
      institutions?: boolean;
      board_members?: boolean;
    };
    org_type: 'community' | 'professional' | 'religious' | 'organization' | 'committee';
    attendance_type: 'daily' | 'meeting' | 'event' | 'period';
    fee_structure?: 'monthly' | 'yearly' | 'lifetime' | 'session';
    ui_mode: 'committee' | 'organization' | 'madrasah' | 'school';
    template_set?: string;
    finance_mode?: 'flexible' | 'standard';
    attendance_settings?: any;
    fee_engine?: 'standard' | 'school' | 'qawmi' | 'kindergarten' | 'simple';
    meeting_engine?: string;
    accounting_mode?: 'committee_system' | 'flexible' | 'qawmi_flexible' | 'school_system';
    subscription_type?: 'monthly' | 'quarterly' | 'yearly' | 'lifetime';
    member_limit?: number;
    sms_rate?: number;
    voice_rate?: number;
    custom_subscription_fee?: number | '';
    package_name?: string;
    package_rate?: number;
    paid_months?: string[];
    due_amount?: number;
    subscription_note?: string;
    accounting_start_date?: string | null;
    accounting_end_date?: string | null;
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
  subscription_end?: string;
  reve_api_key?: string;
  reve_secret_key?: string;
  reve_caller_id?: string;
  voice_sender_id?: string;
  reve_client_id?: string;
  member_portal_config?: {
    enabled: boolean;
    permissions: {
      view_meetings: boolean;
      view_minutes: boolean;
      view_polls: boolean;
      view_notices: boolean;
      view_finances: boolean;
      view_attendance: boolean;
    };
  };
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
  title: string;
  exam_year: string;
  marhala_id: string; // department_id
  is_active: boolean;
  created_at: string;
  departments?: Department;
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

export interface ManagerProfile {
  id: string;
  email?: string;
  full_name: string;
  role: 'manager';
  is_active: boolean;
  phone?: string;
  created_at: string;
  permissions: ManagerPermissions;
}

export interface ManagerPermissions {
  can_manage_committees?: boolean;      // কমিটি তৈরি ও এডিট করার অনুমতি
  can_approve_payments?: boolean;       // এসএমএস ও পেমেন্ট রিকোয়েস্ট অ্যাপ্রুভ/রিজেক্ট
  can_send_sms?: boolean;               // সুপার অ্যাডমিন বাল্ক এসএমএস পাঠানো
  can_manage_rates?: boolean;           // এসএমএস ও ভয়েস রেট কনফিগারেশন
  can_view_dashboard?: boolean;         // সিস্টেম অ্যানালিটিক্স ও ড্যাশবোর্ড
  can_manage_tutorials?: boolean;       // ভিডিও ও টিউটোরিয়াল ম্যানেজমেন্ট
  can_access_voice_service?: boolean;   // ভয়েস সার্ভিস ও ডিরেক্ট কল
  can_manage_managers?: boolean;        // অন্যান্য ম্যানেজার ম্যানেজ করার ক্ষমতা
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
    subscriptions?: boolean;
    meetings?: boolean;
    events?: boolean;
    accounting?: boolean;
    voice_broadcast?: boolean;
    sms?: boolean;
    dashboard?: boolean;
    organizations?: boolean;
    approvals?: boolean;
    can_manage_members?: boolean;
    can_manage_departments?: boolean;
    can_send_sms?: boolean;
    can_manage_meetings?: boolean;
    can_manage_accounting?: boolean;
    can_use_voice_call?: boolean;
    can_manage_attendance?: boolean;
    can_manage_organizations?: boolean;
    can_manage_approvals?: boolean;
    can_manage_executives?: boolean;
    can_manage_settings?: boolean;
    can_view_reports?: boolean;
    // Super Admin Manager permissions
    can_manage_committees?: boolean;
    can_approve_payments?: boolean;
    can_manage_rates?: boolean;
    can_view_dashboard?: boolean;
    can_manage_tutorials?: boolean;
    can_access_voice_service?: boolean;
    can_manage_managers?: boolean;
    allowed_departments?: string[];
  };
}

export interface Department {
  id: string;
  institution_id: string;
  name: string;
  sort_order?: number | null;
  association_type?: 'savings' | 'qard_hasan' | 'capital_share' | 'mudaraba' | 'musharaka' | 'islamic_welfare' | 'hajj_savings' | 'islamic_education' | 'cooperative_business' | null;
  management_settings?: any;
  created_at?: string;
}

export interface Member {
  id: string;
  institution_id: string;
  department_id: string;
  name: string;
  roll?: string | null;
  member_id_number: string | null;
  guardian_name?: string;
  father_name?: string;
  mother_name?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  blood_group?: string;
  occupation?: string;
  nid?: string;
  phone: string;
  email?: string;
  address?: string;
  present_address?: string;
  permanent_address?: string;
  education?: string;
  reference?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  join_date?: string;
  photo_url?: string;
  member_type?: string;
  guardian_phone_2?: string;
  created_at?: string;
  departments?: Department;
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

export interface Meeting {
  id: string;
  institution_id: string;
  department_id: string;
  title: string;
  date: string;
  is_published: boolean;
  agenda?: string;
  minutes?: string;
  created_at: string;
  departments?: Department;
}

export interface MeetingSubject {
  id: string;
  exam_id: string;
  name: string;
  subject_name?: string;
  total_marks: number;
  passing_marks: number;
  full_marks?: number;
}

export interface Attendance {
  id: string;
  institution_id: string;
  member_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  date: string;
  recorded_by: string;
  members?: Member;
}

export interface LedgerEntry {
  id: string;
  institution_id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  transaction_date: string;
  payment_method?: string;
  reference_no?: string;
  created_at: string;
}

export interface SubscriptionStructure {
  id: string;
  institution_id: string;
  department_id: string;
  subscription_name: string;
  amount: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  institution_id: string;
  member_id: string;
  department_id: string;
  amount_paid: number;
  amount_due: number;
  discount?: number;
  period: string; // YYYY-MM or YYYY
  status: 'paid' | 'unpaid' | 'partial';
  paid_at?: string;
  members?: Member;
}

export type Fee = Subscription;

export interface ExamRoom {
  id: string;
  room_name: string;
  capacity: number;
}

export interface SeatAssignment {
  student_id: string;
  name: string;
  department_name: string;
  roll: number;
  room_name: string;
  seat_number: number;
}

export interface FinalResult {
  id: string;
  institution_id: string;
  department_id: string;
  title: string;
  created_at: string;
  departments?: Department;
  exams?: FinalResultExam[];
}

export interface FinalResultExam {
  id: string;
  final_result_id: string;
  exam_id: string;
  weight: number;
  exam?: Meeting;
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

export interface ExecutivePermissions {
  can_manage_attendance?: boolean;
  can_manage_meetings?: boolean;
  can_manage_members?: boolean;
  can_manage_accounting?: boolean;
  can_manage_departments?: boolean;
  can_manage_classes?: boolean;
  can_manage_settings?: boolean;
  can_send_sms?: boolean;
  can_use_voice_call?: boolean;
  can_send_free_sms?: boolean;
  can_view_reports?: boolean;
  can_manage_executives?: boolean;
  allowed_departments?: string[];
}

export interface Executive {
  id: string;
  user_id?: string;
  institution_id: string;
  name: string;
  phone: string;
  pin?: string;
  designation?: string;
  is_active: boolean;
  permissions?: ExecutivePermissions;
  created_at: string;
}

export type View = 
  | 'home' 
  | 'departments' 
  | 'account' 
  | 'members' 
  | 'member-details' 
  | 'member-form' 
  | 'executives'
  | 'executive'
  | 'department-form' 
  | 'admin-panel' 
  | 'transactions' 
  | 'wallet-sms' 
  | 'admin-dashboard' 
  | 'admin-approvals' 
  | 'data-management' 
  | 'accounting' 
  | 'attendance'
  | 'meetings'
  | 'events'
  | 'voice-broadcast'
  | 'sms-voice-menu'
  | 'org-calendar'
  | 'academic-calendar'
  | 'minutes'
  | 'tutorials'
  | 'admin-voice-service'
  | 'admin-tutorials'
  | 'admin-managers'
  | 'polls' | 'management'
  | 'notice-board'
  | 'super-account'
  | 'member-accounting'
  | 'subscriptions';

export interface Poll {
  id: string;
  institution_id: string;
  question: string;
  options: string[];
  is_active: boolean;
  created_at: string;
  end_date?: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  member_id: string;
  option_index: number;
  created_at: string;
}

export interface Notice {
  id: string;
  institution_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_urgent?: boolean;
  created_at: string;
}

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
  selectedDepartmentId?: string;
  selectedMember?: Member;
  isEditing?: boolean;
  isMemberPortal?: boolean;
}

export interface Transaction {
  id: string;
  institution_id: string;
  amount: number;
  transaction_id: string;
  sender_phone: string;
  description: string;
  type?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  sms_count?: number;
  module?: string;
  metadata?: Record<string, any>;
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
  event_type: 'islamic' | 'committee' | 'madrasah' | 'holiday' | 'closed';
  created_at: string;
}

export interface Event {
  id: string;
  institution_id: string;
  title: string;
  description?: string;
  venue?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  organizer?: string;
  guest_name?: string;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  department_id?: string;
  image_url?: string;
  created_at: string;
}
