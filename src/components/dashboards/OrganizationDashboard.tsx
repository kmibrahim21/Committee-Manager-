
import React, { useState, useEffect } from 'react';
import { Building2, Users, Briefcase, Gift, Landmark, ClipboardList, Zap, Mic, MessageSquare, TrendingUp, ChevronRight, Activity, Heart, Projector } from 'lucide-react';
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
  onNavigateToAccounting?: () => void;
}

export const OrganizationDashboard: React.FC<DashboardProps> = ({ 
  lang, madrasah, profile, institutionId, dataVersion, setView,
  onNavigateToWallet, onNavigateToAccounting
}) => {
  const [stats, setStats] = useState({
    totalVolunteers: 0,
    totalEmployees: 0,
    activeProjects: 0,
    totalDonations: 0,
    smsBalance: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isValidUUID(institutionId)) return;
      setLoading(true);
      try {
        const volData = JSON.parse(localStorage.getItem(`special_volunteers_${institutionId}`) || '[]');
        const empData = JSON.parse(localStorage.getItem(`special_employees_${institutionId}`) || '[]');
        const projData = JSON.parse(localStorage.getItem(`special_projects_${institutionId}`) || '[]');
        const donData = JSON.parse(localStorage.getItem(`special_donations_${institutionId}`) || '[]');
        
        const { data: instRes } = await supabase.from('institutions').select('sms_balance').eq('id', institutionId).maybeSingle();

        setStats({
          totalVolunteers: volData.length,
          totalEmployees: empData.length,
          activeProjects: projData.filter((p: any) => p.status === 'Ongoing').length,
          totalDonations: donData.reduce((sum: number, d: any) => sum + (d.amount || 0), 0),
          smsBalance: instRes?.sms_balance || 0
        });
      } catch (e) {
        console.error("Organization Stats Error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [dataVersion, institutionId]);

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-8">
      {/* Organization Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 px-1">
        <button onClick={() => setView('projects')} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Briefcase size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-blue-600'}`}>{stats.activeProjects}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">সক্রিয় প্রজেক্ট</p>
        </button>

        <button onClick={() => setView('donations')} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Gift size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-emerald-600'}`}>{stats.totalDonations.toLocaleString('bn-BD')} ৳</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">মোট অনুদান সংগ্রহ</p>
        </button>

        <button onClick={() => setView('volunteers')} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-purple-50 text-purple-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Heart size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-purple-600'}`}>{stats.totalVolunteers} জন</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">স্বেচ্ছাসেবক বাহিনী</p>
        </button>

        <button onClick={onNavigateToWallet} className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2.5rem] shadow-bubble flex flex-col items-center text-center border active:scale-95 transition-all`}>
          <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-4 shadow-inner"><Zap size={28} /></div>
          <h4 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-amber-600'}`}>{stats.smsBalance}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">যোগাযোগ ব্যালেন্স</p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-1">
        <div className="lg:col-span-2 space-y-6">
           <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-sm`}>
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-lg font-black font-noto text-[#0fb5ab]">প্রজেক্ট ও মানবিক কার্যক্রম</h3>
               <div className="flex gap-2">
                 <button onClick={() => setView('projects')} className="px-4 py-2 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-xl text-[10px] font-black uppercase tracking-widest">সকল প্রজেক্ট</button>
               </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-black font-noto">মানবিক সহায়তা প্রজেক্ট</h4>
                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">চলমান</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="w-[75%] h-full bg-emerald-500"></div>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>বাজেট: ৫,০০,০০০ ৳</span>
                    <span>ব্যয়: ৩,৭৫,০০০ ৳</span>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-black font-noto">চিকিৎসা ও ঔষধ বিতরণ</h4>
                    <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">পরিকল্পিত</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="w-[10%] h-full bg-amber-500"></div>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                    <span>বাজেট: ২,৫০,০০০ ৳</span>
                    <span>ব্যয়: ২৫,০০০ ৳</span>
                  </div>
                </div>
             </div>
           </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
           {/* Human Resources */}
           <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[3rem] border shadow-sm`}>
             <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">জনবল ও কর্মকর্তা</h3>
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center"><Users size={18} /></div>
                   <span className="text-xs font-bold text-slate-600">ভলান্টিয়ার্স</span>
                 </div>
                 <span className="text-sm font-black">{stats.totalVolunteers} জন</span>
               </div>
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Briefcase size={18} /></div>
                   <span className="text-xs font-bold text-slate-600">পেইড এমপ্লয়ী</span>
                 </div>
                 <span className="text-sm font-black">{stats.totalEmployees} জন</span>
               </div>
               <button onClick={() => setView('employees')} className="w-full py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all mt-4">হিউম্যান রিসোর্স ম্যানেজমেন্ট</button>
             </div>
           </div>

           {/* Donation Stats */}
           <div className="bg-gradient-to-br from-[#0fb5ab] to-[#0e8a84] p-8 rounded-[3rem] text-white shadow-lg">
             <Gift size={32} className="mb-4 opacity-40" />
             <h3 className="text-lg font-black font-noto mb-1">ফান্ড সংগ্রহ</h3>
             <p className="text-xs opacity-70 mb-6">সংস্থার সকল অনুদান ও যাকাত তহবিলের স্বচ্ছ হিসাব।</p>
             <div className="flex items-baseline gap-2 mb-6">
               <span className="text-3xl font-black">{stats.totalDonations.toLocaleString('bn-BD')}</span>
               <span className="text-sm font-bold opacity-70">৳ (মোট)</span>
             </div>
             <button onClick={() => setView('donations')} className="w-full py-3 bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/30 transition-all">ডোনেশন ইনপুট</button>
           </div>
        </div>
      </div>
    </div>
  );
};
