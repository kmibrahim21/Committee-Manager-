
import React, { useState, useEffect } from 'react';
import { Home, User, BookOpen, Wallet, ShieldCheck, BarChart3, CreditCard, RefreshCw, Smartphone, Bell, X, Info, AlertTriangle, CheckCircle2, Clock, Calculator, ClipboardList, GraduationCap, Banknote, MessageSquare, Users, Mic, Play, UserCheck, LayoutDashboard, Calendar, Landmark, PiggyBank, Briefcase, Gift, Building2, Vote, HelpCircle, MoreHorizontal } from 'lucide-react';
import { View, Language, Institution, Transaction, Profile } from 'types';
import { t } from 'translations';
import { supabase } from 'supabase';
import { useOfflineStatus } from '../hooks/useOffline';
import { OfflineService } from '../services/OfflineService';
import { handleHardRefresh } from '../utils/hardRefresh';
import MultiCalendarHeader from './MultiCalendarHeader';
import { getCommitteeTypeConfig, MODULE_META } from '../utils/committeeTypes';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  setView: (view: View) => void;
  lang: Language;
  madrasah: Institution | null;
  profile?: Profile | null;
  triggerRefresh?: () => void;
}

interface AppNotification {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'error' | 'warning';
  time: string;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView, lang, madrasah, profile, triggerRefresh }) => {
  const isOnline = useOfflineStatus();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isSuperAdmin = profile?.role === 'super_admin';
  const isManager = profile?.role === 'manager';
  const isSystemAdmin = isSuperAdmin || isManager;
  const role = profile?.role || 'executive';

  const handleRefreshClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await handleHardRefresh();
  };
  
  const canAccess = (module: string) => {
    if (profile?.role === 'super_admin') return true;
    if (profile?.role === 'manager') {
      const perms = profile?.permissions;
      if (module === 'dashboard') return perms?.can_view_dashboard !== false && perms?.dashboard !== false;
      if (module === 'organizations') return perms?.can_manage_committees !== false && perms?.organizations !== false;
      if (module === 'approvals') return perms?.can_approve_payments !== false && perms?.approvals !== false;
      if (module === 'managers') return !!perms?.can_manage_managers;
      return true;
    }
    return false;
  };
  
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
    
    const result = {
      modules: {
        departments: configObj.modules?.departments ?? true,
        attendance: configObj.modules?.attendance ?? true,
        meetings: configObj.modules?.meetings ?? true,
        minutes: configObj.modules?.minutes ?? true,
        events: configObj.modules?.events ?? true,
        accounting: configObj.modules?.accounting ?? true,
        voice_broadcast: configObj.modules?.voice_broadcast ?? true,
        sms: configObj.modules?.sms ?? true,
      },
      ui_mode: configObj.ui_mode || 'committee'
    } as any;
    return result;
  }, [madrasah]) as any;

  const fetchDynamicNotifications = async () => {
    if (!madrasah?.id) return;
    const newNotifications: AppNotification[] = [];
    if (madrasah.sms_balance < 50) {
      newNotifications.push({ id: 'low-bal', title: t('low_balance_title', lang), desc: t('low_balance_msg', lang), type: 'error', time: 'Active' });
    }
    setNotifications(newNotifications);
  };

  useEffect(() => { if (showNotifications) fetchDynamicNotifications(); }, [showNotifications, madrasah?.id]);

  const hasPermission = (perm: keyof NonNullable<Profile['permissions']>) => {
    if (isSuperAdmin || role === 'org_admin') return true;
    return !!profile?.permissions?.[perm];
  };

  const isTabActive = (tab: string) => {
    if (tab === 'home' && currentView === 'home') return true;
    if (tab === 'account' && (currentView === 'account' || currentView === 'super-account' || currentView === 'admin-voice-service' || currentView === 'admin-tutorials')) return true;
    if (tab === 'list' && currentView === 'admin-panel') return true;
    if (tab === 'dashboard' && currentView === 'admin-dashboard') return true;
    if (tab === 'approvals' && currentView === 'admin-approvals') return true;
    if (tab === 'accounting' && currentView === 'accounting') return true;
    if (tab === 'attendance' && currentView === 'attendance') return true;
    if (tab === 'meetings' && (currentView === 'meetings' || currentView === 'minutes')) return true;
    if (tab === 'events' && currentView === 'events') return true;
    if (tab === 'wallet' && currentView === 'wallet-sms') return true;
    if (tab === 'voice-broadcast' && currentView === 'voice-broadcast') return true;
    if (tab === 'sms-voice-menu' && currentView === 'sms-voice-menu') return true;
    if (tab === 'executives' && currentView === 'executives') return true;
    if (tab === 'departments' && (currentView === 'departments' || currentView === 'members' || currentView === 'member-details' || currentView === 'member-form')) return true;
    if (tab === currentView) return true;
    return false;
  };

  return (
    <div className={`flex flex-col md:flex-row w-full h-full relative overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-brand-light'}`}>
      
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col w-72 border-r z-20 shrink-0 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-brand-lavender/30'}`}>
        <div className="p-6 flex items-center gap-4 border-b border-inherit">
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
              {isSystemAdmin ? <ShieldCheck size={24} className="text-[#0fb5ab]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <img src="/icon.svg" className="w-full h-full object-contain p-1" alt="Logo" />)}
            </div>
            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${madrasah?.theme === 'dark' ? 'border-slate-900' : 'border-white'} ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`text-lg font-black leading-tight tracking-tight font-noto line-clamp-3 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>
              {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : isManager ? (lang === 'bn' ? 'ম্যানেজার' : 'Manager') : (madrasah?.name || 'Organization Portal')}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 font-noto">
              {role === 'super_admin' ? 'Super Admin Portal' : role === 'manager' ? 'Manager Portal' : role === 'member' ? 'Member Portal' : role === 'executive' ? 'Executive Portal' : role === 'accountant' ? 'Accounts Portal' : 'Admin Portal'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {isSystemAdmin ? (
            <>
              {canAccess('dashboard') && (
                <button onClick={() => setView('admin-dashboard')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('dashboard') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <BarChart3 size={22} strokeWidth={isTabActive('dashboard') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('dashboard', lang)}</span>
                </button>
              )}
              {canAccess('organizations') && (
                <button onClick={() => setView('admin-panel')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('list') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <Users size={22} strokeWidth={isTabActive('list') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'কমিটি' : 'Committees'}</span>
                </button>
              )}
              {canAccess('approvals') && (
                <button onClick={() => setView('admin-approvals')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('approvals') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <CreditCard size={22} strokeWidth={isTabActive('approvals') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('approvals', lang)}</span>
                </button>
              )}
              {canAccess('managers') && (
                <button onClick={() => setView('admin-managers')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('admin-managers') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <ShieldCheck size={22} strokeWidth={isTabActive('admin-managers') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'ম্যানেজার' : 'Managers'}</span>
                </button>
              )}
              <button onClick={() => setView('sms-voice-menu')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                <MessageSquare size={22} strokeWidth={isTabActive('sms-voice-menu') ? 2.5 : 2} />
                <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'যোগাযোগ' : 'Communication'}</span>
              </button>
              <button onClick={() => setView(isSystemAdmin ? 'super-account' : 'account')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('account') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                <User size={22} strokeWidth={isTabActive('account') ? 2.5 : 2} />
                <span className="text-sm font-bold font-noto">{t('account', lang)}</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setView('home')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('home') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                <Home size={22} strokeWidth={isTabActive('home') ? 2.5 : 2} />
                <span className="text-sm font-bold font-noto">{t('home', lang)}</span>
              </button>
              {(isSuperAdmin || role === 'org_admin' || role === 'executive' || (role !== 'member' && hasPermission('can_manage_members'))) && (
                <button 
                  onClick={() => setView(modules.modules.departments !== false ? 'departments' : 'members')} 
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('departments') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}
                >
                  <Users size={22} strokeWidth={isTabActive('departments') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('departments', lang, madrasah?.institution_type)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'org_admin' || (role !== 'member' && (hasPermission('can_send_sms') || hasPermission('can_use_voice_call')))) && (modules.modules.sms !== false || modules.modules.voice_broadcast) && (
                <button 
                  onClick={() => {
                    if (modules.modules.sms !== false && modules.modules.voice_broadcast) {
                      setView('sms-voice-menu');
                    } else if (modules.modules.sms !== false) {
                      setView('wallet-sms');
                    } else if (modules.modules.voice_broadcast) {
                      setView('voice-broadcast');
                    }
                  }} 
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}
                >
                  <MessageSquare size={22} strokeWidth={isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">
                    {modules.modules.sms !== false && modules.modules.voice_broadcast ? (lang === 'bn' ? 'যোগাযোগ' : 'Communication') : modules.modules.sms !== false ? 'এসএমএস' : 'ভয়েস'}
                  </span>
                </button>
              )}
              {(isSuperAdmin || role === 'org_admin' || (role === 'member' ? !!madrasah?.member_portal_config?.permissions?.view_attendance : hasPermission('can_manage_attendance'))) && modules.modules.attendance && (
                <button onClick={() => setView('attendance')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('attendance') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <ClipboardList size={22} strokeWidth={isTabActive('attendance') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('attendance', lang)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'org_admin' || (role === 'member' ? !!madrasah?.member_portal_config?.permissions?.view_finances : hasPermission('can_manage_accounting'))) && modules.modules.accounting && (
                <button onClick={() => setView('accounting')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('accounting') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <Banknote size={22} strokeWidth={isTabActive('accounting') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('accounts', lang)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'org_admin' || (role === 'member' ? !!madrasah?.member_portal_config?.permissions?.view_meetings : hasPermission('can_manage_meetings'))) && modules.modules.meetings && (
                <button onClick={() => setView('meetings')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('meetings') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <GraduationCap size={22} strokeWidth={isTabActive('meetings') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{t('meetings', lang)}</span>
                </button>
              )}
              {(isSuperAdmin || role === 'org_admin') && (
                <button onClick={() => setView('events')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('events') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-white hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <Calendar size={22} strokeWidth={isTabActive('events') ? 2.5 : 2} />
                  <span className="text-sm font-bold font-noto">{lang === 'bn' ? 'ইভেন্টসমূহ' : 'Events'}</span>
                </button>
              )}
              <button onClick={() => setView('account')} className={`flex items-center gap-4 p-4 rounded-2xl transition-all w-full ${isTabActive('account') ? (madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9]' : 'bg-slate-50 text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                <User size={22} strokeWidth={isTabActive('account') ? 2.5 : 2} />
                <span className="text-sm font-bold font-noto">{t('account', lang)}</span>
              </button>
            </>
          )}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 w-full h-full relative overflow-hidden">
        {/* Mobile Header */}
        <header className={`md:hidden flex-none px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 flex items-center justify-between relative z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-brand-light/80 border-brand-lavender/20'} backdrop-blur-md border-b`}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-sm border overflow-hidden ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                {isSuperAdmin ? <ShieldCheck size={24} className="text-[#0fb5ab]" /> : (madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" alt="Logo" /> : <img src="/icon.svg" className="w-full h-full object-contain p-1" alt="Logo" />)}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${madrasah?.theme === 'dark' ? 'border-slate-900' : 'border-white'} ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className={`text-[16px] font-black leading-[1.2] tracking-tight font-noto line-clamp-3 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>
                {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin') : (madrasah?.name || 'Committee Manager')}
              </h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 font-noto">
                {role === 'super_admin' ? 'Super Admin Portal' : role === 'member' ? 'Member Portal' : role === 'executive' ? 'Executive Portal' : role === 'accountant' ? 'Accounts Portal' : 'Admin Portal'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNotifications(true)} className={`relative p-2.5 rounded-[1rem] active:scale-95 border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9] border-slate-700' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20'}`}>
              <Bell size={18} />
              {notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button 
              onClick={handleRefreshClick} 
              disabled={isRefreshing}
              title={lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
              className={`p-2.5 rounded-[1rem] active:scale-95 transition-all border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white' : 'bg-slate-50 text-slate-400 border-slate-100 hover:text-slate-600'}`}
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin text-[#0fb5ab]' : ''} />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className={`hidden md:flex flex-none h-16 px-8 items-center justify-between border-b relative z-10 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-brand-lavender/20'}`}>
          <div className="flex-1 min-w-0">
            <h2 className={`text-base font-black font-noto truncate ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              {isSuperAdmin ? (lang === 'bn' ? 'সুপার অ্যাডমিন পোর্টাল' : 'Super Admin Portal') : (madrasah?.name || 'Committee Manager')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNotifications(true)} className={`relative p-2.5 rounded-xl transition-all border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9] border-slate-700 hover:bg-slate-700' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20 hover:bg-[#42f5e9]/20'}`}>
              <Bell size={18} />
              {notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
            </button>
            <button 
              onClick={handleRefreshClick} 
              disabled={isRefreshing}
              title={lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
              className={`px-3 py-2 rounded-xl transition-all border shadow-sm flex items-center gap-2 active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#0fb5ab]' : ''} />
              <span className="text-xs font-bold font-noto">{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
          </div>
        </header>

        {(currentView === 'home' || currentView === 'admin-dashboard') && <MultiCalendarHeader madrasah={madrasah} />}

        <main className="flex-1 overflow-y-auto px-5 md:px-8 pt-4 pb-44 md:pb-8 w-full scroll-smooth custom-scrollbar">
          {children}
        </main>

        {/* Mobile Bottom Nav */}
        <div className="fixed md:hidden bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[200]">
        <nav className={`backdrop-blur-[25px] border flex justify-around items-center py-4 px-1 rounded-[2.5rem] shadow-bubble ${madrasah?.theme === 'dark' ? 'bg-slate-800/95 border-slate-700' : 'bg-white/95 border-slate-200'}`}>
          {isSystemAdmin ? (
            <>
              {canAccess('dashboard') && (
                <button onClick={() => setView('admin-dashboard')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('dashboard') ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                  <BarChart3 size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{t('dashboard', lang)}</span>
                </button>
              )}
              {canAccess('organizations') && (
                <button onClick={() => setView('admin-panel')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('list') ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                  <Users size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{lang === 'bn' ? 'কমিটি' : 'Committee'}</span>
                </button>
              )}
              {canAccess('approvals') && (
                <button onClick={() => setView('admin-approvals')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('approvals') ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                  <CreditCard size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{t('approvals', lang)}</span>
                </button>
              )}
              {canAccess('managers') && (
                <button onClick={() => setView('admin-managers')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('admin-managers') ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                  <ShieldCheck size={20} />
                  <span className="text-[9px] font-black font-noto opacity-80">{lang === 'bn' ? 'ম্যানেজার' : 'Manager'}</span>
                </button>
              )}
              <button onClick={() => setView('sms-voice-menu')} className={`relative flex flex-col items-center gap-1 transition-all flex-1 ${isTabActive('sms-voice-menu') ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}>
                <MessageSquare size={20} />
                <span className="text-[9px] font-black font-noto opacity-80">{lang === 'bn' ? 'যোগাযোগ' : 'Communication'}</span>
              </button>
            </>
          ) : (
            <>
              {/* 1. Home Tab */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView('home'); }} 
                className={`relative flex flex-col items-center justify-center min-h-[44px] gap-1 transition-all flex-1 ${isTabActive('home') ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}
              >
                <Home size={20} strokeWidth={isTabActive('home') ? 3 : 2} />
                <span className="text-[10px] font-bold font-noto opacity-90">{t('home', lang)}</span>
              </button>

              {/* 2. Members Tab */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView(modules.modules.departments !== false ? 'departments' : 'members'); }} 
                className={`relative flex flex-col items-center justify-center min-h-[44px] gap-1 transition-all flex-1 ${isTabActive('departments') || currentView === 'members' || currentView === 'member-details' || currentView === 'member-form' ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}
              >
                <Users size={20} />
                <span className="text-[10px] font-bold font-noto opacity-90">{lang === 'bn' ? 'সদস্য' : 'Members'}</span>
              </button>

              {/* 3. Accounting Tab */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView('accounting'); }} 
                className={`relative flex flex-col items-center justify-center min-h-[44px] gap-1 transition-all flex-1 ${isTabActive('accounting') || currentView === 'member-accounting' ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}
              >
                <Banknote size={20} />
                <span className="text-[10px] font-bold font-noto opacity-90">{lang === 'bn' ? 'হিসাব' : 'Accounts'}</span>
              </button>

              {/* 4. Meetings Tab */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView('meetings'); }} 
                className={`relative flex flex-col items-center justify-center min-h-[44px] gap-1 transition-all flex-1 ${isTabActive('meetings') || currentView === 'minutes' ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}
              >
                <Calendar size={20} />
                <span className="text-[10px] font-bold font-noto opacity-90">{lang === 'bn' ? 'মিটিং' : 'Meetings'}</span>
              </button>

              {/* 5. More / আরও Tab */}
              <button 
                onClick={() => setShowMoreMenu(prev => !prev)} 
                className={`relative flex flex-col items-center justify-center min-h-[44px] gap-1 transition-all flex-1 ${showMoreMenu || isTabActive('account') || isTabActive('events') || isTabActive('attendance') || isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu') || currentView === 'polls' || currentView === 'notice-board' ? (madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]') : (madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-[#94A3B8]')}`}
              >
                <MoreHorizontal size={20} strokeWidth={showMoreMenu ? 3 : 2} />
                <span className="text-[10px] font-bold font-noto opacity-90">{lang === 'bn' ? 'আরও' : 'More'}</span>
              </button>
            </>
          )}

        </nav>

        {/* Mobile 'More' Drawer Menu */}
        {showMoreMenu && !isSystemAdmin && (
          <div className={`mb-3 p-4 rounded-3xl border shadow-2xl animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-2xl ${
            madrasah?.theme === 'dark' ? 'bg-slate-900/95 border-slate-700 text-white' : 'bg-white/95 border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-inherit">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                {lang === 'bn' ? 'অতিরিক্ত মেনু' : 'More Menu'}
              </span>
              <button 
                onClick={() => setShowMoreMenu(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Communication (SMS / Voice) */}
              {(modules.modules.sms !== false || modules.modules.voice_broadcast) && (
                <button 
                  onClick={() => {
                    setShowMoreMenu(false);
                    if (modules.modules.sms !== false && modules.modules.voice_broadcast) setView('sms-voice-menu');
                    else if (modules.modules.sms !== false) setView('wallet-sms');
                    else setView('voice-broadcast');
                  }}
                  className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                    isTabActive('wallet') || isTabActive('voice-broadcast') || isTabActive('sms-voice-menu')
                      ? 'bg-[#0fb5ab]/15 text-[#0fb5ab]'
                      : madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare size={18} className="text-[#0fb5ab]" />
                  <span className="text-[10px] font-bold font-noto truncate w-full">{lang === 'bn' ? 'যোগাযোগ' : 'SMS / Call'}</span>
                </button>
              )}

              {/* Attendance */}
              {modules.modules.attendance && (
                <button 
                  onClick={() => { setShowMoreMenu(false); setView('attendance'); }}
                  className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                    isTabActive('attendance')
                      ? 'bg-[#0fb5ab]/15 text-[#0fb5ab]'
                      : madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardList size={18} className="text-[#0fb5ab]" />
                  <span className="text-[10px] font-bold font-noto truncate w-full">{t('attendance', lang)}</span>
                </button>
              )}

              {/* Events */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView('events'); }}
                className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                  isTabActive('events')
                    ? 'bg-[#0fb5ab]/15 text-[#0fb5ab]'
                    : madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Calendar size={18} className="text-[#0fb5ab]" />
                <span className="text-[10px] font-bold font-noto truncate w-full">{lang === 'bn' ? 'ইভেন্ট' : 'Events'}</span>
              </button>

              {/* Notice Board */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView('notice-board'); }}
                className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                  currentView === 'notice-board'
                    ? 'bg-[#0fb5ab]/15 text-[#0fb5ab]'
                    : madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle size={18} className="text-[#0fb5ab]" />
                <span className="text-[10px] font-bold font-noto truncate w-full">{lang === 'bn' ? 'নোটিশ' : 'Notices'}</span>
              </button>

              {/* Polls */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView('polls'); }}
                className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                  currentView === 'polls'
                    ? 'bg-[#0fb5ab]/15 text-[#0fb5ab]'
                    : madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Vote size={18} className="text-[#0fb5ab]" />
                <span className="text-[10px] font-bold font-noto truncate w-full">{lang === 'bn' ? 'পোলস' : 'Polls'}</span>
              </button>

              {/* Account / Settings */}
              <button 
                onClick={() => { setShowMoreMenu(false); setView('account'); }}
                className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all text-center ${
                  isTabActive('account')
                    ? 'bg-[#0fb5ab]/15 text-[#0fb5ab]'
                    : madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <User size={18} className="text-[#0fb5ab]" />
                <span className="text-[10px] font-bold font-noto truncate w-full">{t('account', lang)}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      </div>

      {showNotifications && (
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-start justify-center p-4 pt-12">
           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-sm rounded-[1.8rem] sm:rounded-[3rem] shadow-2xl border overflow-hidden flex flex-col max-h-[80vh]`}>
              <div className={`p-5 sm:p-6 border-b flex items-center justify-between shrink-0 ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                 <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#2E0B5E]'}`}>{t('notifications', lang)}</h3>
                 <button onClick={() => setShowNotifications(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'}`}><X size={18} /></button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto flex-1">
                 {notifications.length > 0 ? notifications.map(n => (
                    <div key={n.id} className={`p-4 rounded-2xl border flex gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
                       <div className="min-w-0 flex-1">
                          <h4 className={`text-[13px] font-black truncate ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#2E0B5E]'}`}>{n.title}</h4>
                          <p className={`text-[11px] font-bold font-noto leading-relaxed ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{n.desc}</p>
                       </div>
                    </div>
                 )) : <div className="py-12 text-center text-slate-400 text-xs font-black uppercase">No Alerts</div>}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
