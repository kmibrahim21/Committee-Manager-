
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy, Zap, Mic, UserCheck, Calendar } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Member as Member, Language, Institution } from 'types';
import { t } from 'translations';
import MemberActivityAnalysis from 'components/MemberActivityAnalysis';
import MemberParticipationAnalytics from 'components/MemberParticipationAnalytics';
import CommitteeFinancialAnalytics from 'components/CommitteeFinancialAnalytics';
import MeetingMinutesAnalytics from 'components/MeetingMinutesAnalytics';
import { isValidUUID } from 'utils/validation';

interface HomeProps {
  onMemberClick: (member: Member) => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  institutionId?: string;
  madrasah: Institution | null;
  profile?: any;
  onNavigateToWallet?: () => void;
  onNavigateToAccounting?: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToExams?: () => void;
  onNavigateToClasses?: () => void;
  onNavigateToMembers?: () => void;
  onNavigateToTeachers?: () => void;
  onNavigateToVoiceBroadcast?: () => void;
}

const Home: React.FC<HomeProps> = ({ onMemberClick, lang, dataVersion, triggerRefresh, institutionId, madrasah, profile, onNavigateToWallet, onNavigateToAccounting, onNavigateToAttendance, onNavigateToExams, onNavigateToClasses, onNavigateToMembers, onNavigateToTeachers, onNavigateToVoiceBroadcast }) => {
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const role = profile?.role || 'executive';
  const isAdmin = role === 'org_admin' || role === 'super_admin';
  const isMember = role === 'member';
  const memberPerms = madrasah?.member_portal_config?.permissions;

  const canSendSMS = !isMember && (isAdmin || !!profile?.permissions?.can_send_sms);
  const canUseVoice = !isMember && (isAdmin || !!profile?.permissions?.can_use_voice_call);
  const canManageMembers = !isMember && (isAdmin || !!profile?.permissions?.can_manage_members);
  const canManageAttendance = isAdmin || (isMember ? !!memberPerms?.view_attendance : !!profile?.permissions?.can_manage_attendance);
  const canManageAccounting = isAdmin || (isMember ? !!memberPerms?.view_finances : !!profile?.permissions?.can_manage_accounting);
  const canManageMeetings = isAdmin || (isMember ? !!memberPerms?.view_meetings : !!profile?.permissions?.can_manage_meetings);
  const canViewMinutes = isAdmin || (isMember ? !!memberPerms?.view_minutes : true);
  
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalDepartments: 0,
    totalExecutives: 0,
    smsBalance: 0,
    voiceBalance: 0,
    attendanceToday: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Dynamic module configuration
  const modules = React.useMemo(() => {
    let config = madrasah?.config_json as any;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        config = {};
      }
    }
    const configObj: any = (typeof config === 'object' && config !== null) ? config : {};
    
    return {
      modules: {
        departments: configObj.modules?.departments ?? true,
        attendance: configObj.modules?.attendance ?? true,
        results: configObj.modules?.results ?? true,
        meetings: configObj.modules?.meetings ?? true,
        accounting: configObj.modules?.accounting ?? true,
        voice_broadcast: configObj.modules?.voice_broadcast ?? true,
        sms: configObj.modules?.sms ?? true,
      },
      result_engine: configObj.result_engine || 'standard',
      attendance_type: configObj.attendance_type || 'meeting',
      fee_structure: configObj.fee_structure || 'monthly',
      ui_mode: configObj.ui_mode || 'committee'
    } as any;
  }, [madrasah]) as any;

  const fetchDashboardStats = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoadingStats(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const allowedDepartments = profile?.permissions?.allowed_departments || profile?.permissions?.allowed_departments;
      const isExecutive = role === 'executive' || role === 'executive';

      let memberQuery = supabase.from('members').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
      let departmentQuery = supabase.from('departments').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId);
      let attendanceQuery = supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('date', today).eq('status', 'present');

      if (isExecutive && allowedDepartments && allowedDepartments.length > 0) {
        memberQuery = memberQuery.in('department_id', allowedDepartments);
        departmentQuery = departmentQuery.in('id', allowedDepartments);
        attendanceQuery = attendanceQuery.in('department_id', allowedDepartments);
      }

      const promises: any[] = [
        memberQuery,
        departmentQuery,
        supabase.from('executives').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
        supabase.from('institutions').select('sms_balance, balance').eq('id', institutionId).maybeSingle()
      ];

      if (modules.modules.attendance) {
        promises.push(attendanceQuery);
      } else {
        promises.push(Promise.resolve({ count: 0 }));
      }

      const [stdRes, clsRes, teacherRes, mRes, attRes] = await Promise.all(promises);

      setStats({
        totalMembers: stdRes.count || 0,
        totalDepartments: clsRes.count || 0,
        totalExecutives: teacherRes.count || 0,
        smsBalance: mRes.data?.sms_balance || 0,
        voiceBalance: mRes.data?.balance || 0,
        attendanceToday: attRes.count || 0
      });
    } catch (e) {
      console.error("Dashboard Stats Error:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => { 
    fetchDashboardStats();
  }, [dataVersion, institutionId, modules.modules.attendance]);

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20 lg:pb-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-6 px-1">

        {canManageMembers && (
          <button onClick={madrasah?.config_json?.modules?.departments === false ? onNavigateToMembers : onNavigateToClasses} className={`${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Users size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.totalMembers}</h4>
             <p className="text-[10px] lg:text-[12px] font-black text-slate-400 uppercase tracking-widest mt-1 lg:mt-2">{t('members', lang)}</p>
          </button>
        )}
        {canManageMembers && madrasah?.config_json?.modules?.departments !== false && (
          <button onClick={onNavigateToClasses} className={`${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-75 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><BookOpen size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.totalDepartments}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${isDark ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>{t('departments', lang)}</p>
          </button>
        )}
        {/* Executive Committee Card */}
        {!isMember && (
          <button onClick={onNavigateToTeachers} className={`${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-100 active:scale-95 transition-all border`}>
               <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><UserCheck size={20} className="lg:w-6 lg:h-6" /></div>
               <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.totalExecutives}</h4>
               <p className={`text-[10px] lg:text-[12px] font-black ${isDark ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>{t('executive_committee', lang)}</p>
          </button>
        )}
        {canSendSMS && (
          <button onClick={onNavigateToWallet} className={`${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-150 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Zap size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.smsBalance}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${isDark ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>{t('sms', lang)}</p>
          </button>
        )}
        {canUseVoice && modules.modules.voice_broadcast && (
          <button onClick={onNavigateToVoiceBroadcast} className={`${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-175 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><Mic size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.voiceBalance.toFixed(2)}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${isDark ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>{t('voice_call', lang)}</p>
          </button>
        )}
        {canManageAttendance && modules.modules.attendance && (
          <button onClick={onNavigateToAttendance} className={`${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-100 hover:bg-slate-50'} p-5 lg:p-6 rounded-[2rem] shadow-bubble flex flex-col items-center text-center animate-in zoom-in duration-300 delay-200 active:scale-95 transition-all border`}>
             <div className="w-10 h-10 lg:w-12 lg:h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mb-2 lg:mb-4 shadow-inner"><CheckCircle2 size={20} className="lg:w-6 lg:h-6" /></div>
             <h4 className={`text-xl lg:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{loadingStats ? '...' : stats.attendanceToday}</h4>
             <p className={`text-[10px] lg:text-[12px] font-black ${isDark ? 'text-slate-300' : 'text-slate-400'} uppercase tracking-widest mt-1 lg:mt-2`}>{t('today_attendance', lang)}</p>
          </button>
        )}
      </div>

      {institutionId && (
        <div className="space-y-10 lg:space-y-12 text-center sm:text-left">
          {/* Accounting Section */}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-6 lg:gap-8">
            {/* Attendance Section */}
            {canManageAttendance && modules.modules.attendance && (
              <div className="space-y-6 lg:space-y-8 xl:col-span-12">
                <div className="px-1 space-y-8">
                  <div className="space-y-4">
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
                </div>
              </div>
            )}
            
            {/* Meetings/Results Section */}
            <div className="space-y-6 lg:space-y-8 xl:col-span-12">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
