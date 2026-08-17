
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Institution, Language, Department, LedgerEntry, Subscription, Member, Profile } from '../types';
import { motion } from 'motion/react';
import { 
  ArrowLeft, DollarSign, Loader2, TrendingUp, TrendingDown, User as UserIcon,
  CheckCircle2, X, Calendar, ChevronRight, AlertCircle, Check
} from 'lucide-react';

import { t } from '../translations';

interface MemberAccountingProps {
  member: Member;
  madrasah: Institution;
  lang: Language;
  onBack: () => void;
  departments: Department[];
  profile?: Profile | null;
}

const MemberAccounting: React.FC<MemberAccountingProps> = ({ member, madrasah, lang, onBack, departments, profile }) => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Multi-month states
  const [showMultiMonthModal, setShowMultiMonthModal] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMemberAccountingData();
  }, [member.id, selectedYear]);

  const fetchMemberAccountingData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all fees for the member in the selected year
      const { data: feesData } = await supabase
        .from('fees')
        .select('*')
        .eq('student_id', member.id)
        .like('month', `${selectedYear}-%`);
      
      if (feesData) setFees(feesData);

      // 2. Fetch ledger entries mentioning this member
      const { data: ledgerData } = await supabase
        .from('ledger')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('category', 'Member Fee')
        .ilike('description', `%${member.name}%`);
      
      if (ledgerData) setLedgerEntries(ledgerData.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()));

      // 3. Fetch fee structures for this member's department
      const { data: structureData } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('institution_id', madrasah.id)
        .or(`department_id.eq.${member.department_id},department_id.is.null`);
      
      if (structureData) setStructures(structureData);

    } catch (error) {
      console.error('Error fetching member accounting:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDark = madrasah.theme === 'dark';
  const departmentName = departments.find(c => c.id === member.department_id)?.name || 'N/A';
  const totalPayablePerMonth = structures.reduce((sum, s) => sum + Number(s.amount), 0);

  const handleMultiMonthPayment = async () => {
    if (selectedMonths.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const perMonthAmount = totalPayablePerMonth;
      const totalAmount = perMonthAmount * selectedMonths.length;

      // 1. Insert fees records for each month
      const feePromises = selectedMonths.map(month => {
        return supabase.from('fees').insert({
          institution_id: madrasah.id,
          student_id: member.id,
          department_id: member.department_id,
          amount_paid: perMonthAmount,
          month: month,
          status: 'paid'
        });
      });

      const results = await Promise.all(feePromises);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;

      // 2. Add to Ledger (one single entry for total)
      const monthsLabel = selectedMonths.map(m => {
        const monthNum = parseInt(m.split('-')[1]);
        return ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'][monthNum - 1];
      }).join(', ');

      const { error: ledgerErr } = await supabase.from('ledger').insert({
        institution_id: madrasah.id,
        type: 'income',
        amount: totalAmount,
        category: 'Member Fee',
        description: `মাসিক ফি (${monthsLabel}) - ${member.name} (${departmentName})`,
        transaction_date: new Date().toISOString().split('T')[0]
      });

      if (ledgerErr) throw ledgerErr;

      setShowMultiMonthModal(false);
      setSelectedMonths([]);
      fetchMemberAccountingData();
    } catch (err: any) {
      console.error('Error saving multi-month fees:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const totalPaid = ledgerEntries.reduce((sum, l) => sum + Number(l.amount), 0);
  
  const currentMonth = new Date().getMonth() + 1;
  const totalPayableYearToDate = totalPayablePerMonth * currentMonth;
  const totalDue = Math.max(0, totalPayableYearToDate - totalPaid);

  return (
    <div className={`space-y-6 animate-in fade-in duration-700 pb-24 ${isDark ? 'text-slate-200' : ''}`}>
      {/* Dynamic Header */}
      <div className="relative h-[200px] w-full overflow-hidden rounded-[2.5rem] shadow-xl border border-white/10">
        <div className={`absolute inset-0 bg-gradient-to-br ${isDark ? 'from-slate-900 via-slate-800 to-[#0a8078]' : 'from-[#0fb5ab] via-[#42f5e9] to-[#0a8078]'}`} />
        <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-[80px]" />
        
        <div className="relative z-10 w-full h-full flex flex-col p-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={onBack} 
              className="w-10 h-10 bg-white/10 backdrop-blur-2xl rounded-xl flex items-center justify-center text-white active:scale-90 transition-all border border-white/20"
            >
              <ArrowLeft size={20} strokeWidth={3} />
            </button>
          </div>

          <div className="mt-auto flex items-center gap-5 pb-2">
            <div className={`relative w-24 h-24 rounded-[2rem] flex items-center justify-center text-[#0fb5ab] border-2 border-white shadow-xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              {member.photo_url ? (
                <img 
                  src={member.photo_url} 
                  alt={member.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon size={48} strokeWidth={2.5} />
              )}
            </div>
            
            <div className="flex flex-col text-left">
              <h1 className="text-2xl font-black text-white font-noto tracking-tighter leading-tight">{member.name}</h1>
              <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full w-fit">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{departmentName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
          <Loader2 className="animate-spin mb-6 text-[#0fb5ab]" size={48} />
          <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div whileHover={{ y: -5 }} className={`p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#42f5e9]/10 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
                  <TrendingUp size={20} />
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">মাসিক ফি</span>
              </div>
              <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>৳{totalPayablePerMonth.toLocaleString('bn-BD')}</p>
            </motion.div>

            <motion.div whileHover={{ y: -5 }} className={`p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  <DollarSign size={20} />
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">পরিশোধিত</span>
              </div>
              <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-emerald-600'}`}>৳{totalPaid.toLocaleString('bn-BD')}</p>
            </motion.div>

            <motion.div whileHover={{ y: -5 }} className={`p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                  <TrendingDown size={20} />
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">মোট বকেয়া</span>
              </div>
              <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-red-600'}`}>৳{totalDue.toLocaleString('bn-BD')}</p>
            </motion.div>
          </div>

          {/* Monthly Card */}
          <div className={`p-8 rounded-[3rem] border shadow-xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className={`text-lg font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>মাসিক ফি স্ট্যাটাস</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status of your monthly contributions</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowMultiMonthModal(true)}
                  className={`h-11 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 ${isDark ? 'bg-[#42f5e9]/10 text-[#42f5e9] border border-[#42f5e9]/20' : 'bg-[#0fb5ab] text-white shadow-lg shadow-[#0fb5ab]/20'}`}
                >
                  <Calendar size={14} />
                  ফি জমা দিন (একাধিক মাস)
                </button>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`h-11 px-4 rounded-2xl border text-xs font-black outline-none ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  {[0, 1, 2].map(offset => {
                    const year = (new Date().getFullYear() - offset).toString();
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({ length: 12 }, (_, i) => {
                const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                const monthName = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][i];
                const monthFee = fees.find((f: any) => (f.month || f.period) === monthStr);
                const status = monthFee?.status || 'unpaid';

                return (
                  <div key={monthStr} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 ${status === 'paid' ? 'bg-emerald-500/5 border-emerald-500/20' : status === 'partial' ? 'bg-orange-500/5 border-orange-500/20' : 'bg-slate-500/5 border-slate-200'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest">{monthName}</p>
                    <div className={`w-2 h-2 rounded-full ${status === 'paid' ? 'bg-emerald-500' : status === 'partial' ? 'bg-orange-500' : 'bg-slate-300'}`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transactions */}
          <div className={`p-8 rounded-[3rem] border shadow-xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
            <h3 className={`text-lg font-black font-noto mb-6 ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>লেনদেনের ইতিহাস</h3>
            <div className="space-y-4">
              {ledgerEntries.length > 0 ? ledgerEntries.map(entry => (
                <div key={entry.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div>
                    <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{entry.description.split(' - ')[0]}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{new Date(entry.transaction_date).toLocaleDateString('bn-BD')}</p>
                  </div>
                  <p className="text-base font-black text-emerald-600">+ ৳{entry.amount}</p>
                </div>
              )) : (
                <p className="text-center py-10 text-slate-400 text-xs font-bold uppercase tracking-widest">কোনো লেনদেন নেই</p>
              )}
            </div>
          </div>
        </div>
      )}

      <MultiMonthModal 
        isOpen={showMultiMonthModal}
        onClose={() => setShowMultiMonthModal(false)}
        onConfirm={handleMultiMonthPayment}
        selectedMonths={selectedMonths}
        setSelectedMonths={setSelectedMonths}
        year={selectedYear}
        isDark={isDark}
        isSaving={isSaving}
        perMonthAmount={totalPayablePerMonth}
        paidMonths={fees.filter(f => f.status === 'paid').map(f => f.month || f.period)}
        error={error}
      />
    </div>
  );
};

const MultiMonthModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedMonths: string[];
  setSelectedMonths: (m: string[]) => void;
  year: string;
  isDark: boolean;
  isSaving: boolean;
  perMonthAmount: number;
  paidMonths: string[];
  error: string | null;
}> = ({ isOpen, onClose, onConfirm, selectedMonths, setSelectedMonths, year, isDark, isSaving, perMonthAmount, paidMonths, error }) => {
  if (!isOpen) return null;

  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

  const toggleMonth = (m: string) => {
    if (paidMonths.includes(m)) return;
    if (selectedMonths.includes(m)) {
      setSelectedMonths(selectedMonths.filter(x => x !== m));
    } else {
      setSelectedMonths([...selectedMonths, m]);
    }
  };

  const total = selectedMonths.length * perMonthAmount;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-lg rounded-[3rem] p-8 border shadow-2xl overflow-hidden relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>মাস সিলেক্ট করুন</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select months to pay for {year}</p>
          </div>
          <button onClick={onClose} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500">
            <AlertCircle size={18} />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {months.map((name, i) => {
            const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`;
            const isPaid = paidMonths.includes(monthStr);
            const isSelected = selectedMonths.includes(monthStr);

            return (
              <button
                key={monthStr}
                disabled={isPaid}
                onClick={() => toggleMonth(monthStr)}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all relative ${isPaid ? (isDark ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-slate-50 border-slate-100 opacity-50') : isSelected ? (isDark ? 'bg-[#42f5e9]/10 border-[#42f5e9] scale-95' : 'bg-[#0fb5ab] text-white border-transparent scale-95 shadow-lg shadow-[#0fb5ab]/20') : (isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-100 hover:border-[#0fb5ab]/30')}`}
              >
                <p className={`text-[11px] font-black uppercase tracking-widest ${isSelected && !isDark ? 'text-white' : ''}`}>{name}</p>
                {isPaid ? (
                  <span className="text-[8px] font-black text-emerald-500 uppercase">পরিশোধিত</span>
                ) : isSelected ? (
                  <Check size={14} className={isDark ? 'text-[#42f5e9]' : 'text-white'} />
                ) : (
                  <span className="text-[8px] font-black text-slate-400 uppercase">৳{perMonthAmount}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className={`p-6 rounded-[2rem] border mb-8 flex items-center justify-between ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট পরিমাণ</p>
            <p className={`text-2xl font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>৳{total.toLocaleString('bn-BD')}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">নির্বাচিত মাস</p>
            <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{selectedMonths.length} টি</p>
          </div>
        </div>

        <button 
          onClick={onConfirm}
          disabled={isSaving || selectedMonths.length === 0}
          className={`w-full py-5 rounded-full font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 ${selectedMonths.length > 0 ? 'bg-[#0fb5ab] text-white shadow-xl shadow-[#0fb5ab]/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
        >
          {isSaving ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={18} /> পেমেন্ট সম্পন্ন করুন</>}
        </button>
      </motion.div>
    </div>
  );
};

export default MemberAccounting;
