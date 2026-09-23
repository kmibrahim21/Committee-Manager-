
import React, { useState, useEffect } from 'react';
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy, Zap, Mic, UserCheck, Calendar, CreditCard } from 'lucide-react';
import { supabase } from 'supabase';
import { Member, Language, Institution, Profile } from 'types';
import { t } from 'translations';
import MemberParticipationAnalytics from 'components/MemberParticipationAnalytics';
import CommitteeFinancialAnalytics from 'components/CommitteeFinancialAnalytics';
import MeetingMinutesAnalytics from 'components/MeetingMinutesAnalytics';
import { isValidUUID } from 'utils/validation';

interface DashboardProps {
  lang: Language;
  madrasah: Institution | null;
  profile?: Profile | null;
  institutionId?: string;
  dataVersion: number;
  onNavigateToWallet?: () => void;
  onNavigateToAccounting?: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToExams?: () => void;
  onNavigateToClasses?: () => void;
  onNavigateToMembers?: () => void;
  onNavigateToTeachers?: () => void;
  onNavigateToVoiceBroadcast?: () => void;
  onNavigateToMeetings?: () => void;
  onNavigateToSubscriptions?: () => void;
}

export const GenericDashboard: React.FC<DashboardProps> = ({ 
  lang, madrasah, profile, institutionId, dataVersion,
  onNavigateToWallet, onNavigateToAccounting, onNavigateToAttendance, 
  onNavigateToExams, onNavigateToClasses, onNavigateToMembers, 
  onNavigateToTeachers, onNavigateToVoiceBroadcast, onNavigateToMeetings, 
  onNavigateToSubscriptions 
}) => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalDepartments: 0,
    totalExecutives: 0,
    smsBalance: 0,
    voiceBalance: 0,
    attendanceToday: 0,
    totalMeetings: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const role = profile?.role || 'executive';
  const isAdmin = role === 'org_admin' || role === 'super_admin';
  const isMember = role === 'member';
  const memberPerms = madrasah?.member_portal_config?.permissions;

  const canManageMembers = !isMember;
  const canManageAttendance = isAdmin || role === 'executive' || (isMember ? !!memberPerms?.view_attendance : true);
  const canManageAccounting = isAdmin || role === 'executive' || (isMember ? !!memberPerms?.view_finances : true);
  const canViewMinutes = isAdmin || role === 'executive' || (isMember ? !!memberPerms?.view_minutes : true);
  const canSendSMS = !isMember && (isAdmin || !!profile?.permissions?.can_send_sms);
  const canUseVoice = !isMember && (isAdmin || !!profile?.permissions?.can_use_voice_call);

  // Dynamic module configuration
  const modules = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) { config = {}; }
    }
    const configObj = (typeof config === 'object' && config !== null) ? config : {};
    return {
      modules: {
        departments: configObj.modules?.departments ?? true,
        attendance: configObj.modules?.attendance ?? true,
        results: configObj.modules?.results ?? true,
        meetings: configObj.modules?.meetings ?? true,
        accounting: configObj.modules?.accounting ?? true,
        subscriptions: configObj.modules?.subscriptions ?? true,
        voice_broadcast: configObj.modules?.voice_broadcast ?? true,
        sms: configObj.modules?.sms ?? true,
      }
    };
  }, [madrasah]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isValidUUID(institutionId)) return;
      setLoadingStats(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const [stdRes, clsRes, execRes, instRes, meetRes, attRes] = await Promise.all([
          supabase.from('members').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
          supabase.from('departments').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
          supabase.from('executives').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
          supabase.from('institutions').select('sms_balance, balance').eq('id', institutionId).maybeSingle(),
          supabase.from('meetings').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
          supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('date', today).eq('status', 'present')
        ]);

        setStats({
          totalMembers: stdRes.count || 0,
          totalDepartments: clsRes.count || 0,
          totalExecutives: execRes.count || 0,
          smsBalance: instRes.data?.sms_balance || 0,
          voiceBalance: instRes.data?.balance || 0,
          totalMeetings: meetRes.count || 0,
          attendanceToday: attRes.count || 0
        });
      } catch (e) {
        console.error("Dashboard Stats Error:", e);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [dataVersion, institutionId]);

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-6 px-1">
        {canManageMembers && (
          <button onClick={modules.modules.departments === false ? onNavigateToMembers : onNavigateToClasses} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center active:scale-95 transition-all border`}>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Users size={20} className="lg:w-6 lg:h-6" /></div>
            <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.totalMembers}</h4>
            <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">{t('members', lang, madrasah?.institution_type)}</p>
          </button>
        )}
        {canManageMembers && modules.modules.departments !== false && (
          <button onClick={onNavigateToClasses} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center active:scale-95 transition-all border`}>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><BookOpen size={20} className="lg:w-6 lg:h-6" /></div>
            <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.totalDepartments}</h4>
            <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">{t('departments', lang, madrasah?.institution_type)}</p>
          </button>
        )}
        {!isMember && (
          <button onClick={onNavigateToTeachers} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center active:scale-95 transition-all border`}>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><UserCheck size={20} className="lg:w-6 lg:h-6" /></div>
            <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.totalExecutives}</h4>
            <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">{t('executive_committee', lang, madrasah?.institution_type)}</p>
          </button>
        )}
        {canSendSMS && (
          <button onClick={onNavigateToWallet} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center active:scale-95 transition-all border`}>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Zap size={20} className="lg:w-6 lg:h-6" /></div>
            <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.smsBalance}</h4>
            <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">{t('sms', lang)}</p>
          </button>
        )}
        {canUseVoice && modules.modules.voice_broadcast && (
          <button onClick={onNavigateToVoiceBroadcast} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center active:scale-95 transition-all border`}>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Mic size={20} className="lg:w-6 lg:h-6" /></div>
            <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : Number(stats.voiceBalance || 0).toFixed(2)}</h4>
            <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">{t('voice_call', lang)}</p>
          </button>
        )}
        {modules.modules.meetings && (
          <button onClick={onNavigateToMeetings} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center active:scale-95 transition-all border`}>
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Calendar size={20} className="lg:w-6 lg:h-6" /></div>
            <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.totalMeetings}</h4>
            <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">{t('meetings', lang)}</p>
          </button>
        )}
      </div>

      {/* Analytics Sections */}
      {institutionId && (
        <div className="space-y-10 lg:space-y-12">
          {canManageAccounting && modules.modules.accounting && (
            <div className="px-1 space-y-4">
               <div className="flex items-center gap-3 px-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                  <h2 className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {lang === 'bn' ? 'আর্থিক বিবরণী' : 'Financial Statement'}
                  </h2>
               </div>
               <CommitteeFinancialAnalytics 
                 institutionId={institutionId} 
                 lang={lang} 
                 month={new Date().toISOString().slice(0, 7)}
                 madrasah={madrasah}
                 role={role}
                 profile={profile}
               />
            </div>
          )}

          {canManageAttendance && modules.modules.attendance && (
            <div className="px-1 space-y-4">
              <div className="flex items-center gap-3 px-3">
                 <div className="w-1.5 h-6 bg-[#42f5e9] rounded-full"></div>
                 <h2 className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                   {lang === 'bn' ? 'সদস্য উপস্থিতির বিবরণ' : 'Member Attendance Review'}
                 </h2>
              </div>
              <MemberParticipationAnalytics 
                institutionId={institutionId} 
                lang={lang} 
                madrasah={madrasah}
              />
            </div>
          )}

          {canViewMinutes && modules.modules.results && (
            <div className="px-1 space-y-4">
               <div className="flex items-center gap-3 px-3">
                  <div className="w-1.5 h-6 bg-[#42f5e9] rounded-full"></div>
                  <h2 className={`text-sm lg:text-base font-black uppercase tracking-[0.2em] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {lang === 'bn' ? 'মিটিং রেজাল্ট ও বিবরণী' : 'Meeting Minutes & Resolutions'}
                  </h2>
               </div>
               <MeetingMinutesAnalytics 
                 institutionId={institutionId} 
                 lang={lang} 
                 madrasah={madrasah}
               />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
