import { 
  Moon, Users, Zap, BookOpen, Trophy, Music, HeartHandshake, 
  Briefcase, Building2, Sprout, Sparkles, Activity, Shield,
  FileText, Calendar, Award, CheckCircle2, Heart, Scale
} from 'lucide-react';

export interface SonghoProject {
  id: string;
  title: string;
  description?: string;
  status: 'planning' | 'ongoing' | 'completed';
  startDate?: string;
  targetBudget?: number | string;
  leadPerson?: string;
}

export interface SonghoActivityConfig {
  is_active: boolean;
  coordinator_name?: string;
  coordinator_phone?: string;
  coordinator_email?: string;
  goals?: string;
  meeting_frequency?: string;
  allocated_budget?: number | string;
  fund_source?: string;
  rules_and_policies?: string;
  projects?: SonghoProject[];
  agreements_docs?: string;
  custom_notes?: string;
  last_updated?: string;
}

export interface SonghoActivityDef {
  id: string;
  labelBn: string;
  labelEn: string;
  shortDescBn: string;
  shortDescEn: string;
  icon: any;
  themeColor: string;
  gradient: string;
  bgLight: string;
  borderActive: string;
  textColor: string;
  badgeBg: string;
  defaultGoals: string[];
  suggestedInitiatives: string[];
  defaultPolicies: string;
  documentTemplates: {
    id: string;
    titleBn: string;
    titleEn: string;
    type: 'agreement' | 'pledge' | 'mou' | 'guideline';
    contentBn: string;
  }[];
}

export const SONGHO_ACTIVITIES: SonghoActivityDef[] = [
  {
    id: 'islamic',
    labelBn: 'ইসলামিক/ধর্মীয়',
    labelEn: 'Islamic & Religious',
    shortDescBn: 'দ্বীনি তালিম, ধর্মীয় অনুষ্ঠান, দাওয়াত, মাহফিল ও মসজিদ ভিত্তিক কর্মসূচি।',
    shortDescEn: 'Islamic education, seminars, da\'wah, and religious initiatives.',
    icon: Moon,
    themeColor: '#0fb5ab',
    gradient: 'from-emerald-600 to-teal-700',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderActive: 'border-emerald-500',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
    defaultGoals: [
      'সদস্যদের মাঝে দ্বীনি জ্ঞান ও তাকওয়া বৃদ্ধি করা',
      'দ্বীনি মাহফিল, কেরাত প্রতিযোগিতা ও ধর্মীয় সেমিনার আয়োজন',
      'রমাদান স্পেশাল প্রজেক্ট, ইফতার মাহফিল ও যাকাত ব্যবস্থাপনা',
      'দাওয়াহ কার্যক্রম পরিচালনা ও ইসলামী সংস্কৃতি প্রচার'
    ],
    suggestedInitiatives: [
      'মাসিক দ্বীনি তালিম ও তাফসিরুল কুরআন মাহফিল',
      'হিফযুল কুরআন ও কিরাত প্রতিযোগিতা',
      'রমাদান ফুড প্যাক ও ইফতার বিতরণ',
      'যাকাত ও ফিতরা সংগ্রহ ও সুষম বণ্টন সেল'
    ],
    defaultPolicies: `১. সকল ধর্মীয় কার্যক্রম কুরআন ও সুন্নাহর সহীহ নির্দেশনার আলোকে পরিচালিত হবে।
২. ধর্মীয় কার্যক্রমে কোনো প্রকার সাম্প্রদায়িক বিদ্বেষ বা বিভেদপূর্ণ আলোচনা পরিহার করতে হবে।
৩. ধর্মীয় আয়োজনের অনুদান ও হাদিয়া সুনির্দিষ্ট ইসলামিক তহবিল একাউন্টে জমা হবে এবং স্বচ্ছতার সাথে ব্যয়িত হবে।
৪. আলেম-ওলামাদের সাথে পরামর্শক্রমে বাৎসরিক দ্বীনি কর্মসূচি প্রণয়ন ও বাস্তবায়ন করতে হবে।`,
    documentTemplates: [
      {
        id: 'islamic-shariah-pledge',
        titleBn: 'ইসলামিক কার্যক্রম পরিচালনা অঙ্গীকারনামা',
        titleEn: 'Islamic Committee Pledge',
        type: 'pledge',
        contentBn: `আমি এই মর্মে অঙ্গীকার করছি যে, সংঘের ইসলামিক ও ধর্মীয় কার্যক্রম পরিচালনায় শরীয়তের বিধি-বিধান এবং সংঘের গঠনতন্ত্রের প্রতি শ্রদ্ধাশীল থেকে দায়িত্ব পালন করব। কোনো প্রকার মতবিরোধ এড়িয়ে সম্প্রীতি ও দাওয়াতের উদ্দেশ্য অক্ষুণ্ণ রাখব।`
      },
      {
        id: 'ramadan-zakat-mou',
        titleBn: 'রমাদান ও যাকাত তহবিল ব্যবস্থাপনা চুক্তিপত্র',
        titleEn: 'Zakat & Ramadan Fund Deed',
        type: 'agreement',
        contentBn: `এই চুক্তির মাধ্যমে সংঘের পক্ষ থেকে সংগ্রহকৃত যাকাত, ফিতরা ও দান-অনুদানের সুনির্দিষ্ট খাতভিত্তিক তালিকা তৈরি এবং প্রকৃত হকদারদের মাঝে স্বচ্ছতার সাথে বিতরণের নীতিমালা চূড়ান্ত করা হলো।`
      }
    ]
  },
  {
    id: 'social',
    labelBn: 'সামাজিক',
    labelEn: 'Social & Community',
    shortDescBn: 'সামাজিক উন্নয়ন, পরিবেশ সুরক্ষা, সামাজিক সম্প্রীতি, সচেতনতা ও মাদকবিরোধী ক্যাম্পেইন।',
    shortDescEn: 'Community development, environment, harmony, and anti-drug campaigns.',
    icon: Users,
    themeColor: '#2563EB',
    gradient: 'from-blue-600 to-indigo-700',
    bgLight: 'bg-blue-50 dark:bg-blue-950/40',
    borderActive: 'border-blue-500',
    textColor: 'text-blue-700 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300',
    defaultGoals: [
      'এলাকার সামাজিক বন্ধন সুদৃঢ় করা ও পারস্পরিক ভ্রাতৃত্ব বৃদ্ধি',
      'পরিবেশ সুরক্ষায় বৃক্ষরোপণ ও পরিচ্ছন্নতা অভিযান পরিচালনা',
      'সামাজিক অবিচার রোধ ও বিরোধ মীমাংসায় গঠনমূলক ভূমিকা রাখা',
      'যুবসমাজকে সামাজিক অবক্ষয় ও মাদকাসক্তি থেকে রক্ষা করা'
    ],
    suggestedInitiatives: [
      'বার্ষিক বৃক্ষরোপণ ও পরিচ্ছন্ন পরিবেশ অভিযান',
      'সামাজিক সচেতনতামূলক সমাবেশ ও মাদকবিরোধী র‍্যালি',
      'জরুরী দুর্যোগ ব্যবস্থাপনা ও সামাজিক সুরক্ষা তহবিল',
      'প্রবীণ ও বিশিষ্ট নাগরিকদের সম্মাননা অনুষ্ঠান'
    ],
    defaultPolicies: `১. সামাজিক কার্যক্রম রাজনৈতিক বা সংকীর্ণ স্বার্থের ঊর্ধ্বে থেকে সর্বজনীন কল্যাণে পরিচালিত হবে।
২. স্থানীয় প্রশাসন ও সুশীল সমাজের সাথে সমন্বয় করে সামাজিক উন্নয়ন প্রকল্প গ্রহণ করা হবে।
৩. সামাজিক উদ্যোগের তহবিলের সঠিক হিসাব ত্রৈমাসিক ভিত্তিতে সাধারণ সদস্যদের নিকট উপস্থাপন করতে হবে।`,
    documentTemplates: [
      {
        id: 'social-volunteer-agreement',
        titleBn: 'সামাজিক স্বেচ্ছাসেবক দায়িত্বপত্র ও চুক্তি',
        titleEn: 'Social Volunteer Agreement',
        type: 'agreement',
        contentBn: `সংঘের সামাজিক উন্নয়ন ও জনসচেতনতামূলক কার্যক্রমে নিষ্ঠার সাথে নিঃস্বার্থ সেবা প্রদানে আমি অঙ্গীকারাবদ্ধ। সংঘের সুনাম ক্ষুণ্ণ হয় এমন কোনো কাজে লিপ্ত হব না।`
      }
    ]
  },
  {
    id: 'youth',
    labelBn: 'যুব',
    labelEn: 'Youth Development',
    shortDescBn: 'যুব উন্নয়ন, নেতৃত্ব বিকাশ, আইটি ও স্কিল ট্রেনিং এবং ক্যারিয়ার গাইডেন্স।',
    shortDescEn: 'Youth empowerment, leadership training, IT skills, and career counseling.',
    icon: Zap,
    themeColor: '#F59E0B',
    gradient: 'from-amber-500 to-orange-600',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40',
    borderActive: 'border-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    defaultGoals: [
      'তরুণদের মাঝে ইতিবাচক নেতৃত্ব ও নৈতিক গুণাবলী বিকাশ',
      'কর্মমুখী স্কিল ট্রেনিং ও তথ্যপ্রযুক্তি প্রশিক্ষণ প্রদান',
      'ক্যারিয়ার কাউন্সেলিং ও উচ্চশিক্ষা গাইডলাইন সেশন আয়োজন',
      'যুবসমাজকে গঠনমূলক সমাজসেবায় উদ্বুদ্ধ করা'
    ],
    suggestedInitiatives: [
      'ফ্রি বেসিক কম্পিউটার ও ফ্রিল্যান্সিং কর্মশালা',
      'ইয়ুথ লিডারশিপ সামিট ও স্কিল ডেভেলপমেন্ট ক্যাম্প',
      'ক্যারিয়ার প্ল্যানিং ও মক ইন্টারভিউ সেশন',
      'তরুণ উদ্যোক্তা সহায়তা সেল'
    ],
    defaultPolicies: `১. যুব ফোরামের সকল কার্যক্রমে ১৮ থেকে ৩৫ বছর বয়সী তরুণ-যুবকদের অগ্রাধিকার প্রদান করা হবে।
২. প্রশিক্ষণার্থীদের উপস্থিতি ও পারফরম্যান্স মূল্যায়নের ভিত্তিতে সনদপত্র প্রদান করা হবে।
৩. কর্মশালা ও প্রশিক্ষণে আধুনিক ও আন্তর্জাতিক মান বজায় রাখা আবশ্যক।`,
    documentTemplates: [
      {
        id: 'youth-training-code',
        titleBn: 'যুব প্রশিক্ষণ ও নেতৃত্ব বিকাশ কোড অফ কন্ডাক্ট',
        titleEn: 'Youth Leadership Code of Conduct',
        type: 'guideline',
        contentBn: `প্রশিক্ষণার্থী ও ইয়ুথ উইং সদস্য হিসেবে নিয়মিত উপস্থিতি বজায় রাখা, সহকর্মীদের প্রতি শ্রদ্ধাশীল থাকা এবং অর্জিত দক্ষতাকে ইতিবাচক সমাজ গঠনে কাজে লাগানোর অঙ্গীকার।`
      }
    ]
  },
  {
    id: 'education',
    labelBn: 'শিক্ষা',
    labelEn: 'Education & Library',
    shortDescBn: 'পাঠাগার পরিচালনা, মেধাবৃত্তি, শিক্ষা উপকরণ বিতরণ, ফ্রি টিউটোরিয়াল ও নিরক্ষরতা দূরীকরণ।',
    shortDescEn: 'Library management, scholarships, student aid, and literacy projects.',
    icon: BookOpen,
    themeColor: '#8B5CF6',
    gradient: 'from-purple-600 to-violet-800',
    bgLight: 'bg-purple-50 dark:bg-purple-950/40',
    borderActive: 'border-purple-500',
    textColor: 'text-purple-700 dark:text-purple-400',
    badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300',
    defaultGoals: [
      'অসহায় ও মেধাবী শিক্ষার্থীদের আর্থিক ও শিক্ষা উপকরণ সহায়তা',
      'উন্মুক্ত পাঠাগার ও রিডিং রুম স্থাপন ও সমৃদ্ধকরণ',
      'মেধাবৃত্তি পরীক্ষা ও পুরস্কার বিতরণী অনুষ্ঠান আয়োজন',
      'ঝরে পড়া শিক্ষার্থীদের জন্য সান্ধ্যকালীন/ফ্রি কোচিং'
    ],
    suggestedInitiatives: [
      'বার্ষিক মেধাবৃত্তি ও কৃতি শিক্ষার্থী সংবর্ধনা',
      'সংঘ পাবলিক লাইব্রেরি ও বুক ব্যাংক স্থাপন',
      'দরিদ্র শিক্ষার্থীদের মাঝে বিনামূল্যে বই-খাতা বিতরণ',
      'এসএসসি/এইচএসসি পরীক্ষার্থীদের বিশেষ দিকনির্দেশনা ও মডেল টেস্ট'
    ],
    defaultPolicies: `১. মেধাবৃত্তি প্রদান সম্পূর্ণ মেধা ও আর্থিক অসচ্ছলতার স্বচ্ছ নিরপেক্ষ মূল্যায়নের ভিত্তিতে হবে।
২. লাইব্রেরির বই সংরক্ষণ ও ইস্যুর ক্ষেত্রে নির্ধারিত রেজিস্টার ও রুলস কঠোরভাবে মানতে হবে।
৩. শিক্ষামূলক কার্যক্রমে দল-মত নির্বিশেষে সকল শিক্ষার্থীর সমান সুযোগ থাকবে।`,
    documentTemplates: [
      {
        id: 'scholarship-terms',
        titleBn: 'মেধাবৃত্তি মঞ্জুরি নীতিমালা ও চুক্তিপত্র',
        titleEn: 'Scholarship Grant Agreement',
        type: 'agreement',
        contentBn: `শিক্ষার্থী যদি পরীক্ষায় নির্দিষ্ট ফলাফল ও সন্তোষজনক চরিত্র বজায় রাখে, তবে সংঘ থেকে মাসিক/এককালীন শিক্ষা অনুদান অব্যাহত থাকবে।`
      }
    ]
  },
  {
    id: 'sports',
    labelBn: 'ক্রীড়া',
    labelEn: 'Sports & Athletics',
    shortDescBn: 'খেলাধুলা, টুর্নামেন্ট আয়োজন, শারীরিক সুস্থতা ও ক্রীড়া সামগ্রী বিতরণ কর্মসূচি।',
    shortDescEn: 'Sports tournaments, fitness, athletics, and sports equipment distribution.',
    icon: Trophy,
    themeColor: '#EF4444',
    gradient: 'from-rose-600 to-red-700',
    bgLight: 'bg-rose-50 dark:bg-rose-950/40',
    borderActive: 'border-rose-500',
    textColor: 'text-rose-700 dark:text-rose-400',
    badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300',
    defaultGoals: [
      'সুস্থ দেহ ও মন গঠনে নিয়মিত ক্রীড়া চর্চা নিশ্চিত করা',
      'বার্ষিক ক্রিকেট, ফুটবল ও ব্যাডমিন্টন টুর্নামেন্ট আয়োজন',
      'তরুণদের মাদক থেকে দূরে রেখে খেলার মাঠে সম্পৃক্ত রাখা',
      'এলাকার উদীয়মান খেলোয়াড়দের প্রশিক্ষণ ও সহায়তা'
    ],
    suggestedInitiatives: [
      'সংঘ প্রিমিয়ার লীগ ক্রিকেট ও ফুটবল টুর্নামেন্ট',
      'শীতকালীন ব্যাডমিন্টন ও টেবিল টেনিস প্রতিযোগিতা',
      'বার্ষিক ক্রীড়া ও অ্যাথলেটিকস প্রতিযোগিতা',
      'স্কুল-কলেজ পর্যায়ে ক্রীড়া সামগ্রী বিতরণ'
    ],
    defaultPolicies: `১. প্রতিটি টুর্নামেন্টের বাইলজ ও নিয়মাবলী খেলার পূর্বে সকল দলের জন্য স্পষ্ট করা হবে।
২. খেলায় শৃঙ্খলা ও ফেয়ার প্লে বজায় রাখতে হবে; শৃঙ্খলাভঙ্গে দল বাতিলযোগ্য হবে।
৩. রেফারি ও ম্যাচ পরিচালকের সিদ্ধান্ত চূড়ান্ত বলে গণ্য হবে।`,
    documentTemplates: [
      {
        id: 'tournament-registration-mou',
        titleBn: 'টুর্নামেন্ট অংশগ্রহণকারী দলসমূহের চুক্তি ও নিয়মাবলী',
        titleEn: 'Tournament Team Agreement',
        type: 'agreement',
        contentBn: `অংশগ্রহণকারী দল সংঘের ক্রীড়া উপ-কমিটির প্রণীত সকল বাইলজ ও শৃঙ্খলা বিধি মেনে খেলায় অংশ নেবে।`
      }
    ]
  },
  {
    id: 'cultural',
    labelBn: 'সাংস্কৃতিক',
    labelEn: 'Cultural & Arts',
    shortDescBn: 'সাহিত্য আসর, সাংস্কৃতিক উৎসব, দেয়ালিকা প্রকাশনা ও সুস্থ সাংস্কৃতিক চর্চা।',
    shortDescEn: 'Literary circles, cultural festivals, magazines, and healthy arts promotion.',
    icon: Music,
    themeColor: '#EC4899',
    gradient: 'from-pink-600 to-rose-700',
    bgLight: 'bg-pink-50 dark:bg-pink-950/40',
    borderActive: 'border-pink-500',
    textColor: 'text-pink-700 dark:text-pink-400',
    badgeBg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/60 dark:text-pink-300',
    defaultGoals: [
      'সুস্থ ও শালীন সাংস্কৃতিক চর্চার বিস্তার ঘটানো',
      'সাহিত্য সাময়িকী, বার্ষিকী ও স্মরণিকা প্রকাশ করা',
      'কবিতা আবৃত্তি, হামদ-নাত, গজল ও ক্যালিগ্রাফি প্রতিযোগিতা আয়োজন',
      'সাংস্কৃতিক প্রতিভা অন্বেষণ ও বিকাশ'
    ],
    suggestedInitiatives: [
      'মাসিক সাহিত্য আসর ও স্বরচিত কবিতা পাঠ',
      'বার্ষিক সাংস্কৃতিক সন্ধ্যা ও সঙ্গীত/গজল উৎসব',
      'সংঘের বাৎসরিক স্মরণিকা প্রকাশনা',
      'ক্যালিগ্রাফি ও ইসলামিক আর্ট এক্সিবিশন'
    ],
    defaultPolicies: `১. সাংস্কৃতিক পরিবেশনায় সমাজের নৈতিকতা ও ধর্মীয় মূল্যবোধ সমুন্নত রাখতে হবে।
২. সাহিত্য ও প্রকাশনার মান যাচাইয়ে সম্পাদকীয় বোর্ড স্বাধীনভাবে কাজ করবে।
৩. কোন প্রকার অশালীন বা উসকানিমূলক পরিবেশনা সাংস্কৃতিক মঞ্চে অনুমোদিত নয়।`,
    documentTemplates: [
      {
        id: 'cultural-publication-deed',
        titleBn: 'সাহিত্য প্রকাশনা ও কপিরাইট অনুমতিপত্র',
        titleEn: 'Publication & Literary Deed',
        type: 'agreement',
        contentBn: `সংঘের সাহিত্য প্রকাশনায় লেখকদের প্রদত্ত লেখা প্রকাশের সম্পাদকীয় অধিকার সংরক্ষিত থাকবে।`
      }
    ]
  },
  {
    id: 'welfare',
    labelBn: 'সেবামূলক/কল্যাণ',
    labelEn: 'Welfare & Charity',
    shortDescBn: 'দরিদ্র ও অসহায়দের সহায়তা, ফ্রি মেডিকেল ক্যাম্প, রক্তদান সেল ও দুর্যোগে ত্রাণ বিতরণ।',
    shortDescEn: 'Charity aid, free medical camps, blood donation club, and disaster relief.',
    icon: HeartHandshake,
    themeColor: '#10B981',
    gradient: 'from-emerald-500 to-green-700',
    bgLight: 'bg-green-50 dark:bg-green-950/40',
    borderActive: 'border-green-500',
    textColor: 'text-green-700 dark:text-green-400',
    badgeBg: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-300',
    defaultGoals: [
      'দুস্থ, অসহায় ও সুবিধাবঞ্চিত মানুষদের মানবিক সহায়তা প্রদান',
      'ফ্রি ফ্রেন্ডস ব্লাড ডোনার্স ক্লাব ও জরুরি রক্তদান সহায়তা',
      'বিনামূল্যে স্বাস্থ্যসেবা ক্যাম্প ও ওষুধ বিতরণ',
      'শীতবস্ত্র বিতরণ ও প্রাকৃতিক দুর্যোগে জরুরি ত্রাণ সহায়তা'
    ],
    suggestedInitiatives: [
      'জরুরী রোগী সেবা ও অ্যাম্বুলেন্স সহায়তা ফান্ড',
      'ফ্রি চক্ষু ও সাধারণ চিকিৎসা ক্যাম্প',
      'শীতকালীন কম্বল ও উষ্ণ কাপড় বিতরণ প্রজেক্ট',
      'কন্যাদায়গ্রস্ত পরিবার ও বিধবা পুনর্বাসন ভাতা'
    ],
    defaultPolicies: `১. প্রতিটি সেবামূলক অনুদান শতভাগ স্বচ্ছতার সাথে সংশ্লিষ্ট সুবিধাভোগীর কাছে হস্তান্তর করা হবে।
২. সুবিধাভোগী বাছাইয়ে স্বজনপ্রীতি কঠোরভাবে নিষিদ্ধ এবং নিরপেক্ষ কমিটি যাচাই করবে।
৩. দাতা ও গ্রহীতার ডাটাবেজ যথাযথ গোপনীয়তা বজায় রেখে সংরক্ষণ করা হবে।`,
    documentTemplates: [
      {
        id: 'welfare-beneficiary-form',
        titleBn: 'কল্যাণ তহবিল সহায়তা মঞ্জুরি ও প্রাপ্তিস্বীকার পত্র',
        titleEn: 'Welfare Grant & Receipt Deed',
        type: 'agreement',
        contentBn: `সংঘের সেবামূলক তহবিল হতে চিকিৎসা/শিক্ষা/জরুরি সহায়তা বাবদ অর্থ প্রদান ও প্রাপ্তির বিবরণী।`
      }
    ]
  },
  {
    id: 'professional',
    labelBn: 'পেশাজীবী',
    labelEn: 'Professional Forum',
    shortDescBn: 'পেশাজীবীদের নেটওয়ার্কিং, অভিজ্ঞতা বিনিময়, ক্যারিয়ার উন্নয়ন ও প্রফেশনাল লিগ্যাল সাপোর্ট।',
    shortDescEn: 'Professional networking, industry mentoring, and professional legal help.',
    icon: Briefcase,
    themeColor: '#0284C7',
    gradient: 'from-cyan-600 to-blue-700',
    bgLight: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderActive: 'border-cyan-500',
    textColor: 'text-cyan-700 dark:text-cyan-400',
    badgeBg: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300',
    defaultGoals: [
      'বিভিন্ন পেশার বিশেষজ্ঞদের মধ্যে সুসম্পর্ক ও নেটওয়ার্কিং তৈরি',
      'তরুণ গ্র্যাজুয়েটদের মেন্টরশিপ ও জব প্লেসমেন্টে সহায়তা',
      'পেশাগত নীতিশাস্ত্র ও দক্ষতা উন্নয়ন সেমিনার আয়োজন',
      'পেশাগত আইনি ও কৌশলগত পরামর্শ প্রদান'
    ],
    suggestedInitiatives: [
      'বার্ষিক প্রফেশনালস মিটআপ ও নেটওয়ার্কিং ডিনার',
      'ইন্ডাস্ট্রি এক্সপার্ট লেকচার সিরিজ ও প্যানেল ডিসকাশন',
      'জব পোর্টাল ও ক্যারিয়ার লিঙ্ক সেল',
      'পেশাজীবী সম্মাননা ও অ্যাচিভমেন্ট অ্যাওয়ার্ড'
    ],
    defaultPolicies: `১. পেশাজীবী ফোরাম কোনো রাজনৈতিক দল বা গোষ্ঠীর অনুসারী হবে না; এটি পেশাগত উৎকর্ষে কাজ করবে।
২. সদস্যদের পারস্পরিক পেশাগত তথ্যের গোপনীয়তা ও সুরক্ষা রক্ষা করা হবে।`,
    documentTemplates: [
      {
        id: 'professional-network-mou',
        titleBn: 'পেশাজীবী ফোরাম সদস্যপদ ও প্রফেশনাল কোড',
        titleEn: 'Professional Code of Conduct',
        type: 'guideline',
        contentBn: `পেশাগত মর্যাদা রক্ষা, সহকর্মীদের সহায়তা ও সংঘের প্রাতিষ্ঠানিক লক্ষ্য অর্জনে অবদান রাখার অঙ্গীকার।`
      }
    ]
  },
  {
    id: 'business',
    labelBn: 'ব্যবসায়ী',
    labelEn: 'Business & Commerce',
    shortDescBn: 'ব্যবসায়িক নেটওয়ার্ক, উদ্যোক্তা সহায়তা, বিনিয়োগ তহবিল ও কো-অপারেটিভ বাণিজ্য।',
    shortDescEn: 'Trade network, entrepreneur support, investments, and cooperative commerce.',
    icon: Building2,
    themeColor: '#D97706',
    gradient: 'from-yellow-600 to-amber-700',
    bgLight: 'bg-yellow-50 dark:bg-yellow-950/40',
    borderActive: 'border-yellow-500',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    badgeBg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300',
    defaultGoals: [
      'ব্যবসায়ী সদস্যদের মাঝে পারস্পরিক ব্যবসায়িক যোগাযোগ বৃদ্ধি',
      'নতুন ও তরুণ উদ্যোক্তাদের ফান্ডিং ও ব্যবসায়িক পরামর্শ দেওয়া',
      'হালাল ও নৈতিক ব্যবসায়িক নীতিমালা প্রচার',
      'যৌথ ব্যবসায়িক উদ্যোগ ও সমবায় প্রকল্প গঠন'
    ],
    suggestedInitiatives: [
      'উদ্যোক্তা সম্মেলন ও ট্রেড এক্সপো',
      'বিজনেস ইনকিউবেশন ও স্টার্টআপ গাইডলাইন',
      'ব্যবসায়ীদের আইনি ও ভ্যাট-ট্যাক্স সহায়তা ক্লিনিক',
      'যৌথ ক্ষুদ্র বিনিয়োগ ফান্ড'
    ],
    defaultPolicies: `১. ব্যবসায়িক ফোরামে কোনো প্রকার সুদী বা অনৈতিক ব্যবসায়িক লেনদেন পরিচালনা করা যাবে না।
২. যৌথ বিনিয়োগের ক্ষেত্রে লাভ-ক্ষতির অংশীদারিত্ব চুক্তি লিখিত আকারে করতে হবে।`,
    documentTemplates: [
      {
        id: 'business-partnership-deed',
        titleBn: 'ব্যবসায়ী ফোরাম যৌথ উদ্যোগ চুক্তিপত্র',
        titleEn: 'Business Alliance Partnership Deed',
        type: 'agreement',
        contentBn: `ব্যবসায়ী সদস্যদের পারস্পরিক বাণিজ্য সহযোগিতা ও যৌথ বিনিয়োগের শর্তাবলী।`
      }
    ]
  },
  {
    id: 'agriculture',
    labelBn: 'কৃষি',
    labelEn: 'Agriculture & Farming',
    shortDescBn: 'কৃষক সহায়তা, আধুনিক কৃষি প্রযুক্তি বিস্তার, উন্নত বীজ-সার এবং কৃষি বাজার সংযোগ।',
    shortDescEn: 'Farmer assistance, agri-tech training, organic inputs, and market linkage.',
    icon: Sprout,
    themeColor: '#65A30D',
    gradient: 'from-lime-600 to-green-800',
    bgLight: 'bg-lime-50 dark:bg-lime-950/40',
    borderActive: 'border-lime-500',
    textColor: 'text-lime-700 dark:text-lime-400',
    badgeBg: 'bg-lime-100 text-lime-800 dark:bg-lime-900/60 dark:text-lime-300',
    defaultGoals: [
      'স্থানীয় কৃষকদের আধুনিক কৃষি প্রযুক্তির সাথে পরিচয় করিয়ে দেওয়া',
      'উন্নত জাতের বীজ, চারা ও জৈব সার ব্যবহারে উদ্বুদ্ধ করা',
      'ন্যায্যমূল্যে কৃষি পণ্য বিপণনে সমবায় বাজার প্রতিষ্ঠা',
      'মৎস্য চাষ, ডেইরি ও পোল্ট্রি খামারিদের প্রশিক্ষণ ও সহায়তা'
    ],
    suggestedInitiatives: [
      'কৃষক সমাবেশ ও আধুনিক কৃষি পরামর্শ সেবা',
      'ফ্রি মাটি পরীক্ষা ও জৈব সার প্রদর্শনী',
      'কৃষি যন্ত্রপাতির যৌথ সেবা কেন্দ্র',
      'ফলদ ও ঔষধি বৃক্ষ চারা বিতরণ মেলা'
    ],
    defaultPolicies: `১. কৃষি কার্যক্রমের প্রধান লক্ষ্য হবে প্রান্তিক কৃষকদের কল্যাণ ও টেকসই পরিবেশ বান্ধব চাষাবাদ।
২. ক্ষতিকর কীটনাশক বর্জন ও জৈব কৃষিকে সর্বোচ্চ গুরুত্ব দিতে হবে।`,
    documentTemplates: [
      {
        id: 'farmer-support-agreement',
        titleBn: 'কৃষি সহায়তা ও সমবায় বিক্রয় চুক্তি',
        titleEn: 'Agricultural Cooperative Deed',
        type: 'agreement',
        contentBn: `কৃষকদের উন্নত উপকরণ সরবরাহ এবং উৎপাদিত পণ্যের ন্যায্যমূল্য নিশ্চিতকরণে সমঝোতা স্মারক।`
      }
    ]
  },
  {
    id: 'others',
    labelBn: 'অন্যান্য',
    labelEn: 'Special & Other Initiatives',
    shortDescBn: 'বিশেষায়িত প্রকল্প, ট্রাস্টি উদ্যোগ, বিশেষ গবেষণা ও বহুমুখী সেবা কার্যক্রম।',
    shortDescEn: 'Specialized projects, trustee programs, research, and general initiatives.',
    icon: Sparkles,
    themeColor: '#64748B',
    gradient: 'from-slate-600 to-gray-800',
    bgLight: 'bg-slate-50 dark:bg-slate-900/60',
    borderActive: 'border-slate-400',
    textColor: 'text-slate-700 dark:text-slate-300',
    badgeBg: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    defaultGoals: [
      'সংঘের বিশেষায়িত অন্যান্য লক্ষ্য ও উদ্দেশ্য বাস্তবায়ন',
      'বিশেষ দুর্যোগ মোকাবিলায় সার্বিক সহায়তা প্রদান',
      'গবেষণা, জরিপ ও ডকুমেন্টারি প্রকাশনা',
      'বিভিন্ন উদ্ভাবনী সেবা প্রকল্পের বাস্তবায়ন'
    ],
    suggestedInitiatives: [
      'বিশেষ গবেষণা ও জরিপ প্রকল্প',
      'সংঘ আর্কাইভ ও ডিজিটাল হিস্ট্রি সংরক্ষণ',
      'কমিউনিটি রেডিও / অনলাইন মিডিয়া সেল',
      'বিশেষ জরুরি তহবিল গঠন'
    ],
    defaultPolicies: `১. বিশেষ প্রকল্পের ক্ষেত্রে কার্যনির্বাহী কমিটির পূর্বানুমোদন বাধ্যতামূলক।
২. প্রকল্পের স্বচ্ছতা ও জবাবদিহিতা নিশ্চিতকরণে স্বতন্ত্র অডিট টিম গঠন করতে হবে।`,
    documentTemplates: [
      {
        id: 'special-project-mou',
        titleBn: 'বিশেষ প্রকল্প পরিচালনা ও অর্থায়ন স্মারক',
        titleEn: 'Special Project MOU',
        type: 'mou',
        contentBn: `সংঘের বিশেষ উদ্যোগ বাস্তবায়ন, অর্থায়ন এবং তদারকির সমন্বিত নীতিমালা।`
      }
    ]
  }
];

export const getSonghoActivity = (id: string): SonghoActivityDef | undefined => {
  return SONGHO_ACTIVITIES.find(a => a.id === id);
};

export const getActiveSonghoActivities = (activeIds?: string[]): SonghoActivityDef[] => {
  if (!activeIds || activeIds.length === 0) {
    // Default to at least Islamic, Social, Youth, Welfare if not yet specified
    return SONGHO_ACTIVITIES.filter(a => ['islamic', 'social', 'youth', 'welfare'].includes(a.id));
  }
  return SONGHO_ACTIVITIES.filter(a => activeIds.includes(a.id));
};

export const getDefaultSonghoActivityIds = (): string[] => {
  return ['islamic', 'youth', 'social', 'welfare'];
};
