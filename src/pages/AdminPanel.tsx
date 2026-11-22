
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
// Fix: Import icons from lucide-react instead of ../supabase
import { Loader2, Search, ChevronLeft, ChevronRight, User as UserIcon, ShieldCheck, Database, Globe, CheckCircle, XCircle, CreditCard, Save, X, Settings, Smartphone, MessageSquare, Key, Shield, ArrowLeft, ArrowRight, Copy, Check, Calendar, Users, Layers, MonitorSmartphone, Server, BarChart3, TrendingUp, RefreshCcw, Clock, Hash, History as HistoryIcon, Zap, Activity, PieChart, Users2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Trash2, Edit2, Sliders, ToggleLeft, ToggleRight, GraduationCap, Banknote, PhoneCall, Mic, Plus, Play, Building2, PlusCircle, BookOpen, Vote, Landmark, ClipboardList, Filter, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, Transaction, AdminSMSStock } from 'types';
import { COMMITTEE_TYPES as UTILITY_COMMITTEE_TYPES } from '../utils/committeeTypes';
import { SONGHO_ACTIVITIES, getDefaultSonghoActivityIds } from '../utils/songhoActivities';
import {
  DEFAULT_MASKING_SMS_RATE,
  DEFAULT_NON_MASKING_SMS_RATE,
  DEFAULT_VOICE_RATE,
  resolveInstitutionSmsPricing
} from '../utils/smsUtils';

const COMMITTEE_PACKAGES = [
  { name: 'STARTER', rate: 200 },
  { name: 'STANDARD', rate: 500 },
  { name: 'PRO', rate: 1000 },
  { name: 'Custom', rate: 0 }
];

const MONTH_NAMES_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const ALL_MODULE_META: Record<string, { labelBn: string; labelEn: string; icon: any }> = {
  departments: { labelBn: 'শাখা ও বিভাগ', labelEn: 'Departments / Branches', icon: BookOpen },
  attendance: { labelBn: 'উপস্থিতি ট্র্যাকিং', labelEn: 'Attendance Tracking', icon: ClipboardList },
  meetings: { labelBn: 'মিটিং ও এজেন্ডা', labelEn: 'Meetings & Agendas', icon: Calendar },
  minutes: { labelBn: 'কার্যবিবরণী (মিনিটস)', labelEn: 'Meeting Minutes', icon: ClipboardList },
  accounting: { labelBn: 'হিসাব-নিকাশ ও তহবিল', labelEn: 'Accounting & Funds', icon: Banknote },
  subscriptions: { labelBn: 'সদস্য চাঁদা ও বকেয়া', labelEn: 'Member Dues & Fees', icon: CreditCard },
  sms: { labelBn: 'এসএমএস ব্রডকাস্ট', labelEn: 'SMS Broadcast', icon: MessageSquare },
  voice_broadcast: { labelBn: 'ভয়েস কল ব্রডকাস্ট', labelEn: 'Voice Call Broadcast', icon: Mic },
  polls: { labelBn: 'ভোট ও মতামত (পোলস)', labelEn: 'Voting & Polls', icon: Vote },
  events: { labelBn: 'ইভেন্ট ও কর্মসূচি', labelEn: 'Events & Programs', icon: Calendar },
  notices: { labelBn: 'নোটিশ বোর্ড', labelEn: 'Notice Board', icon: AlertTriangle },
  qard_hasan: { labelBn: 'করযে হাসানা', labelEn: 'Qard Hasan', icon: Landmark },
};

interface InstitutionWithStats extends Institution {
  student_count?: number;
  class_count?: number;
}

interface AdminPanelProps {
  lang: Language;
  currentView?: 'list' | 'dashboard' | 'approvals';
  dataVersion?: number;
  onProfileUpdate?: () => void;
  madrasah?: Institution | null;
  profile?: any;
  setStatusModal: (modal: {show: boolean, type: 'success' | 'error', title: string, message: string}) => void;
}

const DISPLAY_COMMITTEE_TYPES = UTILITY_COMMITTEE_TYPES.map(t => ({
  id: t.id,
  label: t.labelBn,
  labelEn: t.labelEn
})).concat([{ id: 'ngo', label: 'এনজিও', labelEn: 'NGO' }]);

// Dynamic default modules mapping based on committee type
const ACCOUNT_TYPE_DEFAULT_MODULES = (() => {
  const mapping: Record<string, Record<string, boolean>> = {};
  UTILITY_COMMITTEE_TYPES.forEach(type => {
    const typeModules: Record<string, boolean> = {};
    type.defaultModules.forEach(mod => {
      typeModules[mod] = true;
    });
    mapping[type.id] = typeModules;
  });
  // Add NGO specifically as it's often used interchangeably with Organization
  if (mapping['organization'] && !mapping['ngo']) {
    mapping['ngo'] = { ...mapping['organization'] };
  }
  return mapping;
})();

const AdminPanel: React.FC<AdminPanelProps> = ({ lang, currentView = 'list', dataVersion = 0, onProfileUpdate, madrasah, profile, setStatusModal }) => {
  const [madrasahs, setMadrasahs] = useState<InstitutionWithStats[]>([]);
  const [pendingTrans, setPendingTrans] = useState<Transaction[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<any>('all');
  const [view, setView] = useState<'list' | 'approvals' | 'details' | 'dashboard'>(
    currentView === 'approvals' ? 'approvals' : currentView === 'dashboard' ? 'dashboard' : 'list'
  );

  const [paymentTab, setPaymentTab] = useState<'sms' | 'voice' | 'subscription'>('sms');
  const [showPaymentFilter, setShowPaymentFilter] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [paymentDateFilter, setPaymentDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [isFetchingAwajVoices, setIsFetchingAwajVoices] = useState(false);
  const [awajVoices, setAwajVoices] = useState<any[]>([]);

  const handleFetchAwajVoices = async () => {
    setIsFetchingAwajVoices(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const awajResponse = await fetch('/api/awaj/voices', {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}
      });
      if (awajResponse.ok) {
        const awajData = await awajResponse.json();
        // Assuming the API returns an array of voices or an object with a voices array
        const voicesList = Array.isArray(awajData) ? awajData : (awajData.voices || awajData.data || []);
        setAwajVoices(voicesList);
        if (voicesList.length === 0) {
          setStatusModal({
            show: true,
            type: 'error',
            title: 'No Voices Found',
            message: 'No approved voices found in your Awaj Digital account.'
          });
        }
      } else {
        let errorMsg = 'Unknown error occurred while fetching from Awaj Digital';
        try {
          const textData = await awajResponse.text();
          try {
            const errorData = JSON.parse(textData);
            errorMsg = errorData.message || errorData.error || errorMsg;
          } catch (e) {
            if (textData) errorMsg = textData;
          }
        } catch (e) {
          console.error("Failed to read error response", e);
        }
        throw new Error(`Awaj API Error: ${errorMsg}`);
      }
    } catch (err: any) {
      console.error('Error fetching from Awaj:', err);
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: err.message });
    } finally {
      setIsFetchingAwajVoices(false);
    }
  };

  const [smsToCredit, setSmsToCredit] = useState<{ [key: string]: string }>({});
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  
  const [smsEnabledMap, setSmsEnabledMap] = useState<{ [key: string]: boolean }>({});

  const [rejectConfirm, setRejectConfirm] = useState<Transaction | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const [globalStats, setGlobalStats] = useState({ 
    totalStudents: 0, 
    totalClasses: 0, 
    totalDistributedSMS: 0,
    totalSentSMS: 0,
    currentInUserWallets: 0,
    totalRevenue: 0,
    pendingApprovals: 0,
    totalInstitutions: 0,
    activeInstitutions: 0,
    totalVoiceBalance: 0,
    adminSMSStock: 0,
    typeBreakdown: {} as Record<string, number>
  });
  const [recentInstitutions, setRecentInstitutions] = useState<Institution[]>([]);
  const [selectedUser, setSelectedUser] = useState<InstitutionWithStats | null>(null);
  const [userStats, setUserStats] = useState({ students: 0, departments: 0 });
  
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLoginCode, setEditLoginCode] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editSmsBalance, setEditSmsBalance] = useState<string>('0');
  const [editVoiceBalance, setEditVoiceBalance] = useState<string>('0');
  const [editReveApiKey, setEditReveApiKey] = useState('');
  const [editReveSecretKey, setEditReveSecretKey] = useState('');
  const [editReveCallerId, setEditReveCallerId] = useState('');
  const [editReveClientId, setEditReveClientId] = useState('');
  const [editVoiceSenderId, setEditVoiceSenderId] = useState('');
  const [editSmsType, setEditSmsType] = useState<'non_masking' | 'masking'>('non_masking');
  const [editSmsRate, setEditSmsRate] = useState<string>('');
  const [editVoiceRate, setEditVoiceRate] = useState<number>(DEFAULT_VOICE_RATE);
  const [editMemberLimit, setEditMemberLimit] = useState<number>(0);
  const [globalSmsRates, setGlobalSmsRates] = useState<{
    masking_rate: number;
    non_masking_rate: number;
    default_sms_type: 'non_masking' | 'masking';
  }>({
    masking_rate: DEFAULT_MASKING_SMS_RATE,
    non_masking_rate: DEFAULT_NON_MASKING_SMS_RATE,
    default_sms_type: 'non_masking'
  });

  const [editModules, setEditModules] = useState<Record<string, boolean>>({
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    accounting: true,
    subscriptions: true,
    sms: true,
    voice_broadcast: false,
    polls: true,
    events: true,
    notices: true,
    qard_hasan: false,
  });
  const [editSubscriptionEnd, setEditSubscriptionEnd] = useState('');
  const [editSubscriptionType, setEditSubscriptionType] = useState<'monthly' | 'quarterly' | 'yearly' | 'lifetime'>('monthly');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'trial'>('active');
  const [editAttendanceType, setEditAttendanceType] = useState<'meeting' | 'daily'>('meeting');
  const [editFeeStructure, setEditFeeStructure] = useState<'monthly' | 'session'>('monthly');
  const [editInstitutionType, setEditInstitutionType] = useState<any>('committee');
  const [editFeeEngine, setEditFeeEngine] = useState<'standard' | 'school' | 'qawmi' | 'kindergarten' | 'simple'>('standard');
  const [editAccountingMode, setEditAccountingMode] = useState<'committee_system' | 'flexible'>('committee_system');
  const [editSonghoActivities, setEditSonghoActivities] = useState<string[]>(getDefaultSonghoActivityIds());

  // Subscription & Billing States
  const [editCustomSubscriptionFee, setEditCustomSubscriptionFee] = useState<number | ''>('');
  const [editPackageName, setEditPackageName] = useState<string>('STANDARD');
  const [editPackageRate, setEditPackageRate] = useState<number>(500);
  const [editPaidMonths, setEditPaidMonths] = useState<string[]>([]);
  const [selectedMonthsForPayment, setSelectedMonthsForPayment] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editDueAmount, setEditDueAmount] = useState<number>(0);
  const [overrideTotal, setOverrideTotal] = useState<number | ''>('');
  const [editSubscriptionNote, setEditSubscriptionNote] = useState<string>('');
  const [isProcessingSubPayment, setIsProcessingSubPayment] = useState<boolean>(false);

  // History & Point-in-Time Balance Audit States
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyFilterModule, setHistoryFilterModule] = useState<'all' | 'sms' | 'voice' | 'subscription'>('all');
  const [auditDate, setAuditDate] = useState<string>('');
  const [auditResult, setAuditResult] = useState<any>(null);
  const [isCheckingAudit, setIsCheckingAudit] = useState<boolean>(false);

  const [detailsTab, setDetailsTab] = useState<'committee' | 'api' | 'permissions' | 'subscription' | 'history'>('committee');

  const [editPassword, setEditPassword] = useState('');
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  
  // Create Institution State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstPhone, setNewInstPhone] = useState('');
  const [newInstEmail, setNewInstEmail] = useState('');
  const [newInstPassword, setNewInstPassword] = useState('');
  const [newInstType, setNewInstType] = useState<any>('committee');
  const [newInstSonghoActivities, setNewInstSonghoActivities] = useState<string[]>(getDefaultSonghoActivityIds());
  const [newInstLoginCode, setNewInstLoginCode] = useState('');
  const [isCreatingInst, setIsCreatingInst] = useState(false);

  const fetchGlobalCounts = useCallback(async () => {
    try {
      const [studentsRes, classesRes, smsAllocRes, currentBalRes, pendingRes, instsRes, stockRes] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('sms_count, amount').eq('status', 'approved'),
        supabase.from('institutions').select('sms_balance, balance, is_active, institution_type').or('is_super_admin.eq.false,is_super_admin.is.null'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('institutions').select('*', { count: 'exact', head: true }).or('is_super_admin.eq.false,is_super_admin.is.null'),
        supabase.from('admin_sms_stock').select('remaining_sms').maybeSingle()
      ]);

      const totalAllocated = smsAllocRes.data?.reduce((sum, t) => sum + (Number(t.sms_count) || 0), 0) || 0;
      const totalRevenue = smsAllocRes.data?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
      const totalInWallets = currentBalRes.data?.reduce((sum, m) => sum + (Number(m.sms_balance) || 0), 0) || 0;
      const totalVoiceBalance = currentBalRes.data?.reduce((sum, m) => sum + (Number(m.balance) || 0), 0) || 0;
      const activeInsts = (currentBalRes.data || []).filter(m => m.is_active).length;
      const sentCount = Math.max(0, totalAllocated - totalInWallets);
      const adminStock = stockRes.data?.remaining_sms || 0;

      const typeBreakdown = (currentBalRes.data || []).reduce((acc: any, m) => {
        const type = m.institution_type || 'committee';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalStudents: studentsRes.count || 0,
        totalClasses: classesRes.count || 0,
        totalDistributedSMS: totalAllocated,
        totalSentSMS: sentCount,
        currentInUserWallets: totalInWallets,
        totalRevenue,
        pendingApprovals: pendingRes.count || 0,
        totalInstitutions: instsRes.count || 0,
        activeInstitutions: activeInsts,
        totalVoiceBalance,
        adminSMSStock: adminStock,
        typeBreakdown
      };
    } catch (err) {
      console.error("Error fetching global counts:", err);
      return {
        totalStudents: 0,
        totalClasses: 0,
        totalDistributedSMS: 0,
        totalSentSMS: 0,
        currentInUserWallets: 0,
        totalRevenue: 0,
        pendingApprovals: 0,
        totalInstitutions: 0,
        activeInstitutions: 0,
        totalVoiceBalance: 0,
        adminSMSStock: 0,
        typeBreakdown: {}
      };
    }
  }, []);

  const fetchAllMadrasahs = useCallback(async () => {
    const { data, error } = await supabase.from('institutions')
      .select('*')
      .or('is_super_admin.eq.false,is_super_admin.is.null')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("fetchAllMadrasahs error:", error);
      throw error;
    }
    return data || [];
  }, []);

  const fetchPendingTransactions = useCallback(async () => {
    const { data } = await supabase.from('transactions').select('*, institutions(*)').eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
  }, []);

  const fetchTransactionHistory = useCallback(async () => {
    const { data } = await supabase.from('transactions')
      .select('*, institutions(*)')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }, []);
  const initData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (view === 'list' || view === 'dashboard') {
        const [mListRes, gStats, recentRes, historyRes] = await Promise.all([
          fetchAllMadrasahs().catch(e => { console.error(e); return []; }),
          fetchGlobalCounts(),
          (async () => {
            try {
              return await supabase.from('institutions').select('*').or('is_super_admin.eq.false,is_super_admin.is.null').order('created_at', { ascending: false }).limit(6);
            } catch {
              return { data: [] };
            }
          })(),
          fetchTransactionHistory().catch(e => { console.error(e); return []; })
        ]);
        
        const mList = Array.isArray(mListRes) ? mListRes : [];
        const recent = recentRes.data || [];
        const history = Array.isArray(historyRes) ? historyRes : [];
        
        setMadrasahs(prev => mList.map(m => {
          const existing = prev.find(ex => ex.id === m.id);
          return { 
            ...m, 
            student_count: existing?.student_count || 0, 
            class_count: existing?.class_count || 0 
          };
        }));
        setGlobalStats(gStats);
        setRecentInstitutions(recent);
        setTransactionHistory(history);
      }
      if (view === 'approvals') {
        const [pTrans, tHist] = await Promise.all([
          fetchPendingTransactions(),
          fetchTransactionHistory()
        ]);
        setPendingTrans(pTrans);
        setTransactionHistory(tHist);
        setSmsEnabledMap(prev => {
          const next = { ...prev };
          pTrans.forEach(tr => {
            if (next[tr.id] === undefined) next[tr.id] = true;
          });
          return next;
        });
      }
    } catch (err) { 
      console.error("AdminPanel Init Error:", err); 
    } finally { 
      if (!silent) setLoading(false); 
    }
  }, [view, fetchAllMadrasahs, fetchGlobalCounts, fetchPendingTransactions, fetchTransactionHistory]);

  useEffect(() => { 
    initData(); 
  }, [dataVersion, view, initData]);

  useEffect(() => {
    let active = true;
    smsApi.getGlobalSettings()
      .then((res) => {
        if (!active || !res) return;
        setGlobalSmsRates({
          masking_rate: Number(res.masking_rate) > 0 ? Number(res.masking_rate) : DEFAULT_MASKING_SMS_RATE,
          non_masking_rate: Number(res.non_masking_rate) > 0 ? Number(res.non_masking_rate) : DEFAULT_NON_MASKING_SMS_RATE,
          default_sms_type: res.default_sms_type === 'masking' ? 'masking' : 'non_masking'
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [dataVersion]);

  useEffect(() => {
    if (currentView === 'approvals') setView('approvals');
    else if (currentView === 'dashboard') setView('dashboard');
    else if (currentView === 'list') setView('list');
  }, [currentView]);

  const fetchPaymentHistory = useCallback(async (
    institutionId: string,
    filterModule: 'all' | 'sms' | 'voice' | 'subscription' = 'all'
  ) => {
    if (!institutionId) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];

      const filteredRows = rows.filter((tr: any) => {
        if (filterModule === 'all') return true;
        const desc = (tr.description || '').toLowerCase();
        const trxId = (tr.transaction_id || '').toUpperCase();
        if (filterModule === 'subscription') {
          return tr.module === 'subscription' || desc.includes('subscription') || trxId.startsWith('SUB_');
        }
        if (filterModule === 'voice') {
          return tr.module === 'voice' || desc.includes('voice');
        }
        if (filterModule === 'sms') {
          return tr.module === 'sms' || (Number(tr.sms_count) || 0) > 0 || desc.includes('sms');
        }
        return true;
      });

      setPaymentHistory(filteredRows);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      setPaymentHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const handleCheckHistoricalBalance = async () => {
    if (!selectedUser || !auditDate) return;
    setIsCheckingAudit(true);
    try {
      const targetIso = new Date(auditDate).toISOString();
      const { data: postTx, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('institution_id', selectedUser.id)
        .eq('status', 'approved')
        .gt('created_at', targetIso)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: preTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('institution_id', selectedUser.id)
        .eq('status', 'approved')
        .lte('created_at', targetIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentVoice = Number(selectedUser.balance || 0);
      const currentSms = Number(selectedUser.sms_balance || 0);

      let historicalVoice = currentVoice;
      let historicalSms = currentSms;

      if (preTx?.metadata && (preTx.metadata.balance_after !== undefined || preTx.metadata.sms_balance_after !== undefined)) {
        if (preTx.metadata.balance_after !== undefined) {
          historicalVoice = Number(preTx.metadata.balance_after);
        }
        if (preTx.metadata.sms_balance_after !== undefined) {
          historicalSms = Number(preTx.metadata.sms_balance_after);
        }
      } else {
        (postTx || []).forEach((tr: any) => {
          const desc = (tr.description || '').toLowerCase();
          const trxId = (tr.transaction_id || '').toUpperCase();
          const isDebit = tr.type === 'debit';
          const isSub = tr.module === 'subscription' || desc.includes('subscription') || trxId.startsWith('SUB_');
          const smsCnt = Number(tr.sms_count) || 0;
          const isSms = tr.module === 'sms' || smsCnt > 0 || desc.includes('sms');
          const isVoice = tr.module === 'voice' || desc.includes('voice');

          if (isSub) return;

          if (isSms && smsCnt > 0) {
            historicalSms += isDebit ? smsCnt : -smsCnt;
          }
          if (isVoice || (!isSms && Number(tr.amount) > 0)) {
            const amt = Number(tr.amount) || 0;
            historicalVoice += isDebit ? amt : -amt;
          }
        });
      }

      setAuditResult({
        targetDate: auditDate,
        historicalVoice: Math.max(0, historicalVoice),
        historicalSms: Math.max(0, historicalSms),
        currentVoice,
        currentSms,
        transactionsAfterCount: (postTx || []).length
      });
    } catch (err: any) {
      console.error('Historical balance check failed:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ত্রুটি' : 'Error',
        message: err.message || 'Failed to check historical balance'
      });
    } finally {
      setIsCheckingAudit(false);
    }
  };

  const handleReceiveSubscriptionPayment = async () => {
    if (!selectedUser) return;
    if (selectedMonthsForPayment.length === 0 && overrideTotal === '') {
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Months',
        message: lang === 'bn' ? 'পেমেন্ট গ্রহণের জন্য অন্তত একটি মাস বা কাস্টম মোট টাকা লিখুন।' : 'Please select at least one month or enter a custom total amount.'
      });
      return;
    }

    setIsProcessingSubPayment(true);
    try {
      const effectiveRate = editCustomSubscriptionFee !== '' ? Number(editCustomSubscriptionFee) : Number(editPackageRate || 0);
      const calculatedTotal = Math.max(0, (effectiveRate * selectedMonthsForPayment.length) - Number(editDiscount || 0));
      const finalAmount = overrideTotal !== '' ? Math.max(0, Number(overrideTotal)) : calculatedTotal;

      const mergedPaidMonths = Array.from(new Set([...editPaidMonths, ...selectedMonthsForPayment])).sort();

      // Compute new subscription_end from latest paid month or +1 month
      let newSubEnd = editSubscriptionEnd;
      if (mergedPaidMonths.length > 0) {
        const latestYm = mergedPaidMonths[mergedPaidMonths.length - 1];
        const [yr, mo] = latestYm.split('-').map(Number);
        if (yr && mo) {
          const lastDay = new Date(yr, mo, 0);
          newSubEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        }
      } else {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        newSubEnd = nextMonth.toISOString().split('T')[0];
      }

      const trxId = `SUB_${Date.now()}`;
      const monthsLabel = selectedMonthsForPayment.length > 0 ? selectedMonthsForPayment.join(', ') : 'Custom Payment';
      const description = `Subscription Payment (${editPackageName}) - ${monthsLabel}`;

      const baseInsertPayload = {
        institution_id: selectedUser.id,
        amount: finalAmount,
        transaction_id: trxId,
        sender_phone: 'Admin Direct',
        description,
        type: 'credit',
        status: 'approved',
        sms_count: 0
      };

      const fullInsertPayload = {
        ...baseInsertPayload,
        module: 'subscription',
        metadata: {
          months: selectedMonthsForPayment,
          package_name: editPackageName,
          subscription_type: editSubscriptionType,
          discount: Number(editDiscount || 0),
          due_amount: Number(editDueAmount || 0),
          balance_after: Number(editVoiceBalance || 0),
          sms_balance_after: Number(editSmsBalance || 0)
        }
      };

      const { error: txErr } = await supabase.from('transactions').insert(fullInsertPayload);
      if (txErr) {
        const errMsg = `${txErr.message || ''} ${txErr.code || ''}`.toLowerCase();
        if (errMsg.includes('42703') || errMsg.includes('column') || errMsg.includes('schema cache')) {
          const { error: retryErr } = await supabase.from('transactions').insert(baseInsertPayload);
          if (retryErr) throw retryErr;
        } else {
          throw txErr;
        }
      }

      let existingConfig: any = selectedUser.config_json;
      if (typeof existingConfig === 'string') {
        try {
          existingConfig = JSON.parse(existingConfig);
        } catch {
          existingConfig = {};
        }
      }

      const updatedConfig = {
        ...(typeof existingConfig === 'object' && existingConfig !== null ? existingConfig : {}),
        modules: editModules,
        paid_months: mergedPaidMonths,
        package_name: editPackageName,
        package_rate: editPackageRate,
        custom_subscription_fee: editCustomSubscriptionFee,
        due_amount: Number(editDueAmount || 0),
        subscription_note: editSubscriptionNote,
        subscription_type: editSubscriptionType
      };

      const { data: updatedInst, error: instErr } = await supabase
        .from('institutions')
        .update({
          is_active: true,
          status: 'active',
          subscription_end: newSubEnd || null,
          config_json: updatedConfig
        })
        .eq('id', selectedUser.id)
        .select()
        .single();

      if (instErr) throw instErr;

      setEditPaidMonths(mergedPaidMonths);
      setEditActive(true);
      setEditStatus('active');
      setEditSubscriptionEnd(newSubEnd);
      if (updatedInst) {
        setSelectedUser(prev => prev ? { ...prev, ...updatedInst } : prev);
      }
      setSelectedMonthsForPayment([]);
      setEditDiscount(0);
      setOverrideTotal('');

      await fetchPaymentHistory(selectedUser.id, historyFilterModule);
      initData(true);

      setStatusModal({
        show: true,
        type: 'success',
        title: lang === 'bn' ? 'পেমেন্ট সফল' : 'Payment Received',
        message: lang === 'bn'
          ? `${selectedUser.name}-এর সাবস্ক্রিপশন পেমেন্ট (৳${finalAmount}) সফলভাবে রেকর্ড হয়েছে।`
          : `Subscription payment of ৳${finalAmount} recorded for ${selectedUser.name}.`
      });
    } catch (err: any) {
      console.error('Subscription payment error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ব্যর্থ' : 'Failed',
        message: err.message || 'Failed to record subscription payment'
      });
    } finally {
      setIsProcessingSubPayment(false);
    }
  };

  const handleDeleteHistory = (tr: any) => {
    if (!selectedUser) return;
    setShowConfirm({
      show: true,
      title: lang === 'bn' ? 'লেনদেন ডিলিট নিশ্চিত করুন' : 'Delete Transaction',
      message: lang === 'bn'
        ? `আপনি কি "${tr.transaction_id || tr.id}" (${tr.amount} ৳) লেনদেনটি মুছে ফেলতে চান?`
        : `Are you sure you want to delete transaction "${tr.transaction_id || tr.id}" (${tr.amount} ৳)?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('transactions').delete().eq('id', tr.id);
          if (error) throw error;
          await fetchPaymentHistory(selectedUser.id, historyFilterModule);
          setStatusModal({
            show: true,
            type: 'success',
            title: lang === 'bn' ? 'সফল' : 'Deleted',
            message: lang === 'bn' ? 'লেনদেনটি ইতিহাস থেকে মুছে ফেলা হয়েছে।' : 'Transaction removed from history.'
          });
        } catch (err: any) {
          setStatusModal({
            show: true,
            type: 'error',
            title: lang === 'bn' ? 'ত্রুটি' : 'Error',
            message: err.message || 'Failed to delete transaction'
          });
        }
      }
    });
  };

  const handleDownloadReceipt = async (tr: any) => {
    if (!selectedUser) return;
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

    const escapeHtml = (val: any) =>
      String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formattedDate = escapeHtml(new Date(tr.created_at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US'));
    const monthsText = Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0
      ? escapeHtml(tr.metadata.months.join(', '))
      : '';
    const pkgText = tr.metadata?.package_name ? ` (${escapeHtml(tr.metadata.package_name)})` : '';

    container.innerHTML = `
      <div style="border: 2px solid #0fb5ab; border-radius: 20px; padding: 32px; background: #ffffff; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 24px; font-weight: 900; color: #0fb5ab; letter-spacing: -0.5px;">Committee Manager</div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">Official Payment Receipt</div>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: #ecfdf5; color: #059669; border: 1.5px solid #10b981; font-size: 12px; font-weight: 900; letter-spacing: 1px;">PAID</span>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; margin-top: 8px;">${formattedDate}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 18px; border-radius: 14px; border: 1px solid #e2e8f0;">
          <div>
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Committee / Organization</div>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">${escapeHtml(selectedUser.name)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${escapeHtml(selectedUser.phone || '')}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Transaction ID</div>
            <div style="font-size: 13px; font-weight: 800; color: #0fb5ab; margin-top: 4px;">${escapeHtml(tr.transaction_id || tr.id)}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Method: ${escapeHtml(tr.sender_phone || 'Admin Direct')}</div>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Payment Details</div>
          <div style="font-size: 14px; font-weight: 700; color: #1e293b; padding: 14px 16px; background: #f0fdfa; border-radius: 12px; border: 1px solid #ccfbf1;">
            ${escapeHtml(tr.description || 'Platform Payment')}${pkgText}
            ${monthsText ? `<div style="font-size: 11px; color: #0f766e; margin-top: 6px;">Months: ${monthsText}</div>` : ''}
            ${tr.sms_count ? `<div style="font-size: 11px; color: #0f766e; margin-top: 4px;">SMS Credited: ${escapeHtml(tr.sms_count)} SMS</div>` : ''}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #0fb5ab; color: #ffffff; padding: 18px 24px; border-radius: 14px;">
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Total Amount Paid</div>
          <div style="font-size: 24px; font-weight: 900;">৳ ${Number(tr.amount || 0).toFixed(2)}</div>
        </div>

        <div style="margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 600;">
          Generated by Committee Manager Super Admin Panel
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
      pdf.save(`Committee_Receipt_${tr.transaction_id || tr.id}.pdf`);
    } catch (err) {
      console.error('Receipt generation error:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: lang === 'bn' ? 'ত্রুটি' : 'Error',
        message: lang === 'bn' ? 'রসিদ ডাউনলোড করতে সমস্যা হয়েছে।' : 'Failed to generate receipt PDF.'
      });
    } finally {
      document.body.removeChild(container);
    }
  };

  // Fix: Add missing handleUserClick function to manage details view and stats
  const handleUserClick = async (user: InstitutionWithStats) => {
    setSelectedUser(user);
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
    setEditEmail(user.email || '');
    setEditAddress(user.address || '');
    setEditLoginCode(user.login_code || '');
    setEditActive(user.is_active);
    setEditSmsBalance(String(user.sms_balance ?? 0));
    setEditVoiceBalance(String(user.balance ?? 0));
    setEditReveApiKey(user.reve_api_key || '');
    setEditReveSecretKey(user.reve_secret_key || '');
    setEditReveCallerId(user.reve_caller_id || '');
    setEditReveClientId(user.reve_client_id || '');
    setEditVoiceSenderId(user.voice_sender_id || '');

    let userConfig: any = user.config_json;
    if (typeof userConfig === 'string') {
      try {
        userConfig = JSON.parse(userConfig);
      } catch (e) {
        userConfig = {};
      }
    }

    const resolvedPricing = resolveInstitutionSmsPricing(
      { ...user, config_json: userConfig },
      globalSmsRates
    );
    setEditSmsType(resolvedPricing.smsType);
    const customSmsRate = Number(userConfig?.sms_rate);
    setEditSmsRate(Number.isFinite(customSmsRate) && customSmsRate > 0 ? String(customSmsRate) : '');
    setEditVoiceRate(Number(userConfig?.voice_rate) > 0 ? Number(userConfig.voice_rate) : DEFAULT_VOICE_RATE);
    setEditMemberLimit(Number(userConfig?.member_limit) || 0);

    const userModules = { ...(userConfig?.modules || {}) };
    delete userModules.fees;
    delete userModules.admit_card;
    delete userModules.seat_plan;
    delete userModules.results;

    const baseDefaults = ACCOUNT_TYPE_DEFAULT_MODULES[user.institution_type || 'committee'] || ACCOUNT_TYPE_DEFAULT_MODULES.committee;
    const mergedModules: Record<string, boolean> = {};
    Object.keys(ALL_MODULE_META).forEach((key) => {
      mergedModules[key] = userModules[key] !== undefined ? Boolean(userModules[key]) : Boolean(baseDefaults[key]);
    });
    Object.entries(userModules).forEach(([key, val]) => {
      if (!(key in mergedModules)) {
        mergedModules[key] = Boolean(val);
      }
    });
    setEditModules(mergedModules);

    const createdAtDate = new Date(user.created_at);
    const oneYearLater = new Date(createdAtDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const defaultEndDate = oneYearLater.toISOString().split('T')[0];

    setEditSubscriptionEnd(user.subscription_end || defaultEndDate);
    setEditSubscriptionType(userConfig?.subscription_type || 'monthly');
    setEditCustomSubscriptionFee(userConfig?.custom_subscription_fee ?? '');
    setEditPackageName(userConfig?.package_name || 'STANDARD');
    setEditPackageRate(Number(userConfig?.package_rate) || 500);
    setEditPaidMonths(Array.isArray(userConfig?.paid_months) ? userConfig.paid_months : []);
    setSelectedMonthsForPayment([]);
    setSelectedYear(new Date().getFullYear());
    setEditDiscount(0);
    setEditDueAmount(Number(userConfig?.due_amount) || 0);
    setOverrideTotal('');
    setEditSubscriptionNote(userConfig?.subscription_note || '');

    setEditStatus(user.status || 'active');
    setEditAttendanceType(userConfig?.attendance_type === 'daily' ? 'daily' : 'meeting');
    setEditFeeStructure(userConfig?.fee_structure || 'monthly');
    setEditInstitutionType(user.institution_type || 'committee');
    setEditFeeEngine(userConfig?.fee_engine || 'standard');
    setEditAccountingMode(
      userConfig?.accounting_mode === 'flexible' || userConfig?.accounting_mode === 'qawmi_flexible'
        ? 'flexible'
        : 'committee_system'
    );
    setEditSonghoActivities(
      Array.isArray(userConfig?.songho_activities) && userConfig.songho_activities.length > 0
        ? userConfig.songho_activities
        : getDefaultSonghoActivityIds()
    );

    setDetailsTab('committee');
    setHistoryFilterModule('all');
    setAuditDate('');
    setAuditResult(null);
    setEditPassword('');
    setView('details');

    fetchPaymentHistory(user.id, 'all');

    // Fetch user stats
    setUserStats({ students: 0, departments: 0 });
    try {
      const [stdRes, clsRes] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('institution_id', user.id),
        supabase.from('departments').select('*', { count: 'exact', head: true }).eq('institution_id', user.id)
      ]);
      setUserStats({
        students: stdRes.count || 0,
        departments: clsRes.count || 0
      });
    } catch (e) {
      console.error("Error fetching user stats:", e);
    }
  };

  // Fix: Add missing handleUserUpdate function to save changes to madrasah profile
  const handleUserUpdate = async () => {
    if (!selectedUser) return;
    setIsUpdatingUser(true);
    try {
      let userConfig: any = selectedUser.config_json;
      if (typeof userConfig === 'string') {
        try {
          userConfig = JSON.parse(userConfig);
        } catch (e) {
          userConfig = {};
        }
      }

      const parsedSmsBalance = Math.max(0, parseInt(editSmsBalance, 10) || 0);
      const parsedVoiceBalance = Math.max(0, parseFloat(editVoiceBalance) || 0);
      const parsedCustomSmsRate = parseFloat(String(editSmsRate || '').trim());
      const validCustomSmsRate = Number.isFinite(parsedCustomSmsRate) && parsedCustomSmsRate > 0
        ? Math.round(parsedCustomSmsRate * 10000) / 10000
        : null;
      const effectiveSmsType: 'non_masking' | 'masking' = editReveClientId.trim() ? 'masking' : editSmsType;

      const nextConfigJson: Record<string, any> = {
        ...(typeof userConfig === 'object' && userConfig !== null ? userConfig : {}),
        modules: editModules,
        member_limit: Number(editMemberLimit) || 0,
        sms_type: effectiveSmsType,
        voice_rate: Number(editVoiceRate) || DEFAULT_VOICE_RATE,
        attendance_type: editAttendanceType,
        fee_structure: editFeeStructure,
        subscription_type: editSubscriptionType,
        custom_subscription_fee: editCustomSubscriptionFee,
        package_name: editPackageName,
        package_rate: Number(editPackageRate) || 0,
        paid_months: editPaidMonths,
        due_amount: Number(editDueAmount) || 0,
        subscription_note: editSubscriptionNote,
        fee_engine: editFeeEngine,
        accounting_mode: editAccountingMode,
        ...((editInstitutionType === 'sangha' || editInstitutionType === 'union') ? { songho_activities: editSonghoActivities } : {})
      };

      if (validCustomSmsRate !== null) {
        nextConfigJson.sms_rate = validCustomSmsRate;
      } else {
        delete nextConfigJson.sms_rate;
      }

      const updatePayload: Record<string, any> = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        address: editAddress.trim() || null,
        login_code: editLoginCode.trim(),
        is_active: editActive,
        sms_balance: parsedSmsBalance,
        balance: parsedVoiceBalance,
        reve_api_key: editReveApiKey.trim() || null,
        reve_secret_key: editReveSecretKey.trim() || null,
        reve_caller_id: editReveCallerId.trim() || null,
        reve_client_id: editReveClientId.trim() || null,
        voice_sender_id: editVoiceSenderId.trim() || null,
        sms_type: effectiveSmsType,
        institution_type: editInstitutionType,
        subscription_end: editSubscriptionEnd || null,
        status: editStatus,
        config_json: nextConfigJson
      };

      let { data, error } = await supabase.from('institutions').update(updatePayload).eq('id', selectedUser.id).select();

      if (error && (error.code === '42703' || error.code === 'PGRST204' || String(error.message || '').toLowerCase().includes('sms_type'))) {
        const { sms_type: _omitSmsType, ...fallbackUpdatePayload } = updatePayload;
        const retryRes = await supabase.from('institutions').update(fallbackUpdatePayload).eq('id', selectedUser.id).select();
        data = retryRes.data;
        error = retryRes.error;
      }
      
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Update failed: No rows updated. Check permissions or if the institution exists.');
      
      // Update password if provided
      if (editPassword.trim()) {
        let pwUpdated = false;
        try {
          const currentSession = (await supabase.auth.getSession()).data.session;
          const res = await fetch('/api/admin/update-user-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: selectedUser.id,
              email: editEmail.trim() || selectedUser.email,
              new_password: editPassword.trim(),
              auth_token: currentSession?.access_token
            })
          });
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const resData = await res.json();
            if (res.ok && resData.success) {
              pwUpdated = true;
            } else {
              console.warn('API password update response:', resData);
            }
          }
        } catch (apiErr) {
          console.warn('API error, attempting RPC fallback:', apiErr);
        }

        if (!pwUpdated) {
          try {
            const { data: success, error: pwError } = await supabase.rpc(
              "update_user_by_admin",
              {
                p_user_id: selectedUser.id,
                p_password: editPassword.trim(),
              },
            );
            if (!pwError && success) {
              pwUpdated = true;
            }
          } catch (rpcErr) {
            console.warn('RPC password update failed:', rpcErr);
          }
        }
      }

      setStatusModal({ 
        show: true, 
        type: 'success', 
        title: lang === 'bn' ? 'সফল' : 'Success', 
        message: lang === 'bn' ? 'কমিটির প্রোফাইল, এসএমএস ও ভয়েস ব্যালেন্স সফলভাবে আপডেট হয়েছে।' : 'Committee profile, SMS and voice balances have been updated successfully.' 
      });
      setEditPassword('');
      initData(true);
      if (onProfileUpdate) onProfileUpdate();
      setView('list');
    } catch (err: any) {
      let message = err.message;
      if (message.includes("Could not find the 'email' column")) {
        message = "Database schema mismatch: 'email' column is missing in 'institutions' table. Please run the SQL migration script in Supabase SQL Editor: \n\nALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS email TEXT;\nNOTIFY pgrst, 'reload config';";
      }
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: message });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setShowConfirm({
      show: true,
      title: "কমিটি ডিলিট নিশ্চিত করুন",
      message: `আপনি কি নিশ্চিত যে "${selectedUser.name}" কমিটিটি চিরতরে ডিলিট করতে চান? এটি আর ফিরিয়ে আনা যাবে না এবং এর সকল ডাটা মুছে যাবে।`,
      onConfirm: async () => {
        setIsDeletingUser(true);
        try {
          const { data: success, error } = await supabase.rpc(
            "delete_user_by_admin",
            {
              p_user_id: selectedUser.id,
            },
          );

          if (error) throw error;
          if (!success) throw new Error("User deletion failed via RPC");

          setStatusModal({
            show: true,
            type: "success",
            title: "সফল",
            message: "কমিটিটি সফলভাবে ডিলিট হয়েছে",
          });
          setView('list');
          setSelectedUser(null);
          initData();
        } catch (err: any) {
          console.error("Error removing institution:", err);
          setStatusModal({
            show: true,
            type: "error",
            title: "ত্রুটি",
            message: "কমিটি ডিলিট করতে সমস্যা হয়েছে",
          });
        } finally {
          setIsDeletingUser(false);
        }
      },
    });
  };

  const isSubscriptionTransaction = (tr: Transaction) => {
    const desc = (tr.description || '').toLowerCase();
    return (
      tr.module === 'subscription' ||
      desc.includes('subscription') ||
      String(tr.transaction_id || '').toUpperCase().startsWith('SUB_')
    );
  };

  const approveTransaction = async (tr: Transaction) => {
    const isSub = isSubscriptionTransaction(tr);
    const isVoice = !isSub && (tr.description || '').toLowerCase().includes('voice');
    const sms = Number(smsToCredit[tr.id]);
    
    if (!isSub && !isVoice && (!sms || sms <= 0)) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'সঠিক SMS সংখ্যা লিখুন' });
      return;
    }
    
    setApprovingIds(prev => new Set(prev).add(tr.id));
    try {
      if (isSub) {
        const { error: updateError } = await supabase.from('transactions').update({ status: 'approved' }).eq('id', tr.id);
        if (updateError) throw updateError;

        const { data: instData, error: instError } = await supabase
          .from('institutions')
          .select('id, config_json, subscription_end, status, is_active')
          .eq('id', tr.institution_id)
          .single();
        if (instError) throw instError;

        let currentCfg: any = instData?.config_json || {};
        if (typeof currentCfg === 'string') {
          try { currentCfg = JSON.parse(currentCfg); } catch { currentCfg = {}; }
        }
        const existingPaid: string[] = Array.isArray(currentCfg?.paid_months) ? currentCfg.paid_months : [];
        const fallbackMonths = (tr.description || '').match(/\b\d{4}-\d{2}\b/g) || [];
        const newMonths: string[] = Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0
          ? tr.metadata.months
          : fallbackMonths;
        const mergedPaidMonths = Array.from(new Set([...existingPaid, ...newMonths])).sort();

        const pkgMatch = (tr.description || '').match(/Subscription Payment \(([^)]+)\)/i);
        const resolvedPackageName = tr.metadata?.package_name || (pkgMatch ? pkgMatch[1] : undefined);

        // Advance subscription_end based on latest paid month if applicable
        let nextSubEnd = instData?.subscription_end || null;
        if (mergedPaidMonths.length > 0) {
          const latestYm = mergedPaidMonths[mergedPaidMonths.length - 1];
          const [yrStr, moStr] = latestYm.split('-');
          const yr = Number(yrStr);
          const mo = Number(moStr);
          if (yr && mo) {
            const lastDay = new Date(yr, mo, 0).toISOString().split('T')[0];
            if (!nextSubEnd || lastDay > nextSubEnd) {
              nextSubEnd = lastDay;
            }
          }
        }

        const updatedCfg = {
          ...currentCfg,
          paid_months: mergedPaidMonths,
          ...(resolvedPackageName ? { package_name: resolvedPackageName } : {})
        };

        const { error: instUpdateErr } = await supabase
          .from('institutions')
          .update({
            config_json: updatedCfg,
            subscription_end: nextSubEnd,
            status: 'active',
            is_active: true
          })
          .eq('id', tr.institution_id);
        if (instUpdateErr) throw instUpdateErr;
      } else if (isVoice) {
        // ১. ডাটাবেসে পেমেন্ট অনুমোদন করা (Manual update for Voice)
        const { error: updateError } = await supabase.from('transactions').update({ status: 'approved' }).eq('id', tr.id);
        if (updateError) throw updateError;
        
        const { data: instData, error: instError } = await supabase.from('institutions').select('balance').eq('id', tr.institution_id).single();
        if (instError) throw instError;
        
        const newBalance = (instData.balance || 0) + tr.amount;
        const { error: balanceError } = await supabase.from('institutions').update({ balance: newBalance }).eq('id', tr.institution_id);
        if (balanceError) throw balanceError;
      } else {
        // ১. ডাটাবেসে পেমেন্ট অনুমোদন করা (RPC handles transactions, madrasahs balance and admin stock)
        const { data, error } = await supabase.rpc('approve_payment_with_sms', { 
          t_id: tr.id, 
          m_id: tr.institution_id, 
          sms_to_give: sms 
        });
        
        if (error) throw error;

        // RPC রেসপন্স চেক করা (Database level error capture)
        const res = data as { success: boolean, error?: string };
        if (res && res.success === false) {
          throw new Error(res.error || "Approval failed on server");
        }
      }
      
      // ২. ইউজারকে কনফার্মেশন SMS পাঠানো (যদি টগল চালু থাকে)
      const isSmsEnabled = smsEnabledMap[tr.id] !== false;
      if (isSmsEnabled) {
        const userPhone = tr.institutions?.phone || tr.sender_phone;
        if (userPhone) {
          const msg = isSub
            ? `আস-সালামু আলাইকুম, আপনার সাবস্ক্রিপশন পেমেন্ট (${tr.amount} ৳) অনুমোদিত হয়েছে। ধন্যবাদ।`
            : isVoice
              ? `আস-সালামু আলাইকুম, আপনার পেমেন্ট অনুমোদিত হয়েছে। আপনার অ্যাকাউন্টে ${tr.amount} ৳ ভয়েস ব্যালেন্স যোগ করা হয়েছে। ধন্যবাদ।`
              : `আস-সালামু আলাইকুম, আপনার পেমেন্ট অনুমোদিত হয়েছে। আপনার অ্যাকাউন্টে ${sms} টি SMS যোগ করা হয়েছে। ধন্যবাদ।`;
          // Fire and forget SMS to avoid blocking UI
          smsApi.sendDirect(userPhone, msg).catch(err => console.error("SMS Send Error:", err));
        }
      }

      // ৩. লোকাল স্টেট আপডেট করা (সফল হলে সাথে সাথে লিস্ট থেকে সরিয়ে দেয়া)
      setPendingTrans(prev => prev.filter(p => p.id !== tr.id));
      
      setStatusModal({ 
        show: true, 
        type: 'success', 
        title: 'সফল', 
        message: isSub
          ? 'সাবস্ক্রিপশন পেমেন্ট অনুমোদিত ও আপডেট হয়েছে।'
          : isSmsEnabled
            ? 'রিচার্জ সফল হয়েছে এবং ইউজারকে SMS পাঠানো হয়েছে।'
            : 'রিচার্জ সফল হয়েছে (SMS পাঠানো হয়নি)।' 
      });
      
      // ব্যাকগ্রাউন্ডে ডাটা রিফ্রেশ করা
      initData(true);
    } catch (err: any) {
      console.error("Approve Error:", err);
      // Detailed error reporting for debugging
      const errorMessage = err.message || "অজানা ত্রুটি দেখা দিয়েছে।";
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: errorMessage });
    } finally {
      setApprovingIds(prev => {
        const next = new Set(prev);
        next.delete(tr.id);
        return next;
      });
    }
  };

  const rejectTransaction = async () => {
    if (!rejectConfirm) return;
    setIsRejecting(true);
    try {
      const { error } = await supabase.from('transactions').update({ status: 'rejected' }).eq('id', rejectConfirm.id);
      if (error) throw error;
      
      const userPhone = rejectConfirm.institutions?.phone || rejectConfirm.sender_phone;
      if (userPhone) {
        const msg = `দুঃখিত, আপনার পেমেন্ট রিকোয়েস্টটি (${rejectConfirm.amount} ৳) বাতিল করা হয়েছে। বিস্তারিত জানতে যোগাযোগ করুন।`;
        smsApi.sendDirect(userPhone, msg).catch(err => console.error("SMS Send Error:", err));
      }

      setPendingTrans(prev => prev.filter(p => p.id !== rejectConfirm.id));
      setRejectConfirm(null);
      setStatusModal({ show: true, type: 'success', title: 'বাতিল', message: 'পেমেন্ট রিকোয়েস্ট বাতিল করা হয়েছে' });
      initData(true);
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message });
    } finally {
      setIsRejecting(false);
    }
  };

  const toggleSmsForRequest = (id: string) => {
    setSmsEnabledMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateInstitution = async () => {
    if (!newInstName.trim() || !newInstPhone.trim() || !newInstEmail.trim() || !newInstPassword.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'নাম, ফোন, ইমেইল এবং পাসওয়ার্ড আবশ্যক' });
      return;
    }
    
    setIsCreatingInst(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let isSuccess = false;
      let apiErrorMessage = '';

      // 1. Try serverless endpoint /api/admin/create-committee
      try {
        const response = await fetch('/api/admin/create-committee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newInstEmail.trim(),
            password: newInstPassword.trim(),
            name: newInstName.trim(),
            phone: newInstPhone.trim(),
            login_code: newInstLoginCode.trim(),
            type: newInstType,
            auth_token: session?.access_token,
            songho_activities: newInstSonghoActivities
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const resData = await response.json();
          if (response.ok && resData.success) {
            isSuccess = true;
          } else {
            apiErrorMessage = resData.error || 'Failed to create committee';
          }
        } else {
          console.warn('API returned non-JSON response status:', response.status);
        }
      } catch (apiErr: any) {
        console.warn('API request failed, trying Supabase RPC fallback:', apiErr);
      }

      // 2. Direct Supabase RPC Fallback if API was unavailable
      if (!isSuccess) {
        const defaultMods = ACCOUNT_TYPE_DEFAULT_MODULES[newInstType || 'committee'] || ACCOUNT_TYPE_DEFAULT_MODULES.committee;
        const default_config: Record<string, any> = {
          modules: defaultMods,
          org_type: newInstType || 'committee',
          attendance_type: 'meeting',
          fee_structure: 'monthly',
          ui_mode: 'committee',
          ...((newInstType === 'sangha' || newInstType === 'union') ? {
            songho_activities: (Array.isArray(newInstSonghoActivities) && newInstSonghoActivities.length > 0)
              ? newInstSonghoActivities
              : ['islamic', 'youth', 'social', 'welfare']
          } : {})
        };

        let createdUserId: string | null = null;

        // Try RPC create_user_by_admin
        try {
          const { data: rpcUserId, error: rpcError } = await supabase.rpc('create_user_by_admin', {
            p_email: newInstEmail.trim(),
            p_password: newInstPassword.trim(),
            p_user_data: { name: newInstName.trim(), madrasah_name: newInstName.trim() }
          });
          if (!rpcError && rpcUserId) {
            createdUserId = rpcUserId;
          }
        } catch (rpcErr) {
          console.warn('RPC create_user_by_admin failed, attempting isolated signup:', rpcErr);
        }

        // 3. Isolated client signup fallback
        if (!createdUserId) {
          try {
            const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
            const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
            if (supabaseUrl && supabaseAnonKey) {
              const isolatedAuth = createClient(supabaseUrl, supabaseAnonKey, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
              });
              const { data: signUpData, error: signUpErr } = await isolatedAuth.auth.signUp({
                email: newInstEmail.trim(),
                password: newInstPassword.trim(),
                options: {
                  data: {
                    name: newInstName.trim(),
                    madrasah_name: newInstName.trim()
                  }
                }
              });
              if (!signUpErr && signUpData?.user?.id) {
                createdUserId = signUpData.user.id;
              } else if (signUpErr) {
                console.warn('Isolated signup failed:', signUpErr);
                apiErrorMessage = signUpErr.message;
              }
            }
          } catch (signUpException: any) {
            console.warn('Signup exception:', signUpException);
          }
        }

        if (createdUserId) {
          await supabase.from('institutions').upsert({
            id: createdUserId,
            name: newInstName.trim(),
            email: newInstEmail.trim(),
            phone: newInstPhone.trim(),
            institution_type: newInstType || 'committee',
            login_code: newInstLoginCode.trim() || null,
            is_active: true,
            is_super_admin: false,
            balance: 0,
            sms_balance: 0,
            status: 'active',
            config_json: default_config
          });

          await supabase.from('profiles').upsert({
            id: createdUserId,
            institution_id: createdUserId,
            full_name: newInstName.trim(),
            role: 'org_admin',
            is_active: true
          });

          isSuccess = true;
        }
      }

      if (isSuccess) {
        setStatusModal({ show: true, type: 'success', title: 'সফল', message: 'নতুন কমিটি এবং ইউজার সফলভাবে তৈরি করা হয়েছে।' });
        setShowCreateModal(false);
        setNewInstName('');
        setNewInstPhone('');
        setNewInstEmail('');
        setNewInstPassword('');
        setNewInstLoginCode('');
        initData(true);
      } else {
        throw new Error(apiErrorMessage || 'Failed to create committee');
      }
    } catch (err: any) {
      console.error("Create Error:", err);
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ', message: err.message || 'কমিটি তৈরি করা যায়নি' });
    } finally {
      setIsCreatingInst(false);
    }
  };

  const filtered = useMemo(() => madrasahs.filter(m => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (m.name || '').toLowerCase().includes(query) || (m.login_code && m.login_code.toLowerCase().includes(query));
    const matchesType = filterType === 'all' || (m.institution_type || 'committee') === filterType;
    return matchesSearch && matchesType;
  }), [madrasahs, searchQuery, filterType]);

  const isTransactionMatchingDate = (dateStr: string, filter: 'all' | 'today' | 'week' | 'month') => {
    if (filter === 'all') return true;
    const date = new Date(dateStr);
    const now = new Date();
    if (filter === 'today') {
      return date.toDateString() === now.toDateString();
    }
    if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return date >= oneWeekAgo;
    }
    if (filter === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const matchesPaymentSearch = (tr: Transaction, query: string) => {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const instName = (tr.institutions?.name || '').toLowerCase();
    const trxId = (tr.transaction_id || '').toLowerCase();
    const phone = (tr.sender_phone || '').toLowerCase();
    const amount = String(tr.amount || '');
    return instName.includes(q) || trxId.includes(q) || phone.includes(q) || amount.includes(q);
  };

  const filteredPending = useMemo(() => {
    if (paymentStatusFilter === 'approved' || paymentStatusFilter === 'rejected') return [];
    return pendingTrans.filter(tr => {
      const desc = (tr.description || '').toLowerCase();
      const isSub = isSubscriptionTransaction(tr);
      const isVoice = !isSub && desc.includes('voice');
      const matchesTab =
        paymentTab === 'subscription'
          ? isSub
          : paymentTab === 'voice'
            ? isVoice
            : !isSub && !isVoice;
      const matchesSearch = matchesPaymentSearch(tr, paymentSearch);
      const matchesDate = isTransactionMatchingDate(tr.created_at, paymentDateFilter);
      return matchesTab && matchesSearch && matchesDate;
    });
  }, [pendingTrans, paymentTab, paymentSearch, paymentDateFilter, paymentStatusFilter]);

  const filteredHistory = useMemo(() => {
    if (paymentStatusFilter === 'pending') return [];
    return transactionHistory.filter(tr => {
      const desc = (tr.description || '').toLowerCase();
      const isSub = isSubscriptionTransaction(tr);
      const isVoice = !isSub && desc.includes('voice');
      const matchesTab =
        paymentTab === 'subscription'
          ? isSub
          : paymentTab === 'voice'
            ? isVoice
            : !isSub && !isVoice;
      const matchesStatus = paymentStatusFilter === 'all' || tr.status === paymentStatusFilter;
      const matchesSearch = matchesPaymentSearch(tr, paymentSearch);
      const matchesDate = isTransactionMatchingDate(tr.created_at, paymentDateFilter);
      return matchesTab && matchesStatus && matchesSearch && matchesDate;
    });
  }, [transactionHistory, paymentTab, paymentStatusFilter, paymentSearch, paymentDateFilter]);

  return (
    <div className={`space-y-6 pb-20 animate-in fade-in relative ${madrasah?.theme === 'dark' ? 'text-white' : ''}`}>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Loading System Data...</p>
        </div>
      ) : (
        <>
          {view === 'dashboard' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-5">
              <div className="flex items-center justify-between px-2">
                <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>
                  {lang === 'bn' ? 'সিস্টেম ড্যাশবোর্ড' : 'System Dashboard'}
                </h1>
                <button onClick={() => initData()} className={`p-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#0fb5ab] border-slate-700' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20'} rounded-xl active:scale-95 transition-all border shadow-sm`}>
                   <RefreshCw size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/20 text-[#0fb5ab]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <Users2 size={20} className="shrink-0" />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.totalInstitutions}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{lang === 'bn' ? 'মোট পোর্টাল' : 'Total Portals'}</p>
                </div>
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 ${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-500'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <Activity size={20} className="shrink-0" />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.activeInstitutions}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{lang === 'bn' ? 'সচল পোর্টাল' : 'Active Portals'}</p>
                </div>
                <div onClick={() => setView('approvals')} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none hover:border-yellow-900' : 'bg-white border-slate-100 shadow-bubble hover:border-yellow-200'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center cursor-pointer transition-all active:scale-95`}>
                  <div className={`w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 ${madrasah?.theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-50 text-yellow-500'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <CreditCard size={20} className="shrink-0" />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.pendingApprovals}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{lang === 'bn' ? 'পেন্ডিং রিকোয়েস্ট' : 'Pending Approvals'}</p>
                </div>
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-5 rounded-[2.2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 ${madrasah?.theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-50 text-purple-500'} rounded-2xl flex items-center justify-center mb-2 shadow-inner`}>
                    <Banknote size={20} className="shrink-0" />
                  </div>
                  <h4 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.totalRevenue.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h4>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{lang === 'bn' ? 'মোট আয় (৳)' : 'Total Revenue (৳)'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-4 rounded-[2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-8 h-8 min-w-[32px] min-h-[32px] shrink-0 ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/20 text-[#0fb5ab]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'} rounded-xl flex items-center justify-center mb-1 shadow-inner`}>
                    <GraduationCap size={16} className="shrink-0" />
                  </div>
                  <h4 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.totalStudents.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h4>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সদস্য' : 'Members'}</p>
                </div>
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-4 rounded-[2rem] border flex flex-col items-center text-center`}>
                  <div className={`w-8 h-8 min-w-[32px] min-h-[32px] shrink-0 ${madrasah?.theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-50 text-orange-500'} rounded-xl flex items-center justify-center mb-1 shadow-inner`}>
                    <Layers size={16} className="shrink-0" />
                  </div>
                  <h4 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.totalClasses.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h4>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কমিটি' : 'Committees'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                      {lang === 'bn' ? 'এসএমএস ইনভেন্টরি' : 'SMS Inventory'}
                    </h3>
                    <Zap size={24} className={madrasah?.theme === 'dark' ? 'text-[#0fb5ab]' : 'text-[#0fb5ab]'} fill="currentColor" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{lang === 'bn' ? 'বিতরণকৃত SMS' : 'Distributed SMS'}</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.totalDistributedSMS.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h5>
                    </div>
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{lang === 'bn' ? 'ব্যবহৃত SMS' : 'Sent SMS'}</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-500'}`}>{globalStats.totalSentSMS.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h5>
                    </div>
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{lang === 'bn' ? 'ইউজার ওয়ালেট (মোট SMS)' : 'User Wallets (Total SMS)'}</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-purple-400' : 'text-[#8D30F4]'}`}>{globalStats.currentInUserWallets.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h5>
                    </div>
                    <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl border`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{lang === 'bn' ? 'সিস্টেম স্টক (অবশিষ্ট SMS)' : 'System Stock (Available SMS)'}</p>
                      <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`}>{globalStats.adminSMSStock.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h5>
                    </div>
                  </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                      {lang === 'bn' ? 'সিস্টেম তথ্য' : 'System Info'}
                    </h3>
                    <AlertCircle size={24} className="text-slate-300" />
                  </div>
                  <div className="flex flex-col justify-center h-full pb-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                      {lang === 'bn' ? 'মোট প্রতিষ্ঠান' : 'Total Institutions'}
                    </p>
                    <h5 className={`text-4xl font-black text-center ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{globalStats.totalInstitutions.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</h5>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                      {lang === 'bn' ? 'সিস্টেম বিভাজন' : 'System Breakdown'}
                    </h3>
                    <PieChart size={24} className="text-slate-300" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(globalStats?.typeBreakdown || {}).map(([type, count]) => (
                      <div key={type} className={`p-4 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} border flex items-center justify-between`}>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{type}</span>
                        <span className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                      {lang === 'bn' ? 'সাম্প্রতিক পোর্টাল' : 'Recent Portals'}
                    </h3>
                    <Building2 size={24} className="text-slate-300" />
                  </div>
                  <div className="space-y-3">
                    {recentInstitutions.map(inst => (
                      <div key={inst.id} className={`flex items-center justify-between p-4 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} border`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/20 text-[#0fb5ab]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'}`}>
                            <Building2 size={18} />
                          </div>
                          <div>
                            <p className={`text-xs font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{inst.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{inst.institution_type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-slate-400">{new Date(inst.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} p-8 rounded-[3rem] border space-y-6`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                    {lang === 'bn' ? 'সাম্প্রতিক লেনদেন' : 'Recent Transactions'}
                  </h3>
                  <HistoryIcon size={24} className="text-slate-300" />
                </div>
                <div className="space-y-3">
                  {transactionHistory.slice(0, 5).map(tr => (
                    <div key={tr.id} className={`flex items-center justify-between p-4 rounded-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} border`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tr.status === 'approved' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                          {tr.status === 'approved' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        </div>
                        <div>
                          <p className={`text-xs font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>{tr.institutions?.name || 'Unknown'}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{tr.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'}`}>৳ {tr.amount}</p>
                        <p className="text-[8px] font-bold text-slate-400">{new Date(tr.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</p>
                      </div>
                    </div>
                  ))}
                  {transactionHistory.length === 0 && (
                    <p className="text-center py-10 text-slate-400 text-xs font-bold italic">{lang === 'bn' ? 'কোন লেনদেন পাওয়া যায়নি' : 'No transactions found'}</p>
                  )}
                </div>
                <button onClick={() => setView('approvals')} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-[#0fb5ab] hover:bg-[#42f5e9]/10 rounded-2xl transition-colors">
                  {lang === 'bn' ? 'সকল লেনদেন দেখুন' : 'View All Transactions'}
                </button>
              </div>
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                  {lang === 'bn' ? 'কমিটি লিস্ট' : 'Committee Registry'}
                </h1>
                <button 
                  onClick={() => setShowCreateModal(true)} 
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-premium active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-[#42f5e9] text-[#0e8a84]' : 'bg-[#42f5e9] text-[#0e8a84] hover:opacity-90'}`}
                >
                  <PlusCircle size={18} strokeWidth={2.5} />
                  <span>{lang === 'bn' ? 'নতুন কমিটি' : 'New Committee'}</span>
                </button>
              </div>

              <div className="flex gap-2 px-1">
                <div className="relative group flex-1">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input type="text" placeholder="Search name or code..." className={`w-full h-14 pl-14 pr-14 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'} border rounded-[2rem] outline-none font-bold shadow-bubble`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <select 
                  className={`h-14 px-4 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'} border rounded-[2rem] outline-none font-bold shadow-bubble text-[10px] w-32`}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                >
                  <option value="all">{lang === 'bn' ? 'সকল ধরণ' : 'All Types'}</option>
                  {DISPLAY_COMMITTEE_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.labelEn}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.length > 0 ? filtered.map(m => (
                  <div key={m.id} onClick={() => handleUserClick(m)} className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none hover:border-[#0fb5ab]/50' : 'bg-white border-slate-100 shadow-bubble hover:border-[#42f5e9]/30'} p-5 rounded-[2.2rem] border active:scale-[0.98] transition-all cursor-pointer`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-14 h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} rounded-2xl flex items-center justify-center text-slate-300 border shadow-inner shrink-0 overflow-hidden`}>
                          {m.logo_url ? <img src={m.logo_url} className="w-full h-full object-contain" /> : <UserIcon size={24} />}
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} truncate font-noto text-lg`}>{m.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <p className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {m.is_active ? (lang === 'bn' ? 'সচল' : 'Active') : (lang === 'bn' ? 'বন্ধ' : 'Blocked')}
                            </p>
                            <p className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-[#42f5e9]/10 text-[#0fb5ab]">
                              {m.institution_type || 'committee'}
                            </p>
                            <p className="text-[8px] font-black px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/50 flex items-center gap-1">
                              <MessageSquare size={10} /> {m.sms_balance || 0} SMS
                            </p>
                            <p className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-1">
                              <PhoneCall size={10} /> ৳{Number(m.balance || 0).toFixed(1)}
                            </p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.phone || (lang === 'bn' ? 'ফোন নেই' : 'No Phone')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className={`text-center py-20 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} rounded-[2.5rem] border-2 border-dashed`}>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{lang === 'bn' ? 'কোনো কমিটি পাওয়া যায়নি' : 'No Committees Found'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'approvals' && (
            <div className="space-y-8 px-1">
              <div className="flex items-center justify-between px-2">
                <div>
                  <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                    {lang === 'bn' ? 'পেমেন্ট ম্যানেজমেন্ট' : 'Payment Management'}
                  </h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    {lang === 'bn' ? 'অনুমোদন ও রিচার্জ রিকোয়েস্ট' : 'Recharge Approvals & History'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowPaymentFilter(prev => !prev)} 
                    className={`p-2.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 shadow-sm relative ${
                      showPaymentFilter || paymentSearch || paymentStatusFilter !== 'all' || paymentDateFilter !== 'all'
                        ? 'bg-[#42f5e9] text-[#0e8a84] border-[#0fb5ab]'
                        : madrasah?.theme === 'dark'
                          ? 'bg-slate-800 text-[#0fb5ab] border-slate-700'
                          : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20'
                    }`}
                    title={lang === 'bn' ? 'ফিল্টার' : 'Filter'}
                  >
                    <Filter size={18} />
                    {(paymentSearch || paymentStatusFilter !== 'all' || paymentDateFilter !== 'all') && (
                      <span className="w-2 h-2 rounded-full bg-[#0e8a84] absolute top-1 right-1" />
                    )}
                  </button>
                  <button 
                    onClick={() => initData()} 
                    className={`p-2.5 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#0fb5ab] border-slate-700' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20'} rounded-xl active:scale-95 transition-all border shadow-sm`}
                    title={lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
                  >
                     <RefreshCw size={18} />
                  </button>
                </div>
              </div>

              {/* Collapsible Payment Filter UI */}
              {showPaymentFilter && (
                <div className={`p-5 rounded-[2rem] border animate-in slide-in-from-top-3 space-y-4 shadow-sm ${
                  madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Filter size={16} className="text-[#0fb5ab]" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                        {lang === 'bn' ? 'পেমেন্ট ফিল্টার' : 'Payment Filter'}
                      </span>
                    </div>
                    {(paymentSearch || paymentStatusFilter !== 'all' || paymentDateFilter !== 'all') && (
                      <button 
                        onClick={() => {
                          setPaymentSearch('');
                          setPaymentStatusFilter('all');
                          setPaymentDateFilter('all');
                        }}
                        className="text-[10px] font-black text-rose-500 hover:underline uppercase tracking-wider flex items-center gap-1"
                      >
                        <X size={12} /> {lang === 'bn' ? 'ফিল্টার রিসেট' : 'Reset Filter'}
                      </button>
                    )}
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder={lang === 'bn' ? 'TrxID, কমিটি নাম বা ফোন দিয়ে খুঁজুন...' : 'Search by TrxID, Committee, or Phone...'}
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                      className={`w-full h-11 pl-11 pr-4 rounded-xl text-xs font-bold outline-none border transition-all ${
                        madrasah?.theme === 'dark'
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-[#42f5e9]'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0fb5ab]'
                      }`}
                    />
                    {paymentSearch && (
                      <button onClick={() => setPaymentSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status Pills */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {lang === 'bn' ? 'স্ট্যাটাস ফিল্টার' : 'Status Filter'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'all', labelBn: 'সকল রিকোয়েস্ট', labelEn: 'All Requests' },
                        { id: 'pending', labelBn: 'পেন্ডিং', labelEn: 'Pending' },
                        { id: 'approved', labelBn: 'অনুমোদিত', labelEn: 'Approved' },
                        { id: 'rejected', labelBn: 'বাতিলকৃত', labelEn: 'Rejected' },
                      ].map(st => (
                        <button
                          key={st.id}
                          onClick={() => setPaymentStatusFilter(st.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                            paymentStatusFilter === st.id
                              ? 'bg-[#0fb5ab] text-white shadow-sm'
                              : madrasah?.theme === 'dark'
                                ? 'bg-slate-800 text-slate-400 hover:text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {lang === 'bn' ? st.labelBn : st.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Filter */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {lang === 'bn' ? 'সময়কাল' : 'Date Period'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'all', labelBn: 'সকল সময়', labelEn: 'All Time' },
                        { id: 'today', labelBn: 'আজকের', labelEn: 'Today' },
                        { id: 'week', labelBn: 'এই সপ্তাহ', labelEn: 'This Week' },
                        { id: 'month', labelBn: 'এই মাস', labelEn: 'This Month' },
                      ].map(df => (
                        <button
                          key={df.id}
                          onClick={() => setPaymentDateFilter(df.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                            paymentDateFilter === df.id
                              ? 'bg-[#0fb5ab] text-white shadow-sm'
                              : madrasah?.theme === 'dark'
                                ? 'bg-slate-800 text-slate-400 hover:text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {lang === 'bn' ? df.labelBn : df.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className={`flex ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'} p-1 rounded-2xl gap-1`}>
                <button 
                  onClick={() => setPaymentTab('sms')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentTab === 'sms' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#0fb5ab] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
                >
                  {lang === 'bn' ? 'এসএমএস রিচার্জ' : 'SMS Recharge'}
                </button>
                <button 
                  onClick={() => setPaymentTab('voice')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentTab === 'voice' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#0fb5ab] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
                >
                  {lang === 'bn' ? 'ভয়েস রিচার্জ' : 'Voice Recharge'}
                </button>
                <button 
                  onClick={() => setPaymentTab('subscription')}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${paymentTab === 'subscription' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#0fb5ab] shadow-sm' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
                >
                  {lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}
                </button>
              </div>
              
              {/* Pending Requests Section - only show if filter includes pending */}
              {(paymentStatusFilter === 'all' || paymentStatusFilter === 'pending') && (
                <div className="space-y-6">
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                     <AlertCircle size={14} className="text-amber-400" /> {lang === 'bn' ? 'অপেক্ষমাণ পেমেন্ট অনুরোধ' : 'Pending Requests'}
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredPending.length > 0 ? filteredPending.map(tr => (
                      <div key={tr.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-bubble space-y-4 animate-in slide-in-from-left-4">
                        <div className="flex items-center justify-between">
                          <div className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[16px] font-black border border-emerald-100">{tr.amount} ৳</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5">
                             <Clock size={12} /> {new Date(tr.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                          </div>
                        </div>
                        <div className="px-1 space-y-1">
                          <p className="text-[15px] font-black text-[#0fb5ab] font-noto">{tr.institutions?.name}</p>
                          <div className="flex flex-col gap-0.5">
                             <p className="text-[10px] font-bold text-slate-400">TrxID: <span className="text-[#0fb5ab]">{tr.transaction_id}</span></p>
                             <p className="text-[11px] font-black text-[#0fb5ab] flex items-center gap-1.5">
                                 <Smartphone size={12} className="text-[#0fb5ab]" /> 
                                 {lang === 'bn' ? 'প্রেরক নম্বর:' : 'Sender Number:'} <span className="text-slate-800">{tr.sender_phone || 'N/A'}</span>
                             </p>
                             {isSubscriptionTransaction(tr) && (
                               <p className="text-[10px] font-bold text-indigo-600 mt-1">
                                 {tr.metadata?.package_name ? `${tr.metadata.package_name} • ` : ''}
                                 {Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0
                                   ? tr.metadata.months.join(', ')
                                   : tr.description}
                               </p>
                             )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-2">
                             <MessageSquare size={16} className={smsEnabledMap[tr.id] ? "text-[#0fb5ab]" : "text-slate-300"} />
                             <span className="text-[10px] font-black text-slate-500 uppercase">{lang === 'bn' ? 'অ্যাপ্রুভ হলে SMS পাঠান' : 'Send SMS on Approval'}</span>
                          </div>
                          <button onClick={() => toggleSmsForRequest(tr.id)} className="transition-all active:scale-90">
                             {smsEnabledMap[tr.id] ? (
                               <ToggleRight className="text-[#0fb5ab]" size={28} />
                             ) : (
                               <ToggleLeft className="text-slate-300" size={28} />
                             )}
                          </button>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-2.5">
                            {paymentTab === 'sms' && (
                              <input 
                                type="number" 
                                disabled={approvingIds.has(tr.id)}
                                className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-black text-base text-center outline-none focus:border-[#42f5e9]/50 disabled:opacity-50" 
                                value={smsToCredit[tr.id] || ''} 
                                onChange={(e) => setSmsToCredit({...smsToCredit, [tr.id]: e.target.value})} 
                                placeholder={lang === 'bn' ? 'এসএমএস সংখ্যা' : 'SMS Quantity'} 
                              />
                            )}
                            <button 
                              onClick={() => approveTransaction(tr)} 
                              disabled={approvingIds.has(tr.id) || (paymentTab === 'sms' && !smsToCredit[tr.id])}
                              className="w-full h-14 bg-[#42f5e9] text-[#0e8a84] font-black rounded-[1.5rem] text-sm active:scale-95 transition-all shadow-premium disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center"
                            >
                              {approvingIds.has(tr.id) ? <Loader2 className="animate-spin" size={20} /> : (lang === 'bn' ? 'অনুমোদন দিন' : 'Approve')}
                            </button>
                          </div>
                          <button 
                            onClick={() => setRejectConfirm(tr)} 
                            disabled={approvingIds.has(tr.id)}
                            className="w-full h-12 bg-red-50 text-red-500 font-black rounded-[1.5rem] text-xs active:scale-95 transition-all border border-red-100 disabled:opacity-50"
                          >
                            {lang === 'bn' ? 'রিকোয়েস্ট বাতিল করুন' : 'Reject Request'}
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-10 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{lang === 'bn' ? 'কোনো অপেক্ষমাণ অনুরোধ নেই' : 'No Pending Requests'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Transactions Section - only show if filter is not exclusively pending */}
              {paymentStatusFilter !== 'pending' && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                     <HistoryIcon size={14} className="text-[#0fb5ab]" /> {lang === 'bn' ? 'সাম্প্রতিক লেনদেন ইতিহাস' : 'Recent Transactions'}
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredHistory.length > 0 ? filteredHistory.map(tr => (
                      <div key={tr.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-bubble flex items-center justify-between">
                         <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                               <p className="text-[15px] font-black text-[#0fb5ab] leading-none">{tr.amount} ৳</p>
                               <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${tr.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                  {tr.status}
                               </span>
                            </div>
                            <p className="text-[12px] font-black text-[#0fb5ab] font-noto truncate">{tr.institutions?.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                               <Smartphone size={10} /> {isSubscriptionTransaction(tr) ? (tr.metadata?.payment_method || (lang === 'bn' ? 'প্রেরক:' : 'Sender:')) : (lang === 'bn' ? 'বিকাশ:' : 'bKash:')} {tr.sender_phone || 'N/A'}
                               {Number(tr.sms_count) > 0 && <span className="text-[#0fb5ab] font-black">({tr.sms_count} SMS)</span>}
                            </p>
                            {isSubscriptionTransaction(tr) && (
                              <p className="text-[9px] font-bold text-indigo-500 mt-0.5 truncate">
                                {tr.metadata?.package_name ? `${tr.metadata.package_name} • ` : ''}
                                {Array.isArray(tr.metadata?.months) && tr.metadata.months.length > 0
                                  ? tr.metadata.months.join(', ')
                                  : tr.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 text-slate-400">
                               <Clock size={10} />
                               <p className="text-[9px] font-bold">{new Date(tr.created_at).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</p>
                            </div>
                         </div>
                         <div className="text-right ml-4">
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">TrxID</p>
                            <p className="text-[10px] font-black text-[#0fb5ab] uppercase leading-tight">{tr.transaction_id}</p>
                         </div>
                      </div>
                    )) : (
                      <div className="text-center py-10 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                         <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{lang === 'bn' ? 'কোনো লেনদেনের ইতিহাস পাওয়া যায়নি' : 'No History Found'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'details' && selectedUser && (() => {
             const isDark = madrasah?.theme === 'dark';
             const activeTypeMeta = DISPLAY_COMMITTEE_TYPES.find(t => t.id === editInstitutionType);
             const effectiveRate = editCustomSubscriptionFee !== '' ? Number(editCustomSubscriptionFee) : Number(editPackageRate || 0);
             const calculatedTotal = Math.max(0, (effectiveRate * selectedMonthsForPayment.length) - Number(editDiscount || 0));
             const displayTotal = overrideTotal !== '' ? Math.max(0, Number(overrideTotal)) : calculatedTotal;
             const trialExpiryDate = new Date(new Date(selectedUser.created_at).getTime() + 3 * 24 * 60 * 60 * 1000);
             const activeModuleCount = Object.values(editModules || {}).filter(Boolean).length;

             return (
              <div className="animate-in slide-in-from-right-10 duration-500 pb-20 space-y-6 pt-2">
                {/* Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-1">
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => setView('list')}
                      className={`w-12 h-12 shrink-0 ${isDark ? 'bg-slate-800 text-[#42f5e9] border-slate-700' : 'bg-[#42f5e9]/15 text-[#0fb5ab] border-[#42f5e9]/30'} rounded-2xl flex items-center justify-center active:scale-90 transition-all border shadow-sm`}
                    >
                      <ArrowLeft size={22} strokeWidth={2.5} />
                    </button>
                    <div className="min-w-0">
                      <h1 className={`text-xl md:text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} font-noto truncate leading-tight`}>
                        {lang === 'bn' ? 'কমিটির বিস্তারিত বিবরণ' : 'Committee Details'}
                      </h1>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">
                        ID: {selectedUser.id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteUser}
                    disabled={isDeletingUser}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 border transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'bg-red-900/30 border-red-800/60 text-red-400 hover:bg-red-900/50' : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100'}`}
                  >
                    {isDeletingUser ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    <span>{lang === 'bn' ? 'কমিটি ডিলিট' : 'Delete Committee'}</span>
                  </button>
                </div>

                {/* Main Container */}
                <div className={`${isDark ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} rounded-[3rem] p-6 md:p-10 border space-y-8`}>
                  {/* Horizontal Profile Header */}
                  <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 text-center md:text-left">
                    <div className={`w-28 h-28 md:w-32 md:h-32 shrink-0 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-white'} rounded-[2.5rem] flex items-center justify-center border-4 shadow-bubble overflow-hidden`}>
                      {selectedUser.logo_url ? (
                        <img src={selectedUser.logo_url} alt={selectedUser.name} className="w-full h-full object-contain" />
                      ) : (
                        <UserIcon size={46} className="text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <h2 className={`text-2xl md:text-3xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'} font-noto break-words`}>
                        {editName || selectedUser.name}
                      </h2>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border ${editActive ? (isDark ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (isDark ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-600 border-red-100')}`}>
                          <Activity size={12} />
                          {editActive ? (lang === 'bn' ? 'সচল পোর্টাল' : 'Active Portal') : (lang === 'bn' ? 'বন্ধ পোর্টাল' : 'Access Restricted')}
                        </span>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDark ? 'bg-[#42f5e9]/10 text-[#42f5e9] border-[#42f5e9]/30' : 'bg-[#42f5e9]/15 text-[#0fb5ab] border-[#0fb5ab]/20'}`}>
                          {activeTypeMeta ? (lang === 'bn' ? activeTypeMeta.label : activeTypeMeta.labelEn) : editInstitutionType}
                        </span>
                        {editPackageName && (
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-800/50' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {editPackageName} {lang === 'bn' ? 'প্ল্যান' : 'PLAN'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4-Card Stats Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl text-center border`}>
                      <h5 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                        {userStats.students}
                        {editMemberLimit > 0 && <span className="text-xs font-bold text-slate-400 ml-1">/ {editMemberLimit}</span>}
                      </h5>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 font-noto">
                        {lang === 'bn' ? 'মোট সদস্য / Members' : 'Members'}
                      </p>
                    </div>
                    <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-5 rounded-3xl text-center border`}>
                      <h5 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{userStats.departments}</h5>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 font-noto">
                        {lang === 'bn' ? 'কমিটি / শাখা' : 'Committees'}
                      </p>
                    </div>
                    <div className={`${isDark ? 'bg-[#42f5e9]/15 border-[#42f5e9]/40' : 'bg-[#42f5e9]/10 border-[#42f5e9]/30'} p-5 rounded-3xl text-center border`}>
                      <h5 className={`text-2xl font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{editSmsBalance || 0}</h5>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SMS Balance</p>
                    </div>
                    <div className={`${isDark ? 'bg-emerald-900/30 border-emerald-800/60' : 'bg-emerald-50 border-emerald-100'} p-5 rounded-3xl text-center border`}>
                      <h5 className={`text-2xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>৳ {Number(editVoiceBalance || 0).toFixed(2)}</h5>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Voice Balance</p>
                    </div>
                  </div>

                  {/* Horizontal 5-Tab Navigation Bar */}
                  <div className={`pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} space-y-6`}>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                      {[
                        { id: 'committee', labelBn: 'কমিটি তথ্য', labelEn: 'Committee Info', icon: Building2 },
                        { id: 'api', labelBn: 'এপিআই ও সিকিউরিটি', labelEn: 'API & Security', icon: Key },
                        { id: 'permissions', labelBn: 'পারমিশন', labelEn: 'Permissions', icon: Shield },
                        { id: 'subscription', labelBn: 'সাবস্ক্রিপশন', labelEn: 'Subscription', icon: CreditCard },
                        { id: 'history', labelBn: 'ইতিহাস', labelEn: 'History', icon: HistoryIcon },
                      ].map(tab => {
                        const TabIcon = tab.icon;
                        const isActiveTab = detailsTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setDetailsTab(tab.id as any);
                              if (tab.id === 'history') {
                                fetchPaymentHistory(selectedUser.id, historyFilterModule);
                              }
                            }}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                              isActiveTab
                                ? 'bg-[#0fb5ab] text-white shadow-md'
                                : isDark
                                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <TabIcon size={18} />
                            <span className="font-noto">{lang === 'bn' ? tab.labelBn : tab.labelEn}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* TAB 1: COMMITTEE INFO */}
                    {detailsTab === 'committee' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        {/* SMS & Voice Balance Quick-Adjust Box */}
                        <div className={`p-6 rounded-[2.5rem] border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-gradient-to-br from-teal-50/70 via-cyan-50/40 to-emerald-50/60 border-[#0fb5ab]/20'} space-y-6 shadow-sm`}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#0fb5ab] text-white flex items-center justify-center shadow-md">
                              <CreditCard size={20} />
                            </div>
                            <div>
                              <h4 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {lang === 'bn' ? 'ব্যালেন্স ও ওয়ালেট ম্যানেজমেন্ট' : 'SMS & Voice Balance Management'}
                              </h4>
                              <p className="text-[10px] text-slate-500 font-bold font-noto">
                                {lang === 'bn' ? 'ইউজারের অ্যাকাউন্টে সরাসরি ব্যালেন্স ও এসএমএস পরিবর্তন বা রিচার্জ করুন' : 'Directly adjust user SMS and Voice balance'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* SMS Balance Box */}
                            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-100'} shadow-sm space-y-4`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                                    <MessageSquare size={18} />
                                  </div>
                                  <span className="text-xs font-black font-noto">
                                    {lang === 'bn' ? 'এসএমএস ব্যালেন্স (সংখ্যা / কাউন্ট)' : 'SMS Balance (Count)'}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
                                  {Number(editSmsBalance) || 0} SMS
                                </span>
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={editSmsBalance}
                                  onChange={(e) => setEditSmsBalance(e.target.value)}
                                  placeholder="0"
                                  className={`w-full h-12 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-2xl px-4 font-black text-base outline-none focus:border-[#0fb5ab] transition-all`}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-noto">
                                  {lang === 'bn' ? 'টি' : 'SMS'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[10, 50, 100, 500, 1000].map((amt) => (
                                  <button
                                    type="button"
                                    key={amt}
                                    onClick={() => setEditSmsBalance(prev => String(Math.max(0, (parseInt(prev, 10) || 0) + amt)))}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-400' : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-100 text-cyan-700'}`}
                                  >
                                    +{amt}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setEditSmsBalance('0')}
                                  className="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
                                >
                                  {lang === 'bn' ? 'রিসেট ০' : 'Reset 0'}
                                </button>
                              </div>
                            </div>

                            {/* Voice Balance Box */}
                            <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-100'} shadow-sm space-y-4`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <PhoneCall size={18} />
                                  </div>
                                  <span className="text-xs font-black font-noto">
                                    {lang === 'bn' ? 'ভয়েস কল ব্যালেন্স (টাকা ৳)' : 'Voice Call Balance (BDT)'}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                  ৳{Number(editVoiceBalance || 0).toFixed(2)}
                                </span>
                              </div>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={editVoiceBalance}
                                  onChange={(e) => setEditVoiceBalance(e.target.value)}
                                  placeholder="0.00"
                                  className={`w-full h-12 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-2xl px-4 font-black text-base outline-none focus:border-[#0fb5ab] transition-all`}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-noto">৳</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[10, 50, 100, 500, 1000].map((amt) => (
                                  <button
                                    type="button"
                                    key={amt}
                                    onClick={() => setEditVoiceBalance(prev => String(Math.max(0, (parseFloat(prev) || 0) + amt)))}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 border ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100 text-emerald-700'}`}
                                  >
                                    +৳{amt}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setEditVoiceBalance('0')}
                                  className="px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
                                >
                                  {lang === 'bn' ? 'রিসেট ০' : 'Reset 0'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Basic Profile Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Committee / Org Name</label>
                            <input type="text" className={`w-full h-14 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#0fb5ab]`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gmail / Email</label>
                            <input type="email" className={`w-full h-14 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#0fb5ab]`} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Phone</label>
                            <input type="tel" className={`w-full h-14 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#0fb5ab]`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center justify-between">
                              <span>{lang === 'bn' ? 'লগইন পাসওয়ার্ড / PIN' : 'Login Password / PIN'}</span>
                              {editPassword && <span className="text-[10px] text-[#0fb5ab] font-bold">{lang === 'bn' ? '✓ আপডেট হবে' : '✓ Will update'}</span>}
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                className={`w-full h-14 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 pr-16 font-black outline-none focus:border-[#0fb5ab]`}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                placeholder="নতুন পাসওয়ার্ড দিন (পরিবর্তন করতে চাইলে)"
                              />
                              {editPassword && (
                                <button
                                  type="button"
                                  onClick={() => setEditPassword('')}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-xs font-bold px-2 py-1"
                                >
                                  {lang === 'bn' ? 'মুছুন' : 'Clear'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Login Code</label>
                            <input type="text" className={`w-full h-14 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#0fb5ab]`} value={editLoginCode} onChange={(e) => setEditLoginCode(e.target.value)} />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Address</label>
                            <textarea
                              rows={2}
                              className={`w-full ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 py-4 font-black outline-none focus:border-[#0fb5ab] resize-none`}
                              value={editAddress}
                              onChange={(e) => setEditAddress(e.target.value)}
                              placeholder="Full Address"
                            />
                          </div>
                        </div>

                        {/* Basic Config Card */}
                        <div className={`${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-6 rounded-[2.5rem] border space-y-6`}>
                          <div className="flex items-center justify-between px-1">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Sliders size={14} className={isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} /> Basic Config
                            </h4>
                            <button
                              type="button"
                              onClick={() => setEditActive(!editActive)}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl transition-all active:scale-95 ${editActive ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
                            >
                              {editActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                              <span className="text-[10px] font-black uppercase tracking-widest">{editActive ? 'Active' : 'Inactive'}</span>
                            </button>
                          </div>

                          <div className="space-y-2 max-w-sm">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Member Limit (0 for unlimited)</label>
                            <input
                              type="number"
                              min="0"
                              className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none focus:border-[#0fb5ab]`}
                              value={editMemberLimit}
                              onChange={(e) => setEditMemberLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            />
                          </div>

                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Committee Type</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                              {DISPLAY_COMMITTEE_TYPES.map(type => (
                                <button
                                  key={type.id}
                                  type="button"
                                  onClick={() => {
                                    setEditInstitutionType(type.id);
                                    const defaultMods = ACCOUNT_TYPE_DEFAULT_MODULES[type.id] || ACCOUNT_TYPE_DEFAULT_MODULES.committee;
                                    const nextMods: Record<string, boolean> = {};
                                    Object.keys(ALL_MODULE_META).forEach(k => {
                                      nextMods[k] = Boolean(defaultMods[k]);
                                    });
                                    setEditModules(nextMods);
                                  }}
                                  className={`px-3 py-2.5 rounded-xl border text-[10px] font-black transition-all ${
                                    editInstitutionType === type.id
                                      ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white shadow-md'
                                      : isDark
                                        ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                                        : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="flex flex-col items-center">
                                    <span>{type.label}</span>
                                    <span className="text-[7px] opacity-60 uppercase tracking-tighter mt-0.5">{type.labelEn}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {(editInstitutionType === 'sangha' || editInstitutionType === 'union') && (
                            <div className={`space-y-3 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-widest flex items-center gap-2">
                                  <Activity size={14} /> সংঘের কার্যক্রমসমূহ (মাল্টি-সিলেক্ট)
                                </label>
                                <span className="text-[9px] font-bold text-slate-400">{editSonghoActivities.length} টি নির্বাচিত</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {SONGHO_ACTIVITIES.map(act => {
                                  const isSel = editSonghoActivities.includes(act.id);
                                  const ActIcon = act.icon;
                                  return (
                                    <button
                                      key={act.id}
                                      type="button"
                                      onClick={() => {
                                        setEditSonghoActivities(prev =>
                                          isSel
                                            ? (prev.length > 1 ? prev.filter(x => x !== act.id) : prev)
                                            : [...prev, act.id]
                                        );
                                      }}
                                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 text-xs transition-all ${
                                        isSel
                                          ? 'bg-[#0fb5ab] text-white border-[#0fb5ab] font-black shadow-sm'
                                          : isDark
                                            ? 'bg-slate-900 border-slate-800 text-slate-400 font-medium'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 font-medium'
                                      }`}
                                    >
                                      <span className="shrink-0"><ActIcon size={14} /></span>
                                      <span className="text-[10px] font-noto truncate">{act.labelBn}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* System Settings Card */}
                        <div className={`${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-6 rounded-[2.5rem] border space-y-6`}>
                          <div className="flex items-center justify-between px-1">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Settings size={14} className={isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} /> System Settings
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Attendance Type</label>
                              <select
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none`}
                                value={editAttendanceType}
                                onChange={(e) => setEditAttendanceType(e.target.value as any)}
                              >
                                <option value="meeting">Meeting Based (মিটিং ভিত্তিক)</option>
                                <option value="daily">Daily / Program Wise (দৈনিক / প্রোগ্রাম)</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Accounting Mode</label>
                              <select
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none`}
                                value={editAccountingMode}
                                onChange={(e) => setEditAccountingMode(e.target.value as any)}
                              >
                                <option value="committee_system">Standard Committee System (স্ট্যান্ডার্ড কমিটি সিস্টেম)</option>
                                <option value="flexible">Flexible Contribution Mode (ফ্লেক্সিবল চাঁদা মোড)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: API & SECURITY */}
                    {detailsTab === 'api' && (() => {
                      const hasMaskingId = Boolean(editReveClientId.trim());
                      const effectiveType: 'masking' | 'non_masking' = hasMaskingId ? 'masking' : editSmsType;
                      const autoGlobalRate = effectiveType === 'masking' ? globalSmsRates.masking_rate : globalSmsRates.non_masking_rate;
                      const parsedCustom = parseFloat(String(editSmsRate || '').trim());
                      const activeDisplayRate = Number.isFinite(parsedCustom) && parsedCustom > 0 ? parsedCustom : autoGlobalRate;
                      return (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className={`${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <div className="flex items-center gap-2">
                              <Key size={16} className={isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} />
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">API & Security</h4>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide border ${
                              effectiveType === 'masking'
                                ? isDark
                                  ? 'bg-[#42f5e9]/15 text-[#42f5e9] border-[#42f5e9]/30'
                                  : 'bg-[#0fb5ab]/10 text-[#0e8a84] border-[#0fb5ab]/30'
                                : isDark
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {effectiveType === 'masking'
                                ? hasMaskingId
                                  ? `Masking Account (Auto • ৳${activeDisplayRate}/SMS)`
                                  : `Masking SMS (৳${activeDisplayRate}/SMS)`
                                : `Non-Masking SMS (৳${activeDisplayRate}/SMS)`}
                            </span>
                          </div>

                          {/* SMS Type Selector */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block">
                              SMS Type & Gateway Routing
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                disabled={hasMaskingId}
                                onClick={() => setEditSmsType('non_masking')}
                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                                  effectiveType === 'non_masking'
                                    ? isDark
                                      ? 'bg-[#42f5e9]/15 border-[#42f5e9] text-white'
                                      : 'bg-white border-[#0fb5ab] text-slate-800 shadow-sm'
                                    : isDark
                                      ? 'bg-slate-900 border-slate-800 text-slate-400 opacity-70'
                                      : 'bg-white/60 border-slate-200 text-slate-500 opacity-75'
                                } ${hasMaskingId ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                              >
                                <div>
                                  <p className="text-xs font-black">Non-Masking ({globalSmsRates.non_masking_rate} ৳)</p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Automas Primary • ৳100 = {Math.ceil(100 / globalSmsRates.non_masking_rate)} SMS</p>
                                </div>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${effectiveType === 'non_masking' ? 'border-[#0fb5ab] bg-[#0fb5ab]' : 'border-slate-300'}`}>
                                  {effectiveType === 'non_masking' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditSmsType('masking')}
                                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between cursor-pointer ${
                                  effectiveType === 'masking'
                                    ? isDark
                                      ? 'bg-[#42f5e9]/15 border-[#42f5e9] text-white'
                                      : 'bg-white border-[#0fb5ab] text-slate-800 shadow-sm'
                                    : isDark
                                      ? 'bg-slate-900 border-slate-800 text-slate-400 opacity-70'
                                      : 'bg-white/60 border-slate-200 text-slate-500 opacity-75'
                                }`}
                              >
                                <div>
                                  <p className="text-xs font-black">Masking ({globalSmsRates.masking_rate} ৳)</p>
                                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">REVE SMS Primary • ৳100 = {Math.ceil(100 / globalSmsRates.masking_rate)} SMS</p>
                                </div>
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${effectiveType === 'masking' ? 'border-[#0fb5ab] bg-[#0fb5ab]' : 'border-slate-300'}`}>
                                  {effectiveType === 'masking' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </button>
                            </div>
                            {hasMaskingId && (
                              <p className="text-[10px] font-bold text-[#0fb5ab] px-1">
                                Masking / Client ID সেট থাকায় এই অ্যাকাউন্টটি স্বয়ংক্রিয়ভাবে Masking হিসেবে চিহ্নিত হয়েছে।
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Voice Sender ID</label>
                              <input type="text" className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none focus:border-[#0fb5ab]`} value={editVoiceSenderId} onChange={(e) => setEditVoiceSenderId(e.target.value)} placeholder="e.g. 8801..." />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">REVE / Custom API Key</label>
                              <input type="text" className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-bold text-xs outline-none focus:border-[#0fb5ab]`} value={editReveApiKey} onChange={(e) => setEditReveApiKey(e.target.value)} placeholder="System Default Used" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Secret Key</label>
                              <input type="text" className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-bold text-xs outline-none focus:border-[#0fb5ab]`} value={editReveSecretKey} onChange={(e) => setEditReveSecretKey(e.target.value)} placeholder="Secret Key" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Caller / Sender ID</label>
                              <input type="text" className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none focus:border-[#0fb5ab]`} value={editReveCallerId} onChange={(e) => setEditReveCallerId(e.target.value)} placeholder="e.g. 12345" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Masking / Client ID (REVE)</label>
                              <input
                                type="text"
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none focus:border-[#0fb5ab]`}
                                value={editReveClientId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditReveClientId(val);
                                  if (val.trim()) setEditSmsType('masking');
                                }}
                                placeholder="e.g. COMMITTEE (sets Masking)"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                Custom SMS Rate (BDT) — Optional
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none focus:border-[#0fb5ab]`}
                                value={editSmsRate}
                                onChange={(e) => setEditSmsRate(e.target.value)}
                                placeholder={`Auto (${autoGlobalRate} ৳)`}
                              />
                              <p className="text-[10px] font-bold text-slate-400 px-1">
                                খালি বা ০ রাখলে গ্লোবাল {effectiveType === 'masking' ? 'Masking' : 'Non-Masking'} রেট ({autoGlobalRate} ৳) প্রযোজ্য হবে।
                              </p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Voice Rate (BDT)</label>
                              <input type="number" step="0.01" min="0" className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none focus:border-[#0fb5ab]`} value={editVoiceRate} onChange={(e) => setEditVoiceRate(parseFloat(e.target.value) || 0)} placeholder="0.50" />
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })()}

                    {/* TAB 3: PERMISSIONS */}
                    {detailsTab === 'permissions' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className={`${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <h4 className={`text-sm font-black font-noto flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                              <ShieldCheck size={18} className={isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} />
                              <span>মডিউল পারমিশন (Module Permissions)</span>
                            </h4>
                            <span className={`px-3.5 py-1 rounded-full text-[11px] font-black font-noto ${isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#0fb5ab]/10 text-[#0fb5ab]'}`}>
                              {activeModuleCount} টি সক্রিয়
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {Array.from(new Set([...Object.keys(ALL_MODULE_META), ...Object.keys(editModules || {})])).map((key) => {
                              const value = Boolean(editModules?.[key]);
                              const meta = ALL_MODULE_META[key] || {
                                labelBn: key.replace(/_/g, ' '),
                                labelEn: key.replace(/_/g, ' '),
                                icon: Layers
                              };
                              const ModIcon = meta.icon;
                              return (
                                <button
                                  type="button"
                                  key={key}
                                  onClick={() => setEditModules(prev => ({ ...prev, [key]: !value }))}
                                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] ${
                                    value
                                      ? isDark
                                        ? 'bg-[#42f5e9]/10 border-[#42f5e9]/30 text-white shadow-sm'
                                        : 'bg-white border-[#0fb5ab]/30 text-slate-800 shadow-sm'
                                      : isDark
                                        ? 'bg-slate-900 border-slate-800 text-slate-500 opacity-75'
                                        : 'bg-white/60 border-slate-200/70 text-slate-400 opacity-80'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                      value
                                        ? isDark ? 'bg-[#42f5e9]/20 text-[#42f5e9]' : 'bg-[#0fb5ab]/15 text-[#0fb5ab]'
                                        : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                      <ModIcon size={17} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs font-black font-noto truncate block">
                                        {lang === 'bn' ? meta.labelBn : meta.labelEn}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight truncate block">
                                        {meta.labelEn}
                                      </span>
                                    </div>
                                  </div>
                                  <div className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 flex items-center ${value ? 'bg-[#0fb5ab]' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: SUBSCRIPTION & BILLING */}
                    {detailsTab === 'subscription' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        <div className={`${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'} p-6 md:p-8 rounded-[2.5rem] border space-y-6`}>
                          <div className="flex items-center gap-2 px-1">
                            <CreditCard size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Subscription & Billing</h4>
                          </div>

                          {/* Top Settings Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">System Type</label>
                              <select
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-bold text-xs outline-none`}
                                value={editSubscriptionType}
                                onChange={(e) => setEditSubscriptionType(e.target.value as any)}
                              >
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                                <option value="lifetime">Lifetime</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Portal Status</label>
                              <select
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-bold text-xs outline-none`}
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as any)}
                              >
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="trial">Trial</option>
                              </select>
                              {editStatus === 'trial' && (
                                <p className="text-[10px] font-bold text-amber-500 px-1">
                                  {lang === 'bn'
                                    ? `৩ দিনের ট্রায়াল শেষ: ${trialExpiryDate.toLocaleDateString('bn-BD')}`
                                    : `3-day trial ends: ${trialExpiryDate.toLocaleDateString('en-US')}`}
                                </p>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Subscription End</label>
                              <input
                                type="date"
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-bold text-xs outline-none`}
                                value={editSubscriptionEnd}
                                onChange={(e) => setEditSubscriptionEnd(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Custom Monthly Rate (৳)</label>
                              <input
                                type="number"
                                min="0"
                                className={`w-full h-12 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-xs outline-none`}
                                value={editCustomSubscriptionFee}
                                onChange={(e) => setEditCustomSubscriptionFee(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                placeholder={String(editPackageRate)}
                              />
                            </div>
                          </div>

                          {/* Select Package Grid */}
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Package</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {COMMITTEE_PACKAGES.map(pkg => {
                                const isPkgSelected = editPackageName === pkg.name;
                                return (
                                  <div
                                    key={pkg.name}
                                    onClick={() => {
                                      setEditPackageName(pkg.name);
                                      if (pkg.name !== 'Custom') {
                                        setEditPackageRate(pkg.rate);
                                        setEditCustomSubscriptionFee('');
                                      }
                                    }}
                                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                                      isPkgSelected
                                        ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white shadow-md'
                                        : isDark
                                          ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-[#0fb5ab]/40'
                                    }`}
                                  >
                                    <div className="text-[11px] font-black uppercase tracking-wider">{pkg.name}</div>
                                    {pkg.name === 'Custom' ? (
                                      <input
                                        type="number"
                                        min="0"
                                        onClick={(e) => e.stopPropagation()}
                                        value={editPackageName === 'Custom' ? editPackageRate : ''}
                                        onChange={(e) => {
                                          setEditPackageName('Custom');
                                          setEditPackageRate(Math.max(0, Number(e.target.value) || 0));
                                        }}
                                        placeholder="Rate ৳"
                                        className={`mt-2 w-full h-8 px-2.5 rounded-lg text-xs font-black outline-none ${isPkgSelected ? 'bg-white/20 text-white placeholder:text-white/70' : isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`}
                                      />
                                    ) : (
                                      <div className={`text-lg font-black mt-1 ${isPkgSelected ? 'text-white' : 'text-[#0fb5ab]'}`}>
                                        ৳{pkg.rate}<span className="text-[10px] opacity-75">/mo</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Select Months to Pay */}
                          <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200/70'} space-y-4`}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Months to Pay</span>
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                  <button type="button" onClick={() => setSelectedYear(y => y - 1)} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                                    <ChevronLeft size={14} />
                                  </button>
                                  <span className="text-xs font-black px-2">{selectedYear}</span>
                                  <button type="button" onClick={() => setSelectedYear(y => y + 1)} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                                    <ChevronRight size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const m = String(new Date().getMonth() + 1).padStart(2, '0');
                                    setSelectedMonthsForPayment([`${selectedYear}-${m}`]);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black border ${isDark ? 'bg-slate-800 border-slate-700 text-[#42f5e9]' : 'bg-[#42f5e9]/15 border-[#0fb5ab]/20 text-[#0fb5ab]'}`}
                                >
                                  Monthly
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const curM = new Date().getMonth();
                                    const qMonths = [0, 1, 2].map(offset => {
                                      const d = new Date(selectedYear, curM + offset, 1);
                                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    });
                                    setSelectedMonthsForPayment(qMonths);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black border ${isDark ? 'bg-slate-800 border-slate-700 text-[#42f5e9]' : 'bg-[#42f5e9]/15 border-[#0fb5ab]/20 text-[#0fb5ab]'}`}
                                >
                                  Quarterly
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allMonths = Array.from({ length: 12 }, (_, idx) => `${selectedYear}-${String(idx + 1).padStart(2, '0')}`);
                                    setSelectedMonthsForPayment(allMonths);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black border ${isDark ? 'bg-slate-800 border-slate-700 text-[#42f5e9]' : 'bg-[#42f5e9]/15 border-[#0fb5ab]/20 text-[#0fb5ab]'}`}
                                >
                                  Yearly
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedMonthsForPayment([])}
                                  className="px-3 py-1.5 rounded-xl text-[10px] font-black border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-500"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                              {MONTH_NAMES_BN.map((mName, idx) => {
                                const ym = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
                                const isPaid = editPaidMonths.includes(ym);
                                const isSelected = selectedMonthsForPayment.includes(ym);
                                return (
                                  <button
                                    key={ym}
                                    type="button"
                                    onClick={() => {
                                      if (isPaid) {
                                        setEditPaidMonths(prev => prev.filter(x => x !== ym));
                                      } else {
                                        setSelectedMonthsForPayment(prev =>
                                          prev.includes(ym) ? prev.filter(x => x !== ym) : [...prev, ym]
                                        );
                                      }
                                    }}
                                    className={`relative p-3 rounded-2xl border text-center transition-all active:scale-95 ${
                                      isPaid
                                        ? isDark
                                          ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
                                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : isSelected
                                          ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white shadow-md'
                                          : isDark
                                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#0fb5ab]/40'
                                    }`}
                                  >
                                    {isPaid && (
                                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                        <Check size={11} strokeWidth={3} />
                                      </span>
                                    )}
                                    <span className="text-xs font-black font-noto block">{mName}</span>
                                    <span className="text-[9px] font-bold opacity-70 block mt-0.5">{ym}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Price Calculation Card */}
                          <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} space-y-5`}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                              <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                <p className="text-[9px] font-black text-slate-400 uppercase">Total Members</p>
                                <p className="text-lg font-black mt-0.5">{userStats.students}</p>
                              </div>
                              <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                <p className="text-[9px] font-black text-slate-400 uppercase">Months Selected</p>
                                <p className="text-lg font-black text-[#0fb5ab] mt-0.5">{selectedMonthsForPayment.length}</p>
                              </div>
                              <div className={`p-3 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                <p className="text-[9px] font-black text-slate-400 uppercase">Monthly Rate</p>
                                <p className="text-lg font-black mt-0.5">৳{effectiveRate}</p>
                              </div>
                              <div className={`p-3 rounded-2xl ${isDark ? 'bg-emerald-900/30 border border-emerald-800' : 'bg-emerald-50 border border-emerald-100'}`}>
                                <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Total Price</p>
                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">৳{displayTotal}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Discount (৳)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={editDiscount}
                                  onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                                  className={`w-full h-11 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none`}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">বকেয়া (Due ৳)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={editDueAmount}
                                  onChange={(e) => setEditDueAmount(Math.max(0, Number(e.target.value) || 0))}
                                  className={`w-full h-11 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none`}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Custom Total (৳)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={overrideTotal}
                                  onChange={(e) => setOverrideTotal(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                                  placeholder={String(calculatedTotal)}
                                  className={`w-full h-11 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl px-4 font-black text-sm outline-none`}
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleReceiveSubscriptionPayment}
                              disabled={isProcessingSubPayment}
                              className="w-full h-13 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60"
                            >
                              {isProcessingSubPayment ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />}
                              <span>Receive Payment (৳{displayTotal})</span>
                            </button>
                          </div>

                          {/* Subscription Note */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 font-noto">
                              সাবস্ক্রিপশন নোট (Subscription Note)
                            </label>
                            <textarea
                              rows={2}
                              value={editSubscriptionNote}
                              onChange={(e) => setEditSubscriptionNote(e.target.value)}
                              placeholder="পেমেন্ট বা চুক্তি সংক্রান্ত নোট লিখুন..."
                              className={`w-full ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'} border rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:border-[#0fb5ab] resize-none`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 5: HISTORY & BALANCE AUDIT */}
                    {detailsTab === 'history' && (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Header + Module Filter Pills */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h4 className={`text-sm font-black font-noto flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            <HistoryIcon size={18} className="text-[#0fb5ab]" />
                            <span>{lang === 'bn' ? 'লেনদেন ও রিচার্জ ইতিহাস' : 'Transaction & Recharge History'}</span>
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {[
                              { id: 'all', label: 'সকল' },
                              { id: 'sms', label: 'SMS' },
                              { id: 'voice', label: 'ভয়েস' },
                              { id: 'subscription', label: 'সাবস্ক্রিপশন' }
                            ].map(pill => (
                              <button
                                key={pill.id}
                                type="button"
                                onClick={() => {
                                  const mod = pill.id as any;
                                  setHistoryFilterModule(mod);
                                  fetchPaymentHistory(selectedUser.id, mod);
                                }}
                                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black font-noto transition-all ${
                                  historyFilterModule === pill.id
                                    ? 'bg-[#0fb5ab] text-white shadow-sm'
                                    : isDark
                                      ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {pill.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Point-in-Time Historical Balance Check Card */}
                        <div className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-cyan-50/40 border-slate-200'} space-y-4`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-[#0fb5ab]" />
                              <span className="text-xs font-black font-noto">নির্দিষ্ট তারিখ ও সময়ে ব্যালেন্স কত ছিল?</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="datetime-local"
                                value={auditDate}
                                onChange={(e) => setAuditDate(e.target.value)}
                                className={`h-10 px-3 rounded-xl border text-xs font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                              />
                              <button
                                type="button"
                                onClick={handleCheckHistoricalBalance}
                                disabled={!auditDate || isCheckingAudit}
                                className="h-10 px-4 rounded-xl bg-[#0fb5ab] text-white text-xs font-black flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                              >
                                {isCheckingAudit ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                <span>চেক করুন</span>
                              </button>
                            </div>
                          </div>

                          {auditResult && (
                            <div className="space-y-3 pt-2">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                                  <p className="text-[10px] font-bold text-slate-400 font-noto">ঐ সময়ের ভয়েস ব্যালেন্স</p>
                                  <p className="text-base font-black text-emerald-500 mt-1">৳ {Number(auditResult.historicalVoice).toFixed(2)}</p>
                                </div>
                                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                                  <p className="text-[10px] font-bold text-slate-400 font-noto">ঐ সময়ের SMS ব্যালেন্স</p>
                                  <p className="text-base font-black text-[#0fb5ab] mt-1">{auditResult.historicalSms} SMS</p>
                                </div>
                                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                                  <p className="text-[10px] font-bold text-slate-400 font-noto">বর্তমান ভয়েস ব্যালেন্স</p>
                                  <p className="text-base font-black mt-1">৳ {Number(auditResult.currentVoice).toFixed(2)}</p>
                                </div>
                                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                                  <p className="text-[10px] font-bold text-slate-400 font-noto">বর্তমান SMS ব্যালেন্স</p>
                                  <p className="text-base font-black mt-1">{auditResult.currentSms} SMS</p>
                                </div>
                              </div>
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-[#42f5e9]/15 text-[#0fb5ab] font-noto">
                                <Activity size={12} />
                                <span>ঐ সময়ের পর {auditResult.transactionsAfterCount} টি লেনদেন হয়েছে</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Transaction List */}
                        {isLoadingHistory ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 size={28} className="animate-spin text-[#0fb5ab] mb-2" />
                            <span className="text-xs font-bold">{lang === 'bn' ? 'ইতিহাস লোড হচ্ছে...' : 'Loading history...'}</span>
                          </div>
                        ) : paymentHistory.length > 0 ? (
                          <div className="space-y-3">
                            {paymentHistory.map((tr: any) => {
                              const desc = (tr.description || '').toLowerCase();
                              const trxId = (tr.transaction_id || '').toUpperCase();
                              const modLabel = tr.module
                                || (trxId.startsWith('SUB_') || desc.includes('subscription')
                                  ? 'subscription'
                                  : desc.includes('voice')
                                    ? 'voice'
                                    : (Number(tr.sms_count) > 0 || desc.includes('sms'))
                                      ? 'sms'
                                      : 'wallet');
                              const balAfter = tr.metadata?.balance_after;
                              const smsAfter = tr.metadata?.sms_balance_after;

                              return (
                                <div
                                  key={tr.id}
                                  className={`p-4 md:p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50/70 border-slate-200/70'}`}
                                >
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                                        tr.status === 'approved'
                                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                          : tr.status === 'rejected'
                                            ? 'bg-red-500/15 text-red-500'
                                            : 'bg-amber-500/15 text-amber-600'
                                      }`}>
                                        {tr.status}
                                      </span>
                                      <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#0fb5ab]/15 text-[#0fb5ab]">
                                        {modLabel}
                                      </span>
                                      {Number(tr.sms_count) > 0 && (
                                        <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                                          {tr.sms_count} SMS
                                        </span>
                                      )}
                                      {balAfter !== undefined && (
                                        <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                          Voice After: ৳{Number(balAfter).toFixed(2)}
                                        </span>
                                      )}
                                      {smsAfter !== undefined && (
                                        <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                          SMS After: {smsAfter}
                                        </span>
                                      )}
                                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                        <Clock size={11} />
                                        {new Date(tr.created_at).toLocaleString('bn-BD')}
                                      </span>
                                    </div>
                                    <p className={`text-xs font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                      {tr.description || 'Transaction'}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400">
                                      TrxID: <span className="text-[#0fb5ab]">{tr.transaction_id || tr.id}</span> • Sender: {tr.sender_phone || 'N/A'}
                                    </p>
                                  </div>

                                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                                    <span className={`text-base font-black ${tr.type === 'debit' ? 'text-red-500' : 'text-emerald-500'}`}>
                                      {tr.type === 'debit' ? '-' : '+'}{tr.amount} ৳
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadReceipt(tr)}
                                      className={`px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-1.5 border transition-all active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 text-[#42f5e9] hover:bg-slate-700' : 'bg-white border-slate-200 text-[#0fb5ab] hover:bg-slate-100'}`}
                                    >
                                      <Download size={13} />
                                      <span>Receipt</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteHistory(tr)}
                                      className={`p-2 rounded-xl border transition-all active:scale-95 ${isDark ? 'bg-red-900/20 border-red-900/40 text-red-400 hover:bg-red-900/40' : 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100'}`}
                                      title="Delete"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={`text-center py-12 rounded-3xl border-2 border-dashed ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">
                              {lang === 'bn' ? 'কোনো লেনদেন পাওয়া যায়নি' : 'No transactions found'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Global Save Button */}
                    <button
                      type="button"
                      onClick={handleUserUpdate}
                      disabled={isUpdatingUser}
                      className="w-full h-16 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-60"
                    >
                      {isUpdatingUser ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Save Profile Changes</>}
                    </button>
                  </div>
                </div>
              </div>
             );
          })()}
        </>
      )}

      {/* Create Institution Modal - PORTALED */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-[#0fb5ab] font-noto">নতুন কমিটি</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">কমিটির নাম</label>
                <input 
                  type="text" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#0fb5ab] outline-none focus:border-[#42f5e9]/30" 
                  value={newInstName} 
                  onChange={(e) => setNewInstName(e.target.value)} 
                  placeholder="Example Committee"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">মোবাইল নম্বর</label>
                <input 
                  type="tel" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#0fb5ab] outline-none focus:border-[#42f5e9]/30" 
                  value={newInstPhone} 
                  onChange={(e) => setNewInstPhone(e.target.value)} 
                  placeholder="017..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ইমেইল</label>
                <input 
                  type="email" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#0fb5ab] outline-none focus:border-[#42f5e9]/30" 
                  value={newInstEmail} 
                  onChange={(e) => setNewInstEmail(e.target.value)} 
                  placeholder="admin@committee.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">পাসওয়ার্ড</label>
                <input 
                  type="password" 
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 font-black text-[#0fb5ab] outline-none focus:border-[#42f5e9]/30" 
                  value={newInstPassword} 
                  onChange={(e) => setNewInstPassword(e.target.value)} 
                  placeholder="******"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ধরণ</label>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                  {DISPLAY_COMMITTEE_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewInstType(type.id)}
                      className={`p-2 rounded-xl border text-[9px] font-black transition-all ${
                        newInstType === type.id 
                          ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white shadow-md'
                          : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {(newInstType === 'sangha' || newInstType === 'union') && (
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-wider">
                      সংঘের কার্যক্রম ({newInstSonghoActivities.length})
                    </label>
                    <span className="text-[8px] text-slate-400">মাল্টি-সিলেক্ট</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {SONGHO_ACTIVITIES.map(act => {
                      const isSelected = newInstSonghoActivities.includes(act.id);
                      const ActIcon = act.icon;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => {
                            setNewInstSonghoActivities(prev => 
                              isSelected 
                                ? (prev.length > 1 ? prev.filter(x => x !== act.id) : prev) 
                                : [...prev, act.id]
                            );
                          }}
                          className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 text-xs transition-all ${
                            isSelected 
                              ? 'bg-[#0fb5ab] text-white border-[#0fb5ab] font-bold' 
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className="shrink-0"><ActIcon size={13} /></span>
                          <span className="text-[9px] font-noto truncate">{act.labelBn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button 
                onClick={handleCreateInstitution} 
                disabled={isCreatingInst}
                className="w-full h-14 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-[1.5rem] mt-4 shadow-premium active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isCreatingInst ? <Loader2 className="animate-spin" /> : 'তৈরি করুন'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Confirmation Modal - PORTALED */}
      {rejectConfirm && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-500 border border-red-50">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-red-100">
                 <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-[#0fb5ab] font-noto tracking-tight">আপনি কি নিশ্চিত?</h3>
              <p className="text-[12px] font-bold text-slate-400 mt-2 font-noto leading-relaxed">
                 <span className="text-red-500">{rejectConfirm.institutions?.name}</span> এর <span className="text-slate-800">{rejectConfirm.amount} ৳</span> রিচার্জ রিকোয়েস্ট বাতিল করতে চাচ্ছেন।
              </p>
              <div className="flex flex-col gap-2 mt-8">
                 <button onClick={rejectTransaction} disabled={isRejecting} className="w-full py-4 bg-red-500 text-white font-black rounded-full shadow-lg shadow-red-100 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                    {isRejecting ? <Loader2 className="animate-spin" size={18} /> : 'হ্যাঁ, বাতিল করুন'}
                 </button>
                 <button onClick={() => setRejectConfirm(null)} disabled={isRejecting} className="w-full py-3 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-[10px] uppercase tracking-widest">পিছনে যান</button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showConfirm.show && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center animate-in zoom-in-95 duration-500 border border-amber-50">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner border border-amber-100">
                 <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-[#0fb5ab] font-noto tracking-tight">{showConfirm.title}</h3>
              <p className="text-[12px] font-bold text-slate-400 mt-2 font-noto leading-relaxed px-4">
                 {showConfirm.message}
              </p>
              <div className="flex gap-3 mt-8">
                 <button onClick={() => setShowConfirm({ ...showConfirm, show: false })} className="flex-1 py-4 bg-slate-50 text-slate-400 font-black rounded-full active:scale-95 transition-all text-[10px] uppercase tracking-widest">বাতিল</button>
                 <button 
                   onClick={() => {
                     setShowConfirm({ ...showConfirm, show: false });
                     showConfirm.onConfirm();
                   }} 
                   className="flex-1 py-4 bg-red-500 text-white font-black rounded-full shadow-lg shadow-red-100 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                 >
                    নিশ্চিত করুন
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminPanel;
