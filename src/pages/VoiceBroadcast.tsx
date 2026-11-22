import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Mic, 
  Upload, 
  CreditCard, 
  Play, 
  Send, 
  History, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ChevronDown, 
  Trash2, 
  Smartphone,
  Zap,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  ShieldCheck
} from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, Department, Member, Profile, UserRole } from 'types';
import { t } from 'translations';
import { sortMadrasahClasses } from 'pages/Departments';
import {
  DEFAULT_VOICE_RATE,
  normalizePhone,
  resolveInstitutionVoiceRate,
  buildCmVoiceName,
  extractInstitutionShortCode,
  stripCmVoicePrefix
} from 'utils/smsUtils';
import PaymentCheckout from 'components/PaymentCheckout';

interface VoiceBroadcastProps {
  lang: Language;
  madrasah: Institution | null;
  triggerRefresh: () => void;
  dataVersion: number;
  isEmbedded?: boolean;
  role: UserRole;
  profile?: Profile | null;
  onBack: () => void;
}

const VoiceBroadcast: React.FC<VoiceBroadcastProps> = ({ lang, madrasah, triggerRefresh, dataVersion, isEmbedded = false, role, profile, onBack }) => {
  const isTeacher = role === 'executive';
  const canUseVoice = !isTeacher || profile?.permissions?.can_use_voice_call;

  if (!canUseVoice) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'templates' | 'broadcast' | 'recharge' | 'history'>('broadcast');
  const [loading, setLoading] = useState(false);
  
  const modules = useMemo(() => ({
    voice_broadcast: true,
    ...(madrasah?.config_json?.modules || {})
  }), [madrasah?.config_json?.modules]);

  const availableTabs = useMemo(() => {
    return (['templates', 'broadcast', 'history', 'recharge'] as const).filter(tab => {
      if (tab === 'recharge' && role === 'executive') return false;
      if (tab === 'templates' || tab === 'broadcast') return modules.voice_broadcast !== false;
      return true;
    });
  }, [role, modules.voice_broadcast]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0] || 'broadcast');
    }
  }, [availableTabs, activeTab]);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  
  // Voices state
  const [voices, setVoices] = useState<any[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Broadcast state
  const [departments, setClasses] = useState<Department[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // History state
  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyDetails, setHistoryDetails] = useState<any | null>(null);
  const [studentNamesMap, setStudentNamesMap] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const instShortCode = useMemo(() => extractInstitutionShortCode(madrasah), [madrasah]);
  const knownInstCodes = useMemo(() => (instShortCode ? [instShortCode] : []), [instShortCode]);
  const awajUploadPreviewName = useMemo(() => buildCmVoiceName(uploadName, instShortCode), [uploadName, instShortCode]);

  const parsedInstConfig: any = useMemo(() => {
    const raw = madrasah?.config_json as any;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw || {};
  }, [madrasah?.config_json]);

  const [voiceRate, setVoiceRate] = useState<number>(() =>
    resolveInstitutionVoiceRate(madrasah, { voice_rate: DEFAULT_VOICE_RATE })
  );

  // Error/Status Modal
  const [statusModal, setStatusModal] = useState<{show: boolean, type: 'error' | 'balance' | 'success', title: string, message: string}>({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{id: string, providerId: string | null, fileUrl: string | null, title: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!madrasah) return;
    fetchWalletBalance();
    fetchSystemSettings();
    if (activeTab === 'templates') fetchVoices();
    if (activeTab === 'broadcast') { fetchClasses(); fetchVoices(); fetchSenders(); }
    if (activeTab === 'history') { fetchVoices(); fetchSenders(); fetchHistory(); }
  }, [activeTab, madrasah?.id, dataVersion, parsedInstConfig?.voice_rate]);

  const fetchSystemSettings = async () => {
    try {
      const globalRates = await smsApi.getGlobalSettings();
      setVoiceRate(resolveInstitutionVoiceRate(madrasah, globalRates));
    } catch {
      setVoiceRate(resolveInstitutionVoiceRate(madrasah, { voice_rate: DEFAULT_VOICE_RATE }));
    }
  };

  const fetchWalletBalance = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('institutions').select('balance').eq('id', madrasah.id).single();
    if (data) setWalletBalance(data.balance);
  };

  const fetchVoices = async () => {
    if (!madrasah) return;
    setLoading(true);
    try {
      setApiError(null);
      // Fetch from Awaj API
      const { data: { session } } = await supabase.auth.getSession();
      let apiVoices: any[] = [];
      const response = await fetch('/api/awaj/voices', {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        apiVoices = Array.isArray(data) ? data : (data.voices || data.data || []);
        console.log('Awaj Voices List:', apiVoices);
      } else {
        const errData = await response.json().catch(() => ({}));
        setApiError(errData.error || `Awaj API Error: ${response.status}`);
      }

      // First, get local voices
      const { data: localVoices } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false });
      
      if (localVoices) {
        // Sync statuses and IDs from Awaj API
        const syncedVoices = [];
        for (const localVoice of localVoices) {
          // Try to find matching voice in API by ID, provider_voice_name, or clean/exact title
          const localTitleLower = String(localVoice.title || '').trim().toLowerCase();
          const localProviderNameLower = String(localVoice.provider_voice_name || '').trim().toLowerCase();
          const awajVoice = apiVoices.find(v => {
            if (localVoice.provider_voice_id && v.id && v.id.toString() === localVoice.provider_voice_id.toString()) {
              return true;
            }
            if (!v.name) return false;
            const apiNameLower = String(v.name).trim().toLowerCase();
            if (localProviderNameLower && apiNameLower === localProviderNameLower) return true;
            if (localTitleLower && apiNameLower === localTitleLower) return true;
            const strippedApiLower = stripCmVoicePrefix(v.name, knownInstCodes).toLowerCase();
            return Boolean(localTitleLower && strippedApiLower === localTitleLower);
          });

          if (awajVoice) {
            const newStatus = awajVoice.status || 'approved';
            const newProviderId = awajVoice.id ? awajVoice.id.toString() : localVoice.provider_voice_id;
            const newProviderName = awajVoice.name || localVoice.provider_voice_name;
            
            if (localVoice.provider_status !== newStatus || localVoice.provider_voice_id !== newProviderId || localVoice.provider_voice_name !== newProviderName) {
              await supabase.from('voice_templates').update({ 
                provider_status: newStatus,
                provider_voice_id: newProviderId,
                provider_voice_name: newProviderName
              }).eq('id', localVoice.id);
              
              localVoice.provider_status = newStatus;
              localVoice.provider_voice_id = newProviderId;
              localVoice.provider_voice_name = newProviderName;
            }
          }
          syncedVoices.push(localVoice);
        }
        setVoices(syncedVoices);
      }

    } catch (error) {
      console.error('Error fetching voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoice = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      const { id, providerId, fileUrl } = showDeleteConfirm;
      // 1. Delete from Awaj Digital if linked
      if (providerId) {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`/api/awaj/voices/${providerId}`, {
          method: 'DELETE',
          headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
        });
      }
      
      if (fileUrl && fileUrl.includes('supabase.co')) {
        const fileName = fileUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('voice-templates').remove([`voices/${fileName}`]);
        }
      }

      const { error } = await supabase.from('voice_templates').delete().eq('id', id);
      if (error) throw error;
      
      setVoices(voices.filter(v => v.id !== id));
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ভয়েস সফলভাবে ডিলিট করা হয়েছে' : 'Voice deleted successfully.'
      });
      setShowDeleteConfirm(null);
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchSenders = async () => {
    try {
      setApiError(null);
      // Fetch default senders from Awaj API
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/awaj/senders', {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      });
      let sendersList: any[] = [];
      
      if (response.ok) {
        const data = await response.json();
        sendersList = Array.isArray(data) ? data : (data.senders || data.data || []);
        console.log('Awaj Senders List:', sendersList);
      } else {
        const errData = await response.json().catch(() => ({}));
        setApiError(errData.error || `Awaj API Error: ${response.status}`);
      }

      if (madrasah?.voice_sender_id) {
        // Check if it's already in the list
        const exists = sendersList.some(s => 
          (s.callingNumber === madrasah.voice_sender_id) || 
          (s.caller_id === madrasah.voice_sender_id) || 
          (s.id === madrasah.voice_sender_id)
        );

        if (!exists) {
          sendersList.unshift({
            id: madrasah.voice_sender_id,
            callingNumber: madrasah.voice_sender_id,
            name: 'Dedicated Sender ID'
          });
        }
      }

      setSenders(sendersList);
      if (sendersList.length > 0 && !selectedSenderId) {
        setSelectedSenderId(sendersList[0].id || sendersList[0].callingNumber || sendersList[0].caller_id);
      }
    } catch (error) {
      console.error('Error fetching senders:', error);
    }
  };

  useEffect(() => {
    if (madrasah) {
      fetchSenders();
    }
  }, [madrasah]);

  const fetchClasses = async () => {
    if (!madrasah) return;
    const { data } = await supabase.from('departments').select('*').eq('institution_id', madrasah.id);
    if (data) {
      let filteredClasses = data;
      if (role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0) {
        filteredClasses = data.filter(cls => profile.permissions.allowed_departments.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
  };

  const queryVoiceBroadcastRows = async (institutionId: string) => {
    const { data, error } = await supabase
      .from('voice_broadcasts')
      .select('*, voice_templates!voice_broadcasts_voice_template_id_fkey(title)')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (!error && data) return data;

    const { data: fallbackData } = await supabase
      .from('voice_broadcasts')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    return fallbackData || [];
  };

  const fetchHistory = async () => {
    if (!madrasah) return;
    setLoading(true);
    try {
      const data = await queryVoiceBroadcastRows(madrasah.id);
      setBroadcastHistory(data);

      data.filter(b => b.status === 'sending' || b.status === 'pending').forEach(async (broadcast) => {
        if (!broadcast.provider_campaign_id) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(`/api/awaj/broadcast/${broadcast.provider_campaign_id}`, {
            headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
          });
          if (response.ok) {
            const result = await response.json();
            let newStatus = broadcast.status;
            const providerStatus = (result.broadcast?.status || result.status || result.state || '').toLowerCase();

            if (['pending', 'queued', 'scheduled'].includes(providerStatus)) {
              newStatus = 'pending';
            } else if (['sending', 'processing', 'running'].includes(providerStatus)) {
              newStatus = 'sending';
            } else if (['failed', 'error', 'cancelled'].includes(providerStatus)) {
              newStatus = 'failed';
            } else if (['completed', 'done', 'success'].includes(providerStatus)) {
              newStatus = 'completed';
            }

            if (newStatus !== broadcast.status) {
              await supabase.from('voice_broadcasts').update({ status: newStatus }).eq('id', broadcast.id);
              const updatedData = await queryVoiceBroadcastRows(madrasah.id);
              setBroadcastHistory(updatedData);
            }
          }
        } catch (error) {
          console.error('Error tracking broadcast result:', error);
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async (broadcast: any, failedLogs: any[]) => {
    if (!failedLogs.length || !madrasah) return;

    const phoneNumbers = failedLogs
      .map(log => log.phone || log.number || log.to || log.msisdn)
      .map((p: any) => {
        const digits = String(p || '').replace(/[^0-9]/g, '');
        if (digits.length === 11 && digits.startsWith('01')) return digits;
        if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
        if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
        return digits;
      })
      .filter((p: string) => p.length === 11 && p.startsWith('01'));

    if (!phoneNumbers.length) {
      setStatusModal({ show: true, title: lang === 'bn' ? 'ত্রুটি' : 'Error', type: 'error', message: lang === 'bn' ? 'রিট্রাই করার জন্য কোনো বৈধ নম্বর পাওয়া যায়নি।' : 'No valid phone numbers found to retry.' });
      return;
    }

    if (!confirm(lang === 'bn'
      ? `আপনি কি ${phoneNumbers.length} টি ব্যর্থ নম্বরে পুনরায় কল পাঠাতে চান? এতে আপনার ব্যালেন্স থেকে চার্জ কাটা হবে।`
      : `Are you sure you want to retry ${phoneNumbers.length} failed calls? This will deduct from your balance.`)) {
      return;
    }

    try {
      const voiceId = broadcast.voice_template_id || broadcast.template_id || broadcast.voice_id;
      let availableVoices = voices;
      if (availableVoices.length === 0) {
        const { data: vRows } = await supabase
          .from('voice_templates')
          .select('*')
          .eq('institution_id', madrasah.id);
        if (vRows) availableVoices = vRows;
      }

      const voice = availableVoices.find(v => v.id === voiceId);
      const voiceName = voice?.provider_voice_name || voice?.title || voice?.name || broadcast.voice_templates?.title;
      if (!voiceId || !voiceName) {
        setStatusModal({ show: true, title: lang === 'bn' ? 'ত্রুটি' : 'Error', type: 'error', message: lang === 'bn' ? 'মূল ভয়েস টেমপ্লেট পাওয়া যায়নি।' : 'Original voice template is missing.' });
        return;
      }

      const senderObj = senders.find(s =>
        (broadcast.sender_id && (s.id === broadcast.sender_id || s.callingNumber === broadcast.sender_id || s.caller_id === broadcast.sender_id)) ||
        (selectedSenderId && (s.id === selectedSenderId || s.callingNumber === selectedSenderId || s.caller_id === selectedSenderId))
      ) || senders[0];

      let rawSender = senderObj
        ? String(senderObj.callingNumber || senderObj.caller_id || senderObj.number || senderObj.sender_id || senderObj.id)
        : String(broadcast.sender_id || selectedSenderId || madrasah.voice_sender_id || '');

      const sDigits = rawSender.replace(/[^0-9]/g, '');
      let sNumber = rawSender;
      if (sDigits.length === 11 && sDigits.startsWith('01')) sNumber = '88' + sDigits;
      else if (sDigits.length === 13 && sDigits.startsWith('8801')) sNumber = sDigits;
      else if (sDigits.length === 10 && sDigits.startsWith('1')) sNumber = '880' + sDigits;

      if (!sNumber) {
        setStatusModal({ show: true, title: lang === 'bn' ? 'ত্রুটি' : 'Error', type: 'error', message: lang === 'bn' ? 'ভয়েস সেন্ডার আইডি পাওয়া যায়নি।' : 'Voice sender ID is unavailable.' });
        return;
      }

      const estimatedCost = phoneNumbers.length * voiceRate;
      if (walletBalance < estimatedCost) {
        setStatusModal({
          show: true,
          type: 'balance',
          title: lang === 'bn' ? 'অপর্যাপ্ত ব্যালেন্স' : 'Insufficient Balance',
          message: lang === 'bn' ? `রিচার্জ প্রয়োজন: ${estimatedCost.toFixed(2)} ৳` : `Recharge needed: ${estimatedCost.toFixed(2)} ৳`
        });
        return;
      }

      const requestId = 'cm_retry_' + Math.random().toString(36).slice(2, 11);
      const payload = {
        request_id: requestId,
        voice: voiceName,
        sender: sNumber,
        phone_numbers: phoneNumbers,
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
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to send retry broadcast via Awaj API');
      }

      const result = await response.json();
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || result.data?.campaign_id || result.request_id || requestId;

      // Deduct balance first/always once Awaj broadcast succeeds
      const newBalance = Math.max(0, walletBalance - estimatedCost);
      const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', madrasah.id);
      if (balanceError) {
        console.error('Failed to deduct balance:', balanceError);
      } else {
        setWalletBalance(newBalance);
      }

      // Record broadcast log cleanly (never block success/balance if table schema differs)
      await smsApi.recordVoiceBroadcast(madrasah.id, {
        voiceTemplateId: voiceId,
        targetType: 'retry',
        targetId: broadcast.id,
        totalNumbers: phoneNumbers.length,
        estimatedCost,
        providerCampaignId: campaignId,
        status: 'sending'
      });

      setStatusModal({
        show: true,
        title: lang === 'bn' ? 'সফল' : 'Success',
        type: 'success',
        message: lang === 'bn' ? `${phoneNumbers.length} টি নম্বরে পুনরায় কল পাঠানো শুরু হয়েছে।` : `Successfully initiated retry for ${phoneNumbers.length} calls.`
      });
      fetchHistory();
    } catch (err: any) {
      console.error('Error retrying broadcast:', err);
      setStatusModal({ show: true, title: lang === 'bn' ? 'ব্যর্থ' : 'Error', type: 'error', message: err.message || 'Failed to retry broadcast' });
    }
  };

  const handleExpandHistory = async (broadcast: any) => {
    if (expandedHistoryId === broadcast.id) {
      setExpandedHistoryId(null);
      setHistoryDetails(null);
      return;
    }
    
    setExpandedHistoryId(broadcast.id);
    setLoadingDetails(true);
    setHistoryDetails(null);
    
    if (!broadcast.provider_campaign_id) {
      setHistoryDetails({ error: 'No campaign ID found for this broadcast' });
      setLoadingDetails(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/awaj/broadcast/${broadcast.provider_campaign_id}`, {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      });
      if (response.ok) {
        try {
          const result = await response.json();
          console.log('Broadcast Details API Response:', result);
          setHistoryDetails(result);
          
          // Fetch student names to map phone numbers
          if (madrasah?.id) {
            const { data: students } = await supabase
              .from('members')
              .select('name, roll, phone, guardian_phone_2')
              .eq('institution_id', madrasah.id);
              
            if (students) {
              console.log(`Fetched ${students.length} students for mapping`);
              const newMap: Record<string, { name: string, roll: string }> = {};
              
              const normalizePhone = (p: string) => {
                if (!p) return '';
                const digits = p.replace(/[^0-9]/g, '');
                if (digits.length === 11 && digits.startsWith('01')) return digits;
                if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
                if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
                return digits;
              };

              students.forEach(s => {
                const info = { name: s.name, roll: s.roll ? s.roll.toString() : '' };
                if (s.phone) {
                  const norm = normalizePhone(s.phone);
                  if (norm) newMap[norm] = info;
                }
                if (s.guardian_phone_2) {
                  const norm2 = normalizePhone(s.guardian_phone_2);
                  if (norm2) newMap[norm2] = info;
                }
              });
              setStudentNamesMap(newMap as any);
            }
          }
        } catch (parseErr) {
          console.error('Error parsing broadcast details JSON:', parseErr);
          setHistoryDetails({ error: 'Invalid response format from server' });
        }
      } else {
        let errorMsg = 'Failed to load details';
        try {
          const errData = await response.json();
          errorMsg = errData.error || errData.message || errorMsg;
        } catch (e) {
          // Ignore
        }
        setHistoryDetails({ error: errorMsg });
      }
    } catch (err: any) {
      console.error('Error fetching broadcast details:', err);
      setHistoryDetails({ error: err.message || 'Error loading details' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const extractCallLogs = (details: any) => {
    if (!details) return [];
    if (Array.isArray(details)) return details;
    if (details.calls && Array.isArray(details.calls)) return details.calls;
    if (details.logs && Array.isArray(details.logs)) return details.logs;
    if (details.recipients && Array.isArray(details.recipients)) return details.recipients;
    if (details.data && Array.isArray(details.data)) return details.data;
    if (details.results && Array.isArray(details.results)) return details.results;
    if (details.details && Array.isArray(details.details)) return details.details;
    if (details.broadcast && details.broadcast.calls) return details.broadcast.calls;
    
    // Search for any array in the object that looks like call logs
    for (const key in details) {
      if (Array.isArray(details[key]) && details[key].length > 0 && typeof details[key][0] === 'object') {
        const firstItem = details[key][0];
        if (firstItem.phone || firstItem.number || firstItem.to || firstItem.msisdn || firstItem.recipient || firstItem.mobile || firstItem.destination) {
          return details[key];
        }
      }
    }
    
    // Fallback: return the first array found
    for (const key in details) {
      if (Array.isArray(details[key]) && details[key].length > 0) {
        return details[key];
      }
    }
    
    return [];
  };

  const handleBroadcast = async () => {
    if (!madrasah || !selectedVoiceId || !selectedClassId || !selectedSenderId) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'তথ্য অসম্পূর্ণ' : 'Incomplete Info',
        message: lang === 'bn' ? 'অনুগ্রহ করে ভয়েস, সেন্ডার আইডি এবং কমিটি নির্বাচন করুন।' : 'Please select a voice, sender ID, and committee.'
      });
      return;
    }
    
    // Get member count for selected committee
    const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('department_id', selectedClassId);
    if (!count || count === 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'সদস্য পাওয়া যায়নি' : 'No Members',
        message: lang === 'bn' ? 'এই কমিটিতে কোনো সদস্য পাওয়া যায়নি।' : 'No members found in this committee.'
      });
      return;
    }

    const estimatedCost = count * voiceRate;

    if (walletBalance < estimatedCost) {
      setStatusModal({
        show: true,
        type: 'balance',
        title: lang === 'bn' ? 'ব্যালেন্স শেষ!' : 'Out of Balance!',
        message: lang === 'bn' ? `ব্যালেন্স পর্যাপ্ত নয়। আনুমানিক খরচ: ${estimatedCost} টাকা। বর্তমান ব্যালেন্স: ${walletBalance} টাকা।` : `Insufficient balance. Estimated cost: ${estimatedCost} BDT. Current balance: ${walletBalance} BDT.`
      });
      return;
    }

    setIsBroadcasting(true);
    try {
      // Get the actual students to get their phone numbers
      const { data: students, error: studentError } = await supabase.from('members').select('phone, guardian_phone_2').eq('department_id', selectedClassId);
      
      if (studentError) {
        throw new Error('Error fetching students: ' + studentError.message);
      }

      if (!students || students.length === 0) {
        throw new Error('No students found for this class.');
      }

      // Collect primary phone numbers - use 11 digits (01...) for Awaj API
      const phoneNumbers = students
        .map(s => {
          const phone = s.phone || s.guardian_phone_2;
          if (!phone) return '';
          const digits = phone.replace(/[^0-9]/g, '');
          if (digits.length === 11 && digits.startsWith('01')) return digits;
          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
          return digits;
        })
        .filter(p => p && p.length === 11 && p.startsWith('01'));
      
      if (phoneNumbers.length === 0) {
        throw new Error('No valid 11-digit phone numbers (01...) found for the selected class.');
      }

      // Get the selected template to get the awaj_voice_id
      const voice = voices.find(v => v.id === selectedVoiceId);
      if (!voice) throw new Error('Selected voice not found.');

      if (!voice.provider_voice_id) {
        throw new Error('This voice is not yet linked to Awaj Digital. Please try refreshing the page.');
      }

      if (voice.provider_status !== 'approved' && voice.status !== 'approved') {
        throw new Error('This voice is not yet approved by Awaj Digital.');
      }

      // 1. Send to Awaj Digital API
      const requestId = `cm_broadcast_${crypto.randomUUID().slice(0, 8)}_${Date.now()}`;
      
      // Find the actual sender object to get the calling number
      const senderObj = senders.find(s => 
        (s.id && s.id.toString() === selectedSenderId.toString()) || 
        (s.callingNumber && s.callingNumber.toString() === selectedSenderId.toString()) || 
        (s.caller_id && s.caller_id.toString() === selectedSenderId.toString())
      );
      
      // Documentation says 'sender' must be the active caller sender number (e.g. 8801234567890)
      let sNumber = senderObj ? (senderObj.callingNumber || senderObj.caller_id || senderObj.id).toString() : selectedSenderId.toString();
      
      // Ensure sender is in 8801... format
      const digits = sNumber.replace(/[^0-9]/g, '');
      if (digits.length === 11 && digits.startsWith('01')) {
        sNumber = '88' + digits;
      } else if (digits.length === 13 && digits.startsWith('8801')) {
        sNumber = digits;
      } else if (digits.length === 10 && digits.startsWith('1')) {
        sNumber = '880' + digits;
      }
      
      // Documentation says 'voice' must be the Name of your approved voice
      // We prefer provider_voice_name (synced from API) over local title
      const voiceName = voice.provider_voice_name || voice.title;

      const payload = {
        request_id: requestId,
        voice: voiceName, 
        sender: sNumber,
        phone_numbers: phoneNumbers,
        retry: 1,
        retry_count: 1,
        retries: 1
      };

      console.log('Sending broadcast payload (strictly following docs):', payload);

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
        let errorMessage = 'Failed to send broadcast via Awaj API';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (errorData.details) {
            const details = typeof errorData.details === 'string' ? errorData.details : JSON.stringify(errorData.details);
            errorMessage += ` - ${details}`;
          }
        } catch (e) {
          // If response is not JSON
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Broadcast creation result:', result);
      const campaignId = result.broadcast?.id || result.campaign_id || result.id || result.data?.id || result.data?.campaign_id || result.request_id || requestId;

      // 2. Deduct balance from institution unconditionally once Awaj broadcast succeeds
      const newBalance = Math.max(0, walletBalance - estimatedCost);
      const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', madrasah.id);
      if (balanceError) throw balanceError;
      setWalletBalance(newBalance);

      // 3. Save to Supabase (dual-schema safe, non-fatal if optional columns differ)
      await smsApi.recordVoiceBroadcast(madrasah.id, {
        voiceTemplateId: selectedVoiceId,
        targetType: 'members',
        totalNumbers: phoneNumbers.length,
        estimatedCost,
        providerCampaignId: campaignId,
        status: 'sending'
      });

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'ব্রডকাস্ট সফলভাবে শুরু হয়েছে!' : 'Broadcast started successfully!'
      });
      setSelectedClassId('');
      setSelectedVoiceId('');
      fetchWalletBalance();
      fetchHistory(); // Refresh history
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleVoiceUpload = async () => {
    if (!madrasah || !uploadName.trim() || !uploadFile) return;
    setIsUploading(true);
    try {
      const awajVoiceName = buildCmVoiceName(uploadName, instShortCode);
      const cleanTitle = stripCmVoicePrefix(uploadName, knownInstCodes) || uploadName.trim();

      let publicUrl = '';
      try {
        const fileExt = uploadFile.name.split('.').pop();
        const fileName = `${madrasah.id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('voice-templates')
          .upload(`voices/${fileName}`, uploadFile);
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('voice-templates')
            .getPublicUrl(`voices/${fileName}`);
          publicUrl = urlData?.publicUrl || '';
        }
      } catch (storageErr) {
        console.warn('Supabase storage upload skipped/fallback:', storageErr);
      }

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      const { data: { session } } = await supabase.auth.getSession();
      const awajRes = await fetch('/api/awaj/voices/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          name: awajVoiceName,
          file_base64: base64Data,
          filename: uploadFile.name,
          content_type: uploadFile.type || 'audio/mpeg'
        })
      });

      const rawText = await awajRes.text();
      let awajData: any = {};
      try {
        awajData = rawText ? JSON.parse(rawText) : {};
      } catch {
        awajData = { error: rawText || awajRes.statusText };
      }
      if (awajRes.status === 413) {
        throw new Error('অডিও ফাইলটি সার্ভারের সীমার চেয়ে বড় (অনুগ্রহ করে ৩.৫ MB এর কম ফাইল দিন)।');
      }
      if (!awajRes.ok) {
        throw new Error(awajData.error || awajData.message || `Awaj ভয়েস আপলোড ব্যর্থ হয়েছে (${awajRes.status})`);
      }

      const providerVoiceId = (awajData.id || awajData.voice_id || awajData.voice?.id || '').toString();
      const providerVoiceName = awajData.name || awajData.voice?.name || awajVoiceName;
      const providerStatus = (awajData.status || awajData.voice?.status || 'pending').toLowerCase();
      const finalFileUrl = publicUrl || awajData.url || awajData.previewUrl || awajData.audioUrl || awajData.voice?.previewUrl || '';

      const { error: dbError } = await supabase.from('voice_templates').insert({
        institution_id: madrasah.id,
        title: cleanTitle,
        provider_voice_name: providerVoiceName,
        provider_voice_id: providerVoiceId || null,
        file_url: finalFileUrl,
        admin_status: 'approved',
        provider_status: providerStatus
      });

      if (dbError) throw dbError;

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn'
          ? `ভয়েস সফলভাবে আপলোড হয়েছে (${awajVoiceName})! Awaj অনুমোদন পেলে ব্রডকাস্টে ব্যবহার করা যাবে।`
          : `Voice uploaded successfully (${awajVoiceName})!`
      });
      setShowUploadModal(false);
      setUploadName('');
      setUploadFile(null);
      fetchVoices();
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRequestApproval = async (voiceId: string) => {
    try {
      const { error } = await supabase.from('voice_templates').update({
        admin_status: 'pending',
        provider_status: 'pending'
      }).eq('id', voiceId);
      
      if (error) throw error;
      
      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'সফল' : 'Success',
        message: lang === 'bn' ? 'অনুমোদনের অনুরোধ সফলভাবে পাঠানো হয়েছে।' : 'Approval requested successfully.'
      });
      fetchVoices();
    } catch (err: any) {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message
      });
    }
  };

  const getSelectedClassName = () => {
    const cls = departments.find(c => c.id === selectedClassId);
    return cls ? cls.name : (lang === 'bn' ? 'কমিটি নির্বাচন করুন' : 'Select Committee');
  };

  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showSenderDropdown, setShowSenderDropdown] = useState(false);

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-[#42f5e9] p-6 rounded-[2.2rem] shadow-premium border border-[#42f5e9]/20 flex items-center justify-between text-[#0e8a84] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Mic size={120} />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">{t('available_balance', lang)}</p>
          <h3 className="text-4xl font-black flex items-baseline gap-2">
            {walletBalance.toFixed(2)} <span className="text-lg opacity-60">৳</span>
          </h3>
        </div>
        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
          <Mic size={28} className="text-[#0e8a84]" />
        </div>
      </div>

      <div className="relative h-[60px] bg-white rounded-[2.5rem] p-1.5 shadow-bubble border border-slate-100 flex items-center mb-8">
        <div 
          className="absolute h-[48px] bg-[#42f5e9] rounded-[2.5rem] transition-all duration-500 shadow-premium"
          style={{ 
            width: availableTabs.length > 0 ? `${100 / availableTabs.length}%` : '0',
            left: availableTabs.length > 0 ? `${(Math.max(0, availableTabs.indexOf(activeTab)) * 100) / availableTabs.length}%` : '0',
            transform: 'translateX(0)'
          }}
        />
        {availableTabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 h-full rounded-[2.5rem] font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all z-10 ${activeTab === tab ? 'text-[#0e8a84]' : 'text-slate-400'}`}>
            {tab === 'broadcast' ? <Send size={16} /> : 
             tab === 'templates' ? <Mic size={16} /> : 
             tab === 'history' ? <History size={16} /> :
             <CreditCard size={16} />}
            <span className="font-noto">
              {tab === 'broadcast' ? t('broadcast', lang) : 
               tab === 'templates' ? t('voice', lang) : 
               tab === 'history' ? t('history', lang) :
               t('recharge', lang)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === 'broadcast' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-bubble border border-slate-100">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                <div className="space-y-7">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#0fb5ab] uppercase tracking-widest px-1">{t('step_1_class', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#0fb5ab]">{getSelectedClassName()}</span>
                        <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showClassDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {departments.map(cls => (
                            <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#42f5e9] text-[#0e8a84]' : 'hover:bg-slate-50 text-[#0fb5ab]'}`}>
                              <span className="font-black font-noto">{cls.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#0fb5ab] uppercase tracking-widest px-1">{t('select_voice', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowVoiceDropdown(!showVoiceDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#0fb5ab]">
                          {selectedVoiceId ? stripCmVoicePrefix(voices.find(v => v.id === selectedVoiceId)?.title, knownInstCodes) : t('select_voice', lang)}
                        </span>
                        <ChevronDown className={`text-slate-300 transition-all ${showVoiceDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showVoiceDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {voices.filter(v => v.admin_status === 'approved' && v.provider_status === 'approved').map(v => (
                            <button key={v.id} onClick={() => { setSelectedVoiceId(v.id); setShowVoiceDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedVoiceId === v.id ? 'bg-[#42f5e9] text-[#0e8a84]' : 'hover:bg-slate-50 text-[#0fb5ab]'}`}>
                              <span className="font-black font-noto">{stripCmVoicePrefix(v.title, knownInstCodes)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-7 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-[#0fb5ab] uppercase tracking-widest px-1">{t('select_sender_id', lang)}</h4>
                    <div className="relative">
                      <button onClick={() => setShowSenderDropdown(!showSenderDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                        <span className="text-base font-black font-noto text-[#0fb5ab]">
                          {selectedSenderId ? (senders.find(s => (s.id || s.callingNumber || s.caller_id) === selectedSenderId)?.callingNumber || selectedSenderId) : t('select_sender_id', lang)}
                        </span>
                        <ChevronDown className={`text-slate-300 transition-all ${showSenderDropdown ? 'rotate-180' : ''}`} size={20} />
                      </button>
                      {showSenderDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                          {senders.map(s => (
                            <button key={s.id || s.callingNumber || s.caller_id} onClick={() => { setSelectedSenderId(s.id || s.callingNumber || s.caller_id); setShowSenderDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${(s.id || s.callingNumber || s.caller_id) === selectedSenderId ? 'bg-[#42f5e9] text-[#0e8a84]' : 'hover:bg-slate-50 text-[#0fb5ab]'}`}>
                              <span className="font-black font-noto">{s.callingNumber || s.caller_id || s.id || s.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={handleBroadcast}
                    disabled={!selectedVoiceId || !selectedClassId || !selectedSenderId || isBroadcasting}
                    className="w-full h-[64px] bg-[#42f5e9] text-[#0e8a84] font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all mt-auto"
                  >
                    {isBroadcasting ? <Loader2 className="animate-spin" size={24} /> : <><Send size={20} /> {t('start_broadcast', lang)}</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-5 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between px-2 gap-2 flex-wrap">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('your_voices', lang)}</h2>
              <div className="flex items-center gap-2">
                {!isTeacher && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-[#42f5e9] text-[#0e8a84] px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                  >
                    <Plus size={14} /> {lang === 'bn' ? 'নতুন ভয়েস' : 'Upload Voice'}
                  </button>
                )}
                <button onClick={fetchVoices} disabled={loading} className="bg-[#42f5e9]/10 text-[#0fb5ab] px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-2 active:scale-95 transition-all border border-[#42f5e9]/20">
                   {loading ? <Loader2 className="animate-spin" size={14} /> : <History size={14} />} {t('sync_voices', lang)}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
               {loading ? (
                  <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#0fb5ab]" size={30} /></div>
               ) : voices.length > 0 ? (
                  voices.map(v => (
                    <div key={v.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-bubble">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                             <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
                                <Mic size={18} />
                             </div>
                             <div className="min-w-0">
                               <h4 className="font-black text-[#0fb5ab] text-[15px] font-noto truncate">{stripCmVoicePrefix(v.title, knownInstCodes)}</h4>
                               <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                 <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${v.admin_status === 'approved' && v.provider_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                   {v.provider_status === 'approved' ? t('approved', lang) : t('pending', lang)}
                                 </span>
                               </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {v.file_url && (
                              <audio controls src={v.file_url} className="h-8 w-32 sm:w-48" />
                            )}
                            <button 
                              onClick={() => setShowDeleteConfirm({ id: v.id, providerId: v.provider_voice_id, fileUrl: v.file_url, title: v.title })}
                              className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                       </div>
                    </div>
                  ))
               ) : (
                  <div className="col-span-full text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                     <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_templates', lang)}</p>
                  </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-5">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 flex items-center gap-2">
               <History size={12} /> {t('history', lang)}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {loading ? (
                <div className="col-span-full flex justify-center py-10"><Loader2 className="animate-spin text-[#0fb5ab]" size={32} /></div>
              ) : broadcastHistory.length > 0 ? (
                broadcastHistory.map(h => (
                  <div key={h.id} className="bg-white rounded-[2.2rem] border border-slate-100 shadow-bubble overflow-hidden transition-all">
                    <div className="p-5 cursor-pointer" onClick={() => handleExpandHistory(h)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#42f5e9]/10 rounded-xl flex items-center justify-center text-[#0fb5ab]">
                            <Send size={18} />
                          </div>
                          <div>
                            <h3 className="font-black text-[#0fb5ab] text-[15px] font-noto">
                              {stripCmVoicePrefix(h.voice_templates?.title || voices.find(v => v.id === (h.voice_template_id || h.template_id))?.title || 'Voice Broadcast', knownInstCodes)}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(h.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${h.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-[#42f5e9]/20 text-[#0fb5ab]'}`}>
                            {h.status}
                          </span>
                          <ChevronDown size={16} className={`text-slate-300 transition-transform ${expandedHistoryId === h.id ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('target', lang)}</p>
                          <p className="text-xs font-black text-[#0fb5ab] capitalize">{h.target_type || 'members'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('numbers', lang)}</p>
                          <p className="text-xs font-black text-[#0fb5ab]">{h.total_numbers ?? h.total_recipients ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost', lang)}</p>
                          <p className="text-xs font-black text-red-500">{Number(h.estimated_cost ?? h.total_cost ?? h.cost ?? 0).toFixed(2)} ৳</p>
                        </div>
                      </div>
                    </div>
                    
                    {expandedHistoryId === h.id && (
                      <div className="bg-slate-50 p-5 border-t border-slate-100 animate-in slide-in-from-top-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Smartphone size={12} /> {t('call_details', lang)}
                        </h4>
                        
                        {loadingDetails ? (
                          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#0fb5ab]" size={24} /></div>
                        ) : historyDetails?.error ? (
                          <div className="text-red-500 text-[11px] font-black bg-red-50 p-4 rounded-2xl border border-red-100">
                            {historyDetails.error}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {(() => {
                              const logs = extractCallLogs(historyDetails);
                              const failedLogs = logs.filter((log: any) => {
                                const status = (log.status || log.state || log.call_status || '').toLowerCase();
                                return ['failed', 'no answer', 'busy', 'cancelled', 'error'].includes(status);
                              });
                              const answeredLogs = logs.filter((log: any) => {
                                const status = (log.status || log.state || log.call_status || '').toLowerCase();
                                return ['answered', 'success', 'completed'].includes(status);
                              });
                              
                              return (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-[#42f5e9]/10 p-3 rounded-xl border border-[#42f5e9]/20">
                                      <div className="text-[9px] font-black text-[#42f5e9] uppercase tracking-widest mb-1">Total Calls</div>
                                      <div className="text-lg font-black text-[#0e8a84]">{logs.length || (h.total_numbers ?? h.total_recipients ?? 0)}</div>
                                    </div>
                                    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                      <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Answered</div>
                                      <div className="text-lg font-black text-emerald-900">{answeredLogs.length}</div>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                      <div className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Failed</div>
                                      <div className="text-lg font-black text-red-900">{failedLogs.length}</div>
                                    </div>
                                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</div>
                                      <div className="text-lg font-black text-slate-900">
                                        {logs.reduce((acc: number, l: any) => acc + (parseInt(l.duration || l.billsec) || 0), 0)}s
                                      </div>
                                    </div>
                                  </div>

                                  {failedLogs.length > 0 && (
                                    <div className="flex justify-end">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRetryFailed(h, failedLogs);
                                        }}
                                        className="px-4 py-2 bg-[#42f5e9] text-[#0fb5ab] rounded-xl hover:bg-[#3ce0d5] text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95"
                                      >
                                        <RefreshCw size={14} />
                                        Retry {failedLogs.length} Failed Calls
                                      </button>
                                    </div>
                                  )}

                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {logs.length > 0 ? (
                                      logs.map((log: any, idx: number) => {
                                        let phone = log.phone || log.number || log.to || log.msisdn || log.recipient || log.mobile || log.destination || log.phone_number || log.to_number || log.receiver || log.phone_no || log.mobile_no || log.to_msisdn || log.to_mobile;
                                        
                                        if (!phone) {
                                          // Try to find any property that looks like a phone number
                                          for (const key in log) {
                                            if (typeof log[key] === 'string' && log[key].replace(/[^0-9]/g, '').length >= 10) {
                                              phone = log[key];
                                              break;
                                            }
                                          }
                                        }
                                        
                                        if (!phone) phone = 'Unknown';
                                        
                                        if (phone === 'Unknown') {
                                          console.log('Could not find phone in log object:', log);
                                        }
                                        
                                        const normalizePhone = (p: string) => {
                                          if (!p || p === 'Unknown') return '';
                                          const digits = p.replace(/[^0-9]/g, '');
                                          if (digits.length === 11 && digits.startsWith('01')) return digits;
                                          if (digits.length === 13 && digits.startsWith('8801')) return digits.substring(2);
                                          if (digits.length === 10 && digits.startsWith('1')) return '0' + digits;
                                          return digits;
                                        };
                                        
                                        const normPhone = normalizePhone(phone);
                                        const studentInfo = (studentNamesMap as any)[normPhone];
                                        const studentName = studentInfo?.name || '';
                                        const rollNo = studentInfo?.roll || '';
                                        const status = (log.status || log.state || log.call_status || 'Unknown').toLowerCase();
                                        const duration = log.duration || log.billsec || 0;
                                        
                                        let statusColor = 'text-slate-500 bg-slate-100';
                                        if (['answered', 'success', 'completed'].includes(status)) statusColor = 'text-emerald-700 bg-emerald-100';
                                        else if (['failed', 'no answer', 'busy', 'cancelled'].includes(status)) statusColor = 'text-red-700 bg-red-100';
                                        
                                        return (
                                          <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusColor.replace('text-', 'bg-').replace('700', '100').replace('bg-', 'text-')}`}>
                                                {['answered', 'success', 'completed'].includes(status) ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                              </div>
                                              <div>
                                                <p className="font-black text-[#0fb5ab] text-xs">
                                                  {studentName ? (
                                                    <>
                                                      {studentName}
                                                      {rollNo && <span className="ml-2 text-[10px] text-slate-400 font-bold">(আইডি: {rollNo})</span>}
                                                    </>
                                                  ) : phone}
                                                </p>
                                                {(studentName || duration > 0) && (
                                                  <p className="text-[9px] text-slate-400 font-bold">
                                                    {studentName ? phone : ''}
                                                    {studentName && duration > 0 ? ' • ' : ''}
                                                    {duration > 0 ? `${duration} sec` : ''}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${statusColor}`}>
                                              {status}
                                            </span>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="text-center py-6 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                        {t('no_logs', lang)}
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                   <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{t('no_history', lang)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'recharge' && (
          <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-5 duration-500">
            <PaymentCheckout
              lang={lang}
              madrasah={madrasah}
              module="voice"
              onSuccess={() => {
                fetchWalletBalance();
                triggerRefresh();
              }}
              onCancel={() => {
                fetchWalletBalance();
              }}
            />
          </div>
        )}
      </div>

    </div>

      {statusModal.show && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 text-center shadow-[0_50px_120px_rgba(0,0,0,0.15)] border border-slate-50 animate-in zoom-in-95 duration-500 relative overflow-hidden">
             
             <div className="relative mb-8">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 shadow-inner relative z-10 transition-all duration-700 ${
                  statusModal.type === 'balance' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                  statusModal.type === 'success' ? 'bg-green-50 text-green-500 border-green-100' :
                  'bg-red-50 text-red-500 border-red-100'
                }`}>
                  {statusModal.type === 'balance' ? <Zap size={54} strokeWidth={2.5} fill="currentColor" /> :
                   statusModal.type === 'success' ? <CheckCircle2 size={54} strokeWidth={2.5} /> :
                   <AlertCircle size={54} strokeWidth={2.5} />}
                </div>
                {statusModal.type !== 'success' && (
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-20 mx-auto w-24 h-24 ${statusModal.type === 'balance' ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                )}
             </div>

             <h3 className="text-[24px] font-black text-[#2E0B5E] font-noto leading-tight tracking-tight">{statusModal.title}</h3>
             <p className="text-[13px] font-bold text-slate-500 mt-3 font-noto px-2 leading-relaxed">
               {statusModal.message}
             </p>
             
             <div className="flex flex-col gap-3 mt-10">
                {statusModal.type === 'balance' ? (
                  <>
                    <button 
                      onClick={() => { setStatusModal({ ...statusModal, show: false }); setActiveTab('recharge'); }} 
                      className="w-full py-5 bg-[#42f5e9] text-[#0e8a84] font-black rounded-full shadow-xl shadow-[#42f5e9]/20 active:scale-95 transition-all text-sm uppercase tracking-[0.1em] flex items-center justify-center gap-3"
                    >
                      <Zap size={18} fill="currentColor" /> রিচার্জ করুন
                    </button>
                    <button 
                      onClick={() => setStatusModal({ ...statusModal, show: false })} 
                      className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full text-[11px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setStatusModal({ ...statusModal, show: false })} 
                    className="w-full py-5 bg-[#42f5e9] text-[#0e8a84] font-black rounded-full shadow-xl shadow-[#42f5e9]/20 active:scale-95 transition-all text-sm uppercase tracking-[0.1em]"
                  >
                    {lang === 'bn' ? 'ঠিক আছে' : 'Got it'}
                  </button>
                )}
             </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(239,68,68,0.2)] border border-red-50 text-center space-y-6 animate-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner border border-red-100">
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className="text-xl font-black text-slate-800 font-noto">{t('confirm_delete', lang)}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4 leading-relaxed">
                  {lang === 'bn' ? `আপনি কি নিশ্চিত যে আপনি "${showDeleteConfirm.title}" ডিলিট করতে চান?` : `Are you sure you want to delete "${showDeleteConfirm.title}"?`}
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleDeleteVoice} 
                  disabled={isDeleting} 
                  className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md gap-3"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={22} /> : (
                    <><Trash2 size={20} /> {t('delete', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)} 
                  disabled={isDeleting}
                  className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  {t('cancel', lang)}
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}

      {showUploadModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#42f5e9]/20 text-[#0e8a84] flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-noto">
                    {lang === 'bn' ? 'নতুন ভয়েস আপলোড' : 'Upload New Voice'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">MP3 / WAV / M4A Audio</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider px-1">
                {lang === 'bn' ? 'ভয়েসের নাম *' : 'Voice Name *'}
              </label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="যেমন: মাসিক চাঁদা নোটিশ"
                className="w-full h-12 mt-1.5 rounded-2xl px-4 text-sm font-black bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#42f5e9] outline-none"
              />
              <div className="mt-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 flex-wrap">
                <ShieldCheck size={13} className="shrink-0 text-emerald-600" />
                <span>Awaj সার্ভারে নাম হবে:</span>
                <span className="font-mono font-black break-all">
                  {awajUploadPreviewName || (instShortCode ? `CM_${instShortCode}_...` : 'CM_...')}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider px-1">
                {lang === 'bn' ? 'অডিও ফাইল নির্বাচন করুন *' : 'Select Audio File *'}
              </label>
              <label className="mt-1.5 flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors text-center">
                <Upload size={22} className="text-[#0fb5ab] mb-1.5" />
                <span className="text-xs font-black text-slate-700">
                  {uploadFile ? uploadFile.name : (lang === 'bn' ? 'অডিও ফাইল সিলেক্ট করুন' : 'Choose audio file')}
                </span>
                <span className="text-[10px] font-bold text-slate-400 mt-0.5">MP3, WAV, OGG, M4A</span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadFile(file);
                      if (!uploadName) setUploadName(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <button
              onClick={handleVoiceUpload}
              disabled={isUploading || !uploadName.trim() || !uploadFile}
              className="w-full h-14 bg-[#42f5e9] hover:bg-[#35e5da] text-[#0e8a84] rounded-full font-black text-sm shadow-lg shadow-[#42f5e9]/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              <span>{lang === 'bn' ? 'আপলোড করুন' : 'Upload Voice'}</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default VoiceBroadcast;
