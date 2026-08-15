
import { 
  Users, BookOpen, UserCheck, Zap, Mic, CheckCircle2, 
  Calendar, Banknote, Landmark, PiggyBank, Briefcase, 
  Gift, GraduationCap, Building2, Vote, HelpCircle,
  ClipboardList, ShieldCheck, Trophy, Layers, Activity, MessageSquare
} from 'lucide-react';

export interface CommitteeTypeConfig {
  id: string;
  labelBn: string;
  labelEn: string;
  icon: any;
  defaultModules: string[];
  specializedModules: string[];
}

export const COMMITTEE_TYPES: CommitteeTypeConfig[] = [
  {
    id: 'committee',
    labelBn: 'কমিটি',
    labelEn: 'Committee',
    icon: Users,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'results', 'polls', 'notices'],
    specializedModules: []
  },
  {
    id: 'association',
    labelBn: 'সমিতি',
    labelEn: 'Association',
    icon: PiggyBank,
    defaultModules: ['attendance', 'meetings', 'minutes', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices', 'qard_hasan'],
    specializedModules: ['savings', 'loans', 'qard_hasan', 'installments', 'profit_distribution']
  },
  {
    id: 'organization',
    labelBn: 'সংস্থা',
    labelEn: 'Organization',
    icon: Building2,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'results', 'polls', 'notices'],
    specializedModules: ['employees', 'volunteers', 'tasks', 'projects', 'payroll']
  },
  {
    id: 'club',
    labelBn: 'ক্লাব',
    labelEn: 'Club',
    icon: Trophy,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices'],
    specializedModules: ['tournaments', 'gallery', 'certificates']
  },
  {
    id: 'foundation',
    labelBn: 'ফাউন্ডেশন',
    labelEn: 'Foundation',
    icon: Gift,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices'],
    specializedModules: ['donations', 'beneficiaries', 'relief_mgmt', 'scholarships', 'projects']
  },
  {
    id: 'trust',
    labelBn: 'ট্রাস্ট',
    labelEn: 'Trust',
    icon: Landmark,
    defaultModules: ['attendance', 'meetings', 'minutes', 'accounting', 'voice_broadcast', 'sms', 'notices'],
    specializedModules: ['trustees', 'properties', 'assets', 'legal_documents']
  },
  {
    id: 'council',
    labelBn: 'পরিষদ',
    labelEn: 'Council',
    icon: Layers,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'results', 'polls', 'notices'],
    specializedModules: ['regional_mgmt', 'election']
  },
  {
    id: 'sangha',
    labelBn: 'সংঘ',
    labelEn: 'Sangha',
    icon: Activity,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices'],
    specializedModules: ['welfare_fund', 'legal_support', 'training']
  },
  {
    id: 'forum',
    labelBn: 'ফোরাম',
    labelEn: 'Forum',
    icon: HelpCircle,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices'],
    specializedModules: ['discussions']
  },
  {
    id: 'society',
    labelBn: 'সোসাইটি',
    labelEn: 'Society',
    icon: Building2,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices'],
    specializedModules: ['election']
  },
  {
    id: 'federation',
    labelBn: 'ফেডারেশন',
    labelEn: 'Federation',
    icon: Layers,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'results', 'polls', 'notices'],
    specializedModules: ['multi_org', 'branches', 'delegates', 'conferences']
  },
  {
    id: 'board',
    labelBn: 'বোর্ড',
    labelEn: 'Board',
    icon: GraduationCap,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'results', 'polls', 'notices'],
    specializedModules: ['institutions', 'board_members']
  }
];

export const getCommitteeTypeConfig = (typeId: string = 'committee'): CommitteeTypeConfig => {
  // Handle some legacy mappings
  const normalizedId = typeId === 'union' ? 'sangha' : (typeId === 'governing_board' ? 'board' : typeId);
  return COMMITTEE_TYPES.find(t => t.id === normalizedId) || COMMITTEE_TYPES[0];
};

export const MODULE_META: Record<string, { labelBn: string; labelEn: string; icon: any }> = {
  departments: { labelBn: 'বিভাগ/শাখা', labelEn: 'Departments', icon: BookOpen },
  attendance: { labelBn: 'উপস্থিতি', labelEn: 'Attendance', icon: ClipboardList },
  meetings: { labelBn: 'মিটিং ও রেজুলেশন', labelEn: 'Meetings', icon: Calendar },
  accounting: { labelBn: 'হিসাববিজ্ঞান', labelEn: 'Accounting', icon: Banknote },
  voice_broadcast: { labelBn: 'ভয়েস কল', labelEn: 'Voice Broadcast', icon: Mic },
  sms: { labelBn: 'এসএমএস', labelEn: 'SMS', icon: MessageSquare },
  savings: { labelBn: 'সঞ্চয় সমিতি', labelEn: 'Savings Management', icon: PiggyBank },
  loans: { labelBn: 'ঋণ ও ইএমআই', labelEn: 'Loan & EMI', icon: Landmark },
  qard_hasan: { labelBn: 'করজে হাসানা', labelEn: 'Qard Hasan', icon: ShieldCheck },
  installments: { labelBn: 'কিস্তি আদায়', labelEn: 'Daily Collection', icon: Landmark },
  profit_distribution: { labelBn: 'লভ্যাংশ বণ্টন', labelEn: 'Profit Share', icon: Landmark },
  employees: { labelBn: 'কর্মকর্তা তালিকা', labelEn: 'Employees', icon: Briefcase },
  volunteers: { labelBn: 'স্বেচ্ছাসেবক', labelEn: 'Volunteers', icon: Users },
  tasks: { labelBn: 'প্রকল্পের দায়িত্ব', labelEn: 'Task Assign', icon: ClipboardList },
  projects: { labelBn: 'প্রজেক্ট ট্র্যাকিং', labelEn: 'Projects', icon: ClipboardList },
  payroll: { labelBn: 'বেতন ও পে-রোল', labelEn: 'Payroll Management', icon: Briefcase },
  donations: { labelBn: 'অনুদান সংগ্রহ', labelEn: 'Donations', icon: Gift },
  beneficiaries: { labelBn: 'উপকারভোগী', labelEn: 'Beneficiaries', icon: Users },
  relief_mgmt: { labelBn: 'ত্রাণ ও চিকিৎসা', labelEn: 'Relief & Support', icon: Gift },
  tournaments: { labelBn: 'টুর্নামেন্ট ও স্পোর্টস', labelEn: 'Sports/Events', icon: Trophy },
  certificates: { labelBn: 'সার্টিফিকেট', labelEn: 'Certificates', icon: GraduationCap },
  gallery: { labelBn: 'গ্যালারি', labelEn: 'Gallery Board', icon: Building2 },
  trustees: { labelBn: 'ট্রাস্টি বোর্ড', labelEn: 'Trustees', icon: Users },
  properties: { labelBn: 'ভূমি ও মার্কেট ভাড়া', labelEn: 'Land & Rent', icon: Building2 },
  assets: { labelBn: 'সম্পদ বিবরণী', labelEn: 'Assets Book', icon: Landmark },
  legal_documents: { labelBn: 'আইনি নথি', labelEn: 'Legal Documents', icon: BookOpen },
  regional_mgmt: { labelBn: 'আঞ্চলিক শাখা', labelEn: 'Branches', icon: Building2 },
  election: { labelBn: 'নির্বাচন ও ভোট', labelEn: 'Election & Polls', icon: Vote },
  welfare_fund: { labelBn: 'কল্যাণ তহবিল', labelEn: 'Welfare Fund', icon: PiggyBank },
  legal_support: { labelBn: 'আইনি সহায়তা', labelEn: 'Legal Support', icon: ShieldCheck },
  training: { labelBn: 'প্রশিক্ষণ কোর্স', labelEn: 'Trainings', icon: GraduationCap },
  discussions: { labelBn: 'ফোরাম মতামত', labelEn: 'Discussion Forum', icon: HelpCircle },
  board_members: { labelBn: 'বোর্ড মেম্বার', labelEn: 'Board Members', icon: Users },
};
