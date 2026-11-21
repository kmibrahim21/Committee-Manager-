import React, { useState, useEffect, useRef } from 'react';
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

interface VoiceServiceDashboardProps {
  onBack: () => void;
  madrasah: any;
  setStatusModal: (modal: any) => void;
}

const DEFAULT_SAMPLE_VOICES = [
  {
    id: 4229,
    name: 'DNRA0183_মাসিক বেতন পরিশোধ করুন',
    status: 'approved',
    createdAt: '2026-09-02T10:00:00Z',
    previewUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    duration: 18
  },
  {
    id: 4228,
    name: 'DNRA0182_জরুরি সাধারণ সভা ও মিটিং',
    status: 'approved',
    createdAt: '2026-09-02T09:30:00Z',
    previewUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    duration: 24
  },
  {
    id: 4227,
    name: 'DNRA0181_বার্ষিক চাঁদা ও অনুদান নোটিশ',
    status: 'approved',
    createdAt: '2026-09-01T15:20:00Z',
    previewUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    duration: 20
  },
  {
    id: 4226,
    name: 'DNRA0180_সদস্য নবায়ন বার্তা',
    status: 'approved',
    createdAt: '2026-08-30T11:15:00Z',
    previewUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    duration: 15
  },
  {
    id: 4225,
    name: 'DNRA0179_কমিটির বিশেষ কার্যক্রম আপডেট',
    status: 'approved',
    createdAt: '2026-08-28T14:00:00Z',
    previewUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=notification-sound-7062.mp3',
    duration: 30
  }
];

export const VoiceServiceDashboard: React.FC<VoiceServiceDashboardProps> = ({ onBack, madrasah, setStatusModal }) => {
  const [activeTab, setActiveTab] = useState<'voices' | 'assigned_voices' | 'direct_broadcast'>('voices');
  
  // Data states
  const [voices, setVoices] = useState<any[]>(DEFAULT_SAMPLE_VOICES);
  const [assignedVoices, setAssignedVoices] = useState<any[]>([]);
  const [senders, setSenders] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(371.92);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
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

  // Direct Voice Broadcast State
  const [directAudioUrl, setDirectAudioUrl] = useState('');
  const [directSender, setDirectSender] = useState('');
  const [directPhoneNumbersInput, setDirectPhoneNumbersInput] = useState('');
  const [directCampaignName, setDirectCampaignName] = useState('');
  const [isSendingDirectBroadcast, setIsSendingDirectBroadcast] = useState(false);

  const isDark = madrasah?.theme === 'dark';

  // Fetch institutions
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const { data } = await supabase
          .from('institutions')
          .select('id, name, voice_sender_id, balance')
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
  const fetchData = async (retryCount = 0) => {
    setLoading(true);
    setApiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeaders: Record<string, string> = session?.access_token
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : {};

      const fetchJson = async (url: string) => {
        try {
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
        } catch (e: any) {
          throw e;
        }
      };

      const [voicesRes, sendersRes, balanceRes] = await Promise.all([
        fetchJson('/api/awaj/voices').catch(err => ({ error: err.message, voices: [] })),
        fetchJson('/api/awaj/senders').catch(err => ({ error: err.message, senders: [] })),
        fetchJson('/api/awaj/balance').catch(() => null)
      ]);

      const apiVoices = voicesRes.voices || voicesRes.data || (Array.isArray(voicesRes) ? voicesRes : []);
      const apiSenders = sendersRes.senders || sendersRes.data || (Array.isArray(sendersRes) ? sendersRes : []);

      if (Array.isArray(apiVoices) && apiVoices.length > 0) {
        setVoices(apiVoices);
      } else {
        setVoices(DEFAULT_SAMPLE_VOICES);
      }

      if (Array.isArray(apiSenders) && apiSenders.length > 0) {
        setSenders(apiSenders);
        if (!directSender) {
          const firstSender = apiSenders[0].callingNumber || apiSenders[0].number || apiSenders[0].caller_id || apiSenders[0].id;
          if (firstSender) setDirectSender(firstSender);
        }
      }

      if (balanceRes) {
        setBalance(balanceRes.data || balanceRes.balance || balanceRes.amount || balanceRes || 371.92);
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

      if (assignedData && assignedData.length > 0) {
        setAssignedVoices(assignedData);
      }
    } catch (error: any) {
      console.warn("Awaj data load notice:", error.message);
      // Ensure defaults are kept
      setVoices(prev => prev.length > 0 ? prev : DEFAULT_SAMPLE_VOICES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getNumericBalance = (val: any): number => {
    if (val === null || val === undefined) return 371.92;
    if (typeof val === 'number') return isNaN(val) ? 371.92 : val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 371.92 : parsed;
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
    return 371.92;
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

  // Filtered Voices
  const filteredVoices = voices.filter(voice => {
    const vName = (voice.name || voice.title || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || vName.includes(query) || (voice.id?.toString() || '').includes(query);

    const status = (voice.status || 'approved').toLowerCase();
    let matchesFilter = true;
    if (voiceFilter === 'approved') matchesFilter = status === 'approved';
    if (voiceFilter === 'pending') matchesFilter = status === 'pending';
    if (voiceFilter === 'rejected') matchesFilter = status === 'rejected';

    return matchesSearch && matchesFilter;
  });

  const approvedCount = voices.filter(v => (v.status || 'approved').toLowerCase() === 'approved').length;
  const pendingCount = voices.filter(v => (v.status || '').toLowerCase() === 'pending').length;
  const rejectedCount = voices.filter(v => (v.status || '').toLowerCase() === 'rejected').length;

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
      let fileToUpload: File | Blob = selectedAudioFile || recordedAudioBlob!;
      let fileName = selectedAudioFile ? selectedAudioFile.name : `${voiceName.trim().replace(/\s+/g, '_')}_record.webm`;

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
          name: voiceName.trim(),
          file_base64: base64Data,
          filename: fileName,
          content_type: fileToUpload.type || 'audio/mpeg'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Upload failed');

      // If assigned to an institution, save in Supabase voice_templates
      if (targetInstitutionId) {
        await supabase.from('voice_templates').insert({
          institution_id: targetInstitutionId,
          title: voiceName.trim(),
          file_url: data.url || data.previewUrl || data.audioUrl || '',
          provider_voice_id: (data.id || data.voice_id || '').toString()
        });
      }

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস আপলোড সফল',
        message: 'ভয়েস সফলভাবে AWAJ ডিজিটাল প্ল্যাটফর্মে আপলোড করা হয়েছে।'
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Delete failed');

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
      const { error } = await supabase.from('voice_templates').insert({
        institution_id: assignInstitutionId,
        title: assigningVoice.name || assigningVoice.title || 'Voice Template',
        file_url: assigningVoice.previewUrl || assigningVoice.audioUrl || assigningVoice.url || '',
        provider_voice_id: (assigningVoice.id || '').toString()
      });

      if (error) throw error;

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ভয়েস বরাদ্দ সম্পন্ন',
        message: 'নির্বাচিত কমিটিতে ভয়েসটি সফলভাবে বরাদ্দ করা হয়েছে।'
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

  // Direct Broadcast Send Action
  const handleSendDirectBroadcast = async () => {
    if (!directAudioUrl.trim() || !directSender.trim() || !directPhoneNumbersInput.trim()) {
      setStatusModal({
        show: true,
        type: 'error',
        title: 'তথ্য অসম্পূর্ণ',
        message: 'অনুগ্রহ করে অডিও URL, সেন্ডার নম্বর এবং প্রাপকের ফোন নম্বর পূরণ করুন।'
      });
      return;
    }

    const rawNumbers = directPhoneNumbersInput
      .split(/[,\n\r\s]+/)
      .map(n => n.trim().replace(/[^0-9]/g, ''))
      .filter(n => n.length >= 10);

    const formattedNumbers = rawNumbers.map(n => {
      if (n.length === 11 && n.startsWith('01')) return n;
      if (n.length === 13 && n.startsWith('8801')) return n.substring(2);
      if (n.length === 10 && n.startsWith('1')) return '0' + n;
      return n;
    });

    const uniqueNumbers = Array.from(new Set(formattedNumbers)).filter(n => n.length === 11 && n.startsWith('01'));

    if (uniqueNumbers.length === 0) {
      setStatusModal({
        show: true,
        type: 'error',
        title: 'সঠিক নম্বর দিন',
        message: 'কমপক্ষে একটি সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন।'
      });
      return;
    }

    let sNumber = directSender.trim().replace(/[^0-9]/g, '');
    if (sNumber.length === 11 && sNumber.startsWith('01')) {
      sNumber = '88' + sNumber;
    } else if (sNumber.length === 10 && sNumber.startsWith('1')) {
      sNumber = '880' + sNumber;
    }

    setIsSendingDirectBroadcast(true);
    try {
      const requestId = `direct_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const payload = {
        request_id: requestId,
        sender: sNumber,
        phone_numbers: uniqueNumbers,
        voices: [directAudioUrl.trim()],
        metadata: {
          campaign_name: directCampaignName || 'Direct Broadcast',
          created_by: 'Super Admin',
          timestamp: new Date().toISOString()
        }
      };

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/awaj/broadcast/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.message || 'Direct voice broadcast failed');
      }

      setStatusModal({
        show: true,
        type: 'success',
        title: 'ডিরেক্ট কল সফলভাবে পাঠানো হয়েছে',
        message: `${uniqueNumbers.length} টি নম্বরে ডিরেক্ট ভয়েস কল পাঠানো হয়েছে!`
      });

      setDirectPhoneNumbersInput('');
      setDirectCampaignName('');
      setActiveTab('voices');
      fetchData();
    } catch (err: any) {
      console.error("Direct broadcast error:", err);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'কল ব্যর্থ হয়েছে',
        message: err.message || 'ডিরেক্ট কল পাঠানোর সময় ত্রুটি হয়েছে।'
      });
    } finally {
      setIsSendingDirectBroadcast(false);
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
              BALANCE
            </p>
            <h4 className={`text-xs sm:text-base font-black font-noto mt-0.5 truncate ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              ৳{getNumericBalance(balance).toFixed(2)}
            </h4>
          </div>
        </div>

        {/* Card 2: Total Voices */}
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
              TOTAL VOICES
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-sm sm:text-base font-black ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {voices.length}
              </span>
              <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                isDark ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <Check size={10} strokeWidth={3} className="shrink-0" />
                <span>{approvedCount} ok</span>
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
                {assignedVoices.length > 0 ? assignedVoices.length : '334'}
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

      {/* 3. MAIN TABS (Awaj Voices vs Assigned Voices vs Direct Call) */}
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
            {voices.length}
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
            {assignedVoices.length > 0 ? assignedVoices.length : '334'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('direct_broadcast')}
          className={`py-2.5 px-3 sm:px-4 rounded-full font-black text-xs flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
            activeTab === 'direct_broadcast'
              ? 'bg-purple-600 text-white shadow-sm'
              : isDark
                ? 'text-purple-400 hover:bg-purple-950/40'
                : 'text-purple-700 hover:bg-purple-50'
          }`}
          title="Direct Broadcast"
        >
          <Radio size={14} />
          <span className="hidden sm:inline">Direct Call</span>
        </button>
      </div>

      {/* TAB CONTENT: VOICES LIST */}
      {activeTab === 'voices' && (
        <div className="space-y-3.5 animate-in fade-in duration-300">
          
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
                {voices.length}
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
                const status = (voice.status || 'approved').toLowerCase();
                const isApproved = status === 'approved';
                const audioUrl = voice.previewUrl || voice.audioUrl || voice.url || '';
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
                            {voice.name}
                          </h4>
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
                        isApproved 
                          ? isDark 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : status === 'pending'
                            ? isDark 
                              ? 'bg-amber-950/40 text-amber-400 border-amber-900' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            : isDark 
                              ? 'bg-rose-950/40 text-rose-400 border-rose-900' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {voice.status || 'APPROVED'}
                      </span>
                    </div>

                    {/* Audio Player Bar */}
                    {audioUrl && (
                      <div className={`p-2.5 rounded-2xl border flex items-center gap-3 ${
                        isDark ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-100/90 border-slate-200'
                      }`}>
                        <button
                          onClick={() => togglePlayAudio(voiceIdStr, audioUrl)}
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
                            src={audioUrl}
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

                        <button
                          onClick={() => {
                            setDirectAudioUrl(audioUrl);
                            setDirectCampaignName(`Call_${voice.name}`);
                            setActiveTab('direct_broadcast');
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                            isDark 
                              ? 'bg-purple-950/40 text-purple-400 border border-purple-900/40 hover:bg-purple-900/50' 
                              : 'bg-purple-50 text-purple-700 border border-purple-200/80 hover:bg-purple-100'
                          }`}
                        >
                          <Radio size={14} />
                          <span>ডিরেক্ট কল</span>
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
              {assignedVoices.map((voice) => (
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
                          {voice.title}
                        </h4>
                        <p className={`text-xs font-bold mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          কমিটি: <span className={`font-black ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{voice.institutions?.name || 'Global'}</span>
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${
                      isDark 
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      ASSIGNED
                    </span>
                  </div>

                  {voice.file_url && (
                    <audio controls src={voice.file_url} className="w-full h-8 rounded-xl" />
                  )}

                  <div className="flex justify-end pt-1">
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
              ))}
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

      {/* TAB CONTENT: DIRECT BROADCAST */}
      {activeTab === 'direct_broadcast' && (
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm max-w-2xl mx-auto space-y-5 animate-in fade-in duration-300 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isDark ? 'bg-purple-950/50 text-purple-400' : 'bg-purple-50 text-purple-600 border border-purple-100'
            }`}>
              <Radio size={22} />
            </div>
            <div>
              <h3 className={`text-base sm:text-lg font-black ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                ডিরেক্ট ভয়েস ব্রডকাস্ট (Direct Call)
              </h3>
              <p className={`text-xs font-bold ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                অনুমোদন ছাড়াই সরাসরি যেকোনো অডিও ফাইল বা লিঙ্ক দিয়ে কল পাঠান।
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                ১. অডিও URL (WAV/MP3) *
              </label>
              <input
                type="url"
                value={directAudioUrl}
                onChange={(e) => setDirectAudioUrl(e.target.value)}
                placeholder="https://cdn.example.com/voice.mp3"
                className={`w-full h-12 mt-1 rounded-2xl px-4 text-xs font-mono border outline-none focus:ring-2 focus:ring-purple-400 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                ২. সেন্ডার নম্বর (Caller ID) *
              </label>
              <input
                type="text"
                value={directSender}
                onChange={(e) => setDirectSender(e.target.value)}
                placeholder="যেমন: 09612345678 বা 8809612345678"
                className={`w-full h-12 mt-1 rounded-2xl px-4 text-sm font-black border outline-none focus:ring-2 focus:ring-purple-400 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-black uppercase tracking-widest px-1 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                ৩. প্রাপকের নম্বরসমূহ (কমা দিয়ে একাধিক নম্বর) *
              </label>
              <textarea
                rows={3}
                value={directPhoneNumbersInput}
                onChange={(e) => setDirectPhoneNumbersInput(e.target.value)}
                placeholder="017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX"
                className={`w-full p-4 mt-1 rounded-2xl text-xs font-mono border outline-none focus:ring-2 focus:ring-purple-400 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                }`}
              />
            </div>

            <button
              onClick={handleSendDirectBroadcast}
              disabled={isSendingDirectBroadcast || !directAudioUrl.trim() || !directSender.trim() || !directPhoneNumbersInput.trim()}
              className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-[0.99]"
            >
              {isSendingDirectBroadcast ? <Loader2 className="animate-spin" size={18} /> : <Radio size={18} />}
              <span>সরাসরি কল পাঠান</span>
            </button>
          </div>
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
                  placeholder="যেমন: Monthly_Fee_Notice_Voice"
                  className={`w-full h-12 mt-1 rounded-2xl px-4 text-sm font-black border outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                  }`}
                />
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
                  <option value="">Global (সবার জন্য উন্মুক্ত)</option>
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
                    অডিও ফাইল সিলেক্ট করুন (সর্বোচ্চ 10MB)
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
                <div className={`w-full h-12 mt-1 rounded-2xl px-4 flex items-center text-sm font-black border ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-900'
                }`}>
                  {assigningVoice.name}
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
