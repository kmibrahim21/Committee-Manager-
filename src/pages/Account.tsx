
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Fingerprint, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, ShieldAlert, Award, CheckCircle2, Lock, Terminal, Cpu, Calendar as CalendarIcon, MapPin, Play, Moon, Sun, PhoneCall, UserCheck, BookOpen, FileText, Download, Printer } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, View, Profile } from 'types';
import { t } from 'translations';
import { MemberTypeManager } from 'components/MemberTypeManager';
import MultiCalendar from 'components/MultiCalendar';
import { generateMemberFormPDF } from '../utils/pdfGenerator';
import { SONGHO_ACTIVITIES, getDefaultSonghoActivityIds } from '../utils/songhoActivities';

interface AccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  onProfileUpdate?: () => void;
  setView: (view: View) => void;
  initialMadrasah: Institution | null;
  onLogout: () => void;
  profile?: Profile | null;
}

const Account: React.FC<AccountProps> = ({ lang, setLang, onProfileUpdate, setView, initialMadrasah, onLogout, profile }) => {
  const [madrasah, setMadrasah] = useState<Institution | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMemberTypeManager, setShowMemberTypeManager] = useState(false);
  const [showMemberPortalSettings, setShowMemberPortalSettings] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
  const [downloadingForm, setDownloadingForm] = useState(false);
  
  const handleDownloadForm = async () => {
    setDownloadingForm(true);
    try {
      await generateMemberFormPDF(madrasah, lang);
    } catch (e) {
      console.error("Failed to generate PDF form:", e);
    } finally {
      setDownloadingForm(false);
    }
  };
  
  const [stats, setStats] = useState({ students: 0, departments: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [newName, setNewName] = useState(initialMadrasah?.name || '');
  const [newAddress, setNewAddress] = useState(initialMadrasah?.address || '');
  const [newPhone, setNewPhone] = useState(initialMadrasah?.phone || '');
  const [logoUrl, setLogoUrl] = useState(initialMadrasah?.logo_url || '');
  const [songhoActivities, setSonghoActivities] = useState<string[]>(
    Array.isArray(initialMadrasah?.config_json?.songho_activities) && initialMadrasah.config_json.songho_activities.length > 0
      ? initialMadrasah.config_json.songho_activities
      : getDefaultSonghoActivityIds()
  );
  
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = async () => {
    if (!madrasah) return;
    const newTheme = madrasah.theme === 'dark' ? 'default' : 'dark';
    
    try {
      const { error } = await supabase.from('institutions').update({ theme: newTheme }).eq('id', madrasah.id);
      if (error) throw error;
      setMadrasah({ ...madrasah, theme: newTheme });
      if (onProfileUpdate) onProfileUpdate();
    } catch (err: any) {
      console.error('Error toggling theme:', err);
    }
  };

  useEffect(() => {
    if (initialMadrasah) {
      setMadrasah(initialMadrasah);
      setNewName(initialMadrasah.name || '');
      setNewAddress(initialMadrasah.address || '');
      setNewPhone(initialMadrasah.phone || '');
      setLogoUrl(initialMadrasah.logo_url || '');
      if (Array.isArray(initialMadrasah?.config_json?.songho_activities)) {
        setSonghoActivities(initialMadrasah.config_json.songho_activities);
      }
      
      if (initialMadrasah) fetchStats();
    }
  }, [initialMadrasah]);

  const fetchStats = async () => {
    if (!initialMadrasah) return;
    setLoadingStats(true);
    try {
      const { data: profile } = await supabase.from('institutions').select('*').eq('id', initialMadrasah.id).maybeSingle();
      if (profile) setMadrasah(profile);
      const [stdRes, clsRes] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id),
        supabase.from('departments').select('*', { count: 'exact', head: true }).eq('institution_id', initialMadrasah.id)
      ]);
      setStats({ students: stdRes.count || 0, departments: clsRes.count || 0 });
    } catch (e) { console.error(e); } finally { setLoadingStats(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const updatedConfig = (madrasah.institution_type === 'sangha' || madrasah.institution_type === 'union')
        ? {
            ...(madrasah.config_json || {}),
            songho_activities: songhoActivities
          }
        : madrasah.config_json;

      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
        logo_url: logoUrl,
        config_json: updatedConfig
      }).eq('id', madrasah.id);
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setIsEditingProfile(false);
      setMadrasah(prev => prev ? { ...prev, name: newName, address: newAddress, phone: newPhone, config_json: updatedConfig as any } : null);
      setShowSuccessModal({ show: true, title: t('success', lang), message: lang === 'bn' ? 'প্রোফাইল সফলভাবে আপডেট হয়েছে' : 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      const fileName = `logo_${madrasah.id}_${Date.now()}`;
      
      // Try to create bucket if it doesn't exist
      try {
        await supabase.storage.createBucket('madrasah-assets', { public: true });
      } catch (bucketError) {}

      let uploadError;
      let publicUrl;

      // Try madrasah-assets first
      const { error: err1 } = await supabase.storage.from('madrasah-assets').upload(`logos/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
      });

      if (err1) {
        // Fallback to voice-templates bucket which we know exists and is often pre-configured
        const { error: err2 } = await supabase.storage.from('voice-templates').upload(`logos/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });
        uploadError = err2;
        if (!err2) {
          const { data } = supabase.storage.from('voice-templates').getPublicUrl(`logos/${fileName}`);
          publicUrl = data.publicUrl;
        }
      } else {
        const { data } = supabase.storage.from('madrasah-assets').getPublicUrl(`logos/${fileName}`);
        publicUrl = data.publicUrl;
      }

      if (uploadError && uploadError.message !== 'Bucket not found') throw uploadError;
      
      // If both failed due to bucket issues, we might need to inform the user or use a different strategy
      if (!publicUrl) throw new Error('Could not upload logo. Please ensure storage buckets are configured.');

      const { error: updateErr } = await supabase.from('institutions').update({ logo_url: publicUrl }).eq('id', madrasah.id);
      if (updateErr) throw updateErr;

      setLogoUrl(publicUrl);
      setMadrasah(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      if (onProfileUpdate) onProfileUpdate();
      setShowSuccessModal({ show: true, title: 'সফল', message: 'লোগো আপডেট হয়েছে।' });
    } catch (e: any) { 
      console.error('Upload error:', e);
      alert((lang === 'bn' ? 'লোগো আপলোডে সমস্যা: ' : 'Logo upload failed: ') + e.message); 
    } finally { setSaving(false); }
  };

  const handleChangePin = async () => {
    if (!newPin || !confirmPin) {
      setPinError(lang === 'bn' ? 'পিন প্রদান করুন' : 'Please enter PIN');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError(lang === 'bn' ? 'পিন মিলছে না' : 'PINs do not match');
      return;
    }
    if (newPin.length < 4) {
      setPinError(lang === 'bn' ? 'পিন কমপক্ষে ৪ অক্ষরের হতে হবে' : 'PIN must be at least 4 characters');
      return;
    }

    setSaving(true);
    setPinError('');
    try {
      const { error } = await supabase
        .from('executives')
        .update({ pin: newPin })
        .eq('user_id', profile?.id);

      if (error) throw error;
      
      setShowChangePin(false);
      setNewPin('');
      setConfirmPin('');
      setShowSuccessModal({ show: true, title: lang === 'bn' ? 'সফল' : 'Success', message: lang === 'bn' ? 'পিন সফলভাবে আপডেট হয়েছে' : 'PIN updated successfully' });
    } catch (err: any) {
      setPinError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!madrasah) return null;

  const displayName = madrasah?.name || 'User';

  const role = profile?.role || 'executive';
  const isAdmin = role === 'org_admin' || role === 'super_admin';
  const isMember = role === 'member';
  const canManageAccounting = isAdmin || (isMember ? !!madrasah?.member_portal_config?.permissions?.view_finances : !!profile?.permissions?.can_manage_accounting);

  let config = madrasah?.config_json as any;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (e) {
      config = {};
    }
  }
  const configObj: any = (typeof config === 'object' && config !== null) ? config : {};
  const subscriptionsEnabled = configObj.modules?.subscriptions ?? true;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-36 relative z-10">

      <div className="relative pt-20 px-1">
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[4rem] p-6 sm:p-10 pt-28 md:pt-36 shadow-bubble border relative text-center`}>
          <div className="absolute inset-0 overflow-hidden rounded-[4rem]">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-[#42f5e9] to-[#0fb5ab] opacity-[0.05]" />
          </div>
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="relative group">
              <div className={`w-40 h-40 p-4 rounded-full shadow-bubble border-[12px] flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-50'}`}>
                {logoUrl ? <img src={logoUrl} className="w-full h-full object-contain" alt="Profile" /> : <div className={`w-full h-full rounded-full flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#0fb5ab]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}><UserIcon size={70} strokeWidth={1.5} /></div>}
              </div>
              {madrasah && madrasah.id !== 'super_admin' && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute bottom-2 right-2 w-11 h-11 bg-[#42f5e9] text-[#0fb5ab] rounded-2xl flex items-center justify-center shadow-premium border-4 border-white active:scale-90 transition-all z-30"
                >
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>
          <div className="space-y-6 mt-4">
             <div className="space-y-1">
               <div className="px-4 pb-3">
                 <h2 className={`text-[22px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{displayName}</h2>
               </div>
               
               <div className="flex flex-col items-center gap-1 mt-3">
                {madrasah?.address && (
                  <div className="flex items-center justify-center gap-1.5 text-slate-400">
                    <MapPin size={14} />
                    <p className="text-xs font-bold">{madrasah.address}</p>
                  </div>
                )}
                {madrasah?.phone && (
                  <div className="flex items-center justify-center gap-1.5 text-slate-400">
                    <Smartphone size={14} />
                    <p className="text-xs font-bold">{madrasah.phone}</p>
                  </div>
                )}
                {madrasah?.email && (
                  <div className="flex items-center justify-center gap-1.5 text-slate-400">
                    <Mail size={14} />
                    <p className="text-xs font-bold">{madrasah.email}</p>
                  </div>
                )}
              </div>
            </div>
            
            {madrasah && madrasah.id !== 'super_admin' && (
              <>
                <div className="pt-4 space-y-3">
                   <div onClick={() => copyToClipboard(madrasah.id)} className={`p-5 rounded-[2.5rem] border flex items-center gap-5 active:scale-[0.98] cursor-pointer group ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-[#42f5e9]' : 'bg-white border-slate-100 text-[#0fb5ab]'}`}>
                       <Fingerprint size={24} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                         <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{t('madrasah_uuid', lang)}</p>
                         <p className={`text-[12px] font-black truncate ${madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{madrasah.id}</p>
                      </div>
                      {copiedId ? <Check size={22} className="text-emerald-500 shrink-0" /> : <Copy size={20} className="text-slate-200 shrink-0" />}
                   </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Options Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-1">
        {/* Academic Calendar Card */}
        <button 
          onClick={() => setView('academic-calendar')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'ছুটি ও ইভেন্ট' : 'Holidays'}
            </p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingProfile(true)} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Edit3 size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{t('profile_settings', lang)}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('branding', lang)}</p>
          </div>
        </button>

        <button 
          onClick={() => setView('data-management')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Database size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('backup_restore', lang)}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Excel Tools</p>
          </div>
        </button>

                {madrasah?.institution_type === 'association' && (
        <button 
          onClick={() => setView('management')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sliders size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'ম্যানেজমেন্ট (নীতিমালা)' : 'Management (Policies)'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'সমিতির ধরন ও নিয়ম' : 'Type & Rules'}
            </p>
          </div>
        </button>
        )}

        {(madrasah?.institution_type === 'sangha' || madrasah?.institution_type === 'union') && (
        <button 
          onClick={() => setView('management')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sliders size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'ম্যানেজমেন্ট (কার্যক্রম ও নীতি)' : 'Management (Activities & Rules)'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'কার্যক্রম ও প্রকল্প নির্ধারণ' : 'Activities & Schemes'}
            </p>
          </div>
        </button>
        )}

{/* Executive Committee Card */}
        <button 
          onClick={() => setView('executives')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserCheck size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'কার্যনির্বাহী কমিটি' : 'Executive Committee'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'কমিটি মেম্বারস' : 'Committee Members'}
            </p>
          </div>
        </button>

        {/* Video Tutorial Card */}
        <button 
          onClick={() => setView('tutorials')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {lang === 'bn' ? 'টিউটোরিয়াল' : 'Video Tutorials'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'সহায়তা' : 'Help & Support'}
            </p>
          </div>
        </button>

        {/* Voting & Polls Card */}
        <button 
          onClick={() => setView('polls')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Activity size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {t('voting_polls', lang)}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'সদস্যদের মতামত' : 'Member Opinions'}
            </p>
          </div>
        </button>

        {/* Notice Board Card */}
        <button 
          onClick={() => setView('notice-board')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Bell size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
              {t('notice_board', lang)}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'জরুরী নোটিশ' : 'Announcement'}
            </p>
          </div>
        </button>

        {/* Member Types Config Card */}
        <button 
          onClick={() => setShowMemberTypeManager(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Layers size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'সদস্য ধরন' : 'Member Types'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'কাস্টম ক্যাটাগরি' : 'Custom Types'}
            </p>
          </div>
        </button>

        {/* Member Portal Settings Card */}
        <button 
          onClick={() => setShowMemberPortalSettings(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Smartphone size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {lang === 'bn' ? 'সদস্য পোর্টাল' : 'Member Portal'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'পারমিশন ম্যানেজ' : 'Manage Permissions'}
            </p>
          </div>
        </button>

        {/* Subscriptions Card */}
        {canManageAccounting && subscriptionsEnabled && (
          <button 
            onClick={() => setView('subscriptions')}
            className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <div className="w-14 h-14 bg-emerald-50 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CreditCard size={24} />
            </div>
            <div>
              <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                {lang === 'bn' ? 'ফী/বকেয়া' : 'Dues'}
              </h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscriptions'}
              </p>
            </div>
          </button>
        )}

        {/* Member Form PDF Download Card */}
        <button 
          onClick={handleDownloadForm}
          disabled={downloadingForm}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 disabled:opacity-60 disabled:pointer-events-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            {downloadingForm ? <Loader2 className="animate-spin text-[#2563EB]" size={24} /> : <FileText size={24} />}
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
              {lang === 'bn' ? 'সদস্য ফর্ম PDF' : 'Member Form PDF'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {downloadingForm ? (lang === 'bn' ? 'ডাউনলোড হচ্ছে...' : 'Downloading...') : (lang === 'bn' ? 'অফলাইন ফরম ডাউনলোড' : 'Offline Registration Form')}
            </p>
          </div>
        </button>

        {/* Language Card */}
        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Languages size={24} />
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('language', lang)}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{t('change_lang', lang)}</p>
            </div>
          </div>
          <div className={`flex p-1 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <button 
              onClick={() => setLang('bn')} 
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#42f5e9] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
            >
              বাংলা
            </button>
            <button 
              onClick={() => setLang('en')} 
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#42f5e9] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
            >
              ENG
            </button>
          </div>
        </div>

        {/* Theme Switcher Card */}
        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/10 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
              {madrasah?.theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}
              </h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                {lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}
              </p>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className={`w-14 h-8 rounded-full p-1 transition-colors relative ${madrasah?.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${madrasah?.theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <button 
          onClick={onLogout} 
          className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all ${madrasah?.theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <LogOut size={24} />
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{t('logout', lang)}</h5>
              <p className="text-[10px] font-bold text-red-300 uppercase tracking-widest mt-1.5">{t('logout_system', lang)}</p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-red-900/50' : 'bg-white text-red-200'}`}>
            <ChevronRight size={20} />
          </div>
        </button>
      </div>

      {/* Member Type Manager - PORTALED */}
      {showMemberTypeManager && madrasah && createPortal(
        <MemberTypeManager 
          institution={madrasah} 
          onClose={() => setShowMemberTypeManager(false)} 
          lang={lang}
        />,
        document.body
      )}

      {/* Member Portal Settings Modal - PORTALED */}
      {showMemberPortalSettings && madrasah && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-md rounded-[3.5rem] p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-500 relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/10 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                      {lang === 'bn' ? 'সদস্য পোর্টাল সেটিংস' : 'Member Portal Settings'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {lang === 'bn' ? 'অ্যাক্সেস ও পারমিশন কন্ট্রোল' : 'Access & Permission Control'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMemberPortalSettings(false)} 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className={`p-4 rounded-3xl border flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                      <Zap size={20} />
                    </div>
                    <div>
                      <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                        {lang === 'bn' ? 'পোর্টাল সক্রিয় করুন' : 'Enable Portal'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {lang === 'bn' ? 'সদস্যরা লগইন করতে পারবে' : 'Members can log in'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      const currentConfig = madrasah.member_portal_config || { enabled: false, permissions: { view_meetings: true, view_minutes: true, view_polls: true, view_notices: true, view_finances: false, view_attendance: false } };
                      const newConfig = { ...currentConfig, enabled: !currentConfig.enabled };
                      try {
                        const { error } = await supabase.from('institutions').update({ member_portal_config: newConfig }).eq('id', madrasah.id);
                        if (error) throw error;
                        setMadrasah({ ...madrasah, member_portal_config: newConfig });
                      } catch (err: any) { alert(err.message); }
                    }}
                    className={`w-14 h-8 rounded-full p-1 transition-colors relative ${madrasah.member_portal_config?.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${madrasah.member_portal_config?.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                    {lang === 'bn' ? 'সদস্যদের পারমিশনসমূহ' : 'Member Permissions'}
                  </p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { key: 'view_meetings', labelBn: 'মিটিং দেখুন', labelEn: 'View Meetings', icon: CalendarIcon },
                      { key: 'view_minutes', labelBn: 'মিটিং রেজুলেশন দেখুন', labelEn: 'View Minutes', icon: BookOpen },
                      { key: 'view_polls', labelBn: 'ভোট/মতামত প্রদান করুন', labelEn: 'Participate in Polls', icon: Activity },
                      { key: 'view_notices', labelBn: 'নোটিশ বোর্ড দেখুন', labelEn: 'View Notice Board', icon: Bell },
                      { key: 'view_finances', labelBn: 'আর্থিক হিসাব দেখুন', labelEn: 'View Financials', icon: CreditCard },
                      { key: 'view_attendance', labelBn: 'উপস্থিতি রিপোর্ট দেখুন', labelEn: 'View Attendance', icon: UserCheck }
                    ].map((perm) => (
                      <button 
                        key={perm.key}
                        onClick={async () => {
                          const currentConfig = madrasah.member_portal_config || { enabled: false, permissions: { view_meetings: true, view_minutes: true, view_polls: true, view_notices: true, view_finances: false, view_attendance: false } };
                          const newPermissions = { ...currentConfig.permissions, [perm.key]: !((currentConfig.permissions as any)[perm.key]) };
                          const newConfig = { ...currentConfig, permissions: newPermissions };
                          try {
                            const { error } = await supabase.from('institutions').update({ member_portal_config: newConfig }).eq('id', madrasah.id);
                            if (error) throw error;
                            setMadrasah({ ...madrasah, member_portal_config: newConfig });
                          } catch (err: any) { alert(err.message); }
                        }}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all active:scale-[0.98] ${
                          (madrasah.member_portal_config?.permissions as any)?.[perm.key]
                            ? (madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/5 border-[#42f5e9]/30' : 'bg-[#42f5e9]/5 border-[#42f5e9]/20')
                            : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100')
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            (madrasah.member_portal_config?.permissions as any)?.[perm.key]
                              ? 'bg-[#42f5e9] text-[#0fb5ab]'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            <perm.icon size={20} />
                          </div>
                          <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                            {lang === 'bn' ? perm.labelBn : perm.labelEn}
                          </p>
                        </div>
                        {(madrasah.member_portal_config?.permissions as any)?.[perm.key] && (
                          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${madrasah?.theme === 'dark' ? 'bg-amber-900/10 border-amber-900/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold leading-relaxed">
                    {lang === 'bn' 
                      ? 'সদস্যরা তাদের মোবাইল নম্বর এবং সদস্য পরিচিতি নম্বর দিয়ে লগইন করতে পারবে। নিশ্চিত করুন যে সদস্যদের তথ্য সঠিকভাবে আপডেট করা আছে।' 
                      : 'Members can log in using their mobile number and member ID number. Ensure member data is updated correctly.'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowMemberPortalSettings(false)}
                className="w-full py-4 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-2xl shadow-premium active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close Settings'}
              </button>
           </div>
        </div>,
        document.body
      )}

      {/* Change PIN Modal - PORTALED */}
      {showChangePin && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-rose-900/30 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                    <Key size={20} />
                  </div>
                  <h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                    {lang === 'bn' ? 'পিন পরিবর্তন' : 'Change PIN'}
                  </h3>
                </div>
                <button onClick={() => { setShowChangePin(false); setPinError(''); setNewPin(''); setConfirmPin(''); }} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'নতুন পিন' : 'New PIN'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#0fb5ab] focus:border-[#42f5e9]/30'}`} 
                     value={newPin} 
                     onChange={(e) => setNewPin(e.target.value)} 
                     placeholder="****"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'পিন নিশ্চিত করুন' : 'Confirm PIN'}</label>
                   <input 
                     type="password" 
                     className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#0fb5ab] focus:border-[#42f5e9]/30'}`} 
                     value={confirmPin} 
                     onChange={(e) => setConfirmPin(e.target.value)} 
                     placeholder="****"
                   />
                 </div>
                 
                 {pinError && <p className="text-xs text-red-500 font-bold px-1">{pinError}</p>}
                 
                 <button 
                   onClick={handleChangePin} 
                   disabled={saving}
                   className="w-full h-12 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-2xl shadow-premium active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                 >
                   {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                   {lang === 'bn' ? 'আপডেট করুন' : 'Update PIN'}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Edit Profile Modal - PORTALED */}
      {isEditingProfile && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3.5rem] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 relative max-h-[85vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-[#0fb5ab]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}><Edit3 size={20} /></div><h3 className={`text-xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>অ্যাকাউন্ট আপডেট</h3></div>
                <button onClick={() => setIsEditingProfile(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-300'}`}><X size={20} /></button>
              </div>

              <div className="space-y-3.5">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_name', lang)}</label><input type="text" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#0fb5ab] focus:border-[#42f5e9]/30'}`} value={newName || ''} onChange={(e) => setNewName(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{lang === 'bn' ? 'ঠিকানা' : 'Address'}</label><input type="text" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#0fb5ab] focus:border-[#42f5e9]/30'}`} value={newAddress || ''} onChange={(e) => setNewAddress(e.target.value)} /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('madrasah_phone', lang)}</label><input type="tel" className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#0fb5ab] focus:border-[#42f5e9]/30'}`} value={newPhone || ''} onChange={(e) => setNewPhone(e.target.value)} /></div>

                 {(madrasah?.institution_type === 'sangha' || madrasah?.institution_type === 'union') && (
                   <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                     <label className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-widest px-1 flex items-center justify-between">
                       <span>{lang === 'bn' ? 'সংঘের কার্যক্রমসমূহ (মাল্টি-সিলেক্ট)' : 'Sangha Activities (Multi-Select)'}</span>
                       <span className="text-[9px] font-bold text-slate-400 lowercase">{songhoActivities.length} টি নির্বাচিত</span>
                     </label>
                     <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                       {SONGHO_ACTIVITIES.map(act => {
                         const isSelected = songhoActivities.includes(act.id);
                         const ActIcon = act.icon;
                         return (
                           <button
                             type="button"
                             key={act.id}
                             onClick={() => {
                               setSonghoActivities(prev => 
                                 isSelected 
                                   ? (prev.length > 1 ? prev.filter(x => x !== act.id) : prev)
                                   : [...prev, act.id]
                               );
                             }}
                             className={`p-2 rounded-xl border text-left flex items-center gap-2 text-xs transition-all ${
                               isSelected
                                 ? 'bg-[#42f5e9]/15 border-[#0fb5ab] text-[#0fb5ab] font-black shadow-xs'
                                 : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 font-medium opacity-80'
                             }`}
                           >
                             <span className="shrink-0"><ActIcon size={14} /></span>
                             <span className="truncate text-[11px] font-noto leading-tight">{act.labelBn}</span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 <div className="space-y-1 opacity-70 cursor-not-allowed">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                      Gmail / Email
                      <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-500/10 px-1.5 py-0.5 rounded-md">read-only</span>
                    </label>
                    <input type="email" readOnly disabled className={`w-full h-11 border rounded-xl px-4 font-black text-sm outline-none cursor-not-allowed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} value={madrasah?.email || (lang === 'bn' ? 'অ্যাসাইন করা হয়নি' : 'Not assigned')} />
                 </div>
              </div>
              <div className="flex gap-2 pt-2 shrink-0">
                 <button onClick={() => setIsEditingProfile(false)} className={`flex-1 py-4 font-black rounded-2xl text-[10px] uppercase ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>বাতিল</button>
                 <button onClick={handleUpdate} disabled={saving} className="flex-[2] py-4 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-2xl text-[10px] uppercase shadow-premium flex items-center justify-center gap-2">{saving ? <Loader2 className="animate-spin" size={16} /> : 'সংরক্ষণ করুন'}</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default Account;
