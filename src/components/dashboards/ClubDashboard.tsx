
import React, { useState, useEffect } from 'react';
import { Trophy, Users, Camera, Award, Calendar, Zap, Mic, MessageSquare, TrendingUp, ChevronRight, Activity, Star } from 'lucide-react';
import { supabase } from 'supabase';
import { Language, Institution, Profile } from 'types';
import { t } from 'translations';
import { isValidUUID } from 'utils/validation';

interface DashboardProps {
  lang: Language;
  madrasah: Institution | null;
  profile?: Profile | null;
  institutionId?: string;
  dataVersion: number;
  setView: (view: string) => void;
  onNavigateToWallet?: () => void;
  onNavigateToMembers?: () => void;
}

export const ClubDashboard: React.FC<DashboardProps> = ({ 
  lang, madrasah, profile, institutionId, dataVersion, setView,
  onNavigateToWallet, onNavigateToMembers
}) => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeTournaments: 0,
    totalEvents: 0,
    smsBalance: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isValidUUID(institutionId)) return;
      setLoading(true);
      try {
        const tournamentData = JSON.parse(localStorage.getItem(`special_tournaments_${institutionId}`) || '[]');
        const { count: memberCount } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
        const { count: eventCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
        const { data: instRes } = await supabase.from('institutions').select('sms_balance').eq('id', institutionId).maybeSingle();

        setStats({
          totalMembers: memberCount || 0,
          activeTournaments: tournamentData.length,
          totalEvents: eventCount || 0,
          smsBalance: instRes?.sms_balance || 0
        });
      } catch (e) {
        console.error("Club Stats Error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [dataVersion, institutionId]);

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-8">
      {/* Club Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 px-1">
        <button onClick={onNavigateToMembers} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-purple-50 text-purple-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Users size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-purple-600'}`}>{stats.totalMembers}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ক্লাব মেম্বারস</p>
        </button>

        <button onClick={() => setView('tournaments')} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Trophy size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-amber-600'}`}>{stats.activeTournaments}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">টুর্নামেন্ট ও ইভেন্ট</p>
        </button>

        <button onClick={onNavigateToWallet} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Zap size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-blue-600'}`}>{stats.smsBalance}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">এসএমএস ব্যালেন্স</p>
        </button>

        <button onClick={() => setView('gallery')} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-pink-50 text-pink-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Camera size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-pink-600'}`}>ফটো গ্যালারি</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">স্মৃতিচারণ বোর্ড</p>
        </button>
      </div>

      {/* Club Specific Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-1">
        <div className="lg:col-span-2 space-y-6">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-sm`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black font-noto text-[#0fb5ab]">আসন্ন টুর্নামেন্ট ও কার্যক্রম</h3>
              <Activity size={20} className="text-slate-300" />
            </div>
            <div className="space-y-4">
               <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-amber-500 shadow-sm"><Trophy size={24} /></div>
                   <div>
                     <h4 className="text-sm font-black font-noto">বার্ষিক ফুটবল টুর্নামেন্ট ২০২৬</h4>
                     <p className="text-[10px] font-bold text-slate-400">তারিখ: ১৫ আগস্ট ২০২৬</p>
                   </div>
                 </div>
                 <button onClick={() => setView('tournaments')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">বিস্তারিত</button>
               </div>
               <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-blue-500 shadow-sm"><Star size={24} /></div>
                   <div>
                     <h4 className="text-sm font-black font-noto">সাংস্কৃতিক ও কুইজ প্রতিযোগিতা</h4>
                     <p className="text-[10px] font-bold text-slate-400">তারিখ: ২০ আগস্ট ২০২৬</p>
                   </div>
                 </div>
                 <button onClick={() => setView('tournaments')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">বিস্তারিত</button>
               </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
           {/* Achievement Card */}
           <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-lg relative overflow-hidden">
             <div className="relative z-10">
               <Award size={40} className="mb-4 text-white/40" />
               <h3 className="text-xl font-black font-noto mb-2">মেম্বারশিপ ও সার্টিফিকেট</h3>
               <p className="text-xs opacity-80 leading-relaxed mb-6 font-noto">সদস্যদের জন্য অটোমেটেড মেম্বারশিপ সার্টিফিকেট ও আইডি কার্ড ডাউনলোড অপশন।</p>
               <button onClick={() => setView('certificates')} className="w-full py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">সার্টিফিকেট ম্যানেজমেন্ট</button>
             </div>
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
           </div>

           {/* Quick Announcement */}
           <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-sm`}>
             <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">জরুরি ঘোষণা</h3>
             <div className="space-y-4">
               <div className="flex gap-4">
                 <div className="shrink-0 w-1 h-auto bg-amber-400 rounded-full"></div>
                 <p className="text-xs font-bold text-slate-600 font-noto leading-relaxed italic">"আগামীকাল ক্লাবের সাপ্তাহিক মিটিং বিকেল ৫টায়। সকল সদস্যের উপস্থিতি কামনা করছি।"</p>
               </div>
               <button onClick={onNavigateToWallet} className="w-full py-3 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"><MessageSquare size={14} /> এসএমএস পাঠান</button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
