
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Plus, Search, CheckCircle2, MessageSquare, X, BookOpen,
  ChevronDown, Check, PhoneCall, Smartphone, Loader2, Phone, AlertCircle,
  Zap, Mic, Volume2, Wallet
} from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Department, Member, Language, Institution } from 'types';
import { t } from 'translations';
import { bdDivisions, bdDistricts, bdThanas } from '../utils/bdData';
import { DEFAULT_VOICE_RATE, resolveInstitutionVoiceRate } from '../utils/smsUtils';

interface StudentsProps {
  selectedClass?: Department | null;
  onStudentClick: (student: Member) => void;
  onAddClick: () => void;
  onEditClick?: (student: Member) => void;
  onBack: () => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  canAdd?: boolean;
  canSendSMS?: boolean;
  institutionId?: string;
  madrasah?: Institution | null;
  onNavigateToWallet?: () => void;
}

const PAGE_SIZE = 50;

const Members: React.FC<StudentsProps> = ({
  selectedClass,
  onStudentClick,
  onAddClick,
  onBack,
  lang,
  dataVersion,
  canAdd,
  institutionId,
  madrasah,
  onNavigateToWallet
}) => {
  const [students, setStudents] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [orgMemberCount, setOrgMemberCount] = useState<number | null>(null);

  const memberLimit = useMemo(() => {
    let cfg: any = madrasah?.config_json || {};
    if (typeof cfg === 'string') {
      try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
    }
    return Number(cfg?.member_limit) || 0;
  }, [madrasah?.config_json]);

  useEffect(() => {
    if (!institutionId || memberLimit <= 0) {
      setOrgMemberCount(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('institution_id', institutionId)
      .then(({ count }) => {
        if (!cancelled && typeof count === 'number') {
          setOrgMemberCount(count);
        }
      });
    return () => { cancelled = true; };
  }, [institutionId, memberLimit, dataVersion]);

  // Union Specific Filters
  const [filterDivision, setFilterDivision] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterThana, setFilterThana] = useState('');
  const [filterWard, setFilterWard] = useState('');

  // Selection / SMS / Voice States
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [customSmsMessage, setCustomSmsMessage] = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [sending, setSending] = useState(false);

  // Voice Broadcast Modal States
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceTemplates, setVoiceTemplates] = useState<any[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [isVoiceSending, setIsVoiceSending] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [voiceRate, setVoiceRate] = useState<number>(() =>
    resolveInstitutionVoiceRate(madrasah, { voice_rate: DEFAULT_VOICE_RATE })
  );

  const [statusModal, setStatusModal] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'balance';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  // Fetch SMS Templates
  const fetchTemplates = useCallback(async () => {
    if (!institutionId) return;
    const { data } = await supabase
      .from('sms_templates')
      .select('id, title, body')
      .eq('institution_id', institutionId);
    if (data) setTemplates(data);
  }, [institutionId]);

  // Paginated Fetching
  const fetchStudents = useCallback(async (reset = false) => {
    if (!institutionId) return;
    if (reset) { setLoading(true); setPage(0); } else { setLoadingMore(true); }

    const currentPage = reset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('members')
        .select('*, departments(name)')
        .eq('institution_id', institutionId)
        .order('roll', { ascending: true })
        .range(from, to);

      if (selectedClass?.id) {
        query = query.eq('department_id', selectedClass.id);
      }

      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      if (madrasah?.institution_type === 'union') {
        if (filterDivision.trim()) {
          query = query.ilike('address', `%"division":"${filterDivision.trim()}"%`);
        }
        if (filterDistrict.trim()) {
          query = query.ilike('address', `%"district":"${filterDistrict.trim()}"%`);
        }
        if (filterThana.trim()) {
          query = query.ilike('address', `%"thana":"${filterThana.trim()}"%`);
        }
        if (filterWard.trim()) {
          query = query.ilike('address', `%"ward":"${filterWard.trim()}"%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        const formattedData = (data as any[]).map(s => ({
          ...s,
          departments: Array.isArray(s.departments) ? s.departments[0] : s.departments
        })) as Member[];

        setStudents(prev => (reset ? formattedData : [...prev, ...formattedData]));
        setHasMore(data.length === PAGE_SIZE);
        if (!reset) setPage(currentPage + 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [institutionId, selectedClass?.id, page, searchQuery, filterDivision, filterDistrict, filterThana, filterWard, madrasah?.institution_type]);

  useEffect(() => {
    const timer = setTimeout(() => fetchStudents(true), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, filterDivision, filterDistrict, filterThana, filterWard, selectedClass?.id, dataVersion]);

  useEffect(() => {
    fetchTemplates();
  }, [institutionId, fetchTemplates]);

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  const selectedMembers = useMemo(
    () => students.filter(s => selectedIds.has(s.id)),
    [students, selectedIds]
  );

  const validSelectedMembers = useMemo(
    () =>
      selectedMembers.filter(m => {
        const cleaned = (m.phone || '').toString().replace(/\D/g, '');
        return cleaned.length >= 10;
      }),
    [selectedMembers]
  );

  const validSelectedPhones = useMemo(
    () =>
      validSelectedMembers.map(m => (m.phone || '').toString().replace(/\D/g, '')),
    [validSelectedMembers]
  );

  const handlePremiumSMS = async () => {
    const messageBody = customSmsMessage.trim();
    if (!messageBody || selectedIds.size === 0 || !institutionId) return;

    if (validSelectedMembers.length === 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ফোন নম্বর নেই' : 'No Valid Phone Numbers',
        message: lang === 'bn'
          ? 'নির্বাচিত সদস্যদের কোনো বৈধ মোবাইল নম্বর পাওয়া যায়নি।'
          : 'No valid mobile numbers found for the selected members.'
      });
      return;
    }

    setSending(true);
    try {
      await smsApi.sendBulk(institutionId, validSelectedMembers, messageBody);
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সাফল্য' : 'Success',
        message: t('sms_success', lang)
      });
      setIsSelectionMode(false);
      setSelectedIds(new Set());
      setCustomSmsMessage('');
      setSelectedTemplate(null);
    } catch (err: any) {
      const msg = err?.message || 'SMS failed';
      const isBal = msg.toLowerCase().includes('balance');
      setStatusModal({
        show: true,
        type: isBal ? 'balance' : 'error',
        title: isBal ? (lang === 'bn' ? 'ব্যালেন্স শেষ!' : 'Insufficient Balance!') : (lang === 'bn' ? 'ব্যর্থ' : 'Failed'),
        message: msg
      });
    } finally {
      setSending(false);
    }
  };

  const handleFreeSMS = () => {
    const messageBody = customSmsMessage.trim();
    if (!messageBody || selectedIds.size === 0) return;

    if (validSelectedPhones.length === 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ফোন নম্বর নেই' : 'No Valid Phone Numbers',
        message: lang === 'bn'
          ? 'নির্বাচিত সদস্যদের কোনো বৈধ মোবাইল নম্বর পাওয়া যায়নি।'
          : 'No valid mobile numbers found for the selected members.'
      });
      return;
    }

    const phones = validSelectedPhones.join(',');
    window.location.href = `sms:${phones}?body=${encodeURIComponent(messageBody)}`;
  };

  const handleOpenVoiceModal = async () => {
    if (!institutionId || selectedIds.size === 0) return;
    setShowVoiceModal(true);
    setLoadingVoices(true);
    try {
      const { data: instData } = await supabase
        .from('institutions')
        .select('balance, config_json')
        .eq('id', institutionId)
        .single();

      let cfg: any = instData?.config_json ?? madrasah?.config_json ?? {};
      if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
      }
      const globalRates = await smsApi.getGlobalSettings();
      setVoiceRate(resolveInstitutionVoiceRate({ config_json: cfg }, globalRates));

      if (instData) {
        setWalletBalance(Number(instData.balance) || 0);
      }

      const { data: localVoices } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false });

      setVoiceTemplates(localVoices || []);
      if (localVoices && localVoices.length > 0) {
        setSelectedVoiceId(localVoices[0].id);
      } else {
        setSelectedVoiceId('');
      }
    } catch (err) {
      console.error('Failed to load voice templates:', err);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleSendVoiceBroadcast = async () => {
    if (!institutionId) return;
    if (!selectedVoiceId) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ভয়েস নির্বাচন করুন' : 'Select Voice Template',
        message: lang === 'bn'
          ? 'অনুগ্রহ করে একটি অনুমোদিত ভয়েস টেমপ্লেট নির্বাচন করুন।'
          : 'Please select an approved voice template.'
      });
      return;
    }

    if (validSelectedPhones.length === 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ফোন নম্বর নেই' : 'No Phone Numbers',
        message: lang === 'bn'
          ? 'নির্বাচিত সদস্যদের কোনো বৈধ ফোন নম্বর পাওয়া যায়নি।'
          : 'No valid phone numbers found for selected members.'
      });
      return;
    }

    const estimatedCost = validSelectedPhones.length * voiceRate;
    if (walletBalance < estimatedCost) {
      setStatusModal({
        show: true,
        type: 'balance',
        title: lang === 'bn' ? 'অপর্যাপ্ত ব্যালেন্স' : 'Insufficient Balance',
        message: lang === 'bn'
          ? `ভয়েস কল পাঠানোর জন্য ৳${estimatedCost.toFixed(2)} প্রয়োজন, কিন্তু আপনার বর্তমান ব্যালেন্স ৳${walletBalance.toFixed(2)}। অনুগ্রহ করে ওয়ালেট রিচার্জ করুন।`
          : `Required balance ৳${estimatedCost.toFixed(2)}, current balance is ৳${walletBalance.toFixed(2)}. Please recharge wallet.`
      });
      return;
    }

    const selectedVoice = voiceTemplates.find(v => v.id === selectedVoiceId);
    if (!selectedVoice) return;

    setIsVoiceSending(true);
    try {
      const voiceName = selectedVoice.provider_voice_name || selectedVoice.title;
      const sNumber = selectedVoice.sender_number || selectedVoice.sender || 'default';
      const requestId = `cm_members_${institutionId.slice(0, 6)}_${Date.now()}`;

      const payload = {
        request_id: requestId,
        voice: voiceName,
        sender: sNumber,
        phone_numbers: validSelectedPhones,
        retry: 1,
        retry_count: 1,
        retries: 1
      };

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/awaj/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errMessage = 'Failed to send voice broadcast via Awaj API';
        try {
          const errData = await response.json();
          errMessage = errData.error || errData.message || errMessage;
        } catch (_) {}
        throw new Error(errMessage);
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || requestId;

      const newBalance = Math.max(0, walletBalance - estimatedCost);
      const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', institutionId);
      if (balanceError) throw balanceError;
      setWalletBalance(newBalance);

      await smsApi.recordVoiceBroadcast(institutionId, {
        voiceTemplateId: selectedVoiceId,
        targetType: 'selected_members',
        totalNumbers: validSelectedPhones.length,
        estimatedCost,
        providerCampaignId: campaignId,
        status: 'sending'
      });

      setShowVoiceModal(false);
      setIsSelectionMode(false);
      setSelectedIds(new Set());

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'ভয়েস কল সফল' : 'Voice Broadcast Initiated',
        message: lang === 'bn'
          ? `${validSelectedPhones.length} জন সদস্যের কাছে ভয়েস কল ব্রডকাস্ট শুরু হয়েছে!`
          : `Voice call broadcast initiated for ${validSelectedPhones.length} members!`
      });
    } catch (err: any) {
      console.error('Voice broadcast error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ হয়েছে' : 'Broadcast Failed',
        message: err.message || 'Failed to send voice broadcast'
      });
    } finally {
      setIsVoiceSending(false);
    }
  };

  const getMemberTypeLabel = (type: string) => {
    if (lang === 'bn') {
      switch (type) {
        case 'general': return 'সাধারণ সদস্য';
        case 'executive': return 'কার্যনির্বাহী সদস্য';
        case 'volunteer': return 'স্বেচ্ছাসেবক';
        case 'donor': return 'দাতা সদস্য';
        default: return type || 'সাধারণ সদস্য';
      }
    }
    return type?.charAt(0).toUpperCase() + type?.slice(1) || 'General';
  };

  const canSendSystemSMS = true;
  const canSendFreeSMS = true;
  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="animate-in slide-in-from-right-4 duration-700 pb-24 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] p-6 bg-gradient-to-br from-[#42f5e9] via-[#0fb5ab] to-[#0e8a84] shadow-[0_20px_50px_-15px_rgba(66,245,233,0.3)] border border-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 animate-pulse">
          <BookOpen size={120} strokeWidth={1} />
        </div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="w-12 h-12 bg-white/20 backdrop-blur-2xl rounded-[1.2rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-xl shrink-0 hover:bg-white/30"
              >
                <ArrowLeft size={24} strokeWidth={3} />
              </button>
              <div>
                <h1 className="text-xl font-black text-white font-noto tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                  {selectedClass?.name || t('members', lang)}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">
                    {students.length} {t('members', lang)}
                  </p>
                  {memberLimit > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                      (orgMemberCount ?? students.length) >= memberLimit
                        ? 'bg-red-500/30 text-white border-red-200/50'
                        : 'bg-white/20 text-white border-white/30'
                    }`}>
                      {lang === 'bn'
                        ? `সদস্য: ${orgMemberCount ?? students.length} / ${memberLimit}`
                        : `Limit: ${orgMemberCount ?? students.length} / ${memberLimit}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isSelectionMode && (
                <button
                  onClick={toggleSelectAll}
                  className="h-12 px-4 rounded-[1.2rem] bg-white/20 backdrop-blur-2xl text-white border border-white/30 font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all hover:bg-white/30"
                >
                  {selectedIds.size === students.length ? t('clear', lang) : t('all', lang)}
                </button>
              )}
              <button
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedIds(new Set());
                  setShowTemplateMenu(false);
                }}
                className={`w-11 h-11 rounded-[1.2rem] border flex items-center justify-center transition-all active:scale-95 shadow-xl ${isSelectionMode ? 'bg-white text-[#0fb5ab] border-white' : 'bg-white/20 backdrop-blur-2xl text-white border-white/30 hover:bg-white/30'}`}
                title={lang === 'bn' ? 'এসএমএস / ভয়েস কল মোড' : 'Bulk SMS & Voice Mode'}
              >
                {isSelectionMode ? <X size={22} strokeWidth={3} /> : <MessageSquare size={22} strokeWidth={2.5} />}
              </button>
              {!isSelectionMode && canAdd && (
                <button
                  onClick={onAddClick}
                  className="w-11 h-11 bg-white rounded-[1.2rem] flex items-center justify-center text-[#0fb5ab] active:scale-90 transition-all border border-white shadow-xl hover:shadow-[#42f5e9]/20"
                  title={lang === 'bn' ? 'নতুন সদস্য যোগ করুন' : 'Add Member'}
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/60 group-focus-within:text-white transition-colors" size={20} strokeWidth={3} />
            <input
              type="text"
              placeholder={t('search_placeholder', lang)}
              className="w-full h-14 pl-14 pr-6 bg-white/10 backdrop-blur-2xl border-2 border-white/20 rounded-[1.5rem] outline-none text-white font-black text-base placeholder:text-white/40 focus:border-white/40 focus:bg-white/20 transition-all shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {madrasah?.institution_type === 'union' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="relative">
                <select
                  className="w-full h-11 px-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl outline-none text-white font-black text-xs placeholder:text-white/40 focus:border-white/40 focus:bg-white/20 transition-all shadow-sm appearance-none"
                  value={filterDivision}
                  onChange={(e) => { setFilterDivision(e.target.value); setFilterDistrict(''); setFilterThana(''); }}
                >
                  <option value="" className="text-black">{lang === 'bn' ? 'সব বিভাগ' : 'All Divisions'}</option>
                  {bdDivisions.map(d => <option key={d} value={d} className="text-black">{d}</option>)}
                </select>
              </div>
              <div className="relative">
                <select
                  className="w-full h-11 px-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl outline-none text-white font-black text-xs placeholder:text-white/40 focus:border-white/40 focus:bg-white/20 transition-all shadow-sm appearance-none"
                  value={filterDistrict}
                  onChange={(e) => { setFilterDistrict(e.target.value); setFilterThana(''); }}
                  disabled={!filterDivision}
                >
                  <option value="" className="text-black">{lang === 'bn' ? 'সব জেলা' : 'All Districts'}</option>
                  {filterDivision && bdDistricts[filterDivision]?.map(d => <option key={d} value={d} className="text-black">{d}</option>)}
                </select>
              </div>
              <div className="relative">
                <select
                  className="w-full h-11 px-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl outline-none text-white font-black text-xs placeholder:text-white/40 focus:border-white/40 focus:bg-white/20 transition-all shadow-sm appearance-none"
                  value={filterThana}
                  onChange={(e) => setFilterThana(e.target.value)}
                  disabled={!filterDistrict}
                >
                  <option value="" className="text-black">{lang === 'bn' ? 'সব থানা' : 'All Thanas'}</option>
                  {filterDistrict && bdThanas[filterDistrict]?.map(tName => <option key={tName} value={tName} className="text-black">{tName}</option>)}
                </select>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder={lang === 'bn' ? 'ওয়ার্ড' : 'Ward'}
                  className="w-full h-11 px-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl outline-none text-white font-black text-xs placeholder:text-white/40 focus:border-white/40 focus:bg-white/20 transition-all shadow-sm"
                  value={filterWard}
                  onChange={(e) => setFilterWard(e.target.value)}
                  disabled={!filterDistrict && !filterThana}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Member List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {students.map(student => (
          <div
            key={student.id}
            onClick={() =>
              isSelectionMode
                ? setSelectedIds(prev => {
                    const n = new Set(prev);
                    if (n.has(student.id)) n.delete(student.id);
                    else n.add(student.id);
                    return n;
                  })
                : onStudentClick(student)
            }
            className={`group p-3.5 sm:p-4 rounded-[2rem] border-2 transition-all flex items-start sm:items-center justify-between gap-2 shadow-sm hover:shadow-lg active:scale-[0.98] cursor-pointer ${
              isSelectionMode && selectedIds.has(student.id)
                ? isDark
                  ? 'bg-[#42f5e9]/10 border-[#42f5e9] shadow-[#42f5e9]/20'
                  : 'bg-[#42f5e9]/10 border-[#42f5e9] shadow-[#42f5e9]/10'
                : isDark
                ? 'bg-slate-800 border-slate-700 hover:border-[#42f5e9]/40 hover:bg-slate-700/50'
                : 'bg-white border-slate-100 hover:border-[#42f5e9]/20'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="relative shrink-0">
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[1rem] flex flex-col items-center justify-center shrink-0 border-2 shadow-inner transition-all duration-300 overflow-hidden ${
                    isSelectionMode && selectedIds.has(student.id)
                      ? 'bg-[#42f5e9] text-[#0e8a84] border-[#42f5e9]'
                      : isDark
                      ? 'bg-slate-800 text-[#42f5e9] border-slate-700 group-hover:bg-slate-700 group-hover:border-[#42f5e9]/40'
                      : 'bg-slate-50 text-[#0fb5ab] border-slate-100 group-hover:bg-[#42f5e9]/10 group-hover:border-[#42f5e9]/20'
                  }`}
                >
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={student.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <>
                      <span className={`text-[7px] sm:text-[8px] font-black leading-none uppercase tracking-widest ${isSelectionMode && selectedIds.has(student.id) ? 'opacity-70' : 'opacity-40'}`}>
                        {lang === 'bn' ? 'আইডি নং' : 'ID NO'}
                      </span>
                      <span className="text-xs sm:text-sm font-black leading-none mt-1 truncate max-w-full px-1">
                        {student.member_id_number || student.roll || '-'}
                      </span>
                    </>
                  )}
                </div>
                {isSelectionMode && (
                  <div
                    className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg flex items-center justify-center shadow-lg border-2 transition-all duration-300 ${
                      selectedIds.has(student.id)
                        ? 'bg-[#42f5e9] text-[#0e8a84] border-white scale-110'
                        : isDark
                        ? 'bg-slate-800 text-slate-600 border-slate-700'
                        : 'bg-white text-slate-200 border-slate-100'
                    }`}
                  >
                    <Check size={14} strokeWidth={4} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  className={`font-black font-noto break-words whitespace-normal leading-snug text-[15px] sm:text-base group-hover:text-[#0fb5ab] transition-colors ${
                    isDark ? 'text-slate-100' : 'text-[#1E3A8A]'
                  }`}
                >
                  {student.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <p
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      student.member_type === 'executive'
                        ? isDark
                          ? 'bg-amber-900/20 text-amber-400 border-amber-900/30'
                          : 'bg-amber-50 text-amber-600 border-amber-100'
                        : student.member_type === 'donor'
                        ? isDark
                          ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/30'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : student.member_type === 'volunteer'
                        ? isDark
                          ? 'bg-indigo-900/20 text-indigo-400 border-indigo-900/30'
                          : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        : isDark
                        ? 'bg-slate-700 text-slate-400 border-slate-600'
                        : 'bg-slate-50 text-slate-500 border-slate-100'
                    }`}
                  >
                    {getMemberTypeLabel(student.member_type || 'general')}
                  </p>
                  {(student.member_id_number || student.roll) && (
                    <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      #{student.member_id_number || student.roll}
                    </span>
                  )}
                  {student.phone && (
                    <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      • {student.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!isSelectionMode && (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-1 sm:ml-2 pt-0.5 sm:pt-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (student.phone) window.location.href = `tel:${student.phone}`;
                  }}
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border-2 shadow-sm active:scale-90 transition-all hover:bg-[#42f5e9] hover:text-[#0e8a84] hover:border-[#42f5e9] hover:shadow-[#42f5e9]/20 ${
                    isDark
                      ? 'bg-slate-800 text-[#42f5e9] border-slate-700'
                      : 'bg-slate-50 text-[#0fb5ab] border-slate-100'
                  }`}
                  title={lang === 'bn' ? 'কল করুন' : 'Call'}
                >
                  <Phone size={15} fill="currentColor" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const cleaned = (student.phone || '').replace(/\D/g, '');
                    if (cleaned) {
                      const waNum = cleaned.startsWith('88') ? cleaned : `88${cleaned}`;
                      window.location.href = `https://wa.me/${waNum}`;
                    }
                  }}
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none active:scale-90 transition-all hover:rotate-6 hover:shadow-emerald-300"
                  title="WhatsApp"
                >
                  <PhoneCall size={15} fill="currentColor" />
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 space-y-3">
            <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center ${isDark ? 'bg-[#42f5e9]/20' : 'bg-[#42f5e9]/10'}`}>
              <Loader2 className="animate-spin text-[#0fb5ab]" size={28} />
            </div>
            <p className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-[0.3em] animate-pulse">{t('searching', lang)}</p>
          </div>
        )}

        {!loading && hasMore && (
          <button
            onClick={() => fetchStudents()}
            disabled={loadingMore}
            className={`col-span-full h-16 mt-2 rounded-[1.5rem] text-[#0fb5ab] font-black text-[11px] uppercase tracking-[0.25em] border-2 border-[#42f5e9]/20 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 group ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 hover:border-[#42f5e9]/40' : 'bg-white hover:bg-[#42f5e9]/10 hover:border-[#42f5e9]/30'
            }`}
          >
            {loadingMore ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <span>{lang === 'bn' ? 'আরও লোড করুন' : 'Load More Members'}</span>
                <ChevronDown size={18} className="group-hover:translate-y-1 transition-transform" strokeWidth={3} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Floating Selection Action Bar (Custom SMS + Template + Voice Broadcast) */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] left-1/2 -translate-x-1/2 w-[94%] max-w-md z-[150] animate-in slide-in-from-bottom-10">
          <div
            className={`backdrop-blur-xl rounded-[2rem] p-4 shadow-2xl border flex flex-col gap-2.5 relative ${
              isDark ? 'bg-slate-900/95 border-[#42f5e9]/30' : 'bg-white/95 border-[#42f5e9]/25'
            }`}
          >
            {/* Template Selector Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className={`w-full h-11 flex items-center justify-between px-4 rounded-xl border font-black text-xs transition-all ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-[#0fb5ab]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <BookOpen size={16} className="text-[#0fb5ab] shrink-0" />
                  <span className="truncate font-noto">
                    {selectedTemplate
                      ? selectedTemplate.title
                      : lang === 'bn'
                      ? 'এসএমএস টেমপ্লেট (ঐচ্ছিক)'
                      : 'SMS Template (Optional)'}
                  </span>
                </div>
                <ChevronDown size={16} className={`shrink-0 transition-transform ${showTemplateMenu ? 'rotate-180' : ''}`} />
              </button>

              {showTemplateMenu && (
                <div
                  className={`absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-2xl border max-h-52 overflow-y-auto p-1.5 z-20 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  {templates.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs font-bold text-slate-400 font-noto">
                      {lang === 'bn' ? 'কোনো টেমপ্লেট নেই — নিচে মেসেজ লিখুন' : 'No templates saved — type your message below'}
                    </div>
                  ) : (
                    templates.map(tmp => (
                      <button
                        type="button"
                        key={tmp.id}
                        onClick={() => {
                          setSelectedTemplate(tmp);
                          setCustomSmsMessage(tmp.body || '');
                          setShowTemplateMenu(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between gap-2 transition-colors ${
                          selectedTemplate?.id === tmp.id
                            ? 'bg-[#42f5e9] text-[#0e8a84] shadow-sm'
                            : isDark
                            ? 'text-slate-200 hover:bg-slate-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate font-noto">{tmp.title}</p>
                          <p className="text-[10px] opacity-70 truncate">{tmp.body}</p>
                        </div>
                        {selectedTemplate?.id === tmp.id && <Check size={15} strokeWidth={4} className="shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Direct Custom SMS Textbox */}
            <textarea
              rows={2}
              value={customSmsMessage}
              onChange={(e) => setCustomSmsMessage(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'এখানে সরাসরি মেসেজ লিখুন অথবা উপরের টেমপ্লেট থেকে বাছাই করুন... ({name} ব্যবহার করা যাবে)'
                  : 'Write your message directly or choose a template above...'
              }
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold font-noto outline-none resize-none transition-all ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#42f5e9]'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-[#0fb5ab]'
              }`}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {canSendSystemSMS && (
                <button
                  type="button"
                  onClick={handlePremiumSMS}
                  disabled={sending || !customSmsMessage.trim()}
                  className="h-11 bg-[#42f5e9] text-[#0e8a84] rounded-full font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-45 active:scale-95 transition-all"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} fill="currentColor" />}
                  <span className="truncate">{t('system_sms', lang)}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenVoiceModal}
                disabled={isVoiceSending || selectedIds.size === 0}
                className="h-11 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-45 active:scale-95 transition-all"
              >
                <PhoneCall size={14} />
                <span className="truncate">{lang === 'bn' ? 'ভয়েস কল' : 'Voice Call'}</span>
              </button>

              {canSendFreeSMS && (
                <button
                  type="button"
                  onClick={handleFreeSMS}
                  disabled={!customSmsMessage.trim()}
                  className="h-11 bg-[#0fb5ab] text-white rounded-full font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-45 active:scale-95 transition-all"
                >
                  <Smartphone size={14} fill="currentColor" />
                  <span className="truncate">{t('native_sms', lang)}</span>
                </button>
              )}
            </div>

            <p className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-widest text-center">
              {selectedIds.size} {t('selected', lang)} • {validSelectedPhones.length}{' '}
              {lang === 'bn' ? 'টি বৈধ নম্বর' : 'Valid Phones'}
            </p>
          </div>
        </div>
      )}

      {/* Voice Call Broadcast Modal */}
      {showVoiceModal &&
        createPortal(
          <div className="fixed inset-0 z-[320] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div
              className={`w-full max-w-lg rounded-[2.5rem] border shadow-2xl p-6 sm:p-8 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto ${
                isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <PhoneCall size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-noto">
                      {lang === 'bn' ? 'সদস্য ভয়েস কল ব্রডকাস্ট' : 'Member Voice Call Broadcast'}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400">
                      {lang === 'bn'
                        ? 'নির্বাচিত সদস্যদের নম্বরে স্বয়ংক্রিয় ভয়েস কল পাঠান'
                        : 'Send automated voice call broadcast to selected members'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVoiceModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Recipients Summary */}
              <div
                className={`p-4 rounded-2xl border grid grid-cols-2 gap-4 ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-orange-50/50 border-orange-100/70'
                }`}
              >
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'bn' ? 'নির্বাচিত সদস্য' : 'Selected Members'}
                  </p>
                  <p className="text-lg font-black text-orange-500 mt-0.5">
                    {selectedMembers.length} {lang === 'bn' ? 'জন' : 'Members'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'bn' ? 'বৈধ ফোন নম্বর' : 'Valid Phones'}
                  </p>
                  <p className="text-lg font-black text-[#0fb5ab] mt-0.5">
                    {validSelectedPhones.length} {lang === 'bn' ? 'টি' : 'Numbers'}
                  </p>
                </div>
              </div>

              {/* Direct Call Quick Option when 1 member is selected */}
              {selectedMembers.length === 1 && validSelectedPhones.length === 1 && (
                <a
                  href={`tel:${validSelectedPhones[0]}`}
                  className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-black transition-all ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-[#42f5e9] hover:bg-slate-700'
                      : 'bg-[#42f5e9]/10 border-[#42f5e9]/30 text-[#0fb5ab] hover:bg-[#42f5e9]/20'
                  }`}
                >
                  <Phone size={15} />
                  <span>
                    {lang === 'bn'
                      ? `${selectedMembers[0].name}-কে সরাসরি কল করুন (${validSelectedPhones[0]})`
                      : `Direct Call ${selectedMembers[0].name} (${validSelectedPhones[0]})`}
                  </span>
                </a>
              )}

              {/* Voice Template Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider px-1 block">
                  {lang === 'bn' ? 'ভয়েস টেমপ্লেট নির্বাচন করুন' : 'Select Voice Template'}
                </label>

                {loadingVoices ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                    <Loader2 size={16} className="animate-spin" />
                    {lang === 'bn' ? 'ভয়েস লোড হচ্ছে...' : 'Loading voices...'}
                  </div>
                ) : voiceTemplates.length === 0 ? (
                  <div
                    className={`p-5 rounded-2xl border text-center space-y-2 ${
                      isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Mic size={24} className="mx-auto text-slate-400" />
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-300 font-noto">
                      {lang === 'bn' ? 'কোনো ভয়েস টেমপ্লেট পাওয়া যায়নি।' : 'No voice templates found.'}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400 font-noto">
                      {lang === 'bn'
                        ? 'ভয়েস ব্রডকাস্ট মডিউল থেকে আপনার অডিও ভয়েস রেকর্ড বা আপলোড করে অনুমোদন নিন।'
                        : 'Please record or upload and approve an audio voice in the Voice Broadcast module.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {voiceTemplates.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVoiceId(v.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          selectedVoiceId === v.id
                            ? 'border-orange-500 bg-orange-500/10 shadow-sm'
                            : isDark
                            ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedVoiceId === v.id ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Volume2 size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate font-noto">{v.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{v.provider_voice_name || 'Standard Voice'}</p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shrink-0 ${
                            v.provider_status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : 'bg-blue-500/20 text-blue-500'
                          }`}
                        >
                          {v.provider_status || 'Ready'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cost & Balance */}
              <div
                className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-2 ${
                  isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-emerald-500" />
                  <span className="text-xs font-bold text-slate-400">
                    {lang === 'bn' ? 'বর্তমান ব্যালেন্স:' : 'Current Balance:'}
                  </span>
                  <span className="text-xs font-black text-emerald-500">৳{walletBalance.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400">
                    {lang === 'bn' ? 'আনুমানিক খরচ:' : 'Estimated Cost:'}
                  </span>{' '}
                  <span className="text-xs font-black text-orange-500">
                    ৳{(validSelectedPhones.length * voiceRate).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowVoiceModal(false)}
                  className={`flex-1 h-12 rounded-2xl font-bold text-xs border active:scale-95 transition-all ${
                    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSendVoiceBroadcast}
                  disabled={isVoiceSending || loadingVoices || voiceTemplates.length === 0 || validSelectedPhones.length === 0}
                  className="flex-1 h-12 rounded-2xl font-black text-xs bg-orange-500 hover:bg-orange-600 text-white shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVoiceSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{lang === 'bn' ? 'কল যাচ্ছে...' : 'Calling...'}</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall size={16} />
                      <span>{lang === 'bn' ? 'ভয়েস কল পাঠান' : 'Send Voice Call'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Status Modal */}
      {statusModal.show &&
        createPortal(
          <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-500">
            <div
              className={`w-full max-w-sm rounded-[3rem] p-8 sm:p-10 text-center shadow-[0_50px_120px_rgba(66,245,233,0.2)] border animate-in zoom-in-95 duration-500 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#42f5e9]/10'
              }`}
            >
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-8 mb-6 relative ${
                  statusModal.type === 'success'
                    ? isDark
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-emerald-50 text-emerald-500 border-emerald-100'
                    : statusModal.type === 'balance'
                    ? isDark
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      : 'bg-orange-50 text-orange-500 border-orange-100'
                    : isDark
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-red-50 text-red-500 border-red-100'
                }`}
              >
                <div className="absolute inset-0 blur-2xl opacity-20 bg-current animate-pulse" />
                {statusModal.type === 'success' ? (
                  <CheckCircle2 size={56} strokeWidth={2.5} />
                ) : statusModal.type === 'balance' ? (
                  <Zap size={56} strokeWidth={2.5} />
                ) : (
                  <AlertCircle size={56} strokeWidth={2.5} />
                )}
              </div>
              <h3 className={`text-2xl font-black font-noto tracking-tight ${isDark ? 'text-slate-100' : 'text-[#0fb5ab]'}`}>
                {statusModal.title}
              </h3>
              <p className="text-[13px] font-bold text-slate-400 mt-3 font-noto px-2 leading-relaxed">{statusModal.message}</p>
              <div className="mt-7 flex gap-2">
                {statusModal.type === 'balance' && onNavigateToWallet && (
                  <button
                    onClick={() => {
                      setStatusModal({ ...statusModal, show: false });
                      setShowVoiceModal(false);
                      onNavigateToWallet();
                    }}
                    className="flex-1 h-12 bg-orange-500 text-white font-black rounded-xl text-xs uppercase tracking-wider active:scale-95 transition-all"
                  >
                    {lang === 'bn' ? 'ওয়ালেট রিচার্জ' : 'Recharge'}
                  </button>
                )}
                <button
                  onClick={() => setStatusModal({ ...statusModal, show: false })}
                  className="flex-1 h-12 bg-[#0fb5ab] text-white font-black rounded-xl shadow-lg shadow-[#0fb5ab]/20 text-xs uppercase tracking-wider active:scale-95 transition-all"
                >
                  {lang === 'bn' ? 'ঠিক আছে' : 'Continue'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Members;
