
import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, Department, LedgerEntry, Fee, Subscription } from 'types';
import { motion } from 'motion/react';
import { X, ArrowLeft, Download, Calendar, DollarSign, ArrowUpCircle, FileText, Loader2, TrendingUp, TrendingDown, Clock, CreditCard, Hash } from 'lucide-react';

interface MemberLedgerProps {
  member: any;
  madrasah: Institution;
  lang: Language;
  onBack: () => void;
  departments: Department[];
}

const MemberLedger: React.FC<MemberLedgerProps> = ({ member, madrasah, lang, onBack, departments }) => {
  const [loading, setLoading] = useState(true);
  const [fees, setFees] = useState<Subscription[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchMemberAccountingData();
  }, [member.id, selectedYear]);

  const fetchMemberAccountingData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all subscriptions for the member in the selected year
      const { data: feesData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('student_id', member.id)
        .like('period', `${selectedYear}-%`);
      
      if (feesData) setFees(feesData);

      // 2. Fetch ledger entries mentioning this member
      const { data: ledgerData } = await supabase
        .from('ledger')
        .select('*')
        .eq('institution_id', madrasah.id)
        .eq('category', 'Member Fee')
        .ilike('description', `%${member.name}%`);
      
      if (ledgerData) setLedgerEntries(ledgerData.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()));

      // 3. Fetch subscription structures for this member's department
      const { data: structureData } = await supabase
        .from('subscription_structures')
        .select('*')
        .eq('institution_id', madrasah.id)
        .or(`department_id.eq.${member.department_id},department_id.is.null`);
      
      if (structureData) setStructures(structureData);

    } catch (error) {
      console.error('Error fetching student accounting:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDark = madrasah.theme === 'dark';
  const className = departments.find(c => c.id === member.department_id)?.name || '';

  const totalPayablePerMonth = structures.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalPaid = ledgerEntries.reduce((sum, l) => sum + Number(l.amount), 0);
  
  // Calculate total due for the year up to current month
  const currentMonth = new Date().getMonth() + 1;
  const totalPayableYearToDate = totalPayablePerMonth * currentMonth;
  const totalDue = Math.max(0, totalPayableYearToDate - totalPaid);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-5">
          <button 
            onClick={onBack}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all active:scale-90 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className={`text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>{member.name}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{className} • রোল: {member.roll || '-'}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <div className="relative">
              <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`h-11 px-5 pr-10 rounded-2xl border text-[11px] font-black uppercase outline-none transition-all appearance-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}
              >
                  {[0, 1, 2].map(offset => {
                      const year = (new Date().getFullYear() - offset).toString();
                      return <option key={year} value={year}>{year}</option>;
                  })}
              </select>
              <Calendar className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={14} />
            </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400">
          <Loader2 className="animate-spin mb-6 text-[#0fb5ab]" size={48} />
          <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">প্রসেস হচ্ছে...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-1">
          {/* Left Column: Summary & Monthly Status */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <motion.div 
                whileHover={{ y: -5 }}
                className={`p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-[#42f5e9]/10 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
                    <TrendingUp size={20} />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">মাসিক ফি</span>
                </div>
                <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>৳{totalPayablePerMonth.toLocaleString('bn-BD')}</p>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5 }}
                className={`p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <DollarSign size={20} />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">পরিশোধিত</span>
                </div>
                <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-emerald-600'}`}>৳{totalPaid.toLocaleString('bn-BD')}</p>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5 }}
                className={`p-6 rounded-[2.5rem] border-2 shadow-sm transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                    <TrendingDown size={20} />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">মোট বকেয়া</span>
                </div>
                <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-red-600'}`}>৳{totalDue.toLocaleString('bn-BD')}</p>
              </motion.div>
            </div>

            {/* Monthly Grid */}
            <div className={`p-10 rounded-[3.5rem] border shadow-2xl relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 shadow-black/20' : 'bg-white border-white/20 shadow-blue-900/5'}`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
                <div>
                  <h3 className={`text-lg font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>মাসিক ফি স্ট্যাটাস</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{selectedYear} সালের সাবস্ক্রিপশন কার্ড</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Paid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-200"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Partial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unpaid</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`;
                  const monthName = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'][i];
                  
                  const monthFee = fees.find(f => f.period === monthStr);
                  const status = monthFee?.status || 'unpaid';
                  const paidAmt = (Number(monthFee?.amount_paid) || 0) + (Number(monthFee?.discount) || 0);

                  return (
                    <motion.div 
                      whileHover={{ scale: 1.05 }}
                      key={monthStr} 
                      className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col justify-between h-32 ${status === 'paid' ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-100') : status === 'partial' ? (isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-100') : (isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100')}`}
                    >
                      <p className={`text-[11px] font-black uppercase tracking-widest ${status === 'paid' ? 'text-emerald-600' : status === 'partial' ? 'text-orange-600' : 'text-slate-400'}`}>{monthName}</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${status === 'paid' ? 'bg-emerald-500 text-white' : status === 'partial' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}
                          </span>
                          {paidAmt > 0 && <span className={`text-[10px] font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>৳{paidAmt}</span>}
                        </div>
                        {status === 'unpaid' && <div className="h-1 bg-slate-200 rounded-full w-full" />}
                        {status !== 'unpaid' && (
                          <div className={`h-1 rounded-full w-full ${status === 'paid' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Recent Transactions */}
          <div className="space-y-6">
            <div className={`p-10 rounded-[3.5rem] border shadow-2xl h-full relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 shadow-black/20' : 'bg-white border-white/20 shadow-blue-900/5'}`}>
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className={`text-lg font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>লেনদেনের ইতিহাস</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">এই সদস্যের সর্বশেষ লেনদেনসমূহ</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
                  <Clock size={22} />
                </div>
              </div>

              <div className="space-y-6">
                {ledgerEntries.length > 0 ? (
                  ledgerEntries.map((entry, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      key={entry.id} 
                      className={`relative pl-8 pb-8 ${idx === ledgerEntries.length - 1 ? '' : 'border-l-2 border-dashed border-slate-100'}`}
                    >
                      <div className={`absolute -left-[11px] top-0 w-5 h-5 rounded-full border-4 shadow-sm flex items-center justify-center ${isDark ? 'bg-emerald-500 border-slate-800 shadow-emerald-900/50' : 'bg-emerald-500 border-white shadow-emerald-200'}`}></div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className={`text-base font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+ ৳{entry.amount.toLocaleString('bn-BD')}</p>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Calendar size={10} />
                            <span className="text-[9px] font-bold">{new Date(entry.transaction_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-white shadow-inner'}`}>
                          <p className="text-[11px] text-slate-500 font-bold leading-relaxed line-clamp-2 italic">"{entry.description.split(' (')[0]}"</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-24 flex flex-col items-center justify-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 border-2 border-dashed border-slate-100">
                      <FileText size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">কোনো লেনদেন নেই</p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase">ইতিহাস খালি রয়েছে</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MemberLedger;
