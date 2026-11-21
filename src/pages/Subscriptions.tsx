import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, UserRole, Department, Profile } from 'types';
import {
  CreditCard,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Coins,
  Settings,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  Receipt,
  BadgeCheck,
  Download,
  Loader2,
  AlertTriangle,
  Users,
  ChevronRight
} from 'lucide-react';
import { FlexibleSubscriptionEngine } from 'components/finance/FlexibleSubscriptionEngine';
import { StandardSubscriptionEngine } from 'components/finance/StandardSubscriptionEngine';
import MemberLedger from 'components/finance/MemberLedger';
import { sortMadrasahClasses } from 'pages/Departments';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface SubscriptionsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const MONTHS_BN_SHORT = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const escapeHtml = (val: any) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const Subscriptions: React.FC<SubscriptionsProps> = ({ lang, madrasah, onBack, role, profile }) => {
  const isDark = madrasah?.theme === 'dark';
  const isMember = role === 'member';

  const parsedConfig: any = useMemo(() => {
    if (!madrasah?.config_json) return {};
    if (typeof madrasah.config_json === 'string') {
      try {
        return JSON.parse(madrasah.config_json);
      } catch {
        return {};
      }
    }
    return madrasah.config_json;
  }, [madrasah?.config_json]);

  const subscriptionsModuleEnabled = parsedConfig?.modules?.subscriptions ?? true;
  const accountingMode = parsedConfig?.accounting_mode;
  const feeEngine = parsedConfig?.fee_engine || 'standard';
  const useFlexibleEngine = accountingMode === 'flexible' || accountingMode === 'qawmi_flexible' || feeEngine === 'qawmi';

  const [activeTab, setActiveTab] = useState<'fees' | 'monthly' | 'structures' | 'plan'>(
    subscriptionsModuleEnabled ? 'fees' : 'plan'
  );
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any>(null);
  const [departments, setClasses] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [memberCount, setMemberCount] = useState(0);

  // Month-by-Month Tracker States ("কে কত মাস / কোন মাস দিচ্ছে")
  const currentYear = new Date().getFullYear();
  const [trackerYear, setTrackerYear] = useState<string>(String(currentYear));
  const [trackerDeptId, setTrackerDeptId] = useState<string>('');
  const [trackerSearch, setTrackerSearch] = useState<string>('');
  const [trackerFilter, setTrackerFilter] = useState<'all' | 'paid_some' | 'none_paid'>('all');
  const [trackerLoading, setTrackerLoading] = useState<boolean>(false);
  const [trackerMembers, setTrackerMembers] = useState<any[]>([]);
  const [trackerFeeRows, setTrackerFeeRows] = useState<any[]>([]);
  const [trackerStructures, setTrackerStructures] = useState<any[]>([]);

  // Plan & Billing States
  const [planYear, setPlanYear] = useState<string>(String(currentYear));
  const [subTransactions, setSubTransactions] = useState<any[]>([]);
  const [loadingSubTx, setLoadingSubTx] = useState<boolean>(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    if (!subscriptionsModuleEnabled && activeTab !== 'plan') {
      setActiveTab('plan');
    }
  }, [subscriptionsModuleEnabled, activeTab]);

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
      fetchStats();
    }
  }, [madrasah?.id]);

  useEffect(() => {
    if (madrasah && activeTab === 'monthly') {
      fetchMonthlyTrackerData();
    }
  }, [madrasah?.id, activeTab, trackerYear]);

  useEffect(() => {
    if (madrasah && activeTab === 'plan' && !isMember && madrasah.id !== 'super_admin') {
      fetchPlanTransactions();
    }
  }, [madrasah?.id, activeTab, isMember]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('departments').select('*').eq('institution_id', madrasah.id);
      if (data) {
        let filteredClasses = data;
        if (role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0) {
          filteredClasses = data.filter((cls: any) => profile.permissions.allowed_departments.includes(cls.id));
        }
        setClasses(sortMadrasahClasses(filteredClasses));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!madrasah?.id) return;
    try {
      const [feesRes, membersRes] = await Promise.all([
        supabase.from('fees').select('amount_paid, amount_due').eq('institution_id', madrasah.id),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('institution_id', madrasah.id)
      ]);

      if (feesRes.data) {
        const paid = feesRes.data.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0);
        const due = feesRes.data.reduce((acc, curr) => acc + (Number(curr.amount_due) || 0), 0);
        setTotalCollected(paid);
        setTotalDue(due);
      }
      if (typeof membersRes.count === 'number') {
        setMemberCount(membersRes.count);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMonthlyTrackerData = async () => {
    if (!madrasah?.id) return;
    setTrackerLoading(true);
    try {
      const [membersRes, feeStructRes, feesRes] = await Promise.all([
        supabase
          .from('members')
          .select('id, name, roll, member_id_number, department_id, phone, departments(name)')
          .eq('institution_id', madrasah.id)
          .order('name', { ascending: true }),
        supabase
          .from('fee_structures')
          .select('*')
          .eq('institution_id', madrasah.id),
        supabase
          .from('fees')
          .select('id, member_id, amount_paid, discount, month, status')
          .eq('institution_id', madrasah.id)
          .like('month', `${trackerYear}-%`)
      ]);

      let loadedMembers = membersRes.data || [];
      if (role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0) {
        loadedMembers = loadedMembers.filter((m: any) => profile.permissions.allowed_departments.includes(m.department_id));
      }
      setTrackerMembers(loadedMembers);

      let resolvedStructures = feeStructRes.data || [];
      if (resolvedStructures.length === 0) {
        const { data: subStructData } = await supabase
          .from('subscription_structures')
          .select('*')
          .eq('institution_id', madrasah.id);
        if (subStructData) resolvedStructures = subStructData;
      }
      setTrackerStructures(resolvedStructures);

      let loadedFees = feesRes.data || [];
      if (loadedFees.length === 0) {
        const { data: subRows } = await supabase
          .from('subscriptions')
          .select('id, member_id, amount_paid, discount, period, status')
          .eq('institution_id', madrasah.id)
          .like('period', `${trackerYear}-%`);
        if (subRows && subRows.length > 0) {
          loadedFees = subRows.map((s: any) => ({
            ...s,
            month: s.period
          }));
        }
      }
      setTrackerFeeRows(loadedFees);
    } catch (err) {
      console.error('Monthly tracker load error:', err);
    } finally {
      setTrackerLoading(false);
    }
  };

  const fetchPlanTransactions = async () => {
    if (!madrasah?.id) return;
    setLoadingSubTx(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setSubTransactions(data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription transactions:', err);
    } finally {
      setLoadingSubTx(false);
    }
  };

  const handleDownloadSubReceipt = async (tr: any) => {
    if (!madrasah) return;
    setDownloadingReceiptId(tr.id);
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '680px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = "'Noto Sans Bengali', 'Inter', sans-serif";
    container.style.padding = '36px';
    container.style.boxSizing = 'border-box';

    const formattedDate = escapeHtml(new Date(tr.created_at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US'));
    const monthsText = Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0
      ? escapeHtml(tr.metadata.months.join(', '))
      : '';
    const pkgText = tr.metadata?.package_name ? ` (${escapeHtml(tr.metadata.package_name)})` : '';
    const statusText = escapeHtml(String(tr.status || 'approved').toUpperCase());

    container.innerHTML = `
      <div style="border: 2px solid #0fb5ab; border-radius: 20px; padding: 32px; background: #ffffff; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 24px; font-weight: 900; color: #0fb5ab; letter-spacing: -0.5px;">Committee Manager</div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">Official Payment Receipt</div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: #ecfdf5; color: #059669; border: 1.5px solid #10b981; font-size: 12px; font-weight: 900; letter-spacing: 1px;">${statusText}</span>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; margin-top: 8px;">${formattedDate}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 18px; border-radius: 14px; border: 1px solid #e2e8f0;">
          <div>
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Committee / Organization</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">${escapeHtml(madrasah.name)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(madrasah.phone || '')}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Transaction ID</div>
            <div style="font-size: 13px; font-weight: 800; color: #0fb5ab; margin-top: 4px;">${escapeHtml(tr.transaction_id || tr.id)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Method: ${escapeHtml(tr.sender_phone || 'Admin Direct')}</div>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Payment Details</div>
          <div style="font-size: 14px; font-weight: 700; color: #1e293b; padding: 14px 16px; background: #f0fdfa; border-radius: 12px; border: 1px solid #ccfbf1;">
            ${escapeHtml(tr.description || 'Platform Payment')}${pkgText}
            ${monthsText ? `<div style="font-size: 11px; color: #0f766e; margin-top: 6px;">Months: ${monthsText}</div>` : ''}
            ${tr.sms_count ? `<div style="font-size: 11px; color: #0f766e; margin-top: 4px;">SMS Credited: ${escapeHtml(tr.sms_count)} SMS</div>` : ''}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #0fb5ab; color: #ffffff; padding: 18px 24px; border-radius: 14px;">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Total Amount Paid</div>
          <div style="font-size: 24px; font-weight: 900;">৳ ${Number(tr.amount || 0).toFixed(2)}</div>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
          Generated by Committee Manager
        </div>
      </div>
    `;

    document.body.appendChild(container);
    try {
      const imgData = await toPng(container, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 10, 15, pdfWidth, pdfHeight);
      pdf.save(`Committee_Receipt_${tr.transaction_id || tr.id}.pdf`);
    } catch (err) {
      console.error('Receipt generation error:', err);
    } finally {
      document.body.removeChild(container);
      setDownloadingReceiptId(null);
    }
  };

  // Compute month-by-month breakdown per member
  const monthlyTrackerRows = useMemo(() => {
    const feesByMemberMonth: Record<string, Record<string, { paid: number; discount: number }>> = {};
    trackerFeeRows.forEach((f: any) => {
      const mId = f.member_id;
      const mKey = f.month || f.period;
      if (!mId || !mKey) return;
      if (!feesByMemberMonth[mId]) feesByMemberMonth[mId] = {};
      if (!feesByMemberMonth[mId][mKey]) feesByMemberMonth[mId][mKey] = { paid: 0, discount: 0 };
      feesByMemberMonth[mId][mKey].paid += Number(f.amount_paid) || 0;
      feesByMemberMonth[mId][mKey].discount += Number(f.discount) || 0;
    });

    const rows = trackerMembers.map((m: any) => {
      const deptName = m.departments?.name || m.departments?.[0]?.name || departments.find(d => d.id === m.department_id)?.name || '';
      const applicableStructures = trackerStructures.filter(
        (fs: any) => fs.department_id === m.department_id || fs.department_id === null
      );
      const monthlyPayable = applicableStructures.reduce((sum: number, fs: any) => sum + (Number(fs.amount) || 0), 0);
      const memberMonthMap = feesByMemberMonth[m.id] || {};

      let paidMonthsCount = 0;
      let partialMonthsCount = 0;
      let totalPaidYear = 0;
      const paidMonthNames: string[] = [];
      const partialMonthNames: string[] = [];

      const months = Array.from({ length: 12 }, (_, idx) => {
        const monthNum = String(idx + 1).padStart(2, '0');
        const monthKey = `${trackerYear}-${monthNum}`;
        const entry = memberMonthMap[monthKey];
        const paidAmt = entry ? entry.paid : 0;
        const discAmt = entry ? entry.discount : 0;
        const covered = paidAmt + discAmt;
        totalPaidYear += paidAmt;

        let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
        if (covered > 0) {
          if (monthlyPayable <= 0 || covered >= monthlyPayable) {
            status = 'paid';
            paidMonthsCount += 1;
            paidMonthNames.push(lang === 'bn' ? MONTHS_BN[idx] : MONTHS_EN[idx]);
          } else {
            status = 'partial';
            partialMonthsCount += 1;
            partialMonthNames.push(lang === 'bn' ? MONTHS_BN[idx] : MONTHS_EN[idx]);
          }
        }

        return {
          idx,
          monthKey,
          shortLabel: lang === 'bn' ? MONTHS_BN_SHORT[idx] : MONTHS_EN_SHORT[idx],
          fullLabel: lang === 'bn' ? MONTHS_BN[idx] : MONTHS_EN[idx],
          paidAmt,
          covered,
          status
        };
      });

      return {
        ...m,
        roll: m.member_id_number || m.roll || '-',
        deptName,
        monthlyPayable,
        paidMonthsCount,
        partialMonthsCount,
        totalPaidYear,
        paidMonthNames,
        partialMonthNames,
        months
      };
    });

    return rows.filter((row) => {
      if (trackerDeptId && row.department_id !== trackerDeptId) return false;
      if (trackerFilter === 'paid_some' && row.paidMonthsCount === 0 && row.partialMonthsCount === 0) return false;
      if (trackerFilter === 'none_paid' && (row.paidMonthsCount > 0 || row.partialMonthsCount > 0)) return false;
      if (trackerSearch.trim()) {
        const q = trackerSearch.trim().toLowerCase();
        const matchName = (row.name || '').toLowerCase().includes(q);
        const matchRoll = String(row.roll || '').toLowerCase().includes(q);
        const matchPhone = String(row.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchPhone) return false;
      }
      return true;
    });
  }, [trackerMembers, trackerStructures, trackerFeeRows, trackerYear, trackerDeptId, trackerFilter, trackerSearch, departments, lang]);

  const trackerSummary = useMemo(() => {
    const totalYearAmount = monthlyTrackerRows.reduce((s, r) => s + r.totalPaidYear, 0);
    const totalPaidMonthsSum = monthlyTrackerRows.reduce((s, r) => s + r.paidMonthsCount, 0);
    const activePayingMembers = monthlyTrackerRows.filter(r => r.paidMonthsCount > 0 || r.partialMonthsCount > 0).length;
    return { totalYearAmount, totalPaidMonthsSum, activePayingMembers };
  }, [monthlyTrackerRows]);

  const paidMonthsList: string[] = Array.isArray(parsedConfig?.paid_months) ? parsedConfig.paid_months : [];

  const formatYearMonthLabel = (ym: string) => {
    const parts = String(ym).split('-');
    if (parts.length === 2) {
      const yr = parts[0];
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${lang === 'bn' ? MONTHS_BN[mIdx] : MONTHS_EN[mIdx]} ${yr}`;
      }
    }
    return ym;
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-300 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-700 border-slate-200'}`}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={`text-lg font-black font-noto leading-none ${isDark ? 'text-slate-100' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'সাবস্ক্রিপশন ও চাঁদা' : 'Subscriptions & Plans'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              {lang === 'bn' ? 'মাসভিত্তিক হিসাব, সদস্য চাঁদা ও প্ল্যান' : 'Monthly tracker, member dues & billing'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            fetchClasses();
            fetchStats();
            if (activeTab === 'monthly') fetchMonthlyTrackerData();
            if (activeTab === 'plan') fetchPlanTransactions();
          }}
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-200'}`}
        >
          <RefreshCw size={16} className={loading || trackerLoading || loadingSubTx ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards (shown for Member Subscription tabs) */}
      {subscriptionsModuleEnabled && activeTab !== 'plan' && !selectedStudentForDetail && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
          <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                <Coins size={20} />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {lang === 'bn' ? 'মোট সংগৃহীত চাঁদা' : 'Total Subscriptions Collected'}
              </p>
            </div>
            <h3 className={`text-2xl lg:text-3xl font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
              ৳ {totalCollected.toLocaleString()}
            </h3>
          </div>

          <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                {lang === 'bn' ? 'মোট বকেয়া চাঁদা' : 'Total Outstanding Dues'}
              </p>
            </div>
            <h3 className={`text-2xl lg:text-3xl font-black font-noto ${isDark ? 'text-white' : 'text-amber-500'}`}>
              ৳ {totalDue.toLocaleString()}
            </h3>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      {!selectedStudentForDetail && (
        <div className="px-1">
          <div className={`flex p-1.5 rounded-[2rem] border overflow-x-auto no-scrollbar gap-1 ${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-slate-100/80 border-slate-200/50'}`}>
            {subscriptionsModuleEnabled && (
              <>
                <button
                  onClick={() => setActiveTab('fees')}
                  className={`flex-1 min-w-[115px] py-3 px-3 text-[11px] font-black uppercase tracking-wider rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'fees' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <CreditCard size={14} />
                  <span>{lang === 'bn' ? 'সদস্য চাঁদা' : 'Collection'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('monthly')}
                  className={`flex-1 min-w-[125px] py-3 px-3 text-[11px] font-black uppercase tracking-wider rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'monthly' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Calendar size={14} />
                  <span>{lang === 'bn' ? 'মাসভিত্তিক হিসাব' : 'Month Tracker'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('structures')}
                  className={`flex-1 min-w-[115px] py-3 px-3 text-[11px] font-black uppercase tracking-wider rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'structures' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Settings size={14} />
                  <span>{lang === 'bn' ? 'চাঁদা সেটিংস' : 'Settings'}</span>
                </button>
              </>
            )}
            {!isMember && madrasah?.id !== 'super_admin' && (
              <button
                onClick={() => setActiveTab('plan')}
                className={`flex-1 min-w-[120px] py-3 px-3 text-[11px] font-black uppercase tracking-wider rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'plan' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
              >
                <BadgeCheck size={14} />
                <span>{lang === 'bn' ? 'প্ল্যান ও পেমেন্ট' : 'Plan & Billing'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected Member Ledger */}
      {selectedStudentForDetail ? (
        <MemberLedger
          member={selectedStudentForDetail}
          madrasah={madrasah!}
          lang={lang}
          departments={departments}
          onBack={() => {
            setSelectedStudentForDetail(null);
            fetchStats();
            if (activeTab === 'monthly') fetchMonthlyTrackerData();
          }}
        />
      ) : activeTab === 'monthly' && subscriptionsModuleEnabled ? (
        /* Tab 2: Month-by-Month Tracker ("মাস অনুযায়ী কে কত মাস দিচ্ছে, কোন মাস দিচ্ছে") */
        <div className="space-y-4 px-1 animate-in fade-in duration-300">
          {/* Filters */}
          <div className={`p-4 sm:p-5 rounded-[2rem] border shadow-sm space-y-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">
                  {lang === 'bn' ? 'বছর' : 'Year'}
                </label>
                <select
                  value={trackerYear}
                  onChange={(e) => setTrackerYear(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-xl border text-xs font-black outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                >
                  {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((yr) => (
                    <option key={yr} value={String(yr)}>{yr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">
                  {lang === 'bn' ? 'কমিটি / বিভাগ' : 'Department'}
                </label>
                <select
                  value={trackerDeptId}
                  onChange={(e) => setTrackerDeptId(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-xl border text-xs font-black outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                >
                  <option value="">{lang === 'bn' ? 'সব কমিটি' : 'All Committees'}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">
                  {lang === 'bn' ? 'অবস্থা' : 'Filter'}
                </label>
                <select
                  value={trackerFilter}
                  onChange={(e) => setTrackerFilter(e.target.value as any)}
                  className={`w-full h-11 px-3.5 rounded-xl border text-xs font-black outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                >
                  <option value="all">{lang === 'bn' ? 'সব সদস্য' : 'All Members'}</option>
                  <option value="paid_some">{lang === 'bn' ? 'যারা পরিশোধ করেছে' : 'Paid Members'}</option>
                  <option value="none_paid">{lang === 'bn' ? 'এখনো পরিশোধ করেনি' : 'Not Paid Yet'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 px-1">
                  {lang === 'bn' ? 'সদস্য খুঁজুন' : 'Search'}
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={trackerSearch}
                    onChange={(e) => setTrackerSearch(e.target.value)}
                    placeholder={lang === 'bn' ? 'নাম বা আইডি...' : 'Name or ID...'}
                    className={`w-full h-11 pl-9 pr-3 rounded-xl border text-xs font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                  />
                </div>
              </div>
            </div>

            {/* Yearly Quick Summary Strip */}
            <div className={`grid grid-cols-3 gap-2.5 pt-2 border-t ${isDark ? 'border-slate-700/70' : 'border-slate-100'}`}>
              <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase">{lang === 'bn' ? 'মোট সদস্য' : 'Members'}</p>
                <p className={`text-sm sm:text-base font-black mt-0.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {monthlyTrackerRows.length} {lang === 'bn' ? 'জন' : ''}
                  <span className="text-[10px] font-bold text-emerald-500 ml-1.5">
                    ({trackerSummary.activePayingMembers} {lang === 'bn' ? 'সক্রিয়' : 'paid'})
                  </span>
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase">{lang === 'bn' ? 'পরিশোধিত মাস' : 'Total Months'}</p>
                <p className="text-sm sm:text-base font-black mt-0.5 text-[#0fb5ab]">
                  {trackerSummary.totalPaidMonthsSum} {lang === 'bn' ? 'মাস' : 'mos'}
                </p>
              </div>
              <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase">{lang === 'bn' ? `${trackerYear} মোট আদায়` : `${trackerYear} Total`}</p>
                <p className="text-sm sm:text-base font-black mt-0.5 text-emerald-500">
                  ৳ {trackerSummary.totalYearAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Member Cards with Month Breakdown */}
          {trackerLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-3 text-[#0fb5ab]" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest">
                {lang === 'bn' ? 'মাসভিত্তিক তথ্য লোড হচ্ছে...' : 'Loading monthly breakdown...'}
              </p>
            </div>
          ) : monthlyTrackerRows.length > 0 ? (
            <div className="space-y-3">
              {monthlyTrackerRows.map((row) => (
                <div
                  key={row.id}
                  onClick={() => setSelectedStudentForDetail(row)}
                  className={`p-4 sm:p-5 rounded-[2rem] border shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.99] space-y-3.5 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-[#42f5e9]/40' : 'bg-white border-slate-100 hover:border-[#0fb5ab]/30'}`}
                >
                  {/* Top Row: Member Info + Total Months Paid */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                        row.paidMonthsCount > 0
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : row.partialMonthsCount > 0
                            ? 'bg-amber-500/15 text-amber-500'
                            : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.roll}
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-sm sm:text-base font-black font-noto truncate flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          {row.name}
                          <ChevronRight size={14} className="text-slate-400 shrink-0" />
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 truncate">
                          {row.deptName || (lang === 'bn' ? 'সাধারণ সদস্য' : 'General Member')}
                          {row.monthlyPayable > 0 && ` • ${lang === 'bn' ? 'মাসিক:' : 'Monthly:'} ৳${row.monthlyPayable}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${
                        row.paidMonthsCount > 0
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : isDark ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {row.paidMonthsCount} / 12 {lang === 'bn' ? 'মাস' : 'mos'}
                      </span>
                      {row.partialMonthsCount > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          +{row.partialMonthsCount} {lang === 'bn' ? 'আংশিক' : 'partial'}
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black ${isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#0fb5ab]/10 text-[#0fb5ab]'}`}>
                        ৳ {row.totalPaidYear.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Exact Paid Months Text Line */}
                  <div className={`text-[11px] font-bold font-noto px-3 py-2 rounded-xl ${isDark ? 'bg-slate-900/60 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                    <span className="text-slate-400 mr-1.5">
                      {lang === 'bn' ? 'পরিশোধিত মাস:' : 'Paid Months:'}
                    </span>
                    {row.paidMonthNames.length > 0 ? (
                      <span className="text-emerald-500 font-black">{row.paidMonthNames.join(', ')}</span>
                    ) : (
                      <span className="text-slate-400">{lang === 'bn' ? 'কোনো পূর্ণ মাস পরিশোধ নেই' : 'No full months paid'}</span>
                    )}
                    {row.partialMonthNames.length > 0 && (
                      <span className="text-amber-500 font-black ml-2">
                        ({lang === 'bn' ? 'আংশিক:' : 'Partial:'} {row.partialMonthNames.join(', ')})
                      </span>
                    )}
                  </div>

                  {/* 12-Month Visual Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                    {row.months.map((m: any) => (
                      <div
                        key={m.monthKey}
                        title={`${m.fullLabel} ${trackerYear}: ৳${m.paidAmt}`}
                        className={`px-2 py-1.5 rounded-xl border text-center transition-all ${
                          m.status === 'paid'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                            : m.status === 'partial'
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                              : isDark
                                ? 'bg-slate-900/40 border-slate-700/60 text-slate-500'
                                : 'bg-slate-50 border-slate-100 text-slate-400'
                        }`}
                      >
                        <div className="text-[10px] font-black leading-tight flex items-center justify-center gap-0.5">
                          {m.status === 'paid' && <CheckCircle2 size={10} className="shrink-0" />}
                          <span>{m.shortLabel}</span>
                        </div>
                        <div className="text-[9px] font-bold mt-0.5 opacity-85 truncate">
                          {m.paidAmt > 0 ? `৳${m.paidAmt}` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-16 rounded-[2.5rem] border-2 border-dashed flex flex-col items-center ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <Users size={34} className="text-slate-300 mb-3" />
              <h4 className={`text-base font-black font-noto ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {lang === 'bn' ? 'কোনো সদস্য পাওয়া যায়নি' : 'No members found'}
              </h4>
              <p className="text-[11px] font-bold text-slate-400 mt-1">
                {lang === 'bn' ? 'অনুগ্রহ করে ফিল্টার বা সার্চ পরিবর্তন করে দেখুন' : 'Try adjusting your filters or search query'}
              </p>
            </div>
          )}
        </div>
      ) : activeTab === 'plan' && !isMember && madrasah?.id !== 'super_admin' ? (
        /* Tab 4: Platform Plan, Paid Months & Payment History */
        <div className="space-y-6 px-1 animate-in fade-in duration-300">
          {/* Plan Summary Card */}
          <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#42f5e9]/15 text-[#0fb5ab] border border-[#42f5e9]/25 flex items-center justify-center shrink-0">
                  <BadgeCheck size={24} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className={`text-base sm:text-lg font-black font-noto leading-none ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                      {parsedConfig?.package_name || (lang === 'bn' ? 'স্ট্যান্ডার্ড প্ল্যান' : 'Standard Plan')}
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      madrasah?.is_active === false || madrasah?.status === 'suspended'
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : madrasah?.status === 'trial'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}>
                      {madrasah?.status || 'active'}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                    {parsedConfig?.subscription_type === 'lifetime'
                      ? (lang === 'bn' ? 'লাইফটাইম সাবস্ক্রিপশন' : 'Lifetime Subscription')
                      : `${(parsedConfig?.subscription_type || 'monthly').toUpperCase()} • ${lang === 'bn' ? 'মেয়াদ:' : 'Ends:'} ${madrasah?.subscription_end || (lang === 'bn' ? 'নির্ধারিত নয়' : 'N/A')}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'সদস্য সীমা' : 'Member Limit'}</p>
                <p className={`text-sm font-black mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {Number(parsedConfig?.member_limit) > 0
                    ? `${memberCount} / ${parsedConfig.member_limit}`
                    : (lang === 'bn' ? 'আনলিমিটেড' : 'Unlimited')}
                </p>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'বকেয়া বিল' : 'Due Amount'}</p>
                <p className={`text-sm font-black mt-1 ${Number(parsedConfig?.due_amount || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  ৳ {Number(parsedConfig?.due_amount || 0).toLocaleString()}
                </p>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'SMS / ভয়েস রেট' : 'SMS / Voice Rate'}</p>
                <p className={`text-sm font-black mt-1 ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                  ৳{parsedConfig?.sms_rate ?? '0.40'} / ৳{parsedConfig?.voice_rate ?? '0.50'}
                </p>
              </div>
              <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'পরিশোধিত মাস' : 'Paid Months'}</p>
                <p className={`text-sm font-black mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {paidMonthsList.length} {lang === 'bn' ? 'মাস' : 'mos'}
                </p>
              </div>
            </div>

            {parsedConfig?.subscription_note && (
              <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-start gap-2.5 ${isDark ? 'bg-amber-900/15 border-amber-800/30 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span className="font-noto">{parsedConfig.subscription_note}</span>
              </div>
            )}
          </div>

          {/* Committee Paid Months Breakdown */}
          <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className={`text-base font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                  {lang === 'bn' ? 'কমিটির মাসভিত্তিক সাবস্ক্রিপশন স্ট্যাটাস' : 'Committee Monthly Subscription Status'}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                  {lang === 'bn'
                    ? `মোট ${paidMonthsList.length} টি মাস পরিশোধিত`
                    : `Total ${paidMonthsList.length} months paid`}
                </p>
              </div>
              <select
                value={planYear}
                onChange={(e) => setPlanYear(e.target.value)}
                className={`h-10 px-3.5 rounded-xl border text-xs font-black outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
              >
                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((yr) => (
                  <option key={yr} value={String(yr)}>{yr}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {Array.from({ length: 12 }, (_, idx) => {
                const key = `${planYear}-${String(idx + 1).padStart(2, '0')}`;
                const isPaid = paidMonthsList.includes(key);
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      isPaid
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                        : isDark
                          ? 'bg-slate-900/50 border-slate-700/70 text-slate-500'
                          : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}
                  >
                    <p className="text-xs font-black font-noto">{lang === 'bn' ? MONTHS_BN[idx] : MONTHS_EN_SHORT[idx]}</p>
                    <p className="text-[9px] font-black uppercase tracking-wider mt-1">
                      {isPaid ? (lang === 'bn' ? 'পরিশোধিত' : 'PAID') : (lang === 'bn' ? 'অপরিশোধিত' : 'DUE')}
                    </p>
                  </div>
                );
              })}
            </div>

            {paidMonthsList.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                  {lang === 'bn' ? 'সব পরিশোধিত মাসসমূহ' : 'All Paid Months'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {paidMonthsList.map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                      {formatYearMonthLabel(m)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#42f5e9]/15 text-[#0fb5ab] flex items-center justify-center">
                <Receipt size={20} />
              </div>
              <div>
                <h4 className={`text-base font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                  {lang === 'bn' ? 'পেমেন্ট ইতিহাস ও রসিদ' : 'Payment History & Receipts'}
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {lang === 'bn' ? 'সর্বশেষ লেনদেনসমূহ' : 'Recent platform transactions'}
                </p>
              </div>
            </div>

            {loadingSubTx ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin text-[#0fb5ab]" size={28} />
              </div>
            ) : subTransactions.length > 0 ? (
              <div className="space-y-2.5">
                {subTransactions.map((tr) => (
                  <div
                    key={tr.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                          ৳ {Number(tr.amount || 0).toLocaleString()}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          tr.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : tr.status === 'pending'
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-red-500/15 text-red-500'
                        }`}>
                          {tr.status || 'approved'}
                        </span>
                        {tr.module && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#42f5e9]/15 text-[#0fb5ab]">
                            {tr.module}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-bold font-noto truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {tr.description || (lang === 'bn' ? 'প্ল্যাটফর্ম লেনদেন' : 'Platform Transaction')}
                      </p>
                      {Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0 && (
                        <p className="text-[10px] font-bold text-emerald-500 font-noto">
                          {lang === 'bn' ? 'মাস:' : 'Months:'} {tr.metadata.months.map(formatYearMonthLabel).join(', ')}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400">
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(tr.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                        {tr.transaction_id && <span>TrxID: {tr.transaction_id}</span>}
                      </div>
                    </div>
                    {tr.status === 'approved' && Number(tr.amount || 0) > 0 && (
                      <button
                        onClick={() => handleDownloadSubReceipt(tr)}
                        disabled={downloadingReceiptId === tr.id}
                        className="px-3 py-2 rounded-xl bg-[#42f5e9]/15 text-[#0fb5ab] hover:bg-[#42f5e9]/25 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 active:scale-95 transition-all disabled:opacity-50"
                        title={lang === 'bn' ? 'রসিদ ডাউনলোড' : 'Download Receipt'}
                      >
                        {downloadingReceiptId === tr.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>{lang === 'bn' ? 'রসিদ' : 'Receipt'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`py-12 text-center rounded-2xl border border-dashed ${isDark ? 'bg-slate-900/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {lang === 'bn' ? 'কোনো পেমেন্ট ইতিহাস পাওয়া যায়নি' : 'No payment history found'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tabs 1 & 3: Collection ('fees') & Settings ('structures') */
        <div className="px-1">
          {madrasah && subscriptionsModuleEnabled && (activeTab === 'fees' || activeTab === 'structures') && (
            useFlexibleEngine ? (
              <FlexibleSubscriptionEngine
                activeTab={activeTab}
                madrasah={madrasah}
                lang={lang === 'bn' ? 'bn' : 'en'}
                departments={departments}
                onStudentClick={(student) => setSelectedStudentForDetail(student)}
                role={role}
                profile={profile}
              />
            ) : (
              <StandardSubscriptionEngine
                activeTab={activeTab}
                madrasah={madrasah}
                lang={lang === 'bn' ? 'bn' : 'en'}
                departments={departments}
                onStudentClick={(student) => setSelectedStudentForDetail(student)}
                role={role}
                profile={profile}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
