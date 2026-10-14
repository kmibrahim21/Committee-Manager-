
import React, { useState, useEffect } from 'react';
import { OfflineService } from 'services/OfflineService';
import { useSyncEngine } from 'hooks/useOffline';
import { useAndroidBackHandler } from 'hooks/useAndroidBackHandler';
import { OfflineIndicator } from 'components/OfflineIndicator';
import { useAuth } from 'hooks/useAuth';
import Auth from 'pages/Auth';
import Layout from 'components/Layout';
import Home from 'pages/Home';
import Departments from 'pages/Departments';
import Members from 'pages/Members';
import MemberDetails from 'pages/MemberDetails';
import MemberForm from 'pages/MemberForm';
import MemberAccounting from 'pages/MemberAccounting';
import Account from 'pages/Account';
import AssociationManagement from './pages/AssociationManagement';
import SonghoManagement from './pages/SonghoManagement';

import SuperAccount from 'pages/SuperAccount';
import AdminPanel from 'pages/AdminPanel';
import WalletSMS from 'pages/WalletSMS';
import CommitteeManagement from 'pages/CommitteeManagement';
import DataManagement from 'pages/DataManagement';
import CommitteeFinances from 'pages/CommitteeFinances';
import Subscriptions from 'pages/Subscriptions';
import MemberParticipation from 'pages/MemberParticipation';
import Meetings from 'pages/Meetings';
import Minutes from 'pages/MeetingMinutes';
import Events from 'pages/Events';
import VoiceBroadcast from 'pages/VoiceBroadcast';
import SmsVoiceMenu from 'pages/SmsVoiceMenu';
import MeetingCalendar from 'pages/MeetingCalendar';
import Tutorials from 'pages/Tutorials';
import Polls from 'pages/Polls';
import NoticeBoard from 'pages/NoticeBoard';
import { VoiceServiceDashboard } from 'components/VoiceServiceDashboard';
import { TutorialsManager } from 'components/TutorialsManager';
import { ManagerManagement } from 'components/ManagerManagement';
import { View, Department as Department, Member as Member, Language } from 'types';
import { t } from 'translations';
import { BookOpen, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

const App: React.FC = () => {
  const { session, profile, madrasah, loading, authError, handleLogout, refreshMadrasah, signInAsMember } = useAuth();
  useSyncEngine();
  const getInitialView = (): View => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view') as View;
      if (urlView) return urlView;
    }
    return 'home';
  };

  const [view, setView] = useState<View>(getInitialView);
  useAndroidBackHandler(view, setView);
  const [walletTab, setWalletTab] = useState<'templates' | 'bulk-sms' | 'history' | 'recharge'>('bulk-sms');
  const [selectedClass, setSelectedClass] = useState<Department | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0); 
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('app_lang') as Language) || 'bn');
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'success' | 'error', title: string, message: string}>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  const triggerRefresh = () => {
    setDataVersion(prev => prev + 1);
    refreshMadrasah();
  };

  useEffect(() => {
    if (profile?.role === 'super_admin' && (view === 'home' || !view)) {
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view') as View;
      if (!urlView || urlView === 'home') {
        setView('admin-dashboard');
      }
    }
  }, [profile?.role, view]);

  useEffect(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      if (loading) {
        themeColorMeta.setAttribute('content', '#8D30F4'); // Splash screen color
      } else {
        // Use a dark color for the status bar in both modes to ensure white icons are always visible
        themeColorMeta.setAttribute('content', '#0F172A'); 
      }
    }
  }, [loading, session, madrasah, madrasah?.theme]);

  useEffect(() => {
    const handleStatusChange = () => {
      if (navigator.onLine) OfflineService.processQueue();
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const missingVars = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B132B] transition-colors duration-500">
      <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-[2.5px] border-[#E2E8F0]/30 dark:border-[#334155]/30 border-t-[#0fb5ab] dark:border-t-[#42f5e9] animate-spin" />
        </div>
      </div>
    </div>
  );

  if (missingVars) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center mb-6 animate-pulse">
          <ShieldAlert size={40} />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 font-noto">সেটিংস অসম্পূর্ণ!</h1>
        <p className="text-slate-400 max-w-xs mb-8 text-sm leading-relaxed">
          আপনার অ্যাপটি ডাটাবেসের সাথে সংযুক্ত নয়। দয়া করে <b>Settings</b> মেনু থেকে <b>VITE_SUPABASE_URL</b> এবং <b>VITE_SUPABASE_ANON_KEY</b> সেট করুন।
        </p>
        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-left w-full max-w-md mb-8">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">প্রয়োজনীয় ভেরিয়েবলসমূহ:</p>
          <code className="block text-xs text-amber-400/80 mb-1">VITE_SUPABASE_URL=your_url</code>
          <code className="block text-xs text-amber-400/80">VITE_SUPABASE_ANON_KEY=your_key</code>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-[#42f5e9] text-[#0fb5ab] rounded-2xl font-black shadow-lg shadow-[#42f5e9]/20 active:scale-95 transition-all"
        >
          সেটিংস সেট করার পর রিফ্রেশ দিন
        </button>
      </div>
    );
  }

  if (session && !madrasah && !authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B132B]">
        <div className="w-12 h-12 rounded-full border-[2.5px] border-[#E2E8F0]/30 dark:border-[#334155]/30 border-t-[#0fb5ab] dark:border-t-[#42f5e9] animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
          {lang === 'bn' ? 'তথ্য লোড হচ্ছে...' : 'Initializing Session...'}
        </p>
      </div>
    );
  }

  if (authError) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-500 p-10 text-center text-white font-noto">
       <ShieldAlert size={80} className="mb-6 animate-bounce" />
       <h1 className="text-3xl font-black mb-4">নিরাপত্তা সতর্কতা!</h1>
       <p className="text-lg opacity-80 mb-8">{authError}</p>
       <button onClick={() => window.location.reload()} className="px-10 py-4 bg-white text-red-600 rounded-full font-black shadow-2xl active:scale-95 transition-all">পুনরায় চেষ্টা করুন</button>
    </div>
  );

  if (!session && !madrasah) return <Auth lang={lang} signInAsMember={signInAsMember} />;

  const isVercel = window.location.hostname.includes('vercel.app');

  const renderView = () => {
    const role = profile?.role || 'accountant';

    switch (view) {
      case 'home':
        return <Home 
                  onMemberClick={(s) => { setSelectedStudent(s); setView('member-details'); }} 
                  lang={lang} 
                  dataVersion={dataVersion} 
                  triggerRefresh={triggerRefresh} 
                  institutionId={madrasah?.id} 
                  madrasah={madrasah}
                  profile={profile}
                  onNavigateToWallet={() => {
                    const modules = {
                      voice_broadcast: true,
                      sms: true,
                      ...(madrasah?.config_json?.modules || {})
                    };
                    if (modules.sms !== false || modules.voice_broadcast) {
                      setWalletTab('bulk-sms');
                      setView('wallet-sms');
                    }
                  }}
                  onNavigateToAccounting={() => setView('accounting')}
                  onNavigateToAttendance={() => setView('attendance')}
                  onNavigateToExams={() => setView('meetings')}
                  onNavigateToMeetings={() => setView('meetings')}
                  onNavigateToClasses={() => setView('departments')}
                  onNavigateToMembers={() => { setSelectedClass(null); setView('members'); }}
                  onNavigateToTeachers={() => setView('executives')}
                  onNavigateToVoiceBroadcast={() => {
                    setView('voice-broadcast');
                  }}
                  onNavigateToSubscriptions={() => setView('subscriptions')}
                />;
      case 'departments':
        if (role === 'member') { setView('home'); return null; }
        return <Departments onClassClick={(cls) => { setSelectedClass(cls); setView('members'); }} lang={lang} madrasah={madrasah} dataVersion={dataVersion} triggerRefresh={triggerRefresh} readOnly={role !== 'org_admin' && role !== 'super_admin' && !profile?.permissions?.can_manage_departments} profile={profile} />;
      case 'members':
        return <Members 
                  selectedClass={selectedClass} 
                  onStudentClick={(s) => { setSelectedStudent(s); setView('member-details'); }} 
                  onAddClick={() => { setIsEditing(false); setSelectedStudent(null); setView('member-form'); }} 
                  onEditClick={(s) => { setSelectedStudent(s); setIsEditing(true); setView('member-form'); }}
                  onBack={() => setView(selectedClass ? 'departments' : 'home')} 
                  lang={lang} 
                  dataVersion={dataVersion} 
                  triggerRefresh={triggerRefresh} 
                  canAdd={role === 'org_admin' || role === 'super_admin' || !!profile?.permissions?.can_manage_members}
                  canSendSMS={role === 'org_admin' || role === 'super_admin' || !!profile?.permissions?.can_send_sms}
                  institutionId={madrasah?.id}
                  madrasah={madrasah}
                />;
      case 'executives':
        if (role === 'member') { setView('home'); return null; }
        return <CommitteeManagement organization={madrasah} lang={lang} onBack={() => setView('home')} role={role} profile={profile} />;
      case 'member-details':
        if (!selectedStudent) { setView('home'); return null; }
        return <MemberDetails 
                  student={selectedStudent} 
                  madrasah={madrasah}
                  onEdit={() => { setIsEditing(true); setView('member-form'); }} 
                  onBack={() => setView('members')} 
                  lang={lang} 
                  readOnly={role !== 'org_admin' && role !== 'super_admin' && !profile?.permissions?.can_manage_members}
                  institutionId={madrasah?.id}
                  triggerRefresh={triggerRefresh}
                  onNavigateToAccounting={() => setView('member-accounting')}
                />;
      case 'member-form':
        return <MemberForm student={selectedStudent} madrasah={madrasah} defaultClassId={selectedClass?.id} isEditing={isEditing} onSuccess={() => { triggerRefresh(); setView('members'); }} onCancel={() => setView('members')} lang={lang} />;
      case 'management':
        if (madrasah?.institution_type === 'sangha' || madrasah?.institution_type === 'union') {
          return <SonghoManagement lang={lang} madrasah={madrasah} onBack={() => setView('account')} role={role} profile={profile} onUpdate={refreshMadrasah} />;
        }
        return <AssociationManagement lang={lang} madrasah={madrasah} onBack={() => setView('account')} role={role} profile={profile} />;
      case 'account':
        return <Account lang={lang} setLang={(l) => { setLang(l); localStorage.setItem('app_lang', l); }} initialMadrasah={madrasah} setView={setView} onLogout={handleLogout} onProfileUpdate={refreshMadrasah} profile={profile} />;
      case 'super-account':
        if (role !== 'super_admin' && role !== 'manager') { setView('home'); return null; }
        return <SuperAccount lang={lang} setLang={(l) => { setLang(l); localStorage.setItem('app_lang', l); }} initialMadrasah={madrasah} setView={setView} onLogout={handleLogout} onProfileUpdate={refreshMadrasah} />;
      case 'admin-panel':
      case 'admin-approvals':
      case 'admin-dashboard':
        if (role !== 'super_admin' && role !== 'manager') { setView('home'); return null; }
        
        const permissions = profile?.permissions;
        if (view === 'admin-dashboard' && (permissions?.dashboard === false || permissions?.can_view_dashboard === false)) { setView('home'); return null; }
        if (view === 'admin-panel' && (permissions?.organizations === false || permissions?.can_manage_committees === false)) { setView('home'); return null; }
        if (view === 'admin-approvals' && (permissions?.approvals === false || permissions?.can_approve_payments === false)) { setView('home'); return null; }
        
        return <AdminPanel lang={lang} currentView={view === 'admin-approvals' ? 'approvals' : view === 'admin-dashboard' ? 'dashboard' : 'list'} dataVersion={dataVersion} onProfileUpdate={refreshMadrasah} madrasah={madrasah} profile={profile} setStatusModal={setStatusModal} />;
      case 'admin-managers':
        if (role !== 'super_admin' && !(role === 'manager' && profile?.permissions?.can_manage_managers)) {
          setView('super-account');
          return null;
        }
        return <ManagerManagement lang={lang} madrasah={madrasah} profile={profile} setStatusModal={setStatusModal} onBack={() => setView('super-account')} />;
      case 'admin-voice-service':
        if (role !== 'super_admin' && !(role === 'manager' && profile?.permissions?.can_access_voice_service)) { setView('home'); return null; }
        return <VoiceServiceDashboard onBack={() => setView('super-account')} madrasah={madrasah} setStatusModal={setStatusModal} />;
      case 'admin-tutorials':
        if (role !== 'super_admin' && !(role === 'manager' && profile?.permissions?.can_manage_tutorials)) { setView('home'); return null; }
        return <TutorialsManager onBack={() => setView('super-account')} madrasah={madrasah} setStatusModal={setStatusModal} />;
      case 'wallet-sms':
        return <WalletSMS lang={lang} madrasah={madrasah} triggerRefresh={triggerRefresh} dataVersion={dataVersion} initialTab={walletTab} role={role} profile={profile} onBack={() => setView('home')} />;
      case 'voice-broadcast':
        return <VoiceBroadcast lang={lang} madrasah={madrasah} triggerRefresh={triggerRefresh} dataVersion={dataVersion} role={role} profile={profile} onBack={() => setView('home')} />;
      case 'sms-voice-menu':
        return <SmsVoiceMenu lang={lang} madrasah={madrasah} onBack={() => setView('home')} onNavigateToSms={() => setView('wallet-sms')} onNavigateToVoice={() => setView('voice-broadcast')} role={role} profile={profile} />;
      case 'academic-calendar':
        return <MeetingCalendar lang={lang} madrasah={madrasah} onBack={() => setView('account')} role={role} />;
      case 'tutorials':
        return <Tutorials lang={lang} madrasah={madrasah} onBack={() => setView('account')} />;
      case 'polls':
        if (role === 'member' && !madrasah?.member_portal_config?.permissions?.view_polls) { setView('home'); return null; }
        return <Polls lang={lang} madrasah={madrasah} profile={profile} role={role} onBack={() => setView('home')} />;
      case 'notice-board':
        if (role === 'member' && !madrasah?.member_portal_config?.permissions?.view_notices) { setView('home'); return null; }
        return <NoticeBoard lang={lang} madrasah={madrasah} profile={profile} role={role} onBack={() => setView('home')} />;
      case 'data-management':
        return <DataManagement lang={lang} madrasah={madrasah} onBack={() => setView('account')} triggerRefresh={triggerRefresh} />;
      case 'accounting':
        if (role === 'member' && !madrasah?.member_portal_config?.permissions?.view_finances) { setView('home'); return null; }
        return <CommitteeFinances lang={lang} madrasah={madrasah} onBack={() => setView('home')} role={role} profile={profile} dataVersion={dataVersion} onMemberClick={(m) => { setSelectedStudent(m); setView('member-accounting'); }} />;
      case 'member-accounting':
        if (!selectedStudent || !madrasah) { setView('accounting'); return null; }
        return <MemberAccounting member={selectedStudent} madrasah={madrasah} lang={lang} onBack={() => setView('accounting')} departments={[]} profile={profile} />;
      case 'subscriptions':
        if (role === 'member' && !madrasah?.member_portal_config?.permissions?.view_finances) { setView('home'); return null; }
        return <Subscriptions lang={lang} madrasah={madrasah} onBack={() => setView('account')} role={role} profile={profile} />;
      case 'attendance':
        if (role === 'member' && !madrasah?.member_portal_config?.permissions?.view_attendance) { setView('home'); return null; }
        return <MemberParticipation lang={lang} madrasah={madrasah} onBack={() => setView('home')} userId={session?.user?.id} profile={profile} />;
      case 'meetings':
        if (role === 'member' && !madrasah?.member_portal_config?.permissions?.view_meetings) { setView('home'); return null; }
        return <Meetings lang={lang} madrasah={madrasah} onBack={() => setView('home')} role={role} onNavigateToFinalResults={() => setView('minutes')} profile={profile} />;
      case 'events':
        return <Events lang={lang} madrasah={madrasah} onBack={() => setView('home')} role={role} />;
      case 'minutes':
        if (role === 'member' && !madrasah?.member_portal_config?.permissions?.view_minutes) { setView('home'); return null; }
        return <Minutes lang={lang} madrasah={madrasah} onBack={() => setView('home')} role={role} profile={profile} />;
      default:
        return <Home 
                  onMemberClick={(s) => { setSelectedStudent(s); setView('member-details'); }} 
                  lang={lang} 
                  dataVersion={dataVersion} 
                  triggerRefresh={triggerRefresh} 
                  institutionId={madrasah?.id} 
                  madrasah={madrasah}
                  profile={profile}
                  onNavigateToWallet={() => {
                    const modules = {
                      voice_broadcast: true,
                      sms: true,
                      ...(madrasah?.config_json?.modules || {})
                    };
                    if (modules.sms !== false || modules.voice_broadcast) {
                      setWalletTab('bulk-sms');
                      setView('wallet-sms');
                    }
                  }}
                  onNavigateToAccounting={() => setView('accounting')}
                  onNavigateToAttendance={() => setView('attendance')}
                  onNavigateToExams={() => setView('meetings')}
                  onNavigateToMeetings={() => setView('meetings')}
                  onNavigateToClasses={() => setView('departments')}
                  onNavigateToMembers={() => { setSelectedClass(null); setView('members'); }}
                  onNavigateToTeachers={() => setView('executives')}
                  onNavigateToVoiceBroadcast={() => {
                    setView('voice-broadcast');
                  }}
                  onNavigateToSubscriptions={() => setView('subscriptions')}
                />;
    }
  };

  return (
    <Layout currentView={view} setView={setView} lang={lang} madrasah={madrasah} profile={profile} triggerRefresh={triggerRefresh}>
      <OfflineIndicator />
      {isVercel && missingVars && (
        <div className="bg-red-600 text-white p-2 text-[10px] font-black text-center sticky top-0 z-[100] uppercase tracking-widest px-10">
          Environment variables missing! Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel settings.
        </div>
      )}
      {renderView()}
      
      {/* Status Modal - PORTALED */}
      {statusModal.show && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 z-[100]">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-50'} w-full max-w-sm rounded-[1.8rem] sm:rounded-[3.5rem] p-6 sm:p-10 text-center shadow-2xl border animate-in zoom-in-95 duration-500 relative overflow-hidden`}>
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-transform duration-700 ${statusModal.type === 'success' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'} border-4 shadow-inner`}>
                {statusModal.type === 'success' ? <CheckCircle2 size={40} strokeWidth={2.5} /> : <AlertCircle size={40} strokeWidth={2.5} />}
             </div>
             <h3 className={`text-[22px] font-black font-noto leading-tight tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-400 mt-3 font-noto px-4 leading-relaxed">{statusModal.message}</p>
             <button onClick={() => setStatusModal({ ...statusModal, show: false })} className={`w-full mt-8 py-4 font-black rounded-full text-xs uppercase tracking-[0.2em] transition-all shadow-premium active:scale-95 ${statusModal.type === 'success' ? 'bg-[#42f5e9] text-[#0e8a84]' : 'bg-red-500 text-white'}`}>
                {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
             </button>
          </div>
        </div>,
        document.body
      )}
    </Layout>
  );
};

export default App;
