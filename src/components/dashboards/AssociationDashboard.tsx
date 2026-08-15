
import React, { useState, useEffect } from 'react';
import { PiggyBank, Landmark, ShieldCheck, Banknote, Users, MessageSquare, Zap, Mic, Calendar, TrendingUp, DollarSign, ChevronRight, Activity } from 'lucide-react';
import { supabase } from 'supabase';
import { Language, Institution, Profile } from 'types';
import { t } from 'translations';
import CommitteeFinancialAnalytics from 'components/CommitteeFinancialAnalytics';
import { isValidUUID } from 'utils/validation';

interface DashboardProps {
  lang: Language;
  madrasah: Institution | null;
  profile?: Profile | null;
  institutionId?: string;
  dataVersion: number;
  setView: (view: string) => void;
  onNavigateToWallet?: () => void;
  onNavigateToAccounting?: () => void;
}

export const AssociationDashboard: React.FC<DashboardProps> = ({ 
  lang, madrasah, profile, institutionId, dataVersion, setView,
  onNavigateToWallet, onNavigateToAccounting
}) => {
  const [stats, setStats] = useState({
    totalSavers: 0,
    totalSavings: 0,
    activeLoans: 0,
    loanOutstanding: 0,
    smsBalance: 0,
    voiceBalance: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isValidUUID(institutionId)) return;
      setLoading(true);
      try {
        // Mocking some association stats since they are currently in localStorage in SpecializedModules
        const savingsData = JSON.parse(localStorage.getItem(`special_savings_${institutionId}`) || '[]');
        const loansData = JSON.parse(localStorage.getItem(`special_loans_${institutionId}`) || '[]');
        const qardData = JSON.parse(localStorage.getItem(`special_qard_hasan_${institutionId}`) || '[]');
        
        const { data: instRes } = await supabase.from('institutions').select('sms_balance, balance').eq('id', institutionId).maybeSingle();

        setStats({
          totalSavers: savingsData.length,
          totalSavings: savingsData.reduce((sum: number, s: any) => sum + (s.balance || 0), 0),
          activeLoans: loansData.filter((l: any) => l.status === 'approved').length + qardData.filter((q: any) => q.status === 'approved').length,
          loanOutstanding: loansData.reduce((sum: number, l: any) => sum + ((l.amount || 0) - (l.paid || 0)), 0),
          smsBalance: instRes?.sms_balance || 0,
          voiceBalance: instRes?.balance || 0
        });
      } catch (e) {
        console.error("Association Stats Error:", e);
      } finally {
        setLoading(setLoading(false) as any);
      }
    };
    fetchStats();
  }, [dataVersion, institutionId]);

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-8">
      {/* Association Specific Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 px-1">
        <button onClick={() => setView('savings')} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><PiggyBank size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-emerald-600'}`}>{stats.totalSavings.toLocaleString('bn-BD')} ৳</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">মোট সঞ্চয় আমানত</p>
          <div className="mt-3 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black">{stats.totalSavers} জন সঞ্চয়কারী</div>
        </button>

        <button onClick={() => setView('qard_hasan')} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><ShieldCheck size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-blue-600'}`}>{stats.activeLoans} টি</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">সক্রিয় ঋণ/বিনিয়োগ</p>
          <div className="mt-3 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black">সুদ-মুক্ত করজে হাসানা</div>
        </button>

        <button onClick={onNavigateToWallet} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Zap size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-amber-600'}`}>{stats.smsBalance.toLocaleString('bn-BD')}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">এসএমএস ব্যালেন্স</p>
          <div className="mt-3 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black">যোগাযোগ মাধ্যম</div>
        </button>

        <button onClick={onNavigateToAccounting} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-purple-50 text-purple-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Landmark size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-purple-600'}`}>{stats.loanOutstanding.toLocaleString('bn-BD')} ৳</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">বকেয়া কিস্তি/আদায়যোগ্য</p>
          <div className="mt-3 px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black">সমিতির মূলধন</div>
        </button>
      </div>

      {/* Main Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-1">
        <div className="lg:col-span-2 space-y-6">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-black font-noto text-[#0fb5ab]">আর্থিক কার্যক্রম বিশ্লেষণ</h3>
               <button onClick={onNavigateToAccounting} className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 hover:text-[#0fb5ab]">বিস্তারিত দেখুন <ChevronRight size={14} /></button>
            </div>
            {institutionId && (
              <CommitteeFinancialAnalytics 
                institutionId={institutionId} 
                lang={lang} 
                month={new Date().toISOString().slice(0, 7)}
                madrasah={madrasah}
                role={profile?.role || 'executive'}
                profile={profile}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
           {/* Association Quick Actions */}
           <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-sm`}>
             <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">কুইক অ্যাকশন</h3>
             <div className="grid grid-cols-1 gap-3">
               <button onClick={() => setView('savings')} className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-left">
                 <PiggyBank size={20} />
                 <div>
                   <p className="text-xs font-black">সঞ্চয় জমা</p>
                   <p className="text-[9px] opacity-70">সদস্যের সঞ্চয় হিসাব আপডেট করুন</p>
                 </div>
               </button>
               <button onClick={() => setView('qard_hasan')} className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all text-left">
                 <ShieldCheck size={20} />
                 <div>
                   <p className="text-xs font-black">নতুন ঋণ আবেদন</p>
                   <p className="text-[9px] opacity-70">সুদ-মুক্ত করজে হাসানা আবেদন</p>
                 </div>
               </button>
               <button onClick={() => setView('installments')} className="flex items-center gap-4 p-4 rounded-2xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all text-left">
                 <Activity size={20} />
                 <div>
                   <p className="text-xs font-black">কিস্তি আদায়</p>
                   <p className="text-[9px] opacity-70">দৈনিক/মাসিক কিস্তি কালেকশন</p>
                 </div>
               </button>
             </div>
           </div>

           {/* Membership Info */}
           <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-sm`}>
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">সদস্য তালিকা</h3>
               <Users size={18} className="text-slate-300" />
             </div>
             <div className="flex items-baseline gap-2">
               <span className="text-3xl font-black text-[#0fb5ab]">{stats.totalSavers}</span>
               <span className="text-xs font-bold text-slate-400">জন মোট সদস্য</span>
             </div>
             <div className="mt-6 pt-6 border-t border-slate-50">
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed font-noto italic">"সুদ-মুক্ত অর্থনীতি গড়ি, শরীয়াহ মোতাবেক সমাজ গড়ি।"</p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
