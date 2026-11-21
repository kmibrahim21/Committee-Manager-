
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from 'supabase';
import { Institution, LedgerEntry, Language, UserRole, Department, Profile, Member } from 'types';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, Plus, ArrowUpCircle, ArrowDownCircle, Loader2, Save, X, DollarSign, Tag, FileText, RefreshCw, Bell, Heart, Users, BarChart3, AlertCircle, CreditCard, Calendar as CalendarIcon, Hash, BookmarkPlus, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import CommitteeFinancialAnalytics from 'components/CommitteeFinancialAnalytics';
import { FlexibleSubscriptionEngine } from 'components/finance/FlexibleSubscriptionEngine';
import { StandardSubscriptionEngine } from 'components/finance/StandardSubscriptionEngine';
import MemberLedger from 'components/finance/MemberLedger';
import { sortMadrasahClasses } from 'pages/Departments';

interface AccountingProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
  onMemberClick?: (member: Member) => void;
  dataVersion?: number;
}

const CommitteeFinances: React.FC<AccountingProps> = ({ lang, madrasah, onBack, role, profile, onMemberClick, dataVersion }) => {
  const isTeacher = role === 'executive';
  const canManageAccounting = role === 'org_admin' || role === 'super_admin' || role === 'accountant' || !!profile?.permissions?.can_manage_accounting;

  const [activeTab, setActiveTab] = useState<'summary' | 'ledger' | 'fees' | 'structures' | 'add-ledger'>('fees');
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [departments, setClasses] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'income' | 'expense' | 'qard'>('all');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{ show: boolean; type: 'error' | 'success'; message: string }>({
    show: false,
    type: 'error',
    message: ''
  });

  const handleDeleteLedger = async (id: string) => {
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('ledger').delete().eq('id', id);
      if (error) throw error;
      setLedger(prev => prev.filter(item => item.id !== id));
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      setFeedbackModal({ show: true, type: 'error', message: err.message || 'Error occurred' });
    } finally {
      setIsDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  // Ledger State
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [templates, setTemplates] = useState<any[]>([]);

  // Qard Hasan Integration States
  const [txType, setTxType] = useState<'general' | 'qard'>('general');
  const [qardHasanLoans, setQardHasanLoans] = useState<any[]>([]);
  const [selectedQardLoanId, setSelectedQardLoanId] = useState('');
  const [qardReceiptNo, setQardReceiptNo] = useState('');

  useEffect(() => {
    if (madrasah?.id) {
      const stored = localStorage.getItem(`special_qard_hasan_${madrasah.id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setQardHasanLoans(parsed.filter((app: any) => app.status === 'approved'));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [madrasah?.id, activeTab]);

  useEffect(() => {
    if (madrasah?.id) {
      const saved = localStorage.getItem(`ledger_templates_${madrasah.id}`);
      if (saved) setTemplates(JSON.parse(saved));
    }
  }, [madrasah?.id]);

  const saveTemplate = () => {
    if (!amount || !category) {
      setFeedbackModal({
        show: true,
        type: 'error',
        message: lang === 'bn' ? 'ক্যাটাগরি এবং টাকার পরিমাণ প্রদান করুন' : 'Please provide category and amount'
      });
      return;
    }
    const newTemplate = { id: Date.now().toString(), type, category: category.trim(), amount: amount.trim() };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    if (madrasah?.id) {
      localStorage.setItem(`ledger_templates_${madrasah.id}`, JSON.stringify(updated));
    }
  };

  const deleteTemplate = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = templates.filter(t => t.id !== id);
      setTemplates(updated);
      if (madrasah?.id) {
          localStorage.setItem(`ledger_templates_${madrasah.id}`, JSON.stringify(updated));
      }
  }

  const feeEngine = madrasah?.config_json?.fee_engine || 'school';

  useEffect(() => {
    if (madrasah) {
      fetchData();
      fetchClasses();
    }
  }, [madrasah?.id, activeTab, dataVersion]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    const { data } = await supabase.from('departments').select('*').eq('institution_id', madrasah.id);
    if (data) {
      let filteredClasses = data;
      if (role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0) {
        filteredClasses = data.filter(cls => profile.permissions.allowed_departments.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const fetchData = async () => {
    if (!madrasah?.id) return;
    
    if (activeTab === 'summary' || activeTab === 'ledger') {
      setLoading(true);
      try {
        let query = supabase.from('ledger').select('*').eq('institution_id', madrasah.id);
        const config: any = madrasah?.config_json || {};
        if (config.accounting_start_date) {
          query = query.gte('transaction_date', config.accounting_start_date);
        }
        if (config.accounting_end_date) {
          query = query.lte('transaction_date', config.accounting_end_date);
        }
        const { data } = await query.order('transaction_date', { ascending: false });
        if (data) {
          setLedger(data);
        }
        setRefreshKey(prev => prev + 1);
      } catch (e: any) { 
        console.error("Accounting Fetch Error:", e);
      } finally { setLoading(false); }
    }
  };

  const resetLedgerForm = () => {
    setEditingLedgerId(null);
    setAmount('');
    setCategory('');
    setDesc('');
    setSelectedQardLoanId('');
    setQardReceiptNo('');
    setTxType('general');
    setTransactionDate(new Date().toISOString().split('T')[0]);
  };

  const handleAddLedger = async () => {
    if (!madrasah || !amount || !category) return;
    setIsSaving(true);
    try {
      if (editingLedgerId) {
        const { error } = await supabase
          .from('ledger')
          .update({
            type: type,
            amount: parseFloat(amount),
            category: category.trim(),
            description: desc.trim(),
            transaction_date: transactionDate
          })
          .eq('id', editingLedgerId)
          .eq('institution_id', madrasah.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ledger').insert({
          institution_id: madrasah.id,
          type: type,
          amount: parseFloat(amount),
          category: category.trim(),
          description: desc.trim(),
          transaction_date: transactionDate
        });
        if (error) throw error;
      }
      resetLedgerForm();
      setActiveTab('ledger');
      fetchData();
    } catch (err: any) { 
      setFeedbackModal({ show: true, type: 'error', message: err.message || 'Error saving transaction' }); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className={`space-y-6 animate-in fade-in duration-500 pb-24 ${isDark ? 'text-slate-200' : ''}`}>
      {/* Header Section */}
      <div className={`flex items-center justify-between px-4 py-2 backdrop-blur-md sticky top-0 z-50 -mx-4 border-b ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/50 border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all active:scale-90 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'}`}
          >
            <Calculator size={18}/>
          </button>
          <div>
            <h1 className={`text-lg font-black font-noto leading-none ${isDark ? 'text-slate-100' : 'text-[#0fb5ab]'}`}>চাঁদা ও হিসাব</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">ফান্ড এবং হিসাব ব্যবস্থাপনা</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => fetchData()} 
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-200'} ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={16}/>
            </button>
            <button 
              onClick={() => setActiveTab('summary')} 
              className={`px-4 h-10 rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-xs font-black uppercase tracking-widest border ${activeTab === 'summary' ? (isDark ? 'bg-[#42f5e9]/20 text-[#42f5e9] border-[#42f5e9]/30' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20') : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-600 border-slate-200')}`}
            >
              <BarChart3 size={18}/>
              <span className="hidden sm:inline">ড্যাশবোর্ড</span>
            </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="px-1">
        <div className={`flex p-1.5 rounded-[2rem] border overflow-x-auto no-scrollbar gap-1 ${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-slate-100/80 border-slate-200/50'}`}>
          <button 
            onClick={() => { setEditingLedgerId(null); setActiveTab('fees'); }} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'fees' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
          >
            সদস্য চাঁদা
          </button>
          <button 
            onClick={() => { setEditingLedgerId(null); setActiveTab('structures'); }} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'structures' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
          >
            সেটিং
          </button>
          <button 
            onClick={() => setActiveTab('add-ledger')} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'add-ledger' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
          >
            {editingLedgerId ? 'এডিট লেনদেন' : 'লেনদেন'}
          </button>
          <button 
            onClick={() => { setEditingLedgerId(null); setActiveTab('ledger'); }} 
            className={`flex-1 min-w-[90px] py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 ${activeTab === 'ledger' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
          >
            ইতিহাস
          </button>
        </div>
      </div>

      {selectedStudentForDetail ? (
        <MemberLedger 
          member={selectedStudentForDetail}
          madrasah={madrasah!}
          lang={lang}
          departments={departments}
          onBack={() => setSelectedStudentForDetail(null)}
        />
      ) : (
        <>
          {(activeTab === 'fees' || activeTab === 'structures') && madrasah && (
            <>
              {feeEngine === 'school' && (
                <FlexibleSubscriptionEngine activeTab={activeTab} madrasah={madrasah} lang={lang} departments={departments} onStudentClick={(student) => onMemberClick ? onMemberClick(student) : setSelectedStudentForDetail(student)} role={role} profile={profile} />
              )}
              {feeEngine === 'qawmi' && (
                <StandardSubscriptionEngine activeTab={activeTab} madrasah={madrasah} lang={lang} departments={departments} onStudentClick={(student) => onMemberClick ? onMemberClick(student) : setSelectedStudentForDetail(student)} role={role} profile={profile} />
              )}
              {/* Default to School Engine for others for now */}
              {feeEngine !== 'school' && feeEngine !== 'qawmi' && (
                <FlexibleSubscriptionEngine activeTab={activeTab} madrasah={madrasah} lang={lang} departments={departments} onStudentClick={(student) => onMemberClick ? onMemberClick(student) : setSelectedStudentForDetail(student)} role={role} profile={profile} />
              )}
            </>
          )}
          
          {activeTab === 'summary' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-5">
          <div className={`rounded-[2.5rem] p-1 border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white/40 border-white/20'} backdrop-blur-sm`}>
            {madrasah && (
              <CommitteeFinancialAnalytics 
                institutionId={madrasah.id} 
                lang={lang} 
                month={new Date().toISOString().slice(0, 7)} 
                refreshKey={refreshKey}
                departments={departments}
                madrasah={madrasah}
                role={role}
                profile={profile}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 px-2"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
              <h3 className={`text-lg font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>লেনদেনের ইতিহাস</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ledger.length} টি লেনদেন সম্পন্ন হয়েছে</p>
            </div>
            
            <div className={`flex p-1.5 rounded-2xl border shadow-inner w-fit ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
              <button 
                onClick={() => setLedgerFilter('all')}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${ledgerFilter === 'all' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
              >
                সব
              </button>
              <button 
                onClick={() => setLedgerFilter('income')}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${ledgerFilter === 'income' ? (isDark ? 'bg-slate-900 text-emerald-400 shadow-sm' : 'bg-white text-emerald-500 shadow-sm') : 'text-slate-400'}`}
              >
                আয়
              </button>
              <button 
                onClick={() => setLedgerFilter('expense')}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${ledgerFilter === 'expense' ? (isDark ? 'bg-slate-900 text-red-400 shadow-sm' : 'bg-white text-red-500 shadow-sm') : 'text-slate-400'}`}
              >
                ব্যয়
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[#0fb5ab]" size={40} /></div>
          ) : ledger.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode='popLayout'>
                {ledger.filter(e => {
                  if (ledgerFilter === 'all') return true;
                  if (ledgerFilter === 'qard') return e.category === 'করজে হাসানা কিস্তি আদায়';
                  return e.type === ledgerFilter;
                }).map((entry, index) => {
                  let displayName = entry.category;
                  let details = '';
                  let feeType = '';

                  if (entry.category === 'Member Fee') {
                    const parts = entry.description.split(' - ');
                    if (parts.length >= 2) {
                      feeType = parts[0];
                      const namePart = parts.slice(1).join(' - ');
                      const nameMatch = namePart.match(/^(.*?)\s*\((.*?)\)/);
                      if (nameMatch) {
                        displayName = nameMatch[1];
                        details = nameMatch[2];
                      } else {
                        displayName = namePart;
                      }
                    }
                  }

                  const isConfirming = confirmDeleteId === entry.id;

                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      key={entry.id} 
                      className={`group p-6 rounded-[2.5rem] border-2 transition-all shadow-sm ${isConfirming ? 'border-red-200 bg-red-50/10' : (isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:shadow-xl hover:-translate-y-1' : 'bg-white border-slate-100 hover:border-blue-100 hover:shadow-xl hover:-translate-y-1')}`}
                    >
                      {isConfirming ? (
                        <div className="h-full flex flex-col justify-between min-h-[140px]">
                          <div className="space-y-1">
                            <h5 className="font-black text-sm text-red-600 font-noto">
                              {lang === 'bn' ? 'লেনদেনটি ডিলিট করতে চান?' : 'Confirm Deletion?'}
                            </h5>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              ৳{entry.amount.toLocaleString('bn-BD')} ({entry.category})
                            </p>
                          </div>
                          <div className="flex gap-2 pt-4">
                            <button
                              onClick={() => handleDeleteLedger(entry.id)}
                              disabled={isDeleting === entry.id}
                              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              {isDeleting === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              {lang === 'bn' ? 'হ্যাঁ, ডিলিট' : 'Yes, Delete'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={isDeleting === entry.id}
                              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                              {lang === 'bn' ? 'না' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border transition-transform group-hover:rotate-12 ${entry.type === 'income' ? (isDark ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (isDark ? 'bg-red-900/30 text-red-400 border-red-800/50' : 'bg-red-50 text-red-600 border-red-100')}`}>
                              {entry.type === 'income' ? <ArrowUpCircle size={28} /> : <ArrowDownCircle size={28} />}
                            </div>
                            <div className="flex items-start gap-1">
                              <div className="text-right mr-1">
                                <p className={`text-xl font-black tracking-tight ${entry.type === 'income' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600')}`}>
                                  {entry.type === 'income' ? '+' : '-'} ৳{entry.amount.toLocaleString('bn-BD')}
                                </p>
                              </div>
                              {canManageAccounting && (
                                <button
                                  onClick={() => {
                                    setEditingLedgerId(entry.id);
                                    setType(entry.type as any);
                                    setAmount(entry.amount.toString());
                                    setCategory(entry.category || '');
                                    setDesc(entry.description || '');
                                    setTransactionDate(entry.transaction_date ? entry.transaction_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
                                    setActiveTab('add-ledger');
                                  }}
                                  className={`p-1.5 rounded-xl border transition-colors ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-sky-400' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-blue-600'}`}
                                  title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => setConfirmDeleteId(entry.id)}
                                className={`p-1.5 rounded-xl border transition-colors ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-red-400' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-red-500'}`}
                                title={lang === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <h5 className={`font-black font-noto text-base leading-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{displayName}</h5>
                              {entry.category === 'Member Fee' ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-slate-400 font-bold">{details}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                                  <span className="text-[9px] text-[#0fb5ab] font-black uppercase">{feeType}</span>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 font-medium line-clamp-1 mt-1">{entry.description}</p>
                              )}
                            </div>

                            <div className={`pt-3 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                              <div className="flex items-center gap-2">
                                <CalendarIcon size={12} className="text-slate-400" />
                                <span className="text-[10px] text-slate-500 font-bold">
                                  {new Date(entry.transaction_date).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{entry.category}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className={`text-center py-32 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-slate-100 text-slate-200'}`}>
                  <FileText size={40} />
               </div>
               <h4 className="text-lg font-black text-slate-400 font-noto">কোনো লেনদেন নেই</h4>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">অনুগ্রহ করে নতুন লেনদেন যোগ করুন</p>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'add-ledger' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6 sm:space-y-8 max-w-3xl mx-auto px-2 sm:px-4"
        >
          <div className={`rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-10 space-y-8 sm:space-y-10 border shadow-2xl relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-blue-50 shadow-blue-900/5'}`}>
             <div className="absolute top-0 right-0 w-64 h-64 bg-[#42f5e9]/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
             
             <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-xl sm:text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                    {editingLedgerId ? 'লেনদেন আপডেট করুন' : 'নতুন লেনদেন'}
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {editingLedgerId ? 'পূর্বের এন্ট্রি সংশোধন করুন' : 'পেমেন্ট এবং ফান্ড এন্ট্রি করুন'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {editingLedgerId && (
                    <button
                      type="button"
                      onClick={() => {
                        resetLedgerForm();
                        setActiveTab('ledger');
                      }}
                      className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    >
                      <X size={14} />
                      বাতিল
                    </button>
                  )}
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-[#42f5e9]' : 'bg-blue-50 text-blue-600'}`}>
                    <Calculator size={24} className="sm:w-7 sm:h-7" />
                  </div>
                </div>
             </div>

             <div className={`flex p-1.5 sm:p-2 rounded-2xl sm:rounded-[2rem] border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                <button 
                  onClick={() => setType('income')} 
                  className={`flex-1 py-3 sm:py-4 rounded-xl sm:rounded-[1.6rem] text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${type === 'income' ? (isDark ? 'bg-slate-900 text-emerald-400 shadow-lg border border-slate-700/50' : 'bg-white text-emerald-600 shadow-md border border-emerald-100') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <ArrowUpCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                  আয়
                </button>
                <button 
                  onClick={() => setType('expense')} 
                  className={`flex-1 py-3 sm:py-4 rounded-xl sm:rounded-[1.6rem] text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${type === 'expense' ? (isDark ? 'bg-slate-900 text-red-400 shadow-lg border border-slate-700/50' : 'bg-white text-red-600 shadow-md border border-red-100') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <ArrowDownCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                  ব্যয়
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">টাকার পরিমাণ</label>
                    <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2563EB] transition-colors">
                        <DollarSign size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      <input 
                        type="number" 
                        className={`w-full h-16 sm:h-20 rounded-[1.8rem] sm:rounded-[2.2rem] pl-16 pr-6 sm:pr-8 font-black text-xl sm:text-2xl outline-none border-2 transition-all placeholder:text-slate-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30 focus:bg-slate-900' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/20 focus:bg-white'}`} 
                        placeholder="0.00" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                      />
                    </div>
                  </div>

                  {txType === 'general' ? (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">ক্যাটাগরি</label>
                      <div className="relative group">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2563EB] transition-colors">
                          <Tag size={18} className="sm:w-5 sm:h-5" />
                        </div>
                        <input 
                          type="text" 
                          className={`w-full h-14 sm:h-16 rounded-[1.5rem] sm:rounded-[1.8rem] pl-16 pr-6 font-black text-sm outline-none border-2 transition-all placeholder:text-slate-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30 focus:bg-slate-900' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/20 focus:bg-white'}`} 
                          placeholder="যেমন: অফিস খরচ" 
                          value={category} 
                          onChange={(e) => setCategory(e.target.value)} 
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 px-1 pt-1">
                        {(type === 'income' ? ['মাসিক চাঁদা', 'অনুদান', 'বিশেষ দান'] : ['অফিস খরচ', 'কমিটি মিটিং', 'বেতন']).map(suggestion => (
                            <button 
                              key={suggestion}
                              type="button"
                              onClick={() => setCategory(suggestion)}
                              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-wider border transition-all ${category === suggestion ? (isDark ? 'bg-[#42f5e9]/20 text-[#42f5e9] border-[#42f5e9]/30 shadow-sm' : 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm') : (isDark ? 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200')}`}
                            >
                              {suggestion}
                            </button>
                        ))}
                        {templates.filter(t => t.type === type).map(t => (
                            <div key={t.id} className="relative group">
                              <button 
                                type="button"
                                onClick={() => { setCategory(t.category); setAmount(t.amount); }}
                                className={`px-3 py-1.5 sm:px-4 sm:py-2 pr-8 sm:pr-10 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-wider border transition-all ${category === t.category && amount === t.amount ? (isDark ? 'bg-[#42f5e9]/20 text-[#42f5e9] border-[#42f5e9]/30 shadow-sm' : 'bg-blue-50 text-[#1E3A8A] border-slate-100 shadow-sm') : (isDark ? 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200')}`}
                              >
                                {t.category} - ৳{t.amount}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => deleteTemplate(t.id, e)}
                                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                        ))}
                        {amount && category && !templates.find(t => t.type === type && t.category === category && t.amount === amount) && (
                          <button
                            type="button"
                            onClick={saveTemplate}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-wider border border-dashed transition-all flex items-center gap-1 ${isDark ? 'border-[#42f5e9]/50 text-[#42f5e9] hover:bg-[#42f5e9]/10' : 'border-[#0fb5ab]/50 text-[#0fb5ab] hover:bg-[#0fb5ab]/10'}`}
                          >
                            <BookmarkPlus size={12} />
                            সেভ টেমপ্লেট
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">ঋণগ্রহীতা সদস্য</label>
                        <select 
                          className={`w-full h-14 sm:h-16 rounded-[1.5rem] sm:rounded-[1.8rem] px-6 font-black text-sm outline-none border-2 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30 focus:bg-slate-900' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/20 focus:bg-white'}`}
                          value={selectedQardLoanId}
                          onChange={(e) => {
                            const loanId = e.target.value;
                            setSelectedQardLoanId(loanId);
                            const loan = qardHasanLoans.find(l => l.id === loanId);
                            if (loan) {
                              setAmount(loan.installmentAmount.toString());
                              setCategory("করজে হাসানা কিস্তি আদায়");
                              setDesc(`কিস্তি আদায় - ${loan.name} (${loan.phone})`);
                            } else {
                              setAmount('');
                              setCategory('করজে হাসানা কিস্তি আদায়');
                              setDesc('');
                            }
                          }}
                        >
                          <option value="">সদস্য নির্বাচন করুন</option>
                          {qardHasanLoans.map(loan => {
                            const repayments = loan.repayments || [];
                            const paid = repayments.reduce((sum: number, r: any) => sum + r.amount, 0);
                            const remaining = loan.amount - paid;
                            return (
                              <option key={loan.id} value={loan.id}>
                                {loan.name} ({loan.phone}) - বকেয়া: ৳{remaining.toLocaleString('bn-BD')} (কিস্তি: ৳{loan.installmentAmount})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">রসিদ নম্বর (Receipt No)</label>
                        <input 
                          type="text" 
                          className={`w-full h-14 sm:h-16 rounded-[1.5rem] sm:rounded-[1.8rem] px-6 font-black text-sm outline-none border-2 transition-all placeholder:text-slate-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/20'}`}
                          placeholder="যেমন: RECP-101 (ফাঁকা রাখলে অটো জেনারেট হবে)"
                          value={qardReceiptNo}
                          onChange={(e) => setQardReceiptNo(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">তারিখ</label>
                    <div className="relative">
                      <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-300">
                        <CalendarIcon size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </div>
                      <input 
                        type="date" 
                        className={`w-full h-14 sm:h-16 rounded-[1.5rem] sm:rounded-[1.8rem] pl-12 sm:pl-14 pr-4 font-black text-[10px] sm:text-[11px] outline-none border-2 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/20'}`}
                        value={transactionDate}
                        onChange={(e) => setTransactionDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">বিবরণ</label>
                    <div className="relative group">
                      <div className="absolute left-6 top-6 text-slate-300 group-focus-within:text-[#0fb5ab] transition-colors">
                        <FileText size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <textarea 
                        className={`w-full h-24 sm:h-[104px] rounded-2xl sm:rounded-[2rem] pl-16 pr-6 sm:pr-8 py-5 sm:py-6 font-bold text-sm outline-none border-2 transition-all resize-none placeholder:text-slate-300 ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30 focus:bg-slate-900' : 'bg-slate-50 border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/20 focus:bg-white'}`} 
                        placeholder="লেনদেন সম্পর্কে লিখুন..." 
                        value={desc} 
                        onChange={(e) => setDesc(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
             </div>

             <motion.button 
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
               onClick={handleAddLedger} 
               disabled={isSaving} 
               className="w-full h-16 sm:h-20 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-2xl sm:rounded-[2.2rem] shadow-premium flex items-center justify-center gap-3 sm:gap-4 transition-all text-sm sm:text-base uppercase tracking-[0.15em] sm:tracking-[0.2em] disabled:opacity-50"
             >
               {isSaving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={20} className="sm:w-6 sm:h-6" /> {editingLedgerId ? 'আপডেট সংরক্ষণ করুন' : 'সংরক্ষণ করুন'}</>}
             </motion.button>
          </div>
        </motion.div>
      )}
    </>
  )}

  {/* ADD LEDGER MODAL REMOVED */}

      {/* Floating Action Button for New Transaction removed as per request */}
    </div>
  );
};

export default CommitteeFinances;
