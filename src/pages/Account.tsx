
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Camera, Loader2, User as UserIcon, ShieldCheck, Database, ChevronRight, Check, MessageSquare, Zap, Globe, Smartphone, Save, Users, Layers, Edit3, UserPlus, Languages, Mail, Key, Settings, Copy, History, Server, CreditCard, Shield, Sliders, Activity, Bell, RefreshCw, AlertTriangle, AlertCircle, GraduationCap, ChevronLeft, ArrowRight, LayoutDashboard, Settings2, X, Sparkles, Box, ShieldAlert, Award, CheckCircle2, Lock, Terminal, Cpu, Calendar as CalendarIcon, MapPin, Play, Moon, Sun, PhoneCall, UserCheck, BookOpen, FileText, Download, Printer, Clock, Package } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, View, Profile } from 'types';
import { t } from 'translations';
import { MemberTypeManager } from 'components/MemberTypeManager';
import MultiCalendar from 'components/MultiCalendar';
import { generateMemberFormPDF } from '../utils/pdfGenerator';
import { SONGHO_ACTIVITIES, getDefaultSonghoActivityIds } from '../utils/songhoActivities';
import { uploadOptimizedImage } from '../utils/imageOptimizer';
import PaymentCheckout from 'components/PaymentCheckout';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface SubscriptionPackage {
  id: string;
  name: string;
  rate: number;
  badgeBn: string;
  badgeEn: string;
  featuresBn: string[];
  featuresEn: string[];
}

const SUBSCRIPTION_PACKAGES: SubscriptionPackage[] = [
  {
    id: 'STARTER',
    name: 'STARTER',
    rate: 200,
    badgeBn: 'বেসিক',
    badgeEn: 'Basic',
    featuresBn: [
      'সদস্য ও কমিটি ম্যানেজমেন্ট',
      'নোটিশ বোর্ড ও ডিরেক্টরি',
      'বাল্ক এসএমএস ইন্টিগ্রেশন',
      'মোবাইল ও ওয়েব অ্যাক্সেস'
    ],
    featuresEn: [
      'Member & Committee Management',
      'Notice Board & Directory',
      'Bulk SMS Integration',
      'Mobile & Web Access'
    ]
  },
  {
    id: 'STANDARD',
    name: 'STANDARD',
    rate: 500,
    badgeBn: 'জনপ্রিয়',
    badgeEn: 'Popular',
    featuresBn: [
      'সদস্য, মিটিং ও মিনিটস ম্যানেজমেন্ট',
      'হাজিরা ও উপস্থিতি ট্র্যাকিং',
      'হিসাব-নিকাশ ও সদস্য চাঁদা আদায়',
      'এসএমএস ও ভয়েস কল ব্রডকাস্ট'
    ],
    featuresEn: [
      'Members, Meetings & Minutes',
      'Attendance & Participation Tracking',
      'Accounting & Member Dues Collection',
      'SMS & Voice Broadcast'
    ]
  },
  {
    id: 'PRO',
    name: 'PRO',
    rate: 1000,
    badgeBn: 'প্রিমিয়াম',
    badgeEn: 'Premium',
    featuresBn: [
      'সকল প্রিমিয়াম মডিউল আনলকড',
      'ইভেন্টস ও ভোটিং পোল সিস্টেম',
      'কাস্টম রিপোর্ট ও পিডিএফ এক্সপোর্ট',
      'প্রায়োরিটি সাপোর্ট ও অসীম সুবিধা'
    ],
    featuresEn: [
      'All Premium Modules Unlocked',
      'Events & Voting Poll System',
      'Custom Reports & PDF Exports',
      'Priority Support & Extended Limits'
    ]
  }
];

const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const escapeHtml = (val: any) =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface AccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  onProfileUpdate?: () => void;
  setView: (view: View) => void;
  initialMadrasah: Institution | null;
  onLogout: () => void;
  profile?: Profile | null;
}

interface AccountActionCardProps {
  onClick: () => void;
  disabled?: boolean;
  isDark?: boolean;
  iconBoxClass: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  titleClass?: string;
}

const ActionCard: React.FC<AccountActionCardProps> = ({
  onClick,
  disabled,
  isDark,
  iconBoxClass,
  icon,
  title,
  subtitle,
  titleClass
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full p-4 sm:p-5 rounded-[2rem] border shadow-sm transition-transform flex flex-col items-center justify-center text-center gap-3 active:scale-95 duration-150 hover:shadow-md group disabled:opacity-60 disabled:pointer-events-none ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
    }`}
  >
    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform ${iconBoxClass}`}>
      {icon}
    </div>
    <div className="min-w-0 w-full">
      <h5 className={`text-xs sm:text-sm font-black font-noto leading-tight break-words ${titleClass || (isDark ? 'text-white' : 'text-[#0fb5ab]')}`}>
        {title}
      </h5>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
        {subtitle}
      </p>
    </div>
  </button>
);

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } catch (e) {
      console.error(e);
      setIsLoggingOut(false);
    }
  };
  
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deenora v3 Subscription Sub-Page States
  const [isEditingSubscription, setIsEditingSubscription] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('STANDARD');
  const [packageDetailModal, setPackageDetailModal] = useState<SubscriptionPackage | null>(null);
  const [subscriptionYear, setSubscriptionYear] = useState<number>(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [showSubCheckout, setShowSubCheckout] = useState(false);
  const [subTransactions, setSubTransactions] = useState<any[]>([]);
  const [loadingSubTx, setLoadingSubTx] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

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
      
      const uploadResult = await uploadOptimizedImage(file, {
        primaryBucket: 'committee-assets',
        fallbackBuckets: ['institution-assets', 'madrasah-assets', 'member_photo'],
        filePath: `logos/${fileName}`,
        maxWidthOrHeight: 400,
        maxSizeMB: 0.12, // Max ~120KB compressed
        preserveTransparency: true
      });

      const publicUrl = uploadResult.url;
      const { error: updateErr } = await supabase.from('institutions').update({ logo_url: publicUrl }).eq('id', madrasah.id);
      if (updateErr) throw updateErr;

      setLogoUrl(publicUrl);
      setMadrasah(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      if (onProfileUpdate) onProfileUpdate();

      const savingsMsg = uploadResult.savedPercent > 0 
        ? ` (${uploadResult.originalSizeKB}KB থেকে ${uploadResult.compressedSizeKB}KB - ${uploadResult.savedPercent}% সাশ্রয়)`
        : '';

      setShowSuccessModal({ 
        show: true, 
        title: lang === 'bn' ? 'লোগো অপটিমাইজ ও সংরক্ষিত' : 'Logo Optimized & Saved', 
        message: lang === 'bn' 
          ? `লোগোটি সফলভাবে অপটিমাইজ করে আপডেট করা হয়েছে${savingsMsg}।` 
          : `Logo successfully optimized and updated${savingsMsg}.` 
      });
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

  const role = profile?.role || 'executive';
  const isAdmin = role === 'org_admin' || role === 'super_admin';
  const isMember = role === 'member';
  const displayName = isMember ? (profile?.full_name || 'Member Profile') : (madrasah?.name || 'User');
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

  const fetchSubscriptionData = async () => {
    if (!madrasah?.id) return;
    setLoadingSubTx(true);
    try {
      const txRes = await supabase
        .from('transactions')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!txRes.error && txRes.data) {
        const subOnly = txRes.data.filter((tr: any) =>
          tr.module === 'subscription' ||
          (tr.description || '').toLowerCase().includes('subscription') ||
          String(tr.transaction_id || '').toUpperCase().startsWith('SUB_')
        );
        setSubTransactions(subOnly);
      }
    } catch (err) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setLoadingSubTx(false);
    }
  };

  const openSubscriptionPage = () => {
    const activePkgName = String(configObj.package_name || 'STANDARD').toUpperCase();
    const matchedPkg = SUBSCRIPTION_PACKAGES.find(p => p.name === activePkgName || p.id === activePkgName);
    setSelectedPackageId(matchedPkg ? matchedPkg.id : 'STANDARD');
    setSelectedMonths([]);
    const hasPendingSub = Boolean(madrasah?.id && localStorage.getItem(`pending_payment_${madrasah.id}_subscription`));
    setShowSubCheckout(hasPendingSub);
    setIsEditingSubscription(true);
    fetchSubscriptionData();
  };

  const selectedPackage = SUBSCRIPTION_PACKAGES.find(p => p.id === selectedPackageId) || SUBSCRIPTION_PACKAGES[1];
  const paidMonths: string[] = Array.from(new Set([
    ...(Array.isArray(configObj?.paid_months) ? configObj.paid_months : []),
    ...subTransactions
      .filter((tr: any) => tr.status === 'approved')
      .flatMap((tr: any) => Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0
        ? tr.metadata.months
        : ((tr.description || '').match(/\b\d{4}-\d{2}\b/g) || []))
  ])).sort();

  const activePackageName = String(configObj.package_name || 'STANDARD').toUpperCase();
  const isSelectingCurrentPackage = selectedPackage.name === activePackageName;
  const effectiveRate = (isSelectingCurrentPackage && configObj.custom_subscription_fee !== undefined && configObj.custom_subscription_fee !== null && configObj.custom_subscription_fee !== '')
    ? Number(configObj.custom_subscription_fee)
    : (isSelectingCurrentPackage && Number(configObj.package_rate) > 0)
      ? Number(configObj.package_rate)
      : selectedPackage.rate;

  const calculatedFee = effectiveRate * selectedMonths.length;

  const toggleMonth = (monthKey: string) => {
    if (paidMonths.includes(monthKey) || showSubCheckout) return;
    setSelectedMonths(prev =>
      prev.includes(monthKey) ? prev.filter(m => m !== monthKey) : [...prev, monthKey].sort()
    );
  };

  const formatMonthBadge = (ym: string) => {
    const parts = String(ym).split('-');
    if (parts.length === 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${lang === 'bn' ? MONTHS_BN[mIdx] : MONTHS_EN[mIdx]} ${parts[0]}`;
      }
    }
    return ym;
  };

  const handleDownloadSubReceipt = async (tr: any) => {
    if (!madrasah) return;
    setDownloadingReceiptId(tr.id);
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '680px';
    container.style.backgroundColor = '#ffffff';
    container.style.color = '#0f172a';
    container.style.fontFamily = "'Noto Sans Bengali', 'Inter', sans-serif";
    container.style.padding = '36px';
    container.style.boxSizing = 'border-box';

    const formattedDate = escapeHtml(new Date(tr.created_at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US'));
    const monthsText = Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0
      ? escapeHtml(tr.metadata.months.map((m: string) => formatMonthBadge(m)).join(', '))
      : '';
    const pkgText = tr.metadata?.package_name ? ` (${escapeHtml(tr.metadata.package_name)})` : '';
    const statusText = escapeHtml(String(tr.status || 'pending').toUpperCase());

    container.innerHTML = `
      <div style="border: 2px solid #0fb5ab; border-radius: 20px; padding: 32px; background: #ffffff; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 24px; font-weight: 900; color: #0fb5ab; letter-spacing: -0.5px;">Committee Manager</div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">Official Subscription Receipt</div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: #ecfdf5; color: #059669; border: 1.5px solid #10b981; font-size: 12px; font-weight: 900; letter-spacing: 1px;">${statusText}</span>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; margin-top: 8px;">${formattedDate}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 18px; border-radius: 14px; border: 1px solid #e2e8f0;">
          <div>
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Committee / Organization</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">${escapeHtml(madrasah.name)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(madrasah.phone || '')}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Transaction ID</div>
            <div style="font-size: 13px; font-weight: 800; color: #0fb5ab; margin-top: 4px;">${escapeHtml(tr.transaction_id || tr.id)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Sender: ${escapeHtml(tr.sender_phone || 'Admin Direct')}</div>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Subscription Details</div>
          <div style="font-size: 14px; font-weight: 700; color: #1e293b; padding: 14px 16px; background: #f0fdfa; border-radius: 12px; border: 1px solid #ccfbf1;">
            ${escapeHtml(tr.description || 'Subscription Payment')}${pkgText}
            ${monthsText ? `<div style="font-size: 11px; color: #0f766e; margin-top: 6px;">Months: ${monthsText}</div>` : ''}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #0fb5ab; color: #ffffff; padding: 18px 24px; border-radius: 14px;">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Total Amount Paid</div>
          <div style="font-size: 24px; font-weight: 900;">৳ ${Number(tr.amount || 0).toFixed(2)}</div>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
          Generated by Committee Manager
        </div>
      </div>
    `;

    document.body.appendChild(container);
    try {
      const imgData = await toPng(container, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 10, 15, pdfWidth, pdfHeight);
      pdf.save(`Committee_Subscription_Receipt_${tr.transaction_id || tr.id}.pdf`);
    } catch (err) {
      console.error('Receipt generation error:', err);
    } finally {
      document.body.removeChild(container);
      setDownloadingReceiptId(null);
    }
  };

  const isDark = madrasah?.theme === 'dark';

  if (isEditingSubscription && !isMember) {
    const billingCycleLabel =
      configObj.subscription_type === 'lifetime'
        ? (lang === 'bn' ? 'লাইফটাইম' : 'Lifetime')
        : configObj.subscription_type === 'yearly'
          ? (lang === 'bn' ? 'বার্ষিক' : 'Yearly')
          : configObj.subscription_type === 'quarterly'
            ? (lang === 'bn' ? 'ত্রৈমাসিক' : 'Quarterly')
            : (lang === 'bn' ? 'মাসিক' : 'Monthly');

    const expiresAtLabel =
      configObj.subscription_type === 'lifetime'
        ? (lang === 'bn' ? 'লাইফটাইম' : 'Lifetime')
        : madrasah.subscription_end
          ? new Date(madrasah.subscription_end).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
          : madrasah.status === 'trial' && madrasah.created_at
            ? new Date(new Date(madrasah.created_at).getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : (lang === 'bn' ? 'নির্ধারিত নয়' : 'Not Set');

    const statusBadge =
      madrasah.is_active === false || madrasah.status === 'suspended'
        ? { label: lang === 'bn' ? 'স্থগিত' : 'Suspended', cls: 'bg-red-500/10 text-red-500 border-red-500/20' }
        : madrasah.status === 'trial'
          ? { label: lang === 'bn' ? 'ট্রায়াল' : 'Trial', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' }
          : { label: lang === 'bn' ? 'সক্রিয়' : 'Active', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };

    const overviewRate =
      configObj.custom_subscription_fee !== undefined && configObj.custom_subscription_fee !== null && configObj.custom_subscription_fee !== ''
        ? Number(configObj.custom_subscription_fee)
        : Number(configObj.package_rate) > 0
          ? Number(configObj.package_rate)
          : (SUBSCRIPTION_PACKAGES.find(p => p.name === activePackageName)?.rate || 500);

    const paidInSelectedYear = Array.from({ length: 12 }, (_, idx) => `${subscriptionYear}-${String(idx + 1).padStart(2, '0')}`)
      .filter(k => paidMonths.includes(k));

    return (
      <div className="space-y-6 animate-in fade-in duration-300 pb-36 relative z-10">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                setShowSubCheckout(false);
                setIsEditingSubscription(false);
              }}
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm shrink-0 ${
                isDark ? 'bg-slate-800 text-[#42f5e9] border-slate-700' : 'bg-white text-[#0fb5ab] border-slate-200'
              }`}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className={`text-lg sm:text-xl font-black font-noto leading-tight truncate ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                {lang === 'bn' ? 'সাবস্ক্রিপশন ম্যানেজমেন্ট' : 'Subscription Management'}
              </h1>
              <p className="text-[11px] font-bold text-slate-400 truncate">
                {lang === 'bn' ? 'প্যাকেজ, মাসভিত্তিক স্ট্যাটাস ও চার্জ পরিশোধ করুন' : 'Manage plan, monthly payment status & billing'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchSubscriptionData}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shrink-0 ${
              isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-500 border-slate-200'
            }`}
            title={lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
          >
            <RefreshCw size={16} className={loadingSubTx ? 'animate-spin text-[#0fb5ab]' : ''} />
          </button>
        </div>

        {/* Dual-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-1">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-5">
            {/* Current Package Overview Card */}
            <div className={`p-6 rounded-[2.2rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#42f5e9]/15 text-[#0fb5ab]'}`}>
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {lang === 'bn' ? 'বর্তমান প্যাকেজ' : 'Current Package'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {activePackageName}
                      </h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                  </div>
                </div>

                {Number(configObj.due_amount) > 0 && (
                  <div className="px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>{lang === 'bn' ? `বকেয়া: ৳${Number(configObj.due_amount).toLocaleString()}` : `Due: ৳${Number(configObj.due_amount).toLocaleString()}`}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700/70' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'মোট সদস্য' : 'Total Members'}
                  </p>
                  <p className={`text-base font-black mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {stats.students}
                    {Number(configObj.member_limit) > 0 && (
                      <span className="text-xs font-bold text-slate-400"> / {configObj.member_limit}</span>
                    )}
                  </p>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700/70' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'বিলিং সাইকেল' : 'Billing Cycle'}
                  </p>
                  <p className={`text-base font-black mt-1 font-noto ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                    {billingCycleLabel}
                  </p>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700/70' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'প্যাকেজ রেট' : 'Package Rate'}
                  </p>
                  <p className={`text-base font-black mt-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {overviewRate} ৳
                  </p>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700/70' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'মেয়াদ শেষ' : 'Expires At'}
                  </p>
                  <p className={`text-xs sm:text-sm font-black mt-1.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {expiresAtLabel}
                  </p>
                </div>
              </div>

              {configObj.subscription_note && (
                <div className={`p-3.5 rounded-2xl border text-xs font-bold leading-relaxed ${
                  isDark ? 'bg-slate-900/50 border-slate-700 text-slate-300' : 'bg-slate-50/80 border-slate-200/70 text-slate-600'
                }`}>
                  <span className="text-[#0fb5ab] mr-1.5">{lang === 'bn' ? 'নোট:' : 'Note:'}</span>
                  {configObj.subscription_note}
                </div>
              )}
            </div>

            {/* Section 1: Select Subscription Package */}
            <div className={`p-6 rounded-[2.2rem] border shadow-sm space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {lang === 'bn' ? '১. প্যাকেজ নির্বাচন করুন' : '1. Select Subscription Package'}
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {lang === 'bn' ? '৩টি প্ল্যান' : '3 Plans'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SUBSCRIPTION_PACKAGES.map((pkg) => {
                  const isActivePkg = pkg.name === activePackageName;
                  const isSelectedPkg = pkg.id === selectedPackage.id;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => !showSubCheckout && setSelectedPackageId(pkg.id)}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 relative ${showSubCheckout ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${
                        isSelectedPkg
                          ? isDark
                            ? 'bg-[#0fb5ab]/15 border-[#42f5e9] ring-2 ring-[#42f5e9]/20'
                            : 'bg-[#42f5e9]/10 border-[#0fb5ab] ring-2 ring-[#0fb5ab]/15'
                          : isDark
                            ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                            : 'bg-slate-50/70 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isDark ? 'bg-slate-800 text-[#42f5e9]' : 'bg-white text-[#0fb5ab] border border-[#42f5e9]/30'
                          }`}>
                            {lang === 'bn' ? pkg.badgeBn : pkg.badgeEn}
                          </span>
                          {isActivePkg && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                              {lang === 'bn' ? 'বর্তমান' : 'Current'}
                            </span>
                          )}
                        </div>
                        <h4 className={`text-base font-black tracking-tight pt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {pkg.name}
                        </h4>
                        <p className={`text-lg font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                          ৳{pkg.rate}
                          <span className="text-[10px] font-bold text-slate-400">/{lang === 'bn' ? 'মাস' : 'mo'}</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPackageDetailModal(pkg);
                        }}
                        className={`w-full py-2 rounded-xl text-[10px] font-black transition-colors ${
                          isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-slate-100 text-[#0fb5ab] border border-slate-200'
                        }`}
                      >
                        {lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Monthly Payment Status */}
            <div className={`p-6 rounded-[2.2rem] border shadow-sm space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {lang === 'bn' ? '২. মাসের পেমেন্ট স্ট্যাটাস' : '2. Monthly Payment Status'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={11} />
                      {lang === 'bn'
                        ? `পরিশোধিত: ${paidInSelectedYear.length} / ১২ মাস (${subscriptionYear})`
                        : `Paid: ${paidInSelectedYear.length} / 12 mos (${subscriptionYear})`}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      isDark ? 'bg-slate-900 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {lang === 'bn' ? `মোট পরিশোধ: ${paidMonths.length} মাস` : `Total: ${paidMonths.length} mos`}
                    </span>
                  </div>
                </div>

                {/* Year Switcher */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <button
                    type="button"
                    onClick={() => setSubscriptionYear(y => y - 1)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-white text-slate-600'}`}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className={`px-3 text-xs font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {subscriptionYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubscriptionYear(y => y + 1)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-white text-slate-600'}`}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* 12-Month Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Array.from({ length: 12 }, (_, idx) => {
                  const monthKey = `${subscriptionYear}-${String(idx + 1).padStart(2, '0')}`;
                  const monthLabel = lang === 'bn' ? MONTHS_BN[idx] : MONTHS_EN[idx];
                  const isPaid = paidMonths.includes(monthKey);
                  const isSelected = selectedMonths.includes(monthKey);

                  return (
                    <button
                      key={monthKey}
                      type="button"
                      disabled={isPaid || showSubCheckout}
                      onClick={() => toggleMonth(monthKey)}
                      className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between min-h-[72px] ${
                        isPaid
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 cursor-default'
                          : isSelected
                            ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white shadow-md shadow-[#0fb5ab]/20 active:scale-95'
                            : isDark
                              ? 'bg-slate-900/60 border-slate-700 text-slate-200 hover:border-[#42f5e9]/50 active:scale-95'
                              : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:border-[#0fb5ab]/50 active:scale-95'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-xs font-black font-noto leading-tight">{monthLabel}</span>
                        {isPaid && <CheckCircle2 size={12} className="shrink-0 mt-0.5" />}
                      </div>

                      <span className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 ${
                        isPaid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isSelected
                            ? 'text-white/90'
                            : 'text-slate-400'
                      }`}>
                        {isPaid
                          ? (lang === 'bn' ? 'পরিশোধিত' : 'Paid')
                          : isSelected
                            ? (lang === 'bn' ? 'নির্বাচিত' : 'Selected')
                            : (lang === 'bn' ? 'বকেয়া' : 'Due')}
                      </span>

                      <div className={`absolute bottom-0 left-0 right-0 h-1 ${
                        isPaid
                          ? 'bg-emerald-500'
                          : isSelected
                            ? 'bg-white'
                            : 'bg-transparent'
                      }`} />
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? '* সবুজ চিহ্নিত মাসগুলো ইতিমধ্যে পরিশোধিত। নতুন পেমেন্টের জন্য বকেয়া মাসগুলো সিলেক্ট করুন।'
                  : '* Green highlighted months are already paid. Select unpaid months to submit a new payment.'}
              </p>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-5">
            {/* Payment Checkout Card */}
            {showSubCheckout ? (
              <PaymentCheckout
                lang={lang}
                madrasah={madrasah}
                module="subscription"
                fixedAmount={calculatedFee}
                metadata={{
                  months: selectedMonths,
                  package_name: selectedPackage.name,
                  package_rate: effectiveRate,
                  subscription_type: configObj.subscription_type || 'monthly',
                  expected_amount: calculatedFee
                }}
                onSuccess={async () => {
                  setSelectedMonths([]);
                  if (onProfileUpdate) onProfileUpdate();
                  await Promise.all([fetchSubscriptionData(), fetchStats()]);
                }}
                onCancel={() => {
                  setShowSubCheckout(false);
                  fetchSubscriptionData();
                }}
              />
            ) : (
              <div className={`p-6 rounded-[2.2rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {lang === 'bn' ? '৩. পেমেন্ট করুন' : '3. Make Payment'}
                  </h3>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#42f5e9]/15 text-[#0fb5ab]'}`}>
                    bKash / Nagad
                  </span>
                </div>

                {selectedMonths.length === 0 ? (
                  <div className={`p-8 rounded-3xl border-2 border-dashed text-center space-y-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50/70 border-slate-200'}`}>
                    <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-[#42f5e9]' : 'bg-white text-[#0fb5ab] shadow-sm'}`}>
                      <Clock size={28} />
                    </div>
                    <h4 className={`text-base font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Months'}
                    </h4>
                    <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-xs mx-auto">
                      {lang === 'bn'
                        ? 'পেমেন্ট করার জন্য বাম পাশের ২ নম্বর ধাপ থেকে অন্তত একটি বকেয়া মাস সিলেক্ট করুন।'
                        : 'Select at least one unpaid month from Step 2 on the left to proceed with payment.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? 'bg-slate-900/70 border-slate-700' : 'bg-[#42f5e9]/10 border-[#42f5e9]/30'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            {selectedPackage.name} • ৳{effectiveRate}/{lang === 'bn' ? 'মাস' : 'mo'}
                          </span>
                          <span className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {lang === 'bn' ? `নির্বাচিত মাস (${selectedMonths.length}টি)` : `Selected (${selectedMonths.length} mos)`}
                          </span>
                        </div>
                        <span className={`text-2xl font-black tabular-nums ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                          {calculatedFee.toLocaleString()} ৳
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {selectedMonths.map(m => (
                          <span
                            key={m}
                            onClick={() => toggleMonth(m)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-opacity hover:opacity-80 ${
                              isDark ? 'bg-slate-800 text-[#42f5e9] border border-slate-700' : 'bg-white text-[#0fb5ab] border border-[#0fb5ab]/20'
                            }`}
                          >
                            {formatMonthBadge(m)}
                            <X size={10} />
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowSubCheckout(true)}
                      className="w-full h-14 bg-[#0fb5ab] hover:bg-[#0d9e95] text-white font-black rounded-2xl text-sm uppercase tracking-wider shadow-lg shadow-[#0fb5ab]/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                      <CreditCard size={18} />
                      {lang === 'bn' ? 'পেমেন্ট করুন' : 'Pay Now'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Subscription Payment History List */}
            <div className={`p-6 rounded-[2.2rem] border shadow-sm space-y-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-[#0fb5ab]" />
                  <h3 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {lang === 'bn' ? 'সাবস্ক্রিপশন পেমেন্ট হিস্ট্রি' : 'Subscription Payment History'}
                  </h3>
                </div>
                <span className="text-[10px] font-black text-slate-400">
                  {subTransactions.length}
                </span>
              </div>

              {loadingSubTx ? (
                <div className="py-8 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-[#0fb5ab]" />
                </div>
              ) : subTransactions.length === 0 ? (
                <div className={`p-6 rounded-2xl border-2 border-dashed text-center ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <p className="text-xs font-bold text-slate-400">
                    {lang === 'bn' ? 'এখনো কোনো সাবস্ক্রিপশন পেমেন্ট রেকর্ড নেই।' : 'No subscription payment history found.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {subTransactions.map((tr: any) => {
                    const st = tr.status || 'pending';
                    const stMeta =
                      st === 'approved'
                        ? { label: lang === 'bn' ? 'সফল' : 'Approved', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 }
                        : st === 'rejected'
                          ? { label: lang === 'bn' ? 'প্রত্যাখ্যাত' : 'Rejected', cls: 'bg-red-500/10 text-red-500 border-red-500/20', icon: X }
                          : st === 'cancelled'
                            ? { label: lang === 'bn' ? 'বাতিল' : 'Cancelled', cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: X }
                            : { label: lang === 'bn' ? 'অপেক্ষা' : 'Pending', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock };
                    const StIcon = stMeta.icon;
                    const txMonths: string[] = Array.isArray(tr.metadata?.months) ? tr.metadata.months : [];

                    return (
                      <div
                        key={tr.id}
                        className={`p-4 rounded-2xl border space-y-2.5 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50/70 border-slate-100'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {Number(tr.amount || 0).toLocaleString()} ৳
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${stMeta.cls}`}>
                                <StIcon size={10} />
                                {stMeta.label}
                              </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                              {new Date(tr.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {tr.transaction_id ? ` • TrxID: ${tr.transaction_id}` : ''}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={downloadingReceiptId === tr.id}
                            onClick={() => handleDownloadSubReceipt(tr)}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 shrink-0 border transition-colors ${
                              isDark ? 'bg-slate-800 hover:bg-slate-700 text-[#42f5e9] border-slate-700' : 'bg-white hover:bg-slate-100 text-[#0fb5ab] border-slate-200'
                            }`}
                          >
                            {downloadingReceiptId === tr.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            <span>{lang === 'bn' ? 'রসিদ' : 'Receipt'}</span>
                          </button>
                        </div>

                        {txMonths.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-[#0fb5ab]/10 text-[#0fb5ab]">
                              {lang === 'bn' ? `${txMonths.length} মাস` : `${txMonths.length} mos`}
                            </span>
                            {txMonths.map((m) => (
                              <span
                                key={m}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-200/80'
                                }`}
                              >
                                {formatMonthBadge(m)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Package Details Modal */}
        {packageDetailModal && createPortal(
          <div className="modal-overlay bg-slate-900/50 backdrop-blur-xl animate-in fade-in duration-200 z-[9999]">
            <div className={`w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl border space-y-5 animate-in zoom-in-95 duration-300 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0fb5ab]">
                    {lang === 'bn' ? packageDetailModal.badgeBn : packageDetailModal.badgeEn}
                  </span>
                  <h3 className="text-xl font-black mt-0.5">{packageDetailModal.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPackageDetailModal(null)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-[#42f5e9]/10 border-[#42f5e9]/30'}`}>
                <p className="text-2xl font-black text-[#0fb5ab]">
                  ৳{packageDetailModal.rate}
                  <span className="text-xs font-bold text-slate-400"> / {lang === 'bn' ? 'মাস' : 'month'}</span>
                </p>
              </div>

              <ul className="space-y-2.5">
                {(lang === 'bn' ? packageDetailModal.featuresBn : packageDetailModal.featuresEn).map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-xs font-bold">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPackageId(packageDetailModal.id);
                    setPackageDetailModal(null);
                  }}
                  className="w-full py-3.5 bg-[#0fb5ab] text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-[#0fb5ab]/20"
                >
                  {lang === 'bn' ? 'এই প্যাকেজ সিলেক্ট করুন' : 'Select This Plan'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Feedback / Success Modal */}
        {showSuccessModal.show && createPortal(
          <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 z-[9999]">
            <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-50'} w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border animate-in zoom-in-95 duration-300`}>
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={34} />
              </div>
              <h3 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{showSuccessModal.title}</h3>
              <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed">{showSuccessModal.message}</p>
              <button
                type="button"
                onClick={() => setShowSuccessModal({ show: false, title: '', message: '' })}
                className="w-full mt-6 py-3.5 bg-[#42f5e9] text-[#0e8a84] font-black rounded-2xl text-xs uppercase tracking-widest"
              >
                {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-36 relative z-10">

      {/* Compact Profile Hero Card */}
      <div className="relative pt-14 px-1">
        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[2.5rem] sm:rounded-[3.5rem] p-5 sm:p-8 pt-20 sm:pt-22 shadow-bubble border relative text-center`}>
          <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] sm:rounded-[3.5rem] pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-[#42f5e9] to-[#0fb5ab] opacity-[0.06]" />
          </div>

          <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20">
            <div className="relative group">
              <div className={`w-28 h-28 sm:w-32 sm:h-32 p-3 rounded-full shadow-bubble border-8 flex items-center justify-center ${isDark ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-50'}`}>
                {logoUrl ? (
                  <img src={logoUrl} className="w-full h-full object-contain rounded-full" alt="Profile" />
                ) : (
                  <div className={`w-full h-full rounded-full flex items-center justify-center ${isDark ? 'bg-slate-700 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
                    <UserIcon size={48} strokeWidth={1.6} />
                  </div>
                )}
              </div>
              {madrasah && madrasah.id !== 'super_admin' && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 w-9 h-9 bg-[#42f5e9] text-[#0fb5ab] rounded-xl flex items-center justify-center shadow-premium border-2 border-white active:scale-90 transition-all z-30"
                  title={lang === 'bn' ? 'লোগো পরিবর্তন' : 'Change Logo'}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </div>
          </div>

          <div className="space-y-2.5 mt-1 relative z-10">
            <h2 className={`text-xl sm:text-3xl font-black font-noto tracking-tight leading-tight break-words whitespace-normal px-2 ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
              {displayName}
            </h2>

            {(madrasah?.address || madrasah?.phone || madrasah?.email) && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-slate-400">
                {madrasah?.address && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                    <MapPin size={13} className="text-[#0fb5ab] shrink-0" />
                    <span className="break-words">{madrasah.address}</span>
                  </span>
                )}
                {madrasah?.phone && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                    <Smartphone size={13} className="text-[#0fb5ab] shrink-0" />
                    <span>{madrasah.phone}</span>
                  </span>
                )}
                {madrasah?.email && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold">
                    <Mail size={13} className="text-[#0fb5ab] shrink-0" />
                    <span className="break-all">{madrasah.email}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Options Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mx-1">
        {/* Subscription Card */}
        {!isMember && madrasah.id !== 'super_admin' && (
          <ActionCard
            onClick={openSubscriptionPage}
            isDark={isDark}
            iconBoxClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
            icon={<CreditCard size={22} />}
            title={lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}
            subtitle={lang === 'bn' ? 'প্যাকেজ ও পেমেন্ট' : 'Plans & Billing'}
          />
        )}

        {/* Organizational Calendar Card */}
        {!(configObj.modules?.meetings === false && configObj.modules?.events === false) && (!isMember || !!madrasah?.member_portal_config?.permissions?.view_meetings) && (
          <ActionCard
            onClick={() => setView('academic-calendar')}
            isDark={isDark}
            iconBoxClass="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
            icon={<CalendarIcon size={22} />}
            title={lang === 'bn' ? 'সাংগঠনিক ক্যালেন্ডার' : 'Organizational Calendar'}
            subtitle={lang === 'bn' ? 'ছুটি ও ইভেন্ট' : 'Holidays'}
          />
        )}

        {/* Events Card */}
        {configObj.modules?.events !== false && (!isMember || !!madrasah?.member_portal_config?.permissions?.view_meetings) && (
          <ActionCard
            onClick={() => setView('events')}
            isDark={isDark}
            iconBoxClass="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400"
            icon={<Sparkles size={22} />}
            title={lang === 'bn' ? 'ইভেন্টসমূহ' : 'Events'}
            subtitle={lang === 'bn' ? 'অনুষ্ঠান ও কর্মসূচি' : 'Programs & Events'}
          />
        )}

        {/* Profile Settings Card */}
        {!isMember && (
          <ActionCard
            onClick={() => setIsEditingProfile(true)}
            isDark={isDark}
            iconBoxClass="bg-[#42f5e9]/15 text-[#0fb5ab] dark:bg-[#42f5e9]/15 dark:text-[#42f5e9]"
            icon={<Edit3 size={22} />}
            title={t('profile_settings', lang)}
            subtitle={t('branding', lang)}
          />
        )}

        {/* Backup & Restore Card */}
        {!isMember && (
          <ActionCard
            onClick={() => setView('data-management')}
            isDark={isDark}
            iconBoxClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
            icon={<Database size={22} />}
            title={t('backup_restore', lang)}
            subtitle="Excel Tools"
          />
        )}

        {/* Association Management Card */}
        {!isMember && madrasah?.institution_type === 'association' && (
          <ActionCard
            onClick={() => setView('management')}
            isDark={isDark}
            iconBoxClass="bg-[#42f5e9]/15 text-[#0fb5ab] dark:bg-[#42f5e9]/15 dark:text-[#42f5e9]"
            icon={<Sliders size={22} />}
            title={lang === 'bn' ? 'ম্যানেজমেন্ট (নীতিমালা)' : 'Management (Policies)'}
            subtitle={lang === 'bn' ? 'সমিতির ধরন ও নিয়ম' : 'Type & Rules'}
          />
        )}

        {/* Sangha / Union Management Card */}
        {!isMember && (madrasah?.institution_type === 'sangha' || madrasah?.institution_type === 'union') && (
          <ActionCard
            onClick={() => setView('management')}
            isDark={isDark}
            iconBoxClass="bg-[#42f5e9]/15 text-[#0fb5ab] dark:bg-[#42f5e9]/15 dark:text-[#42f5e9]"
            icon={<Sliders size={22} />}
            title={lang === 'bn' ? 'ম্যানেজমেন্ট (কার্যক্রম ও নীতি)' : 'Management (Activities & Rules)'}
            subtitle={lang === 'bn' ? 'কার্যক্রম ও প্রকল্প নির্ধারণ' : 'Activities & Schemes'}
          />
        )}

        {/* Executive Committee Card */}
        {!isMember && (
          <ActionCard
            onClick={() => setView('executives')}
            isDark={isDark}
            iconBoxClass="bg-[#42f5e9]/15 text-[#0fb5ab] dark:bg-[#42f5e9]/15 dark:text-[#42f5e9]"
            icon={<UserCheck size={22} />}
            title={lang === 'bn' ? 'কার্যনির্বাহী কমিটি' : 'Executive Committee'}
            subtitle={lang === 'bn' ? 'কমিটি মেম্বারস' : 'Committee Members'}
          />
        )}

        {/* Video Tutorial Card */}
        <ActionCard
          onClick={() => setView('tutorials')}
          isDark={isDark}
          iconBoxClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
          icon={<Play size={22} />}
          title={lang === 'bn' ? 'টিউটোরিয়াল' : 'Video Tutorials'}
          subtitle={lang === 'bn' ? 'সহায়তা' : 'Help & Support'}
        />

        {/* Voting & Polls Card */}
        {configObj.modules?.polls !== false && (!isMember || !!madrasah?.member_portal_config?.permissions?.view_polls) && (
          <ActionCard
            onClick={() => setView('polls')}
            isDark={isDark}
            iconBoxClass="bg-[#42f5e9]/15 text-[#0fb5ab] dark:bg-[#42f5e9]/15 dark:text-[#42f5e9]"
            icon={<Activity size={22} />}
            title={t('voting_polls', lang)}
            subtitle={lang === 'bn' ? 'সদস্যদের মতামত' : 'Member Opinions'}
          />
        )}

        {/* Notice Board Card */}
        {configObj.modules?.notices !== false && (!isMember || !!madrasah?.member_portal_config?.permissions?.view_notices) && (
          <ActionCard
            onClick={() => setView('notice-board')}
            isDark={isDark}
            iconBoxClass="bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
            icon={<Bell size={22} />}
            title={t('notice_board', lang)}
            subtitle={lang === 'bn' ? 'জরুরী নোটিশ' : 'Announcement'}
          />
        )}

        {/* Member Types Config Card */}
        {!isMember && (
          <ActionCard
            onClick={() => setShowMemberTypeManager(true)}
            isDark={isDark}
            iconBoxClass="bg-[#42f5e9]/15 text-[#0fb5ab] dark:bg-[#42f5e9]/15 dark:text-[#42f5e9]"
            icon={<Layers size={22} />}
            title={lang === 'bn' ? 'সদস্য ধরন' : 'Member Types'}
            subtitle={lang === 'bn' ? 'কাস্টম ক্যাটাগরি' : 'Custom Types'}
          />
        )}

        {/* Member Portal Settings Card */}
        {!isMember && (
          <ActionCard
            onClick={() => setShowMemberPortalSettings(true)}
            isDark={isDark}
            iconBoxClass="bg-[#42f5e9]/15 text-[#0fb5ab] dark:bg-[#42f5e9]/15 dark:text-[#42f5e9]"
            icon={<Smartphone size={22} />}
            title={lang === 'bn' ? 'সদস্য পোর্টাল' : 'Member Portal'}
            subtitle={lang === 'bn' ? 'পারমিশন ম্যানেজ' : 'Manage Permissions'}
          />
        )}

        {/* Member Form PDF Download Card */}
        {!isMember && (
          <ActionCard
            onClick={handleDownloadForm}
            disabled={downloadingForm}
            isDark={isDark}
            iconBoxClass="bg-blue-50 text-[#2563EB] dark:bg-blue-500/15 dark:text-blue-400"
            icon={downloadingForm ? <Loader2 className="animate-spin text-[#2563EB]" size={22} /> : <FileText size={22} />}
            title={lang === 'bn' ? 'সদস্য ফর্ম PDF' : 'Member Form PDF'}
            subtitle={downloadingForm ? (lang === 'bn' ? 'ডাউনলোড হচ্ছে...' : 'Downloading...') : (lang === 'bn' ? 'অফলাইন ফরম ডাউনলোড' : 'Offline Registration Form')}
          />
        )}
      </div>

      {/* Compact Horizontal Preference & Session Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mx-1">
        {/* Language Card */}
        <div className={`p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm flex items-center justify-between gap-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
              <Languages size={20} />
            </div>
            <div className="text-left min-w-0">
              <h5 className={`text-sm font-black font-noto leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('language', lang)}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">{t('change_lang', lang)}</p>
            </div>
          </div>
          <div className={`flex p-1 rounded-xl border shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <button
              type="button"
              onClick={() => setLang('bn')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'bn' ? (isDark ? 'bg-slate-700 text-[#42f5e9] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? (isDark ? 'bg-slate-700 text-[#42f5e9] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
            >
              ENG
            </button>
          </div>
        </div>

        {/* Theme Switcher Card */}
        <div className={`p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm flex items-center justify-between gap-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#42f5e9]/15 text-[#0fb5ab]'}`}>
              {isDark ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div className="text-left min-w-0">
              <h5 className={`text-sm font-black font-noto leading-tight truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}
              </h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                {lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-13 h-7 rounded-full p-1 transition-colors relative shrink-0 ${isDark ? 'bg-[#0fb5ab]' : 'bg-slate-200'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Logout Card */}
        <button
          type="button"
          onClick={handleLogoutClick}
          disabled={isLoggingOut}
          className={`md:col-span-2 p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none ${isDark ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
              {isLoggingOut ? <Loader2 className="animate-spin text-red-600" size={20} /> : <LogOut size={20} />}
            </div>
            <div className="text-left">
              <h5 className={`text-sm font-black font-noto leading-tight ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {isLoggingOut ? (lang === 'bn' ? 'লগআউট হচ্ছে...' : 'Logging out...') : t('logout', lang)}
              </h5>
              <p className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest mt-0.5">{t('logout_system', lang)}</p>
            </div>
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800 text-red-400' : 'bg-white text-red-400'}`}>
            <ChevronRight size={18} />
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

      {/* Success / Info Modal - PORTALED */}
      {showSuccessModal.show && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300 z-[9999]">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-50'} w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border animate-in zoom-in-95 duration-300`}>
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={34} />
            </div>
            <h3 className={`text-xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{showSuccessModal.title}</h3>
            <p className="text-xs font-bold text-slate-400 mt-2 leading-relaxed">{showSuccessModal.message}</p>
            <button
              type="button"
              onClick={() => setShowSuccessModal({ show: false, title: '', message: '' })}
              className="w-full mt-6 py-3.5 bg-[#42f5e9] text-[#0e8a84] font-black rounded-2xl text-xs uppercase tracking-widest"
            >
              {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
            </button>
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
