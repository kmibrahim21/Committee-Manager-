
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
}

export const COMMITTEE_TYPES: CommitteeTypeConfig[] = [
  {
    id: 'committee',
    labelBn: 'কমিটি',
    labelEn: 'Committee',
    icon: Users,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'association',
    labelBn: 'সমিতি',
    labelEn: 'Association',
    icon: PiggyBank,
    defaultModules: ['attendance', 'meetings', 'minutes', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices', 'qard_hasan']
  },
  {
    id: 'organization',
    labelBn: 'সংস্থা',
    labelEn: 'Organization',
    icon: Building2,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'club',
    labelBn: 'ক্লাব',
    labelEn: 'Club',
    icon: Trophy,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'foundation',
    labelBn: 'ফাউন্ডেশন',
    labelEn: 'Foundation',
    icon: Gift,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'trust',
    labelBn: 'ট্রাস্ট',
    labelEn: 'Trust',
    icon: Landmark,
    defaultModules: ['attendance', 'meetings', 'minutes', 'accounting', 'voice_broadcast', 'sms', 'notices']
  },
  {
    id: 'council',
    labelBn: 'পরিষদ',
    labelEn: 'Council',
    icon: Layers,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'sangha',
    labelBn: 'সংঘ',
    labelEn: 'Sangha',
    icon: Activity,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'forum',
    labelBn: 'ফোরাম',
    labelEn: 'Forum',
    icon: HelpCircle,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'society',
    labelBn: 'সোসাইটি',
    labelEn: 'Society',
    icon: Building2,
    defaultModules: ['attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'federation',
    labelBn: 'ফেডারেশন',
    labelEn: 'Federation',
    icon: Layers,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
  },
  {
    id: 'board',
    labelBn: 'বোর্ড',
    labelEn: 'Board',
    icon: GraduationCap,
    defaultModules: ['departments', 'attendance', 'meetings', 'minutes', 'events', 'accounting', 'voice_broadcast', 'sms', 'polls', 'notices']
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
  sms: { labelBn: 'এসএমএস', labelEn: 'SMS', icon: MessageSquare }
};
