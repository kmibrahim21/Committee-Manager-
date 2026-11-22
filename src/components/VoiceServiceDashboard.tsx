import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  Loader2, 
  Mic, 
  Trash2, 
  CheckCircle2, 
  Smartphone, 
  PhoneCall, 
  ChevronRight, 
  X, 
  Upload, 
  Play, 
  Pause,
  Square, 
  Radio, 
  Send, 
  Volume2, 
  Plus, 
  Check, 
  Clock, 
  Users, 
  DollarSign, 
  Sparkles,
  ExternalLink,
  ShieldCheck,
  FileAudio,
  Search,
  Bell,
  Building,
  Building2,
  Copy,
  Info,
  SlidersHorizontal
} from 'lucide-react';
import { supabase } from 'supabase';
import {
  buildCmVoiceName,
  extractInstitutionShortCode,
  isCmVoiceName,
  stripCmVoicePrefix
} from 'utils/smsUtils';

interface VoiceServiceDashboardProps {
  onBack: () => void;
  madrasah: any;
  setStatusModal: (modal: any) => void;
}

export const VoiceServiceDashboard: React.FC<VoiceServiceDashboardProps> = ({ onBack, madrasah, setStatusModal }) => {
  const [activeTab, setActiveTab] = useState<'voices' | 'assigned_voices'>('voices');
  
  // Data states
  const [voices, setVoices] = useState<any[]>([]);
  const [assignedVoices, setAssignedVoices] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(0);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'cm' | 'all'>('cm');
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Audio Playback State for Cards
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'record'>('file');
  const [voiceName, setVoiceName] = useState('');
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [targetInstitutionId, setTargetInstitutionId] = useState('');
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Assign Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningVoice, setAssigningVoice] = useState<any>(null);
  const [assignInstitutionId, setAssignInstitutionId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const isDark = madrasah?.theme === 'dark';

  // Fetch institutions
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const { data } = await supabase
          .from('institutions')
          .select('id, name, voice_sender_id, balance, login_code, config_json')
          .or('is_super_admin.eq.false,is_super_admin.is.null')
          .order('name');
        if (data && data.length > 0) {
          setInstitutions(data);
        }
      } catch (err) {
        console.error("Error fetching institutions:", err);
      }
    };
    fetchInstitutions();
  }, []);

  // Fetch all Awaj data
  const fetchData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = session?.access_token
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : {};

      const fetchJson = async (url: string) => {
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) {
          const text = await res.text();
          let errorMsg = res.statusText;
          try {
            const json = JSON.parse(text);
            errorMsg = json.error || json.message || errorMsg;
          } catch (e) {}
          throw new Error(`API Error (${res.status}): ${errorMsg}`);
        }
        return res.json();
      };

      const [voicesRes, balanceRes] = await Promise.all([
        fetchJson('/api/awaj/voices').catch(err => {
          setApiError(err.message);
          return { voices: [] };
        }),
        fetchJson('/api/awaj/balance').catch(() => null)
      ]);

      const apiVoices = voicesRes.voices || voicesRes.data || (Array.isArray(voicesRes) ? voicesRes : []);
      setVoices(Array.isArray(apiVoices) ? apiVoices : []);

      if (balanceRes !== null && balanceRes !== undefined) {
        setBalance(balanceRes.data ?? balanceRes.balance ?? balanceRes.amount ?? balanceRes ?? 0);
      } else {
        setBalance(0);
      }

      // Fetch assigned voices from Supabase
      const { data: assignedData } = await supabase
        .from('voice_templates')
        .select(`
          *,
          institutions (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      setAssignedVoices(assignedData || []);
    } catch (error: any) {
      console.warn("Awaj data load notice:", error.message);
      setApiError(error.message || 'Awaj ডেটা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getNumericBalance = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof val === 'object') {
      if (typeof val.balance === 'number') return val.balance;
      if (typeof val.amount === 'number') return val.amount;
      if (typeof val.balance === 'string') {
        const p = parseFloat(val.balance);
        if (!isNaN(p)) return p;
      }
      if (typeof val.amount === 'string') {
        const p = parseFloat(val.amount);
        if (!isNaN(p)) return p;
      }
    }
    return 0;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle Audio Play/Pause for a card
  const togglePlayAudio = (voiceId: string, url: string) => {
    if (playingVoiceId === voiceId) {
      const audio = audioRefs.current[voiceId];
      if (audio) {
        audio.pause();
      }
      setPlayingVoiceId(null);
    } else {
      if (playingVoiceId && audioRefs.current[playingVoiceId]) {
        audioRefs.current[playingVoiceId]?.pause();
      }
      const audio = audioRefs.current[voiceId];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.error("Audio play error:", e));
        setPlayingVoiceId(voiceId);
      }
    }
  };

  const knownInstCodes = useMemo(() => {
    return institutions
      .map(inst => extractInstitutionShortCode(inst))
      .filter(Boolean);
  }, [institutions]);

  const selectedUploadInstitution = useMemo(() => {
    return institutions.find(inst => inst.id === targetInstitutionId) || null;
  }, [institutions, targetInstitutionId]);

  const uploadInstShortCode = useMemo(() => {
    return extractInstitutionShortCode(selectedUploadInstitution);
  }, [selectedUploadInstitution]);

  const awajPreviewName = useMemo(() => {
    return buildCmVoiceName(voiceName, uploadInstShortCode);
  }, [voiceName, uploadInstShortCode]);

  const totalCommitteeWalletBalance = useMemo(() => {
    return institutions.reduce((sum, inst) => sum + (Number(inst?.balance) || 0), 0);
  }, [institutions]);

  const getVoiceAudioUrl = (voice: any): string => {
    return String(voice?.previewUrl || voice?.preview_url || voice?.file_url || voice?.audioUrl || voice?.url || '').trim();
  };

  const isVoiceAudioReady = (voice: any): boolean => {
    const audioUrl = getVoiceAudioUrl(voice);
    return Boolean(
      audioUrl &&
      (audioUrl.startsWith('http://') || audioUrl.startsWith('https://') || audioUrl.startsWith('/'))
    );
  };

  const isVoiceApprovedOrReady = (voice: any): boolean => {
    const status = String(voice?.status || '').toLowerCase();
    if (status === 'rejected') return false;
    return status === 'approved' || isVoiceAudioReady(voice);
  };

  const getPlayableAudioSrc = (rawUrl: string): string => {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/api/awaj/stream')) return trimmed;
    if (trimmed.includes('awajdigital.com') || trimmed.startsWith('/')) {
      return `/api/awaj/stream?url=${encodeURIComponent(trimmed)}`;
    }
    return trimmed;
  };

  const isLinkedToCommittee = (voice: any): boolean => {
    const vId = voice.id !== undefined && voice.id !== null ? String(voice.id) : '';
    const vName = String(voice.name || voice.title || '').trim().toLowerCase();
    const vClean = stripCmVoicePrefix(voice.name || voice.title || '', knownInstCodes).toLowerCase();

    return assignedVoices.some((av) => {
      if (vId && av.provider_voice_id && String(av.provider_voice_id) === vId) return true;
      if (vName && av.provider_voice_name && String(av.provider_voice_name).trim().toLowerCase() === vName) return true;
      if (av.title) {
        const avTitle = String(av.title).trim().toLowerCase();
        if (vName && avTitle === vName) return true;
        if (vClean && avTitle === vClean) return true;
      }
      return false;
    });
  };

  const cmVoices = useMemo(() => {
    return voices.filter(voice => isCmVoiceName(voice.name || voice.title) || isLinkedToCommittee(voice));
  }, [voices, assignedVoices, knownInstCodes]);

  const sourceBaseVoices = sourceFilter === 'cm' ? cmVoices : voices;

  // Filtered Voices
  const filteredVoices = sourceBaseVoices.filter(voice => {
    const rawName = String(voice.name || voice.title || '');
    const cleanName = stripCmVoicePrefix(rawName, knownInstCodes);
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      rawName.toLowerCase().includes(query) ||
      cleanName.toLowerCase().includes(query) ||
      (voice.id?.toString() || '').includes(query);

    const status = String(voice.status || '').toLowerCase();
    const readyOrApproved = isVoiceApprovedOrReady(voice);
    let matchesFilter = true;
    if (voiceFilter === 'approved') matchesFilter = readyOrApproved;
    if (voiceFilter === 'pending') matchesFilter = status !== 'rejected' && !readyOrApproved;
    if (voiceFilter === 'rejected') matchesFilter = status === 'rejected';

    return matchesSearch && matchesFilter;
  });

  const approvedCount = sourceBaseVoices.filter(isVoiceApprovedOrReady).length;
  const rejectedCount = sourceBaseVoices.filter(v => String(v.status || '').toLowerCase() === 'rejected').length;
  const pendingCount = sourceBaseVoices.filter(v => String(v.status || '').toLowerCase() !== 'rejected' && !isVoiceApprovedOrReady(v)).length;
  const cmApprovedCount = cmVoices.filter(isVoiceApprovedOrReady).length;

  // Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Mic access error:", err);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'মাইক্রোফোন ত্রুটি',
        message: 'মাইক্রোফোন অ্যাক্সেস করতে অনুমতি দেওয়া হয়নি বা কোনো মাইক্রোফোন পাওয়া যায়নি।'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // Voice Upload Action
  const handleUploadVoice = async () => {
    if (!voiceName.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'নাম আবশ্যক', message: 'অনুগ্রহ করে ভয়েসের একটি নাম দিন।' });
      return;
    }

    if (!selectedAudioFile && !recordedAudioBlob) {
      setStatusModal({ show: true, type: 'error', title: 'অডিও আবশ্যক', message: 'অনুগ্রহ করে একটি অডিও ফাইল আপলোড করুন অথবা লাইভ রেকর্ড করুন।' });
      return;
    }

    setIsUploadingVoice(true);
    try {
      const awajVoiceName = buildCmVoiceName(voiceName, uploadInstShortCode);
      const cleanTitle = stripCmVoicePrefix(voiceName, knownInstCodes) || voiceName.trim();

      let fileToUpload: File | Blob = selectedAudioFile || recordedAudioBlob!;
      if (fileToUpload.size > 3.5 * 1024 * 1024) {
        throw new Error('অডিও ফাইলটি অনেক বড়। অনুগ্রহ করে ৩.৫ মেগাবাইটের কম সাইজের ফাইল আপলোড করুন।');
      }
      let fileName = selectedAudioFile ? selectedAudioFile.name : `${cleanTitle.replace(/\s+/g, '_')}_record.webm`;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(fileToUpload);
      const base64Data = await base64Promise;

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/awaj/voices/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          name: awajVoiceName,
          title: cleanTitle,
          file_base64: base64Data,
          filename: fileName,
          content_type: fileToUpload.type || 'audio/mpeg',
          ...(targetInstitutionId ? { institution_id: targetInstitutionId } : {})
        })
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: rawText || res.statusText };
      }

      if (res.status === 413) {
        throw new Error('অডিও ফাইলটি সার্ভারের সীমার চেয়ে বড় (সর্বোচ্চ ৩.৫ MB দিন)।');
      }
      if (!res.ok) throw new Error(data.error || data.message || `Upload failed (${res.status})`);

      // Fallback client-side assign if targetInstitutionId was selected and server didn't insert
      if (targetInstitutionId && !data.assigned_template) {
        const providerVoiceName = data.name || data.voice?.name || awajVoiceName;
        const resolvedAudioUrl = getVoiceAudioUrl(data.voice || data);
        await supabase.from('voice_templates').insert({
          institution_id: targetInstitutionId,
          title: cleanTitle,
          provider_voice_name: providerVoiceName,
          file_url: resolvedAudioUrl,
          provider_voice_id: (data.id || data.voice_id || data.voice?.id || '').toString() || null,
          provider_status: 'approved',
          admin_status: 'approved'
        });
      }

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস আপলোড সফল',
        message: targetInstitutionId
          ? `ভয়েস সফলভাবে আপলোড ও অনুমোদিত হয়ে নির্বাচিত কমিটিতে বরাদ্দ দেওয়া হয়েছে (${awajVoiceName})।`
          : `ভয়েস সফলভাবে AWAJ ডিজিটাল প্ল্যাটফর্মে (${awajVoiceName}) আপলোড করা হয়েছে।`
      });

      setShowUploadModal(false);
      setVoiceName('');
      setSelectedAudioFile(null);
      setRecordedAudioBlob(null);
      setTargetInstitutionId('');
      fetchData();
    } catch (error: any) {
      console.error("Upload error:", error);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'আপলোড ব্যর্থ হয়েছে',
        message: error.message || 'ভয়েস আপলোড করার সময় সমস্যা হয়েছে।'
      });
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // Delete Voice Action
  const handleDeleteVoice = async (id: any) => {
    if (!confirm('আপনি কি নিশ্চিত যে এই ভয়েসটি মুছে ফেলতে চান?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/awaj/voices/${id}`, {
        method: 'DELETE',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      });
      const rawText = await res.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: rawText || res.statusText };
      }
      if (!res.ok) throw new Error(data.error || data.message || `Delete failed (${res.status})`);

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস মুছে ফেলা হয়েছে',
        message: 'ভয়েস ফাইলটি সফলভাবে মুছে ফেলা হয়েছে।'
      });
      fetchData();
    } catch (error: any) {
      console.error("Delete error:", error);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'ব্যর্থ হয়েছে',
        message: error.message || 'ভয়েস মুছতে ব্যর্থ হয়েছে।'
      });
    }
  };

  // Assign Voice to Institution Action
  const handleAssignVoice = async () => {
    if (!assigningVoice || !assignInstitutionId) return;
    setIsAssigning(true);
    try {
      const rawAwajName = String(assigningVoice.name || assigningVoice.title || 'Voice Template').trim();
      const cleanTitle = stripCmVoicePrefix(rawAwajName, knownInstCodes) || rawAwajName;
      const resolvedUrl = getVoiceAudioUrl(assigningVoice);
      const { error } = await supabase.from('voice_templates').insert({
        institution_id: assignInstitutionId,
        title: cleanTitle,
        provider_voice_name: rawAwajName,
        file_url: resolvedUrl,
        provider_voice_id: (assigningVoice.id || '').toString() || null,
        provider_status: 'approved',
        admin_status: 'approved'
      });

      if (error) throw error;

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস বরাদ্দ সম্পন্ন',
        message: 'নির্বাচিত কমিটিতে ভয়েসটি সফলভাবে অনুমোদিত ও বরাদ্দ করা হয়েছে।'
      });

      setShowAssignModal(false);
      setAssigningVoice(null);
      setAssignInstitutionId('');
      fetchData();
    } catch (error: any) {
      console.error("Assign error:", error);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: error.message || "Failed to assign voice" });
    } finally {
      setIsAssigning(false);
    }
  };

  // Manual Approve Action for Assigned Voices
  const handleApproveAssignedVoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('voice_templates')
        .update({
          admin_status: 'approved',
          provider_status: 'approved'
        })
        .eq('id', id);

      if (error) throw error;

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস অনুমোদিত',
        message: 'ভয়েসটি সফলভাবে Approve করা হয়েছে। এখন কমিটি ব্রডকাস্ট করতে পারবে।'
      });
      fetchData();
    } catch (error: any) {
      console.error("Approve error:", error);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: error.message || "Failed to approve voice" });
    }
  };

  // Unassign Voice Action
  const handleUnassignVoice = async (id: string) => {
    if (!confirm('আপনি কি এই বরাদ্দটি বাতিল করতে চান?')) return;
    try {
      const { error } = await supabase.from('voice_templates').delete().eq('id', id);
      if (error) throw error;
      
      setStatusModal({
        show: true,
        type: 'success',
        title: 'বরাদ্দ বাতিল',
        message: 'ভয়েস বরাদ্দ সফলভাবে বাতিল করা হয়েছে।'
      });
      fetchData();
    } catch (error: any) {
      console.error("Unassign error:", error);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: error.message || "Failed to unassign voice" });
    }
  };

  return (
    <div className={`space-y-4 pb-36 font-noto max-w-4xl mx-auto ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      
      {/* 1. MAIN HEADER CARD (Voice Service Dashboard) */}
      <div className={`rounded-[2rem] p-5 sm:p-6 border shadow-sm space-y-4 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
      }`}>
        <div className="flex items-center gap-3.5">
          <button 
            onClick={onBack}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all border shrink-0 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="ফিরে যান"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3B66FF] text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
              <Radio size={12} className="animate-pulse" />
              <span>AWAJ DIGITAL GATEWAY</span>
            </div>
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight mt-1 font-sans truncate ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Voice Service Dashboard
            </h1>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2.5 pt-1">
          {/* Balance Pill */}
          <div className={`px-4 py-3 rounded-2xl border flex items-center gap-1.5 font-black text-sm shrink-0 shadow-sm ${
            isDark ? 'bg-emerald-950/40 border-emerald-900 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <span className="text-emerald-500 font-bold">৳</span>
            <span>{getNumericBalance(balance).toFixed(2)}</span>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex-1 bg-[#375DFB] hover:bg-blue-600 active:scale-[0.98] text-white py-3 px-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all whitespace-nowrap"
          >
            <Upload size={16} />
            <span>AWAJ-এ আপলোড</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData()}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border shrink-0 active:scale-95 shadow-sm ${
              isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-blue-50 border-blue-100 text-[#375DFB] hover:bg-blue-100'
            }`}
            title="রিফ্রেশ করুন"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. METRICS 3-COLUMN CARDS GRID */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {/* Card 1: Balance */}
        <div className={`rounded-2xl sm:rounded-3xl p-3 sm:p-4 border shadow-sm flex flex-col justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
        }`}>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 shrink-0 ${
            isDark ? 'bg-emerald-950/50 text-emerald-400' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}>
            <DollarSign size={18} className="shrink-0" />
          </div>
          <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-widest truncate ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              AWAJ BALANCE
            </p>
            <h4 className={`text-xs sm:text-base font-black font-noto mt-0.5 truncate ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              ৳{getNumericBalance(balance).toFixed(2)}
            </h4>
            <p className={`text-[9px] font-bold truncate mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              কমিটি ওয়ালেট: ৳{totalCommitteeWalletBalance.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Card 2: CM Voices */}
        <div className={`rounded-2xl sm:rounded-3xl p-3 sm:p-4 border shadow-sm flex flex-col justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
        }`}>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 shrink-0 ${
            isDark ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600 border border-blue-100'
          }`}>
            <Mic size={18} className="shrink-0" />
          </div>
          <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-widest truncate ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              CM VOICES
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-sm sm:text-base font-black ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {cmVoices.length}
              </span>
              <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                isDark ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <Check size={10} strokeWidth={3} className="shrink-0" />
                <span>{cmApprovedCount} ok</span>
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Assigned */}
        <div className={`rounded-2xl sm:rounded-3xl p-3 sm:p-4 border shadow-sm flex flex-col justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
        }`}>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 shrink-0 ${
            isDark ? 'bg-emerald-950/50 text-emerald-400' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}>
            <Building2 size={18} className="shrink-0" />
          </div>
          <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-widest truncate ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              ASSIGNED
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-xs sm:text-base font-black ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {assignedVoices.length}
              </span>
              <span className={`text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                inst
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN TABS (Awaj Voices vs Assigned Voices) */}
      <div className={`p-1.5 rounded-full border shadow-sm flex items-center gap-1 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
      }`}>
        <button
          onClick={() => setActiveTab('voices')}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-full font-black text-xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'voices'
              ? 'bg-[#375DFB] text-white shadow-sm'
              : isDark
                ? 'text-slate-300 hover:bg-slate-800'
                : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Mic size={14} />
          <span>Awaj Voices</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'voices' 
              ? 'bg-white/20 text-white' 
              : isDark 
                ? 'bg-slate-800 text-slate-300' 
                : 'bg-slate-100 text-slate-800'
          }`}>
            {sourceBaseVoices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('assigned_voices')}
          className={`flex-1 py-2.5 px-3 sm:px-4 rounded-full font-black text-xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'assigned_voices'
              ? 'bg-[#375DFB] text-white shadow-sm'
              : isDark
                ? 'text-slate-300 hover:bg-slate-800'
                : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Building size={14} />
          <span>Assigned Voices</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'assigned_voices' 
              ? 'bg-white/20 text-white' 
              : isDark 
                ? 'bg-slate-800 text-slate-300' 
                : 'bg-slate-100 text-slate-800'
          }`}>
            {assignedVoices.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT: VOICES LIST */}
      {activeTab === 'voices' && (
        <div className="space-y-3.5 animate-in fade-in duration-300">
          
          {apiError && (
            <div className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${
              isDark ? 'bg-rose-950/40 border-rose-900 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <AlertCircle size={16} className="text-rose-500 shrink-0" />
              <p className="leading-snug">{apiError}</p>
            </div>
          )}

          {/* 4. SEARCH BAR */}
          <div className={`relative rounded-2xl border shadow-sm px-4 py-3 flex items-center gap-3 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
          }`}>
            <Search size={18} className={isDark ? 'text-slate-500 shrink-0' : 'text-slate-400 shrink-0'} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ভয়েসের নাম দিয়ে খুঁজুন..."
              className={`w-full bg-transparent text-xs sm:text-sm font-bold focus:outline-none ${
                isDark ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className={isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* SOURCE FILTER PILL (Committee Voices vs All Awaj Voices) */}
          <div className={`p-1.5 rounded-2xl border shadow-sm flex items-center gap-1.5 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
          }`}>
            <button
              onClick={() => setSourceFilter('cm')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                sourceFilter === 'cm'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck size={14} />
              <span>Committee Voices</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                sourceFilter === 'cm'
                  ? 'bg-white/20 text-white'
                  : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-800'
              }`}>
                {cmVoices.length}
              </span>
            </button>
            <button
              onClick={() => setSourceFilter('all')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                sourceFilter === 'all'
                  ? 'bg-[#375DFB] text-white shadow-sm'
                  : isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Radio size={14} />
              <span>All Awaj Voices</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                sourceFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-800'
              }`}>
                {voices.length}
              </span>
            </button>
          </div>

          {/* 5. STATUS FILTER 2x2 GRID */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Filter 1: All */}
            <button
              onClick={() => setVoiceFilter('all')}
              className={`p-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all border shadow-sm ${
                voiceFilter === 'all'
                  ? 'bg-[#375DFB] border-[#375DFB] text-white'
                  : isDark 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-200/90 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${voiceFilter === 'all' ? 'bg-white' : 'bg-blue-500'}`} />
                <span>All</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                voiceFilter === 'all' 
                  ? 'bg-white/20 text-white' 
                  : isDark 
                    ? 'bg-slate-800 text-slate-300' 
                    : 'bg-slate-100 text-slate-800'
              }`}>
                {sourceBaseVoices.length}
              </span>
            </button>

            {/* Filter 2: Approved */}
            <button
              onClick={() => setVoiceFilter('approved')}
              className={`p-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all border shadow-sm ${
                voiceFilter === 'approved'
                  ? 'bg-[#375DFB] border-[#375DFB] text-white'
                  : isDark 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-200/90 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${voiceFilter === 'approved' ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                <span>Approved</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                voiceFilter === 'approved' 
                  ? 'bg-white/20 text-white' 
                  : isDark 
                    ? 'bg-slate-800 text-slate-300' 
                    : 'bg-slate-100 text-slate-800'
              }`}>
                {approvedCount}
              </span>
            </button>

            {/* Filter 3: Pending */}
            <button
              onClick={() => setVoiceFilter('pending')}
              className={`p-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all border shadow-sm ${
                voiceFilter === 'pending'
                  ? 'bg-[#375DFB] border-[#375DFB] text-white'
                  : isDark 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-200/90 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${voiceFilter === 'pending' ? 'bg-amber-300' : 'bg-amber-500'}`} />
                <span>Pending</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                voiceFilter === 'pending' 
                  ? 'bg-white/20 text-white' 
                  : isDark 
                    ? 'bg-slate-800 text-slate-300' 
                    : 'bg-slate-100 text-slate-800'
              }`}>
                {pendingCount}
              </span>
            </button>

            {/* Filter 4: Rejected */}
            <button
              onClick={() => setVoiceFilter('rejected')}
              className={`p-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all border shadow-sm ${
                voiceFilter === 'rejected'
                  ? 'bg-[#375DFB] border-[#375DFB] text-white'
                  : isDark 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-200/90 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${voiceFilter === 'rejected' ? 'bg-rose-300' : 'bg-rose-500'}`} />
                <span>Rejected</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                voiceFilter === 'rejected' 
                  ? 'bg-white/20 text-white' 
                  : isDark 
                    ? 'bg-slate-800 text-slate-300' 
                    : 'bg-slate-100 text-slate-800'
              }`}>
                {rejectedCount}
              </span>
            </button>
          </div>

          {/* 6. INFO BANNER */}
          <div className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${
            isDark ? 'bg-blue-950/40 border-blue-900 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <Info size={16} className="text-blue-500 shrink-0" />
            <p className="leading-snug">
              দ্রুততম স্পিডে লোড হওয়ার জন্য সর্বশেষ ২০টি ভয়েস প্রদর্শন করা হচ্ছে।
            </p>
          </div>

          {/* 7. VOICE CARDS LIST */}
          {loading ? (
            <div className={`flex flex-col items-center justify-center py-16 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 className="animate-spin mb-3 text-blue-500" size={32} />
              <p className="text-xs font-black uppercase tracking-widest">লোড হচ্ছে...</p>
            </div>
          ) : filteredVoices.length > 0 ? (
            <div className="space-y-3">
              {filteredVoices.map((voice) => {
                const status = String(voice.status || '').toLowerCase();
                const isRejected = status === 'rejected';
                const isReady = isVoiceApprovedOrReady(voice);
                const audioUrl = getVoiceAudioUrl(voice);
                const playableAudioUrl = getPlayableAudioSrc(audioUrl);
                const voiceIdStr = voice.id?.toString() || voice.name;
                const isPlaying = playingVoiceId === voiceIdStr;

                return (
                  <div
                    key={voiceIdStr}
                    className={`p-4 sm:p-5 rounded-[2rem] border shadow-sm space-y-3.5 transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
                        : 'bg-white border-slate-200/90 hover:border-blue-300'
                    }`}
                  >
                    {/* Top Row: Icon + Name/Meta + Approved Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${
                          isDark 
                            ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-400' 
                            : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                        }`}>
                          <Mic size={22} />
                        </div>
                        <div className="min-w-0">
                          <h4 className={`text-sm sm:text-base font-black truncate ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`} title={voice.name}>
                            {stripCmVoicePrefix(voice.name || voice.title, knownInstCodes)}
                          </h4>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                              isCmVoiceName(voice.name)
                                ? isDark
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/70'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isDark
                                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              Awaj: {voice.name}
                            </span>
                          </div>
                          <div className={`flex items-center gap-2 text-xs font-bold mt-1 flex-wrap ${
                            isDark ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            <span className="flex items-center gap-1">
                              <Clock size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                              {new Date(voice.createdAt || voice.created_at || Date.now()).toLocaleDateString('bn-BD')}
                            </span>
                            <span>•</span>
                            <button 
                              onClick={() => copyToClipboard(voice.id?.toString() || '', voiceIdStr)}
                              className={`flex items-center gap-1 font-mono text-[11px] transition-colors ${
                                isDark 
                                  ? 'text-slate-300 hover:text-blue-400' 
                                  : 'text-slate-700 hover:text-blue-600'
                              }`}
                              title="ID কপি করুন"
                            >
                              <span>ID: {voice.id}</span>
                              {copiedId === voiceIdStr ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                        isRejected
                          ? isDark 
                            ? 'bg-rose-950/40 text-rose-400 border-rose-900' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                          : isReady
                            ? isDark 
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isDark 
                              ? 'bg-amber-950/40 text-amber-400 border-amber-900' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isRejected ? 'REJECTED' : isReady ? 'APPROVED / READY' : 'PROCESSING / PENDING'}
                      </span>
                    </div>

                    {/* Audio Player Bar */}
                    {playableAudioUrl && (
                      <div className={`p-2.5 rounded-2xl border flex items-center gap-3 ${
                        isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-100/90 border-slate-200'
                      }`}>
                        <button
                          onClick={() => togglePlayAudio(voiceIdStr, playableAudioUrl)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                            isPlaying 
                              ? 'bg-emerald-500 text-white shadow-md' 
                              : isDark 
                                ? 'bg-slate-700 text-slate-200 shadow-sm' 
                                : 'bg-white text-slate-800 shadow-sm border border-slate-200'
                          }`}
                        >
                          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <audio 
                            ref={(el) => { audioRefs.current[voiceIdStr] = el; }}
                            src={playableAudioUrl}
                            onEnded={() => setPlayingVoiceId(null)}
                            className="hidden" 
                          />
                          <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                            isDark ? 'bg-slate-700' : 'bg-slate-200'
                          }`}>
                            <div className={`h-full ${isPlaying ? 'bg-emerald-500 w-full animate-pulse' : 'w-0'}`} />
                          </div>
                        </div>

                        <span className={`text-[11px] font-bold shrink-0 ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {isPlaying ? 'প্লে হচ্ছে...' : 'অডিও শুনুন'}
                        </span>
                      </div>
                    )}

                    {/* Card Actions Row */}
                    <div className={`flex items-center justify-between gap-2 pt-1 border-t ${
                      isDark ? 'border-slate-800/80' : 'border-slate-100'
                    }`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setAssigningVoice(voice);
                            setShowAssignModal(true);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                            isDark 
                              ? 'bg-blue-950/40 text-blue-400 border border-blue-900/40 hover:bg-blue-900/50' 
                              : 'bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100'
                          }`}
                        >
                          <Building size={14} />
                          <span>কমিটিকে বরাদ্দ দিন</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteVoice(voice.id)}
                        className={`p-2 rounded-xl transition-all ${
                          isDark 
                            ? 'text-rose-400 hover:bg-rose-950/40' 
                            : 'text-rose-600 hover:bg-rose-50'
                        }`}
                        title="মুছে ফেলুন"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`p-12 rounded-[2.5rem] border text-center space-y-3 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
            }`}>
              <Mic size={36} className={`mx-auto ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm font-black ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                কোনো ভয়েস পাওয়া যায়নি
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-5 py-2.5 bg-[#375DFB] text-white rounded-2xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-sm"
              >
                <Plus size={16} />
                <span>নতুন ভয়েস আপলোড করুন</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: ASSIGNED VOICES */}
      {activeTab === 'assigned_voices' && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {assignedVoices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assignedVoices.map((voice) => {
                const isFullyApproved = voice.admin_status === 'approved' && voice.provider_status === 'approved';
                const playableUrl = getPlayableAudioSrc(voice.file_url || '');
                return (
                <div 
                  key={voice.id} 
                  className={`p-5 rounded-[2rem] border shadow-sm space-y-3 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        <Building size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className={`font-black text-sm truncate ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}>
                          {stripCmVoicePrefix(voice.title, knownInstCodes)}
                        </h4>
                        {voice.provider_voice_name && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border mt-1 ${
                            isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            Awaj: {voice.provider_voice_name}
                          </span>
                        )}
                        <p className={`text-xs font-bold mt-1 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          কমিটি: <span className={`font-black ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{voice.institutions?.name || 'Global'}</span>
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${
                      isFullyApproved
                        ? isDark 
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isDark
                          ? 'bg-amber-950/40 text-amber-400 border-amber-900'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {isFullyApproved ? 'APPROVED' : 'PENDING'}
                    </span>
                  </div>

                  {playableUrl && (
                    <audio controls src={playableUrl} className="w-full h-8 rounded-xl" />
                  )}

                  <div className="flex justify-end items-center gap-2 pt-1 flex-wrap">
                    {!isFullyApproved && (
                      <button
                        onClick={() => handleApproveAssignedVoice(voice.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-1 ${
                          isDark
                            ? 'text-emerald-300 bg-emerald-950/40 border border-emerald-800 hover:bg-emerald-900/50'
                            : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>Approve</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleUnassignVoice(voice.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-1 ${
                        isDark 
                          ? 'text-rose-400 bg-rose-950/30 hover:bg-rose-900/50' 
                          : 'text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <Trash2 size={13} />
                      <span>বরাদ্দ বাতিল</span>
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className={`p-12 rounded-[2.5rem] border text-center space-y-3 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
            }`}>
              <Building size={36} className={`mx-auto ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
              <p className={`text-sm font-black ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                কোনো বরাদ্দকৃত ভয়েস নেই
              </p>
            </div>
          )}
        </div>
      )}

      {/* 8. UPLOAD MODAL ("AWAJ-এ আপলোড") */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`rounded-[2.5rem] p-6 sm:p-8 w-full max-w-lg shadow-2xl border animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-blue-950/60 text-blue-400' : 'bg-blue-50 text-[#375DFB]'
                }`}>
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    AWAJ-এ ভয়েস আপলোড
                  </h3>
                  <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Awaj Digital API Voice Studio
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className={`grid grid-cols-2 gap-2 p-1 rounded-2xl mb-4 ${
              isDark ? 'bg-slate-800' : 'bg-slate-100'
            }`}>
              <button
                onClick={() => setUploadMode('file')}
                className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                  uploadMode === 'file' 
                    ? isDark 
                      ? 'bg-slate-900 text-blue-400 shadow-sm' 
                      : 'bg-white text-blue-600 shadow-sm' 
                    : isDark 
                      ? 'text-slate-400 hover:text-slate-200' 
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ফাইল আপলোড (MP3/WAV)
              </button>
              <button
                onClick={() => setUploadMode('record')}
                className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                  uploadMode === 'record' 
                    ? isDark 
                      ? 'bg-slate-900 text-blue-400 shadow-sm' 
                      : 'bg-white text-blue-600 shadow-sm' 
                    : isDark 
                      ? 'text-slate-400 hover:text-slate-200' 
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                লাইভ রেকর্ড
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  ভয়েসের নাম *
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="যেমন: মাসিক চাঁদা নোটিশ"
                  className={`w-full h-12 mt-1 rounded-2xl px-4 text-sm font-black border outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                  }`}
                />
                <div className={`mt-2 px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 flex-wrap ${
                  isDark
                    ? 'bg-emerald-950/40 border-emerald-900/70 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <ShieldCheck size={13} className="shrink-0 text-emerald-500" />
                  <span>Awaj সার্ভারে নাম হবে:</span>
                  <span className="font-mono font-black break-all">
                    {awajPreviewName || (uploadInstShortCode ? `CM_${uploadInstShortCode}_...` : 'CM_...')}
                  </span>
                </div>
              </div>

              <div>
                <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  নির্দিষ্ট কমিটিকে বরাদ্দ (ঐচ্ছিক)
                </label>
                <select
                  value={targetInstitutionId}
                  onChange={(e) => setTargetInstitutionId(e.target.value)}
                  className={`w-full h-12 mt-1 rounded-2xl px-4 text-sm font-black border outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'
                  }`}
                >
                  <option value="">শুধু Awaj লাইব্রেরিতে রাখুন (পরে বরাদ্দ দিন)</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>

              {uploadMode === 'file' && (
                <div>
                  <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    অডিও ফাইল সিলেক্ট করুন (সর্বোচ্চ ৩.৫ MB)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer mt-1 transition-all ${
                      isDark ? 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/80' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedAudioFile(file);
                          if (!voiceName) setVoiceName(file.name.replace(/\.[^/.]+$/, ""));
                        }
                      }}
                      className="hidden"
                    />
                    <Upload size={24} className="mx-auto text-blue-500 mb-2" />
                    <p className={`text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {selectedAudioFile ? selectedAudioFile.name : 'অডিও ফাইল সিলেক্ট করতে ক্লিক করুন'}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      MP3, WAV, OGG, M4A
                    </p>
                  </div>
                </div>
              )}

              {uploadMode === 'record' && (
                <div className={`p-6 rounded-3xl border border-dashed text-center space-y-4 ${
                  isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-300 bg-slate-50'
                }`}>
                  <div className={`text-2xl font-mono font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="flex justify-center">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all"
                      >
                        <Mic size={28} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-black transition-all animate-pulse"
                      >
                        <Square size={24} />
                      </button>
                    )}
                  </div>
                  <p className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isRecording ? 'রেকর্ড হচ্ছে... থামাতে ক্লিক করুন' : recordedAudioBlob ? 'রেকর্ডিং সম্পন্ন! আবার করতে বাটনে চাপুন' : 'রেকর্ডিং শুরু করতে ক্লিক করুন'}
                  </p>
                </div>
              )}

              <button
                onClick={handleUploadVoice}
                disabled={isUploadingVoice || !voiceName.trim() || (!selectedAudioFile && !recordedAudioBlob)}
                className="w-full h-14 bg-[#375DFB] hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 mt-4 active:scale-[0.99]"
              >
                {isUploadingVoice ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                <span>Awaj Digital এ আপলোড করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. ASSIGN TO ORG MODAL */}
      {showAssignModal && assigningVoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md shadow-2xl border animate-in zoom-in-95 duration-200 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-lg font-black font-noto ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                কমিটিকে ভয়েস বরাদ্দ দিন
              </h3>
              <button
                onClick={() => { setShowAssignModal(false); setAssigningVoice(null); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  ভয়েসের নাম
                </label>
                <div className={`w-full min-h-12 py-2.5 mt-1 rounded-2xl px-4 flex flex-col justify-center border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-900'
                }`}>
                  <span className="text-sm font-black">
                    {stripCmVoicePrefix(assigningVoice.name || assigningVoice.title, knownInstCodes)}
                  </span>
                  <span className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Awaj: {assigningVoice.name}
                  </span>
                </div>
              </div>

              <div>
                <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  কমিটি নির্বাচন করুন
                </label>
                <select
                  value={assignInstitutionId}
                  onChange={(e) => setAssignInstitutionId(e.target.value)}
                  className={`w-full h-12 mt-1 rounded-2xl px-4 text-sm font-black border outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'
                  }`}
                >
                  <option value="">কমিটি সিলেক্ট করুন...</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAssignVoice}
                disabled={isAssigning || !assignInstitutionId}
                className="w-full h-14 bg-[#375DFB] hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 mt-4 active:scale-[0.99]"
              >
                {isAssigning ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                <span>ভয়েস বরাদ্দ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
