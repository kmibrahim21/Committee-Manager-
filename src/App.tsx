import React, { useState, useEffect } from 'react';
import { supabase } from 'lib/supabase';
import { View, Language, Institution, Profile, Member, Department } from 'types';
import Layout from 'components/Layout';
import Auth from 'pages/Auth';
import Home from 'pages/Home';
import Departments from 'pages/Departments';
import Members from 'pages/Members';
import MemberDetails from 'pages/MemberDetails';
import MemberForm from 'pages/MemberForm';
import CommitteeManagement from 'pages/CommitteeManagement';
import WalletSMS from 'pages/WalletSMS';
import VoiceBroadcast from 'pages/VoiceBroadcast';
import SmsVoiceMenu from 'pages/SmsVoiceMenu';
import MemberParticipation from 'pages/MemberParticipation';
import CommitteeFinances from 'pages/CommitteeFinances';
import Meetings from 'pages/Meetings';
import MeetingMinutes from 'pages/MeetingMinutes';
import Account from 'pages/Account';
import SuperAccount from 'pages/SuperAccount';
import AdminPanel from 'pages/AdminPanel';
import { Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [madrasah, setMadrasah] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('lang') as Language) || 'bn';
  });
  const [currentView, setView] = useState<View>('home');
  const [selectedClass, setSelectedClass] = useState<Department | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const [statusModal, setStatusModal] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const setLang = (l: Language) => {
    localStorage.setItem('lang', l);
    setLangState(l);
  };

  const triggerRefresh = () => {
    setDataVersion((prev) => prev + 1);
  };

  const fetchSessionAndProfile = async () => {
    try {
      setLoading(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        setSession(null);
        setProfile(null);
        setMadrasah(null);
        setLoading(false);
        return;
      }

      setSession(currentSession);
      const userId = currentSession.user.id;

      // 1. Check if there's an executive session stored in localStorage
      const execSessionStr = localStorage.getItem('executive_session');
      if (execSessionStr) {
        try {
          const execData = JSON.parse(execSessionStr);
          if (execData.supabase_email === currentSession.user.email) {
            const tempProfile: Profile = {
              id: execData.id,
              institution_id: execData.institution_id,
              full_name: execData.name,
              role: 'executive',
              is_active: execData.is_active,
              created_at: execData.created_at || new Date().toISOString(),
              permissions: execData.permissions || {},
            };
            setProfile(tempProfile);

            // Fetch institution details
            const { data: instData } = await supabase
              .from('institutions')
              .select('*')
              .eq('id', execData.institution_id)
              .maybeSingle();

            setMadrasah(instData || null);
            setLoading(false);
            return;
          }
        } catch (execErr) {
          console.error('Error parsing executive session from localStorage:', execErr);
        }
      }

      // 2. Fetch administrator/user profile from "profiles" table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);

        // Fetch institution
        if (profileData.institution_id) {
          const { data: instData } = await supabase
            .from('institutions')
            .select('*')
            .eq('id', profileData.institution_id)
            .maybeSingle();
          setMadrasah(instData || null);
        } else if (profileData.role === 'super_admin') {
          setMadrasah(null);
        }
      } else {
        // 3. Fallback for legacy setups where institution ID directly matches auth user ID
        const { data: instData } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (instData) {
          setMadrasah(instData);
          const tempProfile: Profile = {
            id: userId,
            institution_id: userId,
            full_name: instData.name,
            role: instData.is_super_admin ? 'super_admin' : 'org_admin',
            is_active: instData.is_active,
            created_at: instData.created_at || new Date().toISOString(),
            permissions: {
              attendance: true,
              subscriptions: true,
              meetings: true,
              events: true,
              accounting: true,
              voice_broadcast: true,
              sms: true,
              dashboard: true,
              organizations: true,
              approvals: true,
              can_manage_members: true,
              can_manage_departments: true,
              can_send_sms: true,
              can_manage_meetings: true,
              can_manage_accounting: true,
              can_use_voice_call: true,
              can_manage_attendance: true,
              can_manage_organizations: true,
              can_manage_approvals: true,
              can_manage_executives: true,
              can_manage_settings: true,
              can_view_reports: true,
            },
          };
          setProfile(tempProfile);
        } else {
          setProfile(null);
          setMadrasah(null);
        }
      }
    } catch (err) {
      console.error('Error fetching session or profile information:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('executive_session');
    localStorage.removeItem('m_name');
    setProfile(null);
    setMadrasah(null);
    setSession(null);
    setView('home');
  };

  useEffect(() => {
    fetchSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchSessionAndProfile();
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('executive_session');
          localStorage.removeItem('m_name');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dataVersion]);

  // If loading, display a modern loading screen with matching color theme
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-bold tracking-widest text-[10px] uppercase">
          Loading SaaS Portal...
        </p>
      </div>
    );
  }

  // If no logged in session, render clean Auth portal
  if (!session) {
    return <Auth lang={lang} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return (
          <Home
            onMemberClick={(member) => {
              setSelectedMember(member);
              setView('member-details');
            }}
            lang={lang}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            institutionId={profile?.institution_id}
            madrasah={madrasah}
            profile={profile}
            onNavigateToWallet={() => setView('wallet-sms')}
            onNavigateToAccounting={() => setView('accounting')}
            onNavigateToAttendance={() => setView('attendance')}
            onNavigateToExams={() => setView('meetings')}
            onNavigateToClasses={() => setView('departments')}
            onNavigateToMembers={() => setView('members')}
            onNavigateToTeachers={() => setView('executives')}
            onNavigateToVoiceBroadcast={() => setView('voice-broadcast')}
          />
        );
      case 'departments':
        return (
          <Departments
            onClassClick={(cls) => {
              setSelectedClass(cls);
              setView('members');
            }}
            lang={lang}
            madrasah={madrasah}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            profile={profile}
            readOnly={profile?.role === 'executive' && !profile?.permissions?.can_manage_departments}
          />
        );
      case 'members':
        return (
          <Members
            selectedClass={selectedClass}
            onStudentClick={(std) => {
              setSelectedMember(std);
              setView('member-details');
            }}
            onAddClick={() => {
              setSelectedMember(null);
              setView('member-form');
            }}
            onBack={() => setView('departments')}
            lang={lang}
            dataVersion={dataVersion}
            triggerRefresh={triggerRefresh}
            canAdd={profile?.role === 'org_admin' || !!profile?.permissions?.can_manage_members}
            canSendSMS={profile?.role === 'org_admin' || !!profile?.permissions?.can_send_sms}
            institutionId={profile?.institution_id}
            madrasah={madrasah}
            onNavigateToWallet={() => setView('wallet-sms')}
          />
        );
      case 'member-details':
        return (
          <MemberDetails
            student={selectedMember!}
            madrasah={madrasah}
            onEdit={() => setView('member-form')}
            onBack={() => setView(selectedClass ? 'members' : 'home')}
            lang={lang}
            readOnly={profile?.role === 'executive' && !profile?.permissions?.can_manage_members}
            institutionId={profile?.institution_id}
            triggerRefresh={triggerRefresh}
          />
        );
      case 'member-form':
        return (
          <MemberForm
            student={selectedMember}
            madrasah={madrasah}
            defaultClassId={selectedClass?.id}
            isEditing={!!selectedMember}
            onSuccess={() => {
              triggerRefresh();
              setView('members');
            }}
            onCancel={() => setView(selectedMember ? 'member-details' : 'members')}
            lang={lang}
          />
        );
      case 'executives':
        return (
          <CommitteeManagement
            lang={lang}
            organization={madrasah}
            onBack={() => setView('home')}
            role={profile?.role}
            profile={profile}
          />
        );
      case 'wallet-sms':
        return (
          <WalletSMS
            lang={lang}
            madrasah={madrasah}
            onBack={() => setView('home')}
            role={profile?.role || 'executive'}
            profile={profile}
            triggerRefresh={triggerRefresh}
            dataVersion={dataVersion}
          />
        );
      case 'voice-broadcast':
        return (
          <VoiceBroadcast
            lang={lang}
            madrasah={madrasah}
            onBack={() => setView('home')}
            role={profile?.role || 'executive'}
            profile={profile}
            triggerRefresh={triggerRefresh}
            dataVersion={dataVersion}
          />
        );
      case 'sms-voice-menu':
        return (
          <SmsVoiceMenu
            lang={lang}
            madrasah={madrasah}
            onBack={() => setView('home')}
            onNavigateToSms={() => setView('wallet-sms')}
            onNavigateToVoice={() => setView('voice-broadcast')}
            role={profile?.role || 'executive'}
            profile={profile}
          />
        );
      case 'attendance':
        return (
          <MemberParticipation
            lang={lang}
            madrasah={madrasah}
            onBack={() => setView('home')}
            userId={session?.user?.id || ''}
            profile={profile}
          />
        );
      case 'accounting':
        return (
          <CommitteeFinances
            lang={lang}
            madrasah={madrasah}
            onBack={() => setView('home')}
            role={profile?.role || 'executive'}
            profile={profile}
          />
        );
      case 'meetings':
        return (
          <Meetings
            lang={lang}
            madrasah={madrasah}
            onBack={() => setView('home')}
            role={profile?.role || 'executive'}
            onNavigateToFinalResults={() => setView('minutes')}
            profile={profile}
          />
        );
      case 'minutes':
        return (
          <MeetingMinutes
            lang={lang}
            madrasah={madrasah}
            onBack={() => setView('meetings')}
            role={profile?.role || 'executive'}
            profile={profile}
          />
        );
      case 'account':
        return (
          <Account
            lang={lang}
            setLang={setLang}
            onProfileUpdate={triggerRefresh}
            setView={setView}
            initialMadrasah={madrasah}
            onLogout={handleLogout}
            profile={profile}
          />
        );
      case 'super-account':
        return (
          <SuperAccount
            lang={lang}
            setLang={setLang}
            setView={setView}
            onLogout={handleLogout}
            onProfileUpdate={triggerRefresh}
            initialMadrasah={madrasah}
          />
        );
      case 'admin-panel':
        return (
          <AdminPanel
            lang={lang}
            currentView="list"
            dataVersion={dataVersion}
            onProfileUpdate={triggerRefresh}
            madrasah={madrasah}
            profile={profile}
            setStatusModal={setStatusModal}
          />
        );
      case 'admin-dashboard':
        return (
          <AdminPanel
            lang={lang}
            currentView="dashboard"
            dataVersion={dataVersion}
            onProfileUpdate={triggerRefresh}
            madrasah={madrasah}
            profile={profile}
            setStatusModal={setStatusModal}
          />
        );
      case 'admin-approvals':
        return (
          <AdminPanel
            lang={lang}
            currentView="approvals"
            dataVersion={dataVersion}
            onProfileUpdate={triggerRefresh}
            madrasah={madrasah}
            profile={profile}
            setStatusModal={setStatusModal}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 bg-slate-900 border border-slate-800 rounded-3xl m-4">
            <h2 className="text-xl font-bold mb-2 text-red-500">View not found</h2>
            <p className="text-slate-400">The view '{currentView}' is not registered.</p>
            <button
              onClick={() => setView('home')}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
            >
              Go Home
            </button>
          </div>
        );
    }
  };

  return (
    <Layout
      currentView={currentView}
      setView={setView}
      lang={lang}
      madrasah={madrasah}
      profile={profile}
    >
      {renderView()}

      {/* Global Status/Feedback Modal utilized by various SaaS pages */}
      {statusModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setStatusModal({ ...statusModal, show: false })}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                statusModal.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}
            >
              {statusModal.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
            </div>
            <h3 className="text-lg font-black text-white font-noto mb-1">{statusModal.title}</h3>
            <p className="text-slate-400 text-sm font-bold font-noto leading-relaxed">
              {statusModal.message}
            </p>
            <button
              onClick={() => setStatusModal({ ...statusModal, show: false })}
              className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white font-black rounded-xl font-noto"
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
