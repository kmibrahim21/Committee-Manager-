import React, { useState, useEffect } from 'react';
import { supabase } from 'supabase';
import { Institution, Language, UserRole, Department, Profile } from 'types';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, ArrowLeft, RefreshCw, BarChart3, AlertCircle, Coins, Settings } from 'lucide-react';
import { FlexibleSubscriptionEngine } from 'components/finance/FlexibleSubscriptionEngine';
import { StandardSubscriptionEngine } from 'components/finance/StandardSubscriptionEngine';
import MemberLedger from 'components/finance/MemberLedger';
import { sortMadrasahClasses } from 'pages/Departments';

interface SubscriptionsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const Subscriptions: React.FC<SubscriptionsProps> = ({ lang, madrasah, onBack, role, profile }) => {
  const isDark = madrasah?.theme === 'dark';
  const [activeTab, setActiveTab] = useState<'fees' | 'structures'>('fees');
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<any>(null);
  const [departments, setClasses] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalDue, setTotalDue] = useState(0);

  const feeEngine = madrasah?.config_json?.fee_engine || 'school';

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
      fetchStats();
    }
  }, [madrasah?.id]);

  const fetchClasses = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from('departments').select('*').eq('institution_id', madrasah.id);
      if (data) {
        let filteredClasses = data;
        if (role === 'executive' && profile?.permissions?.allowed_departments) {
          filteredClasses = data.filter(cls => profile.permissions?.allowed_departments?.includes(cls.id));
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
      const { data: feesData } = await supabase
        .from('fees')
        .select('amount_paid, amount_due')
        .eq('institution_id', madrasah.id);
      
      if (feesData) {
        const paid = feesData.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0);
        const due = feesData.reduce((acc, curr) => acc + (Number(curr.amount_due) || 0), 0);
        setTotalCollected(paid);
        setTotalDue(due);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-white text-slate-700 border-slate-200'}`}
          >
            <ArrowLeft size={20}/>
          </button>
          <div>
            <h1 className={`text-lg font-black font-noto leading-none ${isDark ? 'text-slate-100' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'সাবস্ক্রিপশন মডিউল' : 'Subscription Module'}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              {lang === 'bn' ? 'সদস্যদের চাঁদা এবং ফি ব্যবস্থাপনা' : 'Member dues and fee management'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => { fetchClasses(); fetchStats(); }} 
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-200'}`}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
        <div className={`p-6 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
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
            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
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

      {/* Main Tabs */}
      <div className="px-1">
        <div className={`flex p-1.5 rounded-[2rem] border overflow-x-auto no-scrollbar gap-1 ${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-slate-100/80 border-slate-200/50'}`}>
          <button 
            onClick={() => setActiveTab('fees')} 
            className={`flex-1 min-w-[120px] py-3 text-[11px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'fees' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
          >
            <CreditCard size={14} />
            <span>{lang === 'bn' ? 'সদস্য চাঁদা' : 'Member Subscriptions'}</span>
          </button>
          <button 
            onClick={() => setActiveTab('structures')} 
            className={`flex-1 min-w-[120px] py-3 text-[11px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'structures' ? (isDark ? 'bg-slate-900 text-[#42f5e9] shadow-sm border border-slate-700/50' : 'bg-white text-[#0fb5ab] shadow-sm border border-[#42f5e9]/20') : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Settings size={14} />
            <span>{lang === 'bn' ? 'চাঁদা প্যাকেজ/সেটিংস' : 'Subscription Settings'}</span>
          </button>
        </div>
      </div>

      {selectedStudentForDetail ? (
        <MemberLedger 
          member={selectedStudentForDetail}
          madrasah={madrasah!}
          lang={lang}
          departments={departments}
          onBack={() => {
            setSelectedStudentForDetail(null);
            fetchStats();
          }}
        />
      ) : (
        <div className="px-1">
          {madrasah && (
            <>
              {feeEngine === 'school' && (
                <FlexibleSubscriptionEngine 
                  activeTab={activeTab} 
                  madrasah={madrasah} 
                  lang={lang === 'bn' ? 'bn' : 'en'} 
                  departments={departments} 
                  onStudentClick={(student) => setSelectedStudentForDetail(student)} 
                  role={role} 
                  profile={profile} 
                />
              )}
              {feeEngine === 'qawmi' && (
                <StandardSubscriptionEngine 
                  activeTab={activeTab} 
                  madrasah={madrasah} 
                  lang={lang === 'bn' ? 'bn' : 'en'} 
                  departments={departments} 
                  onStudentClick={(student) => setSelectedStudentForDetail(student)} 
                  role={role} 
                  profile={profile} 
                />
              )}
              {feeEngine !== 'school' && feeEngine !== 'qawmi' && (
                <FlexibleSubscriptionEngine 
                  activeTab={activeTab} 
                  madrasah={madrasah} 
                  lang={lang === 'bn' ? 'bn' : 'en'} 
                  departments={departments} 
                  onStudentClick={(student) => setSelectedStudentForDetail(student)} 
                  role={role} 
                  profile={profile} 
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Subscriptions;
