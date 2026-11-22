
import React, { useState, useEffect } from 'react';
import { supabase, smsApi } from 'supabase';
import { Language, Department, SMSTemplate, Institution, UserRole, Profile } from 'types';
import { t } from 'translations';
import { ShortcodeService } from 'services/ShortcodeService';
import { TrendingUp, DollarSign, BarChart3, AlertCircle, Send, Loader2, CheckCircle2, MessageSquare, Smartphone, PieChart, Users, Filter, Calendar, Wallet, BookOpen, ChevronDown, Info, Phone, Mic, Volume2, Radio, PhoneCall, X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { isValidUUID } from 'utils/validation';
import { getInstitutionFeeCategories, getCategoryForStructure } from '../utils/feeCategoryHelper';
import { resolveInstitutionVoiceRate } from 'utils/smsUtils';

interface CommitteeFinancialAnalyticsProps {
  institutionId: string;
  lang: Language;
  month: string;
  refreshKey?: number;
  departments?: Department[];
  madrasah: Institution | null;
  role?: UserRole;
  profile?: Profile | null;
}

const localT = {
  allClasses: { en: 'All Departments', bn: 'সকল বিভাগ' },
  targetMonthly: { en: 'Target Monthly', bn: 'মাসিক লক্ষ্য' },
  goal100: { en: '100% Goal', bn: '১০০% লক্ষ্য' },
  progress: { en: 'Progress', bn: 'অগ্রগতি' },
  active: { en: 'Active', bn: 'সক্রিয়' },
  totalExpense: { en: 'Total Expense', bn: 'মোট খরচ' },
  monthlyOutflow: { en: 'Monthly Outflow', bn: 'মাসিক ব্যয়' },
  netIncome: { en: 'Net Income', bn: 'নিট আয়' },
  remainingBalance: { en: 'Remaining Balance', bn: 'অবশিষ্ট ব্যালেন্স' },
  feeBreakdown: { en: 'Subscription Breakdown', bn: 'চাঁদা ব্রেকডাউন' },
  students: { en: 'Members', bn: 'সদস্য' },
  paid: { en: 'Paid', bn: 'পরিশোধিত' },
  expectedCollected: { en: 'Expected / Collected', bn: 'প্রত্যাশিত / সংগৃহীত' },
  due: { en: 'Due', bn: 'বকেয়া' },
  noFeeStructures: { en: 'No subscription structures found', bn: 'কোনো সাবস্ক্রিপশন স্ট্রাকচার পাওয়া যায়নি' },
  studentsPending: { en: 'Members Pending', bn: 'সদস্যের বকেয়া রয়েছে' },
  availableShortcodes: { en: 'Available Shortcodes for Templates:', bn: 'টেমপ্লেটের জন্য উপলব্ধ শর্টকোড:' },
  useShortcodes: { en: '* Use these codes in your SMS templates in Wallet/SMS page.', bn: '* ওয়ালেট/এসএমএস পেজে আপনার এসএমএস টেমপ্লেটে এই কোডগুলো ব্যবহার করুন।' },
  default: { en: 'Default', bn: 'ডিফল্ট' },
  defaultReminder: { en: 'Default Reminder Message', bn: 'ডিফল্ট রিমাইন্ডার মেসেজ' },
  noClass: { en: 'No Department', bn: 'কোনো বিভাগ নেই' },
  allFeesCollected: { en: 'All subscriptions collected!', bn: 'সব চাঁদা সংগ্রহ করা হয়েছে!' },
  totalCollected: { en: 'Total Collected', bn: 'মোট সংগৃহীত' },
  monthly: { en: 'Monthly', bn: 'মাসিক' },
  yearly: { en: 'Yearly', bn: 'বার্ষিক' },
};

const CommitteeFinancialAnalytics: React.FC<CommitteeFinancialAnalyticsProps> = ({ institutionId, lang, month: initialMonth, refreshKey, departments = [], madrasah, role, profile }) => {
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [incomeCategorySummary, setIncomeCategorySummary] = useState<{ category: string; total: number; count: number }[]>([]);
  const [expenseCategorySummary, setExpenseCategorySummary] = useState<{ category: string; total: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SMSTemplate | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showShortcodes, setShowShortcodes] = useState(false);

  // Voice Broadcast States
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceTemplates, setVoiceTemplates] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [isVoiceSending, setIsVoiceSending] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [voiceRate, setVoiceRate] = useState<number>(() => {
    let cfg: any = madrasah?.config_json || {};
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
    }
    const r = Number(cfg?.voice_rate);
    return r > 0 ? r : 0.60;
  });
  const [voiceStatusModal, setVoiceStatusModal] = useState<{ show: boolean; type: 'success' | 'error'; title: string; message: string } | null>(null);

  const availableShortcodes = [
    { code: '{name}', label: lang === 'bn' ? 'মেম্বারের নাম' : 'Member Name' },
    { code: '{member_id}', label: lang === 'bn' ? 'মেম্বার আইডি' : 'Member ID' },
    { code: '{designation}', label: lang === 'bn' ? 'পদবী' : 'Designation' },
    { code: '{due_amount}', label: lang === 'bn' ? 'বকেয়া চাঁদা' : 'Due Amount' },
    { code: '{paid_amount}', label: lang === 'bn' ? 'পরিশোধিত চাঁদা' : 'Paid Amount' },
    { code: '{meeting_title}', label: lang === 'bn' ? 'সভার বিষয়' : 'Meeting Subject' },
    { code: '{meeting_date}', label: lang === 'bn' ? 'সভার তারিখ' : 'Meeting Date' },
    { code: '{meeting_time}', label: lang === 'bn' ? 'সভার সময়' : 'Meeting Time' },
    { code: '{meeting_location}', label: lang === 'bn' ? 'সভার স্থান' : 'Meeting Location' },
    { code: '{event_title}', label: lang === 'bn' ? 'অনুষ্ঠানের নাম' : 'Event Title' },
    { code: '{event_date}', label: lang === 'bn' ? 'অনুষ্ঠানের তারিখ' : 'Event Date' },
    { code: '{institution_name}', label: lang === 'bn' ? 'কমিটি/প্রতিষ্ঠানের নাম' : 'Committee Name' },
  ];

  // Filters
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  const [localClasses, setLocalClasses] = useState<Department[]>([]);

  useEffect(() => {
    if (departments.length > 0) {
      setLocalClasses(departments);
    } else if (isValidUUID(institutionId)) {
      supabase.from('departments')
        .select('*')
        .eq('institution_id', institutionId)
        .order('name')
        .then(({ data }) => {
          if (data) {
            let filteredClasses = data;
            if (role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0) {
              filteredClasses = data.filter(cls => profile.permissions.allowed_departments.includes(cls.id));
            }
            setLocalClasses(filteredClasses);
          }
        });
    }
  }, [institutionId, departments, role, profile]);

  useEffect(() => {
    fetchAnalytics();
    fetchTemplates();
  }, [institutionId, selectedMonth, selectedYear, selectedDate, viewMode, selectedClassId, refreshKey]);

  const fetchTemplates = async () => {
    if (!isValidUUID(institutionId)) return;
    const { data } = await supabase.from('sms_templates')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data);
  };

  const fetchAnalytics = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoading(true);
    console.log("Fetching analytics for:", { institutionId, viewMode, selectedMonth, selectedYear, selectedClassId });
    try {
      // Determine date filter for ledger
      const dateFilter = viewMode === 'daily' ? selectedDate : (viewMode === 'monthly' ? selectedMonth : selectedYear);

      // 1. Fetch Fee Structures
      let structureQuery = supabase.from('fee_structures').select('*').eq('institution_id', institutionId);
      if (selectedClassId !== 'all') {
        structureQuery = structureQuery.or(`department_id.eq.${selectedClassId},department_id.is.null`);
      }
      const { data: structures, error: structError } = await structureQuery;
      console.log("Structures:", structures, "Error:", structError);
      if (!structures) return;

      // 2. Fetch Students for counts and class mapping
      let studentQuery = supabase.from('members').select('name, department_id').eq('institution_id', institutionId);
      if (selectedClassId !== 'all') {
        studentQuery = studentQuery.eq('department_id', selectedClassId);
      }
      const { data: students, error: studError } = await studentQuery;
      console.log("Students:", students, "Error:", studError);
      
      const studentCounts: Record<string, number> = {};
      const studentClassMap: Record<string, string> = {};
      
      students?.forEach(s => {
        studentCounts[s.department_id] = (studentCounts[s.department_id] || 0) + 1;
        studentClassMap[s.name] = s.department_id;
      });

      // 3. Fetch Ledger for transaction counts (Income) AND Expenses
      let ledgerQuery = supabase.from('ledger')
        .select('description, amount, type, category, transaction_date')
        .eq('institution_id', institutionId);

      const config: any = madrasah?.config_json || {};
      if (config.accounting_start_date) {
        ledgerQuery = ledgerQuery.gte('transaction_date', config.accounting_start_date);
      }
      if (config.accounting_end_date) {
        ledgerQuery = ledgerQuery.lte('transaction_date', config.accounting_end_date);
      }

      const { data: ledger, error: ledgerError } = await ledgerQuery;
      console.log("Ledger:", ledger, "Error:", ledgerError);

      // 4. Process Data
      const breakdownMap: Record<string, { expected: number, collected: number, students: number, transactions: number }> = {};
      let totalExpected = 0;
      let totalCollected = 0;
      let totalExpense = 0;
      let totalOverallIncome = 0;

      // Calculate Expenses and Overall Income (+ Category Summaries)
      const incCatMap: Record<string, { total: number; count: number }> = {};
      const expCatMap: Record<string, { total: number; count: number }> = {};

      ledger?.forEach(l => {
        if (!(l.transaction_date || '').startsWith(dateFilter)) return;
        const catName = (l.category || (lang === 'bn' ? 'অন্যান্য' : 'Other')).trim();
        const amt = Number(l.amount || 0);
        if (l.type === 'expense') {
          totalExpense += amt;
          if (!expCatMap[catName]) expCatMap[catName] = { total: 0, count: 0 };
          expCatMap[catName].total += amt;
          expCatMap[catName].count += 1;
        }
        if (l.type === 'income') {
          totalOverallIncome += amt;
          if (!incCatMap[catName]) incCatMap[catName] = { total: 0, count: 0 };
          incCatMap[catName].total += amt;
          incCatMap[catName].count += 1;
        }
      });

      setIncomeCategorySummary(
        Object.entries(incCatMap)
          .map(([category, v]) => ({ category, total: v.total, count: v.count }))
          .sort((a, b) => b.total - a.total)
      );
      setExpenseCategorySummary(
        Object.entries(expCatMap)
          .map(([category, v]) => ({ category, total: v.total, count: v.count }))
          .sort((a, b) => b.total - a.total)
      );

      const institutionCategories = getInstitutionFeeCategories(madrasah);

      structures.forEach(s => {
        // Daily view doesn't have fixed target monthly/yearly subscription goals
        if (viewMode === 'daily') return;

        // If department_id is null, it's a global fee and applies to all students
        const count = s.department_id === null 
            ? (students?.length || 0) 
            : (studentCounts[s.department_id] || 0);
            
        // Multiply by 12 in yearly view ONLY for monthly categories
        const catObj = getCategoryForStructure(s, institutionCategories, madrasah);
        const multiplier = viewMode === 'yearly'
          ? (catObj.frequency === 'monthly' ? 12 : 1)
          : 1;
        const total = count * Number(s.amount || 0) * multiplier;
        
        const feeName = s.fee_name.trim();
        if (!breakdownMap[feeName]) {
          breakdownMap[feeName] = { expected: 0, collected: 0, students: 0, transactions: 0 };
        }
        breakdownMap[feeName].expected += total;
        breakdownMap[feeName].students += count;
        totalExpected += total;
      });
      console.log("Total Expected calculated:", totalExpected);

        // Count transactions and calculate collected amount (Income)
      ledger?.forEach(l => {
        if (l.type !== 'income' || l.category !== 'Member Fee') return;

        // Ensure it's for the selected month/year
        // Robust check: either transaction date matches or description contains month
        const isCorrectPeriod = l.transaction_date.startsWith(dateFilter) || l.description.includes(dateFilter);
        if (!isCorrectPeriod) return;

        const parts = l.description.split(' - ');
        if (parts.length < 2) return;

        const feePart = parts[0];
        const studentInfo = parts.slice(1).join(' - ');
        const studentName = studentInfo.split(' (')[0].trim();
        
        // Extract class name from description if possible
        const match = studentInfo.match(/\((.*?)\s*\|/);
        const classNameFromDesc = match ? match[1].trim() : null;
        
        let classId = studentClassMap[studentName];
        if (!classId && classNameFromDesc && localClasses.length > 0) {
            classId = localClasses.find(c => c.name.trim() === classNameFromDesc)?.id;
        }

        // If filtering by class, ensure student belongs to selected class
        if (selectedClassId !== 'all' && classId !== selectedClassId) return;

        const fees = feePart.split(',').map(f => f.trim());
        let totalStructureAmount = 0;
        const matchedStructures: any[] = [];
        
        fees.forEach(f => {
            const normalizedF = f.toLowerCase().trim();
            // Find structure for this fee name and class
            // Match either the student's class or a global fee (department_id is null)
            const structure = structures.find(s => 
                s.fee_name.toLowerCase().trim() === normalizedF && 
                (s.department_id === null || (classId && s.department_id === classId))
            );
            
            if (structure) {
                totalStructureAmount += structure.amount;
                matchedStructures.push(structure);
            } else {
                // Try matching by name only if class match fails
                const nameOnlyMatch = structures.find(s => s.fee_name.toLowerCase().trim() === normalizedF);
                if (nameOnlyMatch) {
                    totalStructureAmount += nameOnlyMatch.amount;
                    matchedStructures.push(nameOnlyMatch);
                }
            }
        });
        
        if (matchedStructures.length > 0) {
            matchedStructures.forEach(structure => {
                const feeName = structure.fee_name.trim();
                if (breakdownMap[feeName]) {
                    breakdownMap[feeName].transactions += 1;
                    // Allocate actual collected amount proportionally
                    const ratio = totalStructureAmount > 0 ? (structure.amount / totalStructureAmount) : (1 / matchedStructures.length);
                    const allocatedAmount = l.amount * ratio;
                    breakdownMap[feeName].collected += allocatedAmount;
                }
            });
            totalCollected += l.amount;
        } else {
            // Fallback if no structures matched
            fees.forEach(f => {
                const normalizedF = f.toLowerCase().trim();
                // Find any breakdown item that matches the name
                const breakdownKey = Object.keys(breakdownMap).find(k => k.toLowerCase().trim() === normalizedF);
                if (breakdownKey) {
                    breakdownMap[breakdownKey].transactions += 1;
                    breakdownMap[breakdownKey].collected += l.amount / fees.length;
                }
            });
            totalCollected += l.amount;
        }
      });
      console.log("Total Collected calculated:", totalCollected);

      const breakdownList = Object.entries(breakdownMap).map(([name, data]) => ({ name, ...data }));
      setBreakdown(breakdownList);

      // Set Stats
      setStats({
        expected_income: totalExpected,
        prediction: viewMode === 'daily' ? totalOverallIncome : totalOverallIncome, // represents overall actual income
        total_expense: totalExpense,
        net_income: totalOverallIncome - totalExpense,
        collection_rate: totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0,
        fee_collected: totalCollected
      });

      // Fetch reminders for monthly view (current dues) directly from members, fee_structures, fees, and subscriptions
      if (viewMode === 'monthly') {
        let memQuery = supabase
          .from('members')
          .select('id, name, phone, roll, member_id_number, department_id, departments(id, name)')
          .eq('institution_id', institutionId);
        
        if (selectedClassId !== 'all') {
          memQuery = memQuery.eq('department_id', selectedClassId);
        }

        const { data: memList } = await memQuery;

        const { data: feesData } = await supabase
          .from('fees')
          .select('member_id, amount_paid, discount, month')
          .eq('institution_id', institutionId)
          .eq('month', selectedMonth);

        const { data: subsData } = await supabase
          .from('subscriptions')
          .select('member_id, amount_paid, discount, period')
          .eq('institution_id', institutionId)
          .eq('period', selectedMonth);

        const membersWithDues = (memList || []).map((m: any) => {
          const studentFeeStructures = (structures || []).filter((fs: any) => 
            fs.department_id === m.department_id || fs.department_id === null
          );
          const totalPayable = studentFeeStructures.reduce((sum: number, fs: any) => sum + Number(fs.amount || 0), 0);

          const paidInFees = (feesData || [])
            .filter((f: any) => f.member_id === m.id)
            .reduce((sum: number, f: any) => sum + Number(f.amount_paid || 0) + Number(f.discount || 0), 0);
          
          const paidInSubs = (subsData || [])
            .filter((s: any) => s.member_id === m.id)
            .reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0) + Number(s.discount || 0), 0);

          const totalPaid = Math.max(paidInFees, paidInSubs);
          const balanceDue = Math.max(0, totalPayable - totalPaid);
          const deptName = m.departments?.name || (Array.isArray(m.departments) ? m.departments[0]?.name : '') || '';

          return {
            id: m.id,
            student_id: m.id,
            name: m.name,
            member_code: m.member_id_number || m.roll || '-',
            phone: m.phone || '',
            department_id: m.department_id,
            department_name: deptName,
            balance_due: balanceDue,
            reminder_type: balanceDue > 1000 ? 'final' : balanceDue > 500 ? 'strong' : 'soft'
          };
        }).filter((m: any) => m.balance_due > 0);

        setReminders(membersWithDues);
      } else {
        setReminders([]);
      }

    } catch (err) {
      console.error('Smart Fee Analytics Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendBulkReminder = async (type: 'native' | 'system') => {
    if (reminders.length === 0) return;
    
    if (type === 'native') {
      const phones = reminders.map(r => r.phone).join(',');
      let body = selectedTemplate 
        ? selectedTemplate.body 
        : `আস-সালামু আলাইকুম, {name} এর {month} মাসের বকেয়া ফি ৳{due_amount} দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো।`;
      
      // Simple variable replacement if using template
      if (selectedTemplate) {
        body = body.replace(/\[month\]/g, '{month}')
                   .replace(/\[amount\]/g, '{due_amount}')
                   .replace(/\[name\]/g, '{name}');
      }

      // For native SMS, we can only send one message to all, so we use the first student's data as a preview
      // But actually native SMS doesn't support shortcodes per recipient.
      // So we'll just use the first student's data for the native SMS body.
      const firstData = {
        name: reminders[0].name,
        month: selectedMonth,
        due_amount: Math.max(0, Number(reminders[0].balance_due))
      };
      const finalBody = ShortcodeService.replaceShortcodes(body, firstData);

      window.location.href = `sms:${phones}?body=${encodeURIComponent(finalBody)}`;
    } else {
      setSending(true);
      try {
        // Map reminders to Member-like objects for SMSService
        const pseudoStudents = reminders.map(r => ({
          id: r.student_id,
          name: r.name,
          phone: r.phone,
          institution_id: institutionId
        })) as any[];

        let body = selectedTemplate 
          ? selectedTemplate.body 
          : `আস-সালামু আলাইকুম, {name} এর {month} মাসের বকেয়া ফি ৳{due_amount} দ্রুত পরিশোধ করার জন্য অনুরোধ করা হলো।`;

        // If using old style templates, convert them
        if (selectedTemplate) {
          body = body.replace(/\[month\]/g, '{month}')
                     .replace(/\[amount\]/g, '{due_amount}')
                     .replace(/\[name\]/g, '{name}');
        }

        await smsApi.sendBulk(institutionId, pseudoStudents, body);
        setVoiceStatusModal({
          show: true,
          type: 'success',
          title: lang === 'bn' ? 'সফল হয়েছে' : 'Success',
          message: lang === 'bn' ? 'রিমাইন্ডার সফলভাবে পাঠানো হয়েছে' : 'Reminders sent successfully'
        });
      } catch (err: any) {
        setVoiceStatusModal({
          show: true,
          type: 'error',
          title: lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Failed',
          message: err.message || 'Failed to send SMS'
        });
      } finally {
        setSending(false);
      }
    }
  };

  const handleOpenVoiceModal = async () => {
    if (reminders.length === 0) {
      setVoiceStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'বকেয়া তালিকা খালি' : 'Empty List',
        message: lang === 'bn' ? 'বকেয়া তালিকা খালি, কোনো সদস্য পাওয়া যায়নি' : 'Due reminder list is empty'
      });
      return;
    }

    setShowVoiceModal(true);
    setLoadingVoices(true);
    try {
      // 1. Fetch institution balance & global/custom voice rate
      const [{ data: instData }, globalRates] = await Promise.all([
        supabase
          .from('institutions')
          .select('balance, config_json')
          .eq('id', institutionId)
          .single(),
        smsApi.getGlobalSettings().catch(() => null)
      ]);

      setVoiceRate(resolveInstitutionVoiceRate(instData || madrasah, globalRates));

      if (instData) {
        setWalletBalance(Number(instData.balance) || 0);
      }

      // 2. Fetch local voice templates
      const { data: localVoices } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false });

      setVoiceTemplates(localVoices || []);
      if (localVoices && localVoices.length > 0) {
        setSelectedVoiceId(localVoices[0].id);
      }
    } catch (err) {
      console.error('Failed to load voice templates:', err);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleSendVoiceBroadcast = async () => {
    if (!selectedVoiceId) {
      setVoiceStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ভয়েস নির্বাচন করুন' : 'Select Voice Template',
        message: lang === 'bn' ? 'অনুগ্রহ করে একটি অনুমোদিত ভয়েস টেমপ্লেট নির্বাচন করুন।' : 'Please select an approved voice template.'
      });
      return;
    }

    const validPhones = reminders
      .map(r => r.phone?.toString().trim().replace(/[^0-9]/g, ''))
      .filter(p => p && p.length >= 10);

    if (validPhones.length === 0) {
      setVoiceStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ফোন নম্বর নেই' : 'No Phone Numbers',
        message: lang === 'bn' ? 'বকেয়া তালিকার সদস্যদের কোনো বৈধ ফোন নম্বর পাওয়া যায়নি।' : 'No valid phone numbers found for pending members.'
      });
      return;
    }

    const estimatedCost = validPhones.length * voiceRate;
    if (walletBalance < estimatedCost) {
      setVoiceStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'অপর্যাপ্ত ব্যালেন্স' : 'Insufficient Balance',
        message: lang === 'bn' 
          ? `ভয়েস কল পাঠানোর জন্য ৳${estimatedCost.toFixed(2)} প্রয়োজন, কিন্তু আপনার বর্তমান ব্যালেন্স ৳${walletBalance.toFixed(2)}। অনুগ্রহ করে ওয়ালেট রিচার্জ করুন।` 
          : `Required balance ৳${estimatedCost.toFixed(2)}, current balance is ৳${walletBalance.toFixed(2)}. Please recharge wallet.`
      });
      return;
    }

    const selectedVoice = voiceTemplates.find(v => v.id === selectedVoiceId);
    if (!selectedVoice) return;

    setIsVoiceSending(true);
    try {
      const voiceName = selectedVoice.provider_voice_name || selectedVoice.title;
      const sNumber = selectedVoice.sender_number || selectedVoice.sender || 'default';
      const requestId = `cm_due_${institutionId.slice(0, 6)}_${Date.now()}`;

      const payload = {
        request_id: requestId,
        voice: voiceName,
        sender: sNumber,
        phone_numbers: validPhones,
        retry: 1,
        retry_count: 1,
        retries: 1
      };

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/awaj/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errMessage = 'Failed to send voice broadcast via Awaj API';
        try {
          const errData = await response.json();
          errMessage = errData.error || errData.message || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || requestId;

      // Deduct balance once Awaj broadcast succeeds (do not block on voice_broadcasts log failure)
      const newBalance = Math.max(0, walletBalance - estimatedCost);
      const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', institutionId);
      if (balanceError) throw balanceError;
      setWalletBalance(newBalance);

      // Save to Supabase safely
      await smsApi.recordVoiceBroadcast(institutionId, {
        voiceTemplateId: selectedVoiceId,
        targetType: 'due_reminders',
        totalNumbers: validPhones.length,
        estimatedCost,
        providerCampaignId: campaignId,
        status: 'sending'
      });

      setVoiceStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'ভয়েস কল সফল' : 'Voice Broadcast Initiated',
        message: lang === 'bn' 
          ? `${validPhones.length} জন বকেয়াদার সদস্যের কাছে ভয়েস কল ব্রডকাস্ট শুরু হয়েছে!` 
          : `Voice call broadcast initiated for ${validPhones.length} members with dues!`
      });

      setShowVoiceModal(false);
    } catch (err: any) {
      console.error('Voice broadcast error:', err);
      setVoiceStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Broadcast Failed',
        message: err.message || 'Failed to send voice broadcast'
      });
    } finally {
      setIsVoiceSending(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="animate-spin text-[#2563EB]" size={32} />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Filters */}
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-center justify-between`}>
        <div className="flex items-center gap-2">
            <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'} p-1 rounded-xl flex`}>
                <button 
                    onClick={() => setViewMode('daily')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'daily' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-[#42f5e9]' : 'bg-white shadow-sm text-[#0fb5ab]') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {lang === 'bn' ? 'দৈনিক' : 'Daily'}
                </button>
                <button 
                    onClick={() => setViewMode('monthly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'monthly' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-[#42f5e9]' : 'bg-white shadow-sm text-[#0fb5ab]') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {localT.monthly[lang]}
                </button>
                <button 
                    onClick={() => setViewMode('yearly')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'yearly' ? (madrasah?.theme === 'dark' ? 'bg-slate-800 shadow-sm text-[#42f5e9]' : 'bg-white shadow-sm text-[#0fb5ab]') : 'text-slate-500 hover:text-slate-700'}`}
                >
                    {localT.yearly[lang]}
                </button>
            </div>
            
            {viewMode === 'daily' ? (
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#42f5e9]/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                />
            ) : viewMode === 'monthly' ? (
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#42f5e9]/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                />
            ) : (
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#42f5e9]/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            )}
        </div>

        <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className={`px-4 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#42f5e9]/20 min-w-[150px] ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
            >
                <option value="all">{localT.allClasses[lang]}</option>
                {localClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
        </div>
      </div>

      {/* Stats Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Expected Income */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/10 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
              <DollarSign size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('expected_income', lang)}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>৳ {stats?.expected_income?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span>{localT.targetMonthly[lang]}</span>
            <span className="text-[#0fb5ab]">{localT.goal100[lang]}</span>
          </div>
        </div>

        {/* Predicted Collection */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
              <TrendingUp size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewMode === 'yearly' ? localT.totalCollected[lang] : t('predicted_total', lang)}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-[#0fb5ab]'}`}>৳ {stats?.prediction?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
              <span>{localT.progress[lang]}</span>
              <span>{Math.round((stats?.prediction / stats?.expected_income) * 100) || 0}%</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000" 
                style={{ width: `${Math.min(100, (stats?.prediction / stats?.expected_income) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Collection Rate */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
              <BarChart3 size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('collection_rate_label', lang)}</p>
              <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-indigo-400' : 'text-[#0fb5ab]'}`}>{stats?.collection_rate}%</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <div className="h-full bg-indigo-500" style={{ width: `${stats?.collection_rate}%` }} />
            </div>
            <span className="text-[9px] font-black text-indigo-500 uppercase">{localT.active[lang]}</span>
          </div>
        </div>

        {/* Total Expense */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500'}`}>
              <TrendingUp size={24} className="rotate-180" />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{localT.totalExpense[lang]}</p>
              <h3 className="text-xl font-black text-red-500">৳ {stats?.total_expense?.toLocaleString('bn-BD')}</h3>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{localT.monthlyOutflow[lang]}</p>
        </div>

        {/* Net Income */}
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-3xl border shadow-bubble hover:shadow-md transition-all group`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${stats?.net_income >= 0 ? (madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-500') : (madrasah?.theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500')}`}>
              <Wallet size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{localT.netIncome[lang]}</p>
              <h3 className={`text-xl font-black ${stats?.net_income >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                ৳ {stats?.net_income?.toLocaleString('bn-BD')}
              </h3>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{localT.remainingBalance[lang]}</p>
        </div>
      </div>

      {/* Fee Breakdown Section */}
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-6 rounded-[2rem] border shadow-bubble space-y-4`}>
        <div className="flex items-center gap-3 mb-2">
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-500'}`}>
              <PieChart size={20} />
           </div>
           <h3 className={`text-lg font-black font-noto ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#0fb5ab]'}`}>{localT.feeBreakdown[lang]} ({viewMode === 'monthly' ? selectedMonth : selectedYear})</h3>
        </div>
        
        <div className="space-y-3">
           {breakdown.length > 0 ? breakdown.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                 <div>
                    <h4 className={`font-black text-sm ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-[#0fb5ab]'}`}>{item.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                       <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Users size={10}/> {item.students} {localT.students[lang]}</span>
                       <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> {item.transactions} {localT.paid[lang]}</span>
                    </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">{localT.expectedCollected[lang]}</p>
                    <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-[#0fb5ab]'}`}>৳{item.expected.toLocaleString()} / <span className="text-emerald-500">৳{item.collected.toLocaleString()}</span></p>
                    <p className="text-[10px] font-bold text-red-400 mt-1">{localT.due[lang]}: ৳{Math.max(0, item.expected - item.collected).toLocaleString()}</p>
                 </div>
              </div>
           )) : (
              <div className="text-center py-8 text-slate-400 text-xs font-bold">{localT.noFeeStructures[lang]}</div>
           )}
        </div>
      </div>

      {/* Income & Expense Category Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-6 rounded-[2rem] border shadow-bubble space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                <ArrowUpCircle size={20} />
              </div>
              <div>
                <h3 className={`text-base font-black font-noto ${madrasah?.theme === 'dark' ? 'text-slate-100' : 'text-[#0fb5ab]'}`}>
                  {lang === 'bn' ? 'আয়ের খাতসমূহ' : 'Income by Category'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {viewMode === 'daily' ? selectedDate : viewMode === 'monthly' ? selectedMonth : selectedYear}
                </p>
              </div>
            </div>
            <span className="text-sm font-black text-emerald-500">
              ৳{incomeCategorySummary.reduce((s, c) => s + c.total, 0).toLocaleString()}
            </span>
          </div>

          <div className="space-y-2.5">
            {incomeCategorySummary.length > 0 ? (
              incomeCategorySummary.map((item) => {
                const grandTotal = incomeCategorySummary.reduce((s, c) => s + c.total, 0) || 1;
                const pct = Math.round((item.total / grandTotal) * 100);
                return (
                  <div key={item.category} className={`p-3.5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between text-xs font-black mb-1.5">
                      <span className={`font-noto truncate ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                        {item.category} <span className="text-[10px] font-bold text-slate-400">({item.count})</span>
                      </span>
                      <span className="text-emerald-500 shrink-0">৳{item.total.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/70'}`}>
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs font-bold">
                {lang === 'bn' ? 'এই সময়সীমায় কোনো আয় নেই' : 'No income recorded in this period'}
              </div>
            )}
          </div>
        </div>

        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-6 rounded-[2rem] border shadow-bubble space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500'}`}>
                <ArrowDownCircle size={20} />
              </div>
              <div>
                <h3 className={`text-base font-black font-noto ${madrasah?.theme === 'dark' ? 'text-slate-100' : 'text-red-500'}`}>
                  {lang === 'bn' ? 'ব্যয়ের খাতসমূহ' : 'Expense by Category'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {viewMode === 'daily' ? selectedDate : viewMode === 'monthly' ? selectedMonth : selectedYear}
                </p>
              </div>
            </div>
            <span className="text-sm font-black text-red-500">
              ৳{expenseCategorySummary.reduce((s, c) => s + c.total, 0).toLocaleString()}
            </span>
          </div>

          <div className="space-y-2.5">
            {expenseCategorySummary.length > 0 ? (
              expenseCategorySummary.map((item) => {
                const grandTotal = expenseCategorySummary.reduce((s, c) => s + c.total, 0) || 1;
                const pct = Math.round((item.total / grandTotal) * 100);
                return (
                  <div key={item.category} className={`p-3.5 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between text-xs font-black mb-1.5">
                      <span className={`font-noto truncate ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                        {item.category} <span className="text-[10px] font-bold text-slate-400">({item.count})</span>
                      </span>
                      <span className="text-red-500 shrink-0">৳{item.total.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/70'}`}>
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs font-bold">
                {lang === 'bn' ? 'এই সময়সীমায় কোনো ব্যয় নেই' : 'No expense recorded in this period'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reminders Section - Only show for Monthly View */}
      {viewMode === 'monthly' && (
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-100 text-[#1E293B]'} p-8 rounded-[2.5rem] shadow-bubble border space-y-6`}>
            <div className="flex items-center justify-between">
            <div>
                <h3 className="text-xl font-black font-noto">{t('reminders', lang)}</h3>
                <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">{reminders.length} {localT.studentsPending[lang]}</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/10 text-[#42f5e9] border-[#42f5e9]/20' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/10'}`}>
                <AlertCircle size={24} />
            </div>
            </div>

            {/* Template Selection */}
            <div className="relative">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {t('template_title', lang)}
                </label>
                <button 
                  onClick={() => setShowShortcodes(!showShortcodes)}
                  className="text-[10px] font-black text-[#8D30F4] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-all"
                >
                  <Info size={12} /> Shortcodes
                </button>
              </div>

              {showShortcodes && (
                <div className={`${madrasah?.theme === 'dark' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50/50 border-purple-100/50'} p-3 rounded-2xl border mb-3 animate-in slide-in-from-top-2`}>
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2">{localT.availableShortcodes[lang]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableShortcodes.map(sc => (
                      <div
                        key={sc.code}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-purple-300' : 'bg-white border-purple-100 text-[#2E0B5E]'}`}
                      >
                        {sc.code} <span className="text-slate-400 font-normal">({sc.label})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 mt-2 italic">
                    {localT.useShortcodes[lang]}
                  </p>
                </div>
              )}

              <button 
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} 
                className={`w-full flex items-center justify-between px-5 py-3.5 border rounded-xl text-sm font-bold shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-[#8D30F4]" />
                  <span className="truncate">{selectedTemplate ? selectedTemplate.title : t('template_title', lang)}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-all ${showTemplateDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showTemplateDropdown && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-xl border z-[510] max-h-48 overflow-y-auto p-1 animate-in slide-in-from-top-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  <button 
                    onClick={() => { setSelectedTemplate(null); setShowTemplateDropdown(false); }}
                    className={`w-full text-left px-4 py-3 border-b last:border-0 rounded-lg ${madrasah?.theme === 'dark' ? 'border-slate-700 hover:bg-slate-900' : 'border-slate-50 hover:bg-slate-50'}`}
                  >
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">{localT.default[lang]}</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{localT.defaultReminder[lang]}</p>
                  </button>
                  {templates.map(tmp => (
                    <button 
                      key={tmp.id} 
                      onClick={() => { setSelectedTemplate(tmp); setShowTemplateDropdown(false); }} 
                      className={`w-full text-left px-4 py-3 border-b last:border-0 rounded-lg ${madrasah?.theme === 'dark' ? 'border-slate-700 hover:bg-slate-900' : 'border-slate-50 hover:bg-slate-50'}`}
                    >
                      <p className="text-[8px] font-black text-[#8D30F4] uppercase mb-0.5">{tmp.title}</p>
                      <p className="text-xs font-bold text-slate-500 truncate">{tmp.body}</p>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase">
                      {t('no_templates', lang)}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {lang === 'bn' ? 'কমিটি নির্বাচন' : 'Select Committee'}
                    </label>
                    <select 
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className={`w-full h-11 px-4 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    >
                        <option value="all">{localT.allClasses[lang]}</option>
                        {localClasses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        {lang === 'bn' ? 'মাস নির্বাচন' : 'Select Month'}
                    </label>
                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className={`w-full h-11 px-4 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button 
                onClick={() => sendBulkReminder('system')}
                disabled={sending || isVoiceSending}
                className="h-14 bg-[#2563EB] text-white rounded-2xl font-black text-[10px] uppercase shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
                {sending ? <Loader2 className="animate-spin" size={16} /> : <MessageSquare size={16} fill="currentColor" />} {t('system_sms', lang)}
            </button>
            <button 
                onClick={handleOpenVoiceModal}
                disabled={sending || isVoiceSending}
                className={`h-14 rounded-2xl font-black text-[10px] uppercase border flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 ${madrasah?.theme === 'dark' ? 'bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30' : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100/80'}`}
            >
                <PhoneCall size={16} /> {lang === 'bn' ? 'ভয়েস কল ব্রডকাস্ট' : 'Voice Broadcast'}
            </button>
            <button 
                onClick={() => sendBulkReminder('native')}
                disabled={sending || isVoiceSending}
                className={`h-14 rounded-2xl font-black text-[10px] uppercase border flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 col-span-2 sm:col-span-1 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
            >
                <Smartphone size={16} fill="currentColor" /> {t('native_sms', lang)}
            </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {reminders.map((r, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 group transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-sm'}`}>
                <div className="min-w-0 flex-1">
                    <h4 className={`font-black text-sm font-noto truncate ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>{r.name}</h4>
                    <p className="text-[9px] font-bold opacity-70 uppercase tracking-tight truncate">
                      {r.department_name || localT.noClass[lang]} • <span className="text-red-500 font-black">{localT.due[lang]}: ৳{Math.max(0, Number(r.balance_due)).toLocaleString()}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.phone && (
                    <a 
                      href={`tel:${r.phone}`}
                      className={`p-2 rounded-xl border transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-[#0fb5ab]'}`}
                      title={lang === 'bn' ? 'সরাসরি কল' : 'Direct Call'}
                    >
                      <Phone size={13} />
                    </a>
                  )}
                  <span className={`px-2.5 py-1 rounded-xl text-[8px] font-black uppercase shrink-0 ${
                      r.reminder_type === 'final' ? 'bg-red-500 text-white' : r.reminder_type === 'strong' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                  }`}>
                      {r.reminder_type === 'final' ? t('final_warning', lang) : r.reminder_type === 'strong' ? t('strong_reminder', lang) : t('soft_reminder', lang)}
                  </span>
                </div>
                </div>
            ))}
            {reminders.length === 0 && (
                <div className="col-span-full text-center py-10 opacity-40">
                <CheckCircle2 size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">{localT.allFeesCollected[lang]}</p>
                </div>
            )}
            </div>
        </div>
      )}

      {/* Voice Broadcast Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className={`w-full max-w-lg rounded-[2.5rem] border shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center">
                  <PhoneCall size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black font-noto">
                    {lang === 'bn' ? 'বকেয়া আদায়ের ভয়েস কল ব্রডকাস্ট' : 'Due Reminder Voice Broadcast'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    {lang === 'bn' ? 'সকল বকেয়াদার সদস্যের নম্বরে স্বয়ংক্রিয় ভয়েস কল পাঠান' : 'Send automated voice calls to all pending members'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowVoiceModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipients Summary */}
            <div className={`p-4 rounded-2xl border grid grid-cols-2 gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-orange-50/50 border-orange-100/60'}`}>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'প্রাপক সংখ্যা' : 'Recipients'}</p>
                <p className="text-lg font-black text-orange-500 mt-0.5">{reminders.length} {lang === 'bn' ? 'জন সদস্য' : 'Members'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'মোট বকেয়া' : 'Total Dues'}</p>
                <p className="text-lg font-black text-red-500 mt-0.5">৳{reminders.reduce((sum, r) => sum + Number(r.balance_due || 0), 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Voice Template Selector */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">
                {lang === 'bn' ? 'ভয়েস টেমপ্লেট নির্বাচন করুন' : 'Select Voice Template'}
              </label>

              {loadingVoices ? (
                <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                  <Loader2 size={16} className="animate-spin" /> {lang === 'bn' ? 'ভয়েস লোড হচ্ছে...' : 'Loading voices...'}
                </div>
              ) : voiceTemplates.length === 0 ? (
                <div className={`p-5 rounded-2xl border text-center space-y-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <Mic size={24} className="mx-auto text-slate-400" />
                  <p className="text-xs font-bold text-slate-400">
                    {lang === 'bn' ? 'কোনো ভয়েস টেমপ্লেট পাওয়া যায়নি।' : 'No voice templates found.'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">
                    {lang === 'bn' ? 'ভয়েস ব্রডকাস্ট পেজ থেকে আপনার অডিও ভয়েস রেকর্ড বা আপলোড করুন।' : 'Upload or record your voice in the Voice Broadcast module.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {voiceTemplates.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVoiceId(v.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        selectedVoiceId === v.id
                          ? 'border-orange-500 bg-orange-500/10 shadow-sm'
                          : madrasah?.theme === 'dark'
                          ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedVoiceId === v.id ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          <Volume2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">{v.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">{v.provider_voice_name || 'Standard Voice'}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                          v.provider_status === 'approved' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500'
                        }`}>
                          {v.provider_status || 'Ready'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cost & Balance */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-emerald-500" />
                <span className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'বর্তমান ব্যালেন্স:' : 'Current Balance:'}</span>
                <span className="text-xs font-black text-emerald-500">৳{walletBalance.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400">{lang === 'bn' ? 'আনুমানিক খরচ:' : 'Estimated Cost:'}</span>{' '}
                <span className="text-xs font-black text-orange-500">৳{(reminders.length * voiceRate).toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowVoiceModal(false)}
                className={`flex-1 h-12 rounded-2xl font-bold text-xs border active:scale-95 transition-all ${
                  madrasah?.theme === 'dark' ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={handleSendVoiceBroadcast}
                disabled={isVoiceSending || loadingVoices || voiceTemplates.length === 0}
                className="flex-1 h-12 rounded-2xl font-black text-xs bg-orange-500 hover:bg-orange-600 text-white shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVoiceSending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{lang === 'bn' ? 'কল যাচ্ছে...' : 'Calling...'}</span>
                  </>
                ) : (
                  <>
                    <PhoneCall size={16} />
                    <span>{lang === 'bn' ? 'ভয়েস কল শুরু করুন' : 'Start Voice Call'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Status Modal */}
      {voiceStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className={`w-full max-w-sm rounded-[2.5rem] border shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${voiceStatusModal.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {voiceStatusModal.type === 'success' ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
            </div>
            <div>
              <h4 className="text-base font-black font-noto">{voiceStatusModal.title}</h4>
              <p className="text-xs font-bold text-slate-400 mt-1 leading-relaxed">{voiceStatusModal.message}</p>
            </div>
            <button
              onClick={() => setVoiceStatusModal(null)}
              className="w-full h-11 bg-[#2563EB] text-white rounded-xl font-bold text-xs active:scale-95 transition-all"
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitteeFinancialAnalytics;
