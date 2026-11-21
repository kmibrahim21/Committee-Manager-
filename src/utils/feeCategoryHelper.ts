import { SupabaseClient } from '@supabase/supabase-js';

export type FeeCategoryFrequency = 'monthly' | 'one_time' | 'annual' | 'event' | 'custom';

export type FeeCategoryColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'slate';

export interface FeeCategory {
  id: string;
  name: string;
  frequency: FeeCategoryFrequency;
  is_default?: boolean;
  description?: string;
  color?: FeeCategoryColor;
}

export const DEFAULT_FEE_CATEGORIES: FeeCategory[] = [
  {
    id: 'monthly_subscription',
    name: 'মাসিক চাঁদা',
    frequency: 'monthly',
    is_default: true,
    description: 'প্রতি মাসে নিয়মিত আদায়যোগ্য সদস্য চাঁদা',
    color: 'blue',
  },
  {
    id: 'membership_fee',
    name: 'সদস্য ভর্তি ফি',
    frequency: 'one_time',
    is_default: true,
    description: 'নতুন সদস্য নিবন্ধন বা ভর্তির এককালীন ফি',
    color: 'emerald',
  },
  {
    id: 'annual_renewal',
    name: 'বার্ষিক নবায়ন ফি',
    frequency: 'annual',
    is_default: true,
    description: 'বছরে একবার প্রদেয় সদস্যপদ নবায়ন ফি',
    color: 'amber',
  },
  {
    id: 'event_project_fee',
    name: 'ইভেন্ট / প্রকল্প চাঁদা',
    frequency: 'event',
    is_default: true,
    description: 'বিশেষ অনুষ্ঠান, সম্মেলন বা উন্নয়ন প্রকল্পের চাঁদা',
    color: 'purple',
  },
  {
    id: 'other_fund',
    name: 'অন্যান্য ফান্ড',
    frequency: 'custom',
    is_default: true,
    description: 'কল্যাণ তহবিল বা অন্যান্য নির্ধারিত চাঁদা',
    color: 'slate',
  },
];

export const FREQUENCY_LABELS: Record<
  FeeCategoryFrequency,
  { bn: string; en: string; badgeBn: string }
> = {
  monthly: { bn: 'মাসিক', en: 'Monthly', badgeBn: 'মাসিক' },
  one_time: { bn: 'এককালীন', en: 'One Time', badgeBn: 'এককালীন' },
  annual: { bn: 'বার্ষিক', en: 'Annual', badgeBn: 'বার্ষিক' },
  event: { bn: 'ইভেন্ট / প্রকল্প', en: 'Event / Project', badgeBn: 'ইভেন্ট' },
  custom: { bn: 'কাস্টম', en: 'Custom', badgeBn: 'কাস্টম' },
};

export const MONTH_DEFINITIONS = [
  { num: '01', bn: 'জানুয়ারি', shortBn: 'জানু', en: 'January' },
  { num: '02', bn: 'ফেব্রুয়ারি', shortBn: 'ফেব্রু', en: 'February' },
  { num: '03', bn: 'মার্চ', shortBn: 'মার্চ', en: 'March' },
  { num: '04', bn: 'এপ্রিল', shortBn: 'এপ্রি', en: 'April' },
  { num: '05', bn: 'মে', shortBn: 'মে', en: 'May' },
  { num: '06', bn: 'জুন', shortBn: 'জুন', en: 'June' },
  { num: '07', bn: 'জুলাই', shortBn: 'জুলা', en: 'July' },
  { num: '08', bn: 'আগস্ট', shortBn: 'আগ', en: 'August' },
  { num: '09', bn: 'সেপ্টেম্বর', shortBn: 'সেপ্টে', en: 'September' },
  { num: '10', bn: 'অক্টোবর', shortBn: 'অক্টো', en: 'October' },
  { num: '11', bn: 'নভেম্বর', shortBn: 'নভে', en: 'November' },
  { num: '12', bn: 'ডিসেম্বর', shortBn: 'ডিসে', en: 'December' },
];

export const CATEGORY_COLOR_CLASSES: Record<
  FeeCategoryColor,
  { bg: string; text: string; border: string; dot: string; darkBg: string; darkText: string; darkBorder: string }
> = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    darkBg: 'bg-blue-500/15',
    darkText: 'text-blue-300',
    darkBorder: 'border-blue-500/30',
  },
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    darkBg: 'bg-emerald-500/15',
    darkText: 'text-emerald-300',
    darkBorder: 'border-emerald-500/30',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    darkBg: 'bg-purple-500/15',
    darkText: 'text-purple-300',
    darkBorder: 'border-purple-500/30',
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    darkBg: 'bg-amber-500/15',
    darkText: 'text-amber-300',
    darkBorder: 'border-amber-500/30',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    darkBg: 'bg-rose-500/15',
    darkText: 'text-rose-300',
    darkBorder: 'border-rose-500/30',
  },
  slate: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    darkBg: 'bg-slate-700/60',
    darkText: 'text-slate-300',
    darkBorder: 'border-slate-600',
  },
};

export const parseConfigJson = (institution: any): Record<string, any> => {
  if (!institution?.config_json) return {};
  if (typeof institution.config_json === 'string') {
    try {
      return JSON.parse(institution.config_json);
    } catch {
      return {};
    }
  }
  return institution.config_json;
};

export const convertBnToEnNumberString = (val: string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val || '')
    .split('')
    .map((ch) => {
      const idx = bnDigits.indexOf(ch);
      return idx !== -1 ? String(idx) : ch;
    })
    .join('')
    .replace(/[^0-9.]/g, '');
};

export const toBanglaDigits = (val: string | number): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => bnDigits[Number(d)]);
};

export const getLastDayOfMonth = (yearMonthStr: string): string => {
  if (!yearMonthStr || !/^\d{4}-\d{2}/.test(yearMonthStr)) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  const [yStr, mStr] = yearMonthStr.slice(0, 7).split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(y, m, 0).getDate();
  return `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
};

export const formatMonthLabel = (yearMonthOrDate: string, lang: 'bn' | 'en' = 'bn'): string => {
  if (!yearMonthOrDate) return '';
  const ym = yearMonthOrDate.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return yearMonthOrDate;
  const [year, month] = ym.split('-');
  const def = MONTH_DEFINITIONS.find((m) => m.num === month);
  if (!def) return yearMonthOrDate;
  if (lang === 'bn') {
    return `${def.bn} ${toBanglaDigits(year)}`;
  }
  return `${def.en} ${year}`;
};

export const getInstitutionFeeCategories = (institution: any): FeeCategory[] => {
  const cfg = parseConfigJson(institution);
  const saved: FeeCategory[] = Array.isArray(cfg.fee_categories) ? cfg.fee_categories : [];
  if (saved.length === 0) {
    return [...DEFAULT_FEE_CATEGORIES];
  }
  const merged = [...saved];
  DEFAULT_FEE_CATEGORIES.forEach((def) => {
    if (!merged.some((c) => c.id === def.id)) {
      merged.push(def);
    }
  });
  return merged;
};

export const saveInstitutionFeeCategories = async (
  supabase: SupabaseClient,
  institution: any,
  categories: FeeCategory[]
): Promise<FeeCategory[]> => {
  const cfg = parseConfigJson(institution);
  const updatedConfig = {
    ...cfg,
    fee_categories: categories,
  };

  const { error } = await supabase
    .from('institutions')
    .update({ config_json: updatedConfig })
    .eq('id', institution.id);

  if (error) throw error;
  institution.config_json = updatedConfig;
  return categories;
};

export const getCategoryForStructure = (
  structure: any,
  categories: FeeCategory[],
  institution?: any
): FeeCategory => {
  const cfg = parseConfigJson(institution);
  const mapping: Record<string, string> = cfg.fee_structure_categories || {};
  const mappedCategoryId = structure?.category_id || (structure?.id ? mapping[structure.id] : undefined);

  if (mappedCategoryId) {
    const exact = categories.find((c) => c.id === mappedCategoryId);
    if (exact) return exact;
  }

  const feeName = String(structure?.fee_name || '').toLowerCase().trim();
  const byName = categories.find((c) => c.name.toLowerCase().trim() === feeName);
  if (byName) return byName;

  if (feeName.includes('মাসিক') || feeName.includes('monthly')) {
    return categories.find((c) => c.frequency === 'monthly') || DEFAULT_FEE_CATEGORIES[0];
  }
  if (feeName.includes('ভর্তি') || feeName.includes('admission') || feeName.includes('সদস্য ফি')) {
    return categories.find((c) => c.frequency === 'one_time') || DEFAULT_FEE_CATEGORIES[1];
  }
  if (feeName.includes('বার্ষিক') || feeName.includes('নবায়ন') || feeName.includes('annual') || feeName.includes('yearly')) {
    return categories.find((c) => c.frequency === 'annual') || DEFAULT_FEE_CATEGORIES[2];
  }
  if (feeName.includes('ইভেন্ট') || feeName.includes('প্রকল্প') || feeName.includes('প্রজেক্ট') || feeName.includes('event') || feeName.includes('project')) {
    return categories.find((c) => c.frequency === 'event') || DEFAULT_FEE_CATEGORIES[3];
  }

  return categories.find((c) => c.id === 'other_fund') || categories[0] || DEFAULT_FEE_CATEGORIES[4];
};

export const batchSaveFeeStructureCategories = async (
  supabase: SupabaseClient,
  institution: any,
  mapping: Record<string, string>
): Promise<void> => {
  const cfg = parseConfigJson(institution);
  const existingMap: Record<string, string> = cfg.fee_structure_categories || {};
  const mergedMap = { ...existingMap, ...mapping };
  const updatedConfig = {
    ...cfg,
    fee_structure_categories: mergedMap,
  };

  const { error } = await supabase
    .from('institutions')
    .update({ config_json: updatedConfig })
    .eq('id', institution.id);

  if (error) throw error;
  institution.config_json = updatedConfig;

  // Attempt optional fee_structures.category_id sync with graceful fallback if column doesn't exist
  for (const [structureId, categoryId] of Object.entries(mapping)) {
    try {
      const { error: colErr } = await supabase
        .from('fee_structures')
        .update({ category_id: categoryId })
        .eq('id', structureId);
      if (colErr && (colErr.code === '42703' || colErr.message?.includes('column'))) {
        break;
      }
    } catch {
      break;
    }
  }
};

export const getStructureDateRange = (
  structure: any,
  institution?: any
): { start_date: string; due_date: string } => {
  const cfg = parseConfigJson(institution);
  const datesMap = cfg.fee_structure_dates || {};
  const fromConfig = structure?.id ? datesMap[structure.id] : undefined;
  return {
    start_date: structure?.start_date || fromConfig?.start_date || '',
    due_date: structure?.due_date || structure?.end_date || fromConfig?.due_date || fromConfig?.end_date || '',
  };
};

export const saveStructureDateRange = async (
  supabase: SupabaseClient,
  institution: any,
  structureId: string,
  range: { start_date?: string; due_date?: string }
): Promise<void> => {
  const cfg = parseConfigJson(institution);
  const existingDates: Record<string, { start_date?: string; due_date?: string }> = cfg.fee_structure_dates || {};

  const nextDates = { ...existingDates };
  if (!range.start_date && !range.due_date) {
    delete nextDates[structureId];
  } else {
    nextDates[structureId] = {
      start_date: range.start_date || '',
      due_date: range.due_date || '',
    };
  }

  const updatedConfig = {
    ...cfg,
    fee_structure_dates: nextDates,
  };

  const { error } = await supabase
    .from('institutions')
    .update({ config_json: updatedConfig })
    .eq('id', institution.id);

  if (error) throw error;
  institution.config_json = updatedConfig;
};
