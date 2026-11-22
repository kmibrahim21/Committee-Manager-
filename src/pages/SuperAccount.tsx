
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Loader2, User as UserIcon, ShieldCheck, ChevronRight, Smartphone, Save, Sliders, CreditCard, LayoutDashboard, X, Play, Mic, Moon, Sun, Languages, Globe, CheckCircle2, Users, Bell, AlertCircle } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, View } from 'types';
import { t } from 'translations';

interface SuperAccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  setView: (view: View) => void;
  onLogout: () => void;
  onProfileUpdate?: () => void;
  initialMadrasah: Institution | null;
}

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const normalizePaymentNumber = (val: string): string =>
  String(val || '').replace(/[০-৯]/g, d => BN_TO_EN_DIGITS[d] || d).trim();

const SuperAccount: React.FC<SuperAccountProps> = ({ lang, setLang, setView, onLogout, onProfileUpdate, initialMadrasah }) => {
  const [madrasah, setMadrasah] = useState<Institution | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingBulkSMS, setIsEditingBulkSMS] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [bulkSmsError, setBulkSmsError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const formatDigitsByLang = (str: string | undefined | null, currentLang: Language): string => {
    if (!str) return 'N/A';
    const bnToEn: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
    const enToBn: Record<string, string> = { '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯' };
    if (currentLang === 'en') {
      return str.replace(/[০-৯]/g, d => bnToEn[d] || d);
    }
    return str.replace(/[0-9]/g, d => enToBn[d] || d);
  };

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (e) {
      console.error(e);
      setIsLoggingOut(false);
    }
  };

  const [globalSettings, setGlobalSettings] = useState<{
    id: string | number | null;
    reve_api_key: string;
    reve_secret_key: string;
    reve_client_id: string;
    reve_caller_id: string;
    reve_non_masking_id: string;
    automas_api_key: string;
    automas_non_masking_sender_id: string;
    automas_masking_sender_id: string;
    bkash_number: string;
    nagad_number: string;
    sms_rate: number;
    non_masking_rate: number;
    masking_rate: number;
    default_sms_type: 'non_masking' | 'masking';
    voice_rate: number;
  }>({
    id: null,
    reve_api_key: '',
    reve_secret_key: '',
    reve_client_id: '',
    reve_caller_id: '',
    reve_non_masking_id: '',
    automas_api_key: '',
    automas_non_masking_sender_id: '',
    automas_masking_sender_id: '',
    bkash_number: '',
    nagad_number: '',
    sms_rate: 0.35,
    non_masking_rate: 0.35,
    masking_rate: 0.55,
    default_sms_type: 'non_masking',
    voice_rate: 0.50
  });

  useEffect(() => {
    fetchGlobalSettings();
  }, []);

  const applySettingsRow = (row: any) => {
    if (!row) return;
    let providerCfg: any = row.sms_provider_config;
    if (typeof providerCfg === 'string') {
      try { providerCfg = JSON.parse(providerCfg); } catch { providerCfg = {}; }
    }
    providerCfg = providerCfg && typeof providerCfg === 'object' ? providerCfg : {};

    const nonMaskingRate =
      Number(providerCfg?.non_masking_rate) > 0
        ? Number(providerCfg.non_masking_rate)
        : Number(row.sms_rate) > 0
          ? Number(row.sms_rate)
          : 0.35;

    const maskingRate =
      Number(providerCfg?.masking_rate) > 0
        ? Number(providerCfg.masking_rate)
        : 0.55;

    setGlobalSettings({
      id: row.id ?? null,
      reve_api_key: row.reve_api_key || providerCfg?.reve?.api_key || '',
      reve_secret_key: row.reve_secret_key || providerCfg?.reve?.secret_key || '',
      reve_client_id: row.reve_client_id || providerCfg?.reve?.client_id || '',
      reve_caller_id: row.reve_caller_id || providerCfg?.reve?.caller_id || '',
      reve_non_masking_id: row.reve_non_masking_id || providerCfg?.reve?.non_masking_id || row.reve_caller_id || '',
      automas_api_key: row.automas_api_key || providerCfg?.automas?.api_key || '',
      automas_non_masking_sender_id: row.automas_non_masking_sender_id || providerCfg?.automas?.non_masking_sender_id || '',
      automas_masking_sender_id: row.automas_masking_sender_id || providerCfg?.automas?.masking_sender_id || '',
      bkash_number: row.bkash_number || '',
      nagad_number: row.nagad_number || '',
      sms_rate: nonMaskingRate,
      non_masking_rate: nonMaskingRate,
      masking_rate: maskingRate,
      default_sms_type: providerCfg?.default_type === 'masking' ? 'masking' : 'non_masking',
      voice_rate: Number(row.voice_rate) > 0 ? Number(row.voice_rate) : 0.50
    });
  };

  const fetchGlobalSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/admin/system-settings', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.settings) {
            applySettingsRow(json.settings);
            return;
          }
        }
      }
    } catch {
      // Fallback to client query below
    }

    const settings = await smsApi.getGlobalSettings();
    applySettingsRow(settings);
  };

  const persistSystemSettings = async (payload: Record<string, any>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      let apiResponse: { status: number; rawText: string; json: any } | null = null;
      try {
        const res = await fetch('/api/admin/system-settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify(payload)
        });
        const rawText = await res.text();
        let json: any = {};
        try {
          json = rawText ? JSON.parse(rawText) : {};
        } catch {
          json = {};
        }
        apiResponse = { status: res.status, rawText, json };
      } catch (networkErr: any) {
        console.warn('System settings API network error, falling back to direct Supabase:', networkErr?.message || networkErr);
      }

      if (apiResponse) {
        const { status, rawText, json } = apiResponse;
        if (status >= 200 && status < 300 && json?.success && json?.settings) {
          return json.settings;
        }
        const serverMessage =
          json?.error ||
          (rawText && !rawText.trim().startsWith('<') ? rawText.slice(0, 220) : '');

        const shouldFallback =
          status === 404 ||
          status >= 500 ||
          /FUNCTION_INVOCATION_FAILED|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL|ERR_MODULE_NOT_FOUND/i.test(
            `${serverMessage} ${rawText}`
          );

        if (!shouldFallback) {
          throw new Error(serverMessage || `Failed to update settings (${status})`);
        }
        console.warn('System settings API fallback triggered:', status, serverMessage);
      }
    }

    // Fallback: direct Supabase update using the actual existing row ID
    const { data: existingRow, error: lookupErr } = await supabase
      .from('system_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    const targetId = existingRow?.id ?? globalSettings.id;

    if (targetId !== null && targetId !== undefined) {
      const safePayload: Record<string, any> = {};
      if (existingRow && typeof existingRow === 'object') {
        const hasJsonbCfg = Object.prototype.hasOwnProperty.call(existingRow, 'sms_provider_config');
        for (const [k, v] of Object.entries(payload)) {
          if (Object.prototype.hasOwnProperty.call(existingRow, k)) {
            safePayload[k] = v;
          } else if (!hasJsonbCfg && v !== '' && v !== null && v !== undefined) {
            safePayload[k] = v;
          }
        }
      } else {
        Object.assign(safePayload, payload);
      }

      const { data: updatedRow, error: updateErr } = await supabase
        .from('system_settings')
        .update(safePayload)
        .eq('id', targetId)
        .select('*')
        .maybeSingle();

      if (updateErr) throw updateErr;
      if (!updatedRow) {
        throw new Error(
          lang === 'bn'
            ? 'ডাটাবেস আপডেট অনুমোদিত হয়নি (RLS বা কোনো রো পাওয়া যায়নি)।'
            : 'Update did not affect any row. Please check database permissions or row existence.'
        );
      }
      return updatedRow;
    }

    const { data: insertedRow, error: insertErr } = await supabase
      .from('system_settings')
      .insert(payload)
      .select('*')
      .single();

    if (insertErr) throw insertErr;
    return insertedRow;
  };

  const handleSaveBulkSMS = async () => {
    setSaving(true);
    setBulkSmsError('');
    try {
      const nonMaskingRate = Number(globalSettings.non_masking_rate) > 0 ? Number(globalSettings.non_masking_rate) : 0.35;
      const maskingRate = Number(globalSettings.masking_rate) > 0 ? Number(globalSettings.masking_rate) : 0.55;
      const voiceRate = Number(globalSettings.voice_rate) > 0 ? Number(globalSettings.voice_rate) : 0.50;

      const reveApiKey = (globalSettings.reve_api_key || '').trim();
      const reveSecretKey = (globalSettings.reve_secret_key || '').trim();
      const reveClientId = (globalSettings.reve_client_id || '').trim();
      const reveNonMaskingId = (globalSettings.reve_non_masking_id || globalSettings.reve_caller_id || '').trim();
      const reveCallerId = (globalSettings.reve_caller_id || reveNonMaskingId).trim();

      const automasApiKey = (globalSettings.automas_api_key || '').trim();
      const automasNonMaskingSenderId = (globalSettings.automas_non_masking_sender_id || '').trim();
      const automasMaskingSenderId = (globalSettings.automas_masking_sender_id || '').trim();

      const smsProviderConfig = {
        default_type: globalSettings.default_sms_type,
        masking_rate: maskingRate,
        non_masking_rate: nonMaskingRate,
        primary: {
          masking: 'reve',
          non_masking: 'automas'
        },
        reve: {
          api_key: reveApiKey,
          secret_key: reveSecretKey,
          client_id: reveClientId,
          caller_id: reveCallerId,
          non_masking_id: reveNonMaskingId
        },
        automas: {
          api_key: automasApiKey,
          non_masking_sender_id: automasNonMaskingSenderId,
          masking_sender_id: automasMaskingSenderId
        }
      };

      const savedRow = await persistSystemSettings({
        reve_api_key: reveApiKey,
        reve_secret_key: reveSecretKey,
        reve_client_id: reveClientId,
        reve_caller_id: reveCallerId,
        reve_non_masking_id: reveNonMaskingId,
        automas_api_key: automasApiKey,
        automas_non_masking_sender_id: automasNonMaskingSenderId,
        automas_masking_sender_id: automasMaskingSenderId,
        sms_rate: nonMaskingRate,
        voice_rate: voiceRate,
        sms_provider_config: smsProviderConfig
      });
      applySettingsRow(savedRow);
      setIsEditingBulkSMS(false);
      setShowSuccessModal({
        show: true,
        title: lang === 'bn' ? 'SMS গেটওয়ে ও রেট আপডেট' : 'SMS Gateway & Rates Updated',
        message: lang === 'bn'
          ? 'REVE, Automas এবং Masking / Non-Masking রেট সফলভাবে আপডেট হয়েছে।'
          : 'REVE, Automas & Masking / Non-Masking rates updated successfully.'
      });
      fetchGlobalSettings();
    } catch (err: any) {
      setBulkSmsError(err?.message || (lang === 'bn' ? 'সেটিংস আপডেট করতে সমস্যা হয়েছে।' : 'Failed to update settings.'));
    } finally { setSaving(false); }
  };

  const handleSavePayment = async () => {
    setPaymentError('');
    const cleanBkash = normalizePaymentNumber(globalSettings.bkash_number);
    const cleanNagad = normalizePaymentNumber(globalSettings.nagad_number);

    if (!cleanBkash && !cleanNagad) {
      setPaymentError(
        lang === 'bn'
          ? 'কমপক্ষে বিকাশ অথবা নগদ নম্বর প্রদান করুন।'
          : 'Please enter at least a bKash or Nagad number.'
      );
      return;
    }

    setSaving(true);
    try {
      const savedRow = await persistSystemSettings({
        bkash_number: cleanBkash,
        nagad_number: cleanNagad
      });
      applySettingsRow(savedRow);
      setIsEditingPayment(false);
      setShowSuccessModal({
        show: true,
        title: lang === 'bn' ? 'পেমেন্ট আপডেট' : 'Payment Updated',
        message: lang === 'bn' ? 'বিকাশ ও নগদ মাস্টার পেমেন্ট নম্বর সফলভাবে আপডেট হয়েছে।' : 'bKash & Nagad master payment numbers updated successfully.'
      });
      fetchGlobalSettings();
    } catch (err: any) {
      if (err?.message?.includes('nagad_number')) {
        setPaymentError('Database column "nagad_number" is missing in system_settings. Please run: ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS nagad_number TEXT;');
      } else {
        setPaymentError(err?.message || (lang === 'bn' ? 'পেমেন্ট নম্বর আপডেট করা যায়নি।' : 'Failed to update payment numbers.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleTheme = async () => {
    const currentTheme = madrasah?.theme || localStorage.getItem('super_admin_theme') || 'default';
    const newTheme = currentTheme === 'dark' ? 'default' : 'dark';
    localStorage.setItem('super_admin_theme', newTheme);
    setMadrasah(prev => prev ? { ...prev, theme: newTheme } : { id: 'super_admin', name: 'Super Admin', theme: newTheme } as any);
    if (onProfileUpdate) onProfileUpdate();
  };

  const displayName = lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin';

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
                <div className={`w-full h-full rounded-full flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}><UserIcon size={70} strokeWidth={1.5} /></div>
              </div>
            </div>
          </div>
          <div className="space-y-6 mt-4">
             <div className="space-y-1">
               <div className="px-4 pb-3">
                 <h2 className={`text-[22px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{displayName}</h2>
               </div>
               <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">System Controller</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-1">
        <button 
          onClick={() => setView('admin-tutorials')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{lang === 'bn' ? 'টিউটোরিয়াল ম্যানেজ' : 'Manage Tutorials'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Video Guides</p>
          </div>
        </button>

        <button 
          onClick={() => setView('admin-voice-service')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Mic size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{lang === 'bn' ? 'ভয়েস ড্যাশবোর্ড' : 'Voice Dashboard'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Service Control</p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingBulkSMS(true)} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sliders size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>{lang === 'bn' ? 'রেট ম্যানেজমেন্ট' : 'Rates Management'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Communication Rates</p>
          </div>
        </button>

        <button 
          onClick={() => setView('admin-panel')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>{lang === 'bn' ? 'কমিটি ম্যানেজমেন্ট' : 'Committee Management'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage All Committees</p>
          </div>
        </button>

        <button 
          onClick={() => setView('admin-managers')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#BFE8DD] text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>
              {lang === 'bn' ? 'ম্যানেজার প্যানেল' : 'Manager Panel'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'ম্যানেজার ও পারমিশন' : 'Managers & Roles'}
            </p>
          </div>
        </button>

        <button 
          onClick={() => setView('executives')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserIcon size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>
              {lang === 'bn' ? 'কার্যনির্বাহী কমিটি' : 'Executive Committee'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'কমিটি মেম্বারস' : 'Committee Members'}
            </p>
          </div>
        </button>

        {/* Voting & Polls Card */}
        <button 
          onClick={() => setView('polls')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>
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
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>
              {t('notice_board', lang)}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'জরুরী নোটিশ' : 'Announcement'}
            </p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingBulkSMS(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>Bulk SMS</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Master Gateway</p>
          </div>
        </button>

        <button 
          onClick={() => setView('admin-voice-service')}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Mic size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>
              {lang === 'bn' ? 'ভয়েস সার্ভিস' : 'Voice Service'}
            </h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'আপলোড ও ডিরেক্ট কল' : 'Upload & Direct Call'}
            </p>
          </div>
        </button>
        
        <button 
          onClick={() => {
            setPaymentError('');
            setIsEditingPayment(true);
          }}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <CreditCard size={24} />
          </div>
          <div className="w-full min-w-0">
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>Master Payment</h5>
            <div className="text-[10px] font-bold text-slate-400 mt-1.5 space-y-0.5 tabular-nums">
              <p className="truncate">
                <span className="text-[#E2136E] font-black">{lang === 'bn' ? 'বিকাশ:' : 'bKash:'}</span> {formatDigitsByLang(globalSettings.bkash_number, lang)}
              </p>
              <p className="truncate">
                <span className="text-[#F6921E] font-black">{lang === 'bn' ? 'নগদ:' : 'Nagad:'}</span> {formatDigitsByLang(globalSettings.nagad_number, lang)}
              </p>
            </div>
          </div>
        </button>

        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Languages size={24} />
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>{t('language', lang)}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{t('change_lang', lang)}</p>
            </div>
          </div>
          <div className={`flex p-1 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <button onClick={() => setLang('bn')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#42f5e9] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}>বাংলা</button>
            <button onClick={() => setLang('en')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#42f5e9] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}>ENG</button>
          </div>
        </div>

        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/10 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
              {madrasah?.theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>{lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}</p>
            </div>
          </div>
            <button onClick={toggleTheme} className={`w-14 h-8 rounded-full relative transition-all duration-300 ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]' : 'bg-slate-200'}`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${madrasah?.theme === 'dark' ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <button 
          onClick={handleLogoutClick} 
          disabled={isLoggingOut}
          className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none ${madrasah?.theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              {isLoggingOut ? <Loader2 className="animate-spin text-red-600" size={24} /> : <LogOut size={24} />}
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                {isLoggingOut ? (lang === 'bn' ? 'লগআউট হচ্ছে...' : 'Logging out...') : t('logout', lang)}
              </h5>
              <p className="text-[10px] font-bold text-red-300 uppercase tracking-widest mt-1.5">{t('logout_system', lang)}</p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-red-900/50' : 'bg-white text-red-200'}`}>
            <ChevronRight size={20} />
          </div>
        </button>
      </div>

      {isEditingBulkSMS && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-lg rounded-[2.75rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[88vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 sm:px-6 shrink-0 relative overflow-hidden border-b border-slate-100/80 dark:border-slate-800">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/10 text-[#42f5e9] border-[#42f5e9]/20' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20'}`}><LayoutDashboard size={20} strokeWidth={2.5} /></div>
                       <div>
                         <h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                           {lang === 'bn' ? 'মাস্টার SMS গেটওয়ে ও রেট' : 'Master SMS Gateway & Rates'}
                         </h3>
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">REVE (Masking) & Automas (Non-Masking)</p>
                       </div>
                    </div>
                    <button onClick={() => setIsEditingBulkSMS(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>

              <div className="px-5 sm:px-6 py-5 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 {/* Section 1: Service Rates */}
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                      {lang === 'bn' ? 'সার্ভিস রেট (প্রতি ইউনিট)' : 'Service Rates (Per Unit)'}
                    </h4>
                    <div className={`p-4 rounded-[1.8rem] border space-y-3.5 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-[#0fb5ab] uppercase px-1 block">Non-Masking SMS (৳)</label>
                           <input
                             type="number"
                             step="0.01"
                             min="0.01"
                             className={`w-full h-11 rounded-xl px-3.5 font-black text-xs tabular-nums outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/60' : 'bg-white border-slate-200 text-[#0e8a84] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.non_masking_rate}
                             onChange={(e) => {
                               const v = parseFloat(e.target.value);
                               setGlobalSettings({ ...globalSettings, non_masking_rate: Number.isFinite(v) ? v : 0, sms_rate: Number.isFinite(v) ? v : 0 });
                             }}
                           />
                           <p className="text-[9px] font-bold text-slate-400 px-1 tabular-nums">
                             ৳100 = {globalSettings.non_masking_rate > 0 ? Math.ceil(100 / globalSettings.non_masking_rate) : 286} SMS
                           </p>
                         </div>

                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-indigo-500 uppercase px-1 block">Masking SMS (৳)</label>
                           <input
                             type="number"
                             step="0.01"
                             min="0.01"
                             className={`w-full h-11 rounded-xl px-3.5 font-black text-xs tabular-nums outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-indigo-400 focus:border-indigo-400/60' : 'bg-white border-slate-200 text-indigo-600 focus:border-indigo-500'}`}
                             value={globalSettings.masking_rate}
                             onChange={(e) => {
                               const v = parseFloat(e.target.value);
                               setGlobalSettings({ ...globalSettings, masking_rate: Number.isFinite(v) ? v : 0 });
                             }}
                           />
                           <p className="text-[9px] font-bold text-slate-400 px-1 tabular-nums">
                             ৳100 = {globalSettings.masking_rate > 0 ? Math.ceil(100 / globalSettings.masking_rate) : 182} SMS
                           </p>
                         </div>

                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1 block">Voice Call (৳)</label>
                           <input
                             type="number"
                             step="0.01"
                             min="0.01"
                             className={`w-full h-11 rounded-xl px-3.5 font-black text-xs tabular-nums outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/60' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.voice_rate}
                             onChange={(e) => {
                               const v = parseFloat(e.target.value);
                               setGlobalSettings({ ...globalSettings, voice_rate: Number.isFinite(v) ? v : 0 });
                             }}
                           />
                           <p className="text-[9px] font-bold text-slate-400 px-1">Per Call Unit</p>
                         </div>
                       </div>

                       {/* Default SMS Type Selector */}
                       <div className="pt-1 space-y-1.5">
                         <label className="text-[9px] font-black text-slate-400 uppercase px-1 block">
                           {lang === 'bn' ? 'ডিফল্ট SMS ধরন (Default SMS Type)' : 'Default SMS Type'}
                         </label>
                         <div className="grid grid-cols-2 gap-2">
                           <button
                             type="button"
                             onClick={() => setGlobalSettings({ ...globalSettings, default_sms_type: 'non_masking' })}
                             className={`py-2.5 px-3 rounded-xl border text-left transition-all ${
                               globalSettings.default_sms_type === 'non_masking'
                                 ? 'bg-[#0fb5ab] text-white border-[#0fb5ab] shadow-sm'
                                 : madrasah?.theme === 'dark'
                                   ? 'bg-slate-900 border-slate-700 text-slate-300'
                                   : 'bg-white border-slate-200 text-slate-600'
                             }`}
                           >
                             <span className="text-[11px] font-black block">Non-Masking</span>
                             <span className="text-[9px] font-bold opacity-80 block">Primary: Automas</span>
                           </button>
                           <button
                             type="button"
                             onClick={() => setGlobalSettings({ ...globalSettings, default_sms_type: 'masking' })}
                             className={`py-2.5 px-3 rounded-xl border text-left transition-all ${
                               globalSettings.default_sms_type === 'masking'
                                 ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                 : madrasah?.theme === 'dark'
                                   ? 'bg-slate-900 border-slate-700 text-slate-300'
                                   : 'bg-white border-slate-200 text-slate-600'
                             }`}
                           >
                             <span className="text-[11px] font-black block">Masking</span>
                             <span className="text-[9px] font-bold opacity-80 block">Primary: REVE SMS</span>
                           </button>
                         </div>
                       </div>
                    </div>
                 </div>

                 {/* Section 2: REVE SMS (Masking) */}
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] px-1">
                      REVE SMS (Masking Gateway)
                    </h4>
                    <div className={`p-4 rounded-[1.8rem] border space-y-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1">REVE API Key</label>
                           <input
                             type="text"
                             placeholder="REVE API Key"
                             className={`w-full h-11 rounded-xl px-3.5 font-bold text-[11px] outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/50' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.reve_api_key}
                             onChange={(e) => setGlobalSettings({ ...globalSettings, reve_api_key: e.target.value })}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1">REVE Secret Key</label>
                           <input
                             type="text"
                             placeholder="REVE Secret Key"
                             className={`w-full h-11 rounded-xl px-3.5 font-bold text-[11px] outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/50' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.reve_secret_key}
                             onChange={(e) => setGlobalSettings({ ...globalSettings, reve_secret_key: e.target.value })}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1">Default Masking ID</label>
                           <input
                             type="text"
                             placeholder="e.g. COMMITTEE"
                             className={`w-full h-11 rounded-xl px-3.5 font-bold text-[11px] outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/50' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.reve_client_id}
                             onChange={(e) => setGlobalSettings({ ...globalSettings, reve_client_id: e.target.value })}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1">Non-Masking Caller ID</label>
                           <input
                             type="text"
                             placeholder="e.g. 8809601017065"
                             className={`w-full h-11 rounded-xl px-3.5 font-bold text-[11px] outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/50' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.reve_non_masking_id}
                             onChange={(e) => setGlobalSettings({ ...globalSettings, reve_non_masking_id: e.target.value, reve_caller_id: e.target.value })}
                           />
                         </div>
                       </div>
                    </div>
                 </div>

                 {/* Section 3: Automas SMS (Non-Masking) */}
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-[0.2em] px-1">
                      Automas SMS (Non-Masking Gateway)
                    </h4>
                    <div className={`p-4 rounded-[1.8rem] border space-y-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1">
                         <label className="text-[9px] font-black text-slate-400 uppercase px-1">Automas API Key</label>
                         <input
                           type="text"
                           placeholder="Automas API Key"
                           className={`w-full h-11 rounded-xl px-3.5 font-bold text-[11px] outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/50' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                           value={globalSettings.automas_api_key}
                           onChange={(e) => setGlobalSettings({ ...globalSettings, automas_api_key: e.target.value })}
                         />
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1">Non-Masking Sender ID</label>
                           <input
                             type="text"
                             placeholder="e.g. 0961XXXXXXX"
                             className={`w-full h-11 rounded-xl px-3.5 font-bold text-[11px] outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/50' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.automas_non_masking_sender_id}
                             onChange={(e) => setGlobalSettings({ ...globalSettings, automas_non_masking_sender_id: e.target.value })}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1">Masking Sender ID</label>
                           <input
                             type="text"
                             placeholder="Optional Masking ID"
                             className={`w-full h-11 rounded-xl px-3.5 font-bold text-[11px] outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-[#42f5e9] focus:border-[#42f5e9]/50' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#0fb5ab]'}`}
                             value={globalSettings.automas_masking_sender_id}
                             onChange={(e) => setGlobalSettings({ ...globalSettings, automas_masking_sender_id: e.target.value })}
                           />
                         </div>
                       </div>
                    </div>
                 </div>

                 {bulkSmsError && (
                   <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-start gap-2">
                     <AlertCircle size={15} className="shrink-0 mt-0.5" />
                     <span>{bulkSmsError}</span>
                   </div>
                 )}

                 <div className="pt-1">
                    <button onClick={handleSaveBulkSMS} disabled={saving} className="relative w-full h-14 bg-[#42f5e9] text-[#0e8a84] font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/20 text-xs uppercase tracking-[0.2em] disabled:opacity-60">
                       {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> {lang === 'bn' ? 'সেটিংস সংরক্ষণ করুন' : 'Save Settings'}</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {isEditingPayment && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400 border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}><CreditCard size={20} strokeWidth={2.5} /></div>
                       <div>
                         <h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>Master Payment</h3>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Global bKash & Nagad</p>
                       </div>
                    </div>
                    <button onClick={() => setIsEditingPayment(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                      {lang === 'bn' ? 'পেমেন্ট গেটওয়ে নম্বরসমূহ' : 'Gateway Numbers'}
                    </h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1.5">
                         <label className="text-[10px] font-black uppercase px-1 flex items-center gap-1.5 text-[#E2136E]">
                           <span className="w-2 h-2 rounded-full bg-[#E2136E] inline-block" />
                           {lang === 'bn' ? 'বিকাশ নম্বর (bKash)' : 'bKash Number'}
                         </label>
                         <input
                           type="tel"
                           placeholder="017XXXXXXXX"
                           className={`w-full h-11 rounded-xl px-4 font-black text-sm tabular-nums outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-[#E2136E]/60' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#E2136E]/60'}`}
                           value={globalSettings.bkash_number}
                           onChange={(e) => {
                             setPaymentError('');
                             setGlobalSettings({ ...globalSettings, bkash_number: e.target.value });
                           }}
                         />
                       </div>

                       <div className="space-y-1.5">
                         <label className="text-[10px] font-black uppercase px-1 flex items-center gap-1.5 text-[#F6921E]">
                           <span className="w-2 h-2 rounded-full bg-[#F6921E] inline-block" />
                           {lang === 'bn' ? 'নগদ নম্বর (Nagad)' : 'Nagad Number'}
                         </label>
                         <input
                           type="tel"
                           placeholder="018XXXXXXXX"
                           className={`w-full h-11 rounded-xl px-4 font-black text-sm tabular-nums outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-[#F6921E]/60' : 'bg-white border-slate-200 text-[#0fb5ab] focus:border-[#F6921E]/60'}`}
                           value={globalSettings.nagad_number}
                           onChange={(e) => {
                             setPaymentError('');
                             setGlobalSettings({ ...globalSettings, nagad_number: e.target.value });
                           }}
                         />
                       </div>
                    </div>
                 </div>

                 {paymentError && (
                   <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-start gap-2">
                     <AlertCircle size={15} className="shrink-0 mt-0.5" />
                     <span>{paymentError}</span>
                   </div>
                 )}

                 <div className="pt-2">
                    <button onClick={handleSavePayment} disabled={saving} className="relative w-full h-14 bg-[#42f5e9] text-[#0e8a84] font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/20 text-xs uppercase tracking-[0.2em] disabled:opacity-60">
                       {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Settings'}</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showSuccessModal.show && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-500 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className="w-16 h-16 bg-[#42f5e9]/10 text-[#0fb5ab] rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div>
            <div className="space-y-1"><h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0e8a84]'}`}>{showSuccessModal.title}</h3><p className="text-slate-400 font-bold text-sm">{showSuccessModal.message}</p></div>
            <button onClick={() => setShowSuccessModal({ ...showSuccessModal, show: false })} className="w-full py-4 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-2xl shadow-premium active:scale-95 transition-all">ঠিক আছে</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SuperAccount;
