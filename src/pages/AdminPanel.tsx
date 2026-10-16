
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
// Fix: Import icons from lucide-react instead of ../supabase
import { Loader2, Search, ChevronRight, User as UserIcon, ShieldCheck, Database, Globe, CheckCircle, XCircle, CreditCard, Save, X, Settings, Smartphone, MessageSquare, Key, Shield, ArrowLeft, ArrowRight, Copy, Check, Calendar, Users, Layers, MonitorSmartphone, Server, BarChart3, TrendingUp, RefreshCcw, Clock, Hash, History as HistoryIcon, Zap, Activity, PieChart, Users2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Trash2, Edit2, Sliders, ToggleLeft, ToggleRight, GraduationCap, Banknote, PhoneCall, Mic, Plus, Play, Building2, PlusCircle, BookOpen, Vote, Landmark, ClipboardList, Filter } from 'lucide-react';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, Transaction, AdminSMSStock } from 'types';
import { COMMITTEE_TYPES as UTILITY_COMMITTEE_TYPES } from '../utils/committeeTypes';
import { SONGHO_ACTIVITIES, getDefaultSonghoActivityIds } from '../utils/songhoActivities';

const ALL_MODULE_META: Record<string, { labelBn: string; labelEn: string; icon: any }> = {
  departments: { labelBn: 'শাখা ও বিভাগ', labelEn: 'Departments / Branches', icon: BookOpen },
  attendance: { labelBn: 'উপস্থিতি ট্র্যাকিং', labelEn: 'Attendance Tracking', icon: ClipboardList },
  meetings: { labelBn: 'মিটিং ও এজেন্ডা', labelEn: 'Meetings & Agendas', icon: Calendar },
  results: { labelBn: 'রেজুলেশন ও সিদ্ধান্ত', labelEn: 'Resolutions & Decisions', icon: GraduationCap },
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

  const [paymentTab, setPaymentTab] = useState<'sms' | 'voice'>('sms');
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
      const awajResponse = await fetch('/api/awaj/voices');
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
  const [editReveCallerId, setEditReveCallerId] = useState('');
  const [editVoiceSenderId, setEditVoiceSenderId] = useState('');
  const [editModules, setEditModules] = useState({
    departments: true,
    attendance: true,
    results: true,
    accounting: true,
    subscriptions: true,
    voice_broadcast: false,
    sms: true
  });
  const [editSubscriptionEnd, setEditSubscriptionEnd] = useState('');
  const [editSubscriptionType, setEditSubscriptionType] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'trial'>('active');
  const [editResultEngine, setEditResultEngine] = useState<'school' | 'befaq' | 'qawmi_custom'>('school');
  const [editResultSystem, setEditResultSystem] = useState<'grading' | 'marks'>('grading');
  const [editAttendanceType, setEditAttendanceType] = useState<'daily' | 'period'>('daily');
  const [editFeeStructure, setEditFeeStructure] = useState<'monthly' | 'session'>('monthly');
  const [editInstitutionType, setEditInstitutionType] = useState<any>('madrasah');
  const [editFeeEngine, setEditFeeEngine] = useState<'school' | 'qawmi' | 'kindergarten' | 'simple'>('school');
  const [editAccountingMode, setEditAccountingMode] = useState<'qawmi_flexible' | 'school_system'>('school_system');
  const [editSonghoActivities, setEditSonghoActivities] = useState<string[]>(getDefaultSonghoActivityIds());

  const [detailsTab, setDetailsTab] = useState<'basic' | 'advanced' | 'subscription' | 'settings'>('basic');

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
  const [newInstType, setNewInstType] = useState<any>('madrasah');
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
    if (currentView === 'approvals') setView('approvals');
    else if (currentView === 'dashboard') setView('dashboard');
    else if (currentView === 'list') setView('list');
  }, [currentView]);

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
    setEditReveCallerId(user.reve_caller_id || '');
    setEditVoiceSenderId(user.voice_sender_id || '');
    let userConfig: any = user.config_json;
    if (typeof userConfig === 'string') {
      try {
        userConfig = JSON.parse(userConfig);
      } catch (e) {
        userConfig = {};
      }
    }

    const userModules = { ...(userConfig?.modules || {}) };
    delete userModules.fees;
    delete userModules.admit_card;
    delete userModules.seat_plan;

    setEditModules({
      departments: true,
      attendance: true,
      results: true,
      accounting: true,
      subscriptions: true,
      voice_broadcast: true,
      sms: true,
      ...userModules
    });

    const createdAtDate = new Date(user.created_at);
    const oneYearLater = new Date(createdAtDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const defaultEndDate = oneYearLater.toISOString().split('T')[0];

    setEditSubscriptionEnd(user.subscription_end || defaultEndDate);
    setEditSubscriptionType(userConfig?.subscription_type || 'monthly');
    setEditStatus(user.status || 'active');
    setEditResultEngine(userConfig?.result_engine || 'school');
    setEditResultSystem(userConfig?.result_system || 'grading');
    setEditAttendanceType(userConfig?.attendance_type || 'daily');
    setEditFeeStructure(userConfig?.fee_structure || 'monthly');
    setEditInstitutionType(user.institution_type || 'madrasah');
    setEditFeeEngine(userConfig?.fee_engine || 'school');
    setEditAccountingMode(userConfig?.accounting_mode || 'school_system');
    setEditSonghoActivities(
      Array.isArray(userConfig?.songho_activities) && userConfig.songho_activities.length > 0
        ? userConfig.songho_activities
        : getDefaultSonghoActivityIds()
    );
    
    setView('details');
    
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

      console.log('Saving config_json:', {
        modules: editModules,
        result_engine: editResultEngine,
        result_system: editResultSystem,
        attendance_type: editAttendanceType,
        fee_structure: editFeeStructure,
        fee_engine: editFeeEngine,
        accounting_mode: editAccountingMode
      });
      const parsedSmsBalance = Math.max(0, parseInt(editSmsBalance, 10) || 0);
      const parsedVoiceBalance = Math.max(0, parseFloat(editVoiceBalance) || 0);

      const { data, error } = await supabase.from('institutions').update({
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        address: editAddress.trim() || null,
        login_code: editLoginCode.trim(),
        is_active: editActive,
        sms_balance: parsedSmsBalance,
        balance: parsedVoiceBalance,
        reve_api_key: editReveApiKey.trim() || null,
        reve_caller_id: editReveCallerId.trim() || null,
        voice_sender_id: editVoiceSenderId.trim() || null,
        institution_type: editInstitutionType,
        subscription_end: editSubscriptionEnd || null,
        status: editStatus,
        config_json: {
          ...(typeof userConfig === 'object' && userConfig !== null ? userConfig : {}),
          modules: editModules,
          result_engine: editResultEngine,
          result_system: editResultSystem,
          attendance_type: editAttendanceType,
          fee_structure: editFeeStructure,
          subscription_type: editSubscriptionType,
          fee_engine: editFeeEngine,
          accounting_mode: editAccountingMode,
          ...((editInstitutionType === 'sangha' || editInstitutionType === 'union') ? { songho_activities: editSonghoActivities } : {})
        }
      }).eq('id', selectedUser.id).select();
      
      console.log('Update result data:', data, 'error:', error);
      
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

  const approveTransaction = async (tr: Transaction) => {
    const isVoice = (tr.description || '').toLowerCase().includes('voice');
    const sms = Number(smsToCredit[tr.id]);
    
    if (!isVoice && (!sms || sms <= 0)) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'সঠিক SMS সংখ্যা লিখুন' });
      return;
    }
    
    setApprovingIds(prev => new Set(prev).add(tr.id));
    try {
      if (isVoice) {
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
          const msg = isVoice 
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
        message: isSmsEnabled ? 'রিচার্জ সফল হয়েছে এবং ইউজারকে SMS পাঠানো হয়েছে।' : 'রিচার্জ সফল হয়েছে (SMS পাঠানো হয়নি)।' 
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
    const matchesType = filterType === 'all' || (m.institution_type || 'madrasah') === filterType;
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
      const matchesTab = paymentTab === 'sms' ? (desc.includes('sms') || !desc.includes('voice')) : desc.includes('voice');
      const matchesSearch = matchesPaymentSearch(tr, paymentSearch);
      const matchesDate = isTransactionMatchingDate(tr.created_at, paymentDateFilter);
      return matchesTab && matchesSearch && matchesDate;
    });
  }, [pendingTrans, paymentTab, paymentSearch, paymentDateFilter, paymentStatusFilter]);

  const filteredHistory = useMemo(() => {
    if (paymentStatusFilter === 'pending') return [];
    return transactionHistory.filter(tr => {
      const desc = (tr.description || '').toLowerCase();
      const matchesTab = paymentTab === 'sms' ? (desc.includes('sms') || !desc.includes('voice')) : desc.includes('voice');
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
                              {m.institution_type || 'madrasah'}
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

              <div className={`flex ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'} p-1 rounded-2xl`}>
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
                                 {lang === 'bn' ? 'বিকাশ নম্বর:' : 'bKash Number:'} <span className="text-slate-800">{tr.sender_phone || 'N/A'}</span>
                             </p>
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
                            <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-2">
                               <Smartphone size={10} /> {lang === 'bn' ? 'বিকাশ:' : 'bKash:'} {tr.sender_phone || 'N/A'}
                               {tr.sms_count && <span className="text-[#0fb5ab] font-black">({tr.sms_count} SMS)</span>}
                            </p>
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

          {view === 'details' && selectedUser && (
             <div className="animate-in slide-in-from-right-10 duration-500 pb-20 space-y-8 pt-2">
                <div className="flex items-center gap-5 px-1">
                   <button onClick={() => setView('list')} className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-[#42f5e9] border-slate-700' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20'} rounded-2xl flex items-center justify-center active:scale-90 transition-all border shadow-sm`}>
                      <ArrowLeft size={24} strokeWidth={3} />
                   </button>
                   <div className="min-w-0">
                      <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto truncate leading-tight`}>
                        {lang === 'bn' ? 'কমিটির বিস্তারিত বিবরণ' : 'Committee Details'}
                      </h1>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">UUID: {selectedUser.id}</p>
                   </div>
                </div>

                <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-bubble'} rounded-[3.5rem] p-8 border space-y-8`}>
                   <div className="flex flex-col items-center text-center">
                      <div className={`w-24 h-24 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-white'} rounded-[2rem] flex items-center justify-center border-4 shadow-bubble overflow-hidden mb-4`}>
                         {selectedUser.logo_url ? <img src={selectedUser.logo_url} className="w-full h-full object-contain" /> : <UserIcon size={40} className="text-slate-300" />}
                      </div>
                      <h2 className={`text-2xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>{selectedUser.name}</h2>
                      <div className={`mt-3 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${editActive ? (madrasah?.theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (madrasah?.theme === 'dark' ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-600 border-red-100')}`}>
                         <Activity size={12} /> {editActive ? (lang === 'bn' ? 'সচল পোর্টাল' : 'Active Portal') : (lang === 'bn' ? 'বন্ধ পোর্টাল' : 'Access Restricted')}
                      </div>
                   </div>

                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-4 rounded-3xl text-center border`}>
                         <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{userStats.students}</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সদস্য' : 'Students'}</p>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'} p-4 rounded-3xl text-center border`}>
                         <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>{userStats.departments}</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কমিটি' : 'Classes'}</p>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/20 border-[#42f5e9]/50' : 'bg-[#42f5e9]/10 border-[#42f5e9]/20'} p-4 rounded-3xl text-center border`}>
                         <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{editSmsBalance || 0}</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'এসএমএস ব্যালেন্স' : 'SMS Bal'}</p>
                      </div>
                      <div className={`${madrasah?.theme === 'dark' ? 'bg-emerald-900/30 border-emerald-900/50' : 'bg-emerald-50 border-emerald-100'} p-4 rounded-3xl text-center border`}>
                         <h5 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{Number(editVoiceBalance || 0).toFixed(2)} ৳</h5>
                         <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'ভয়েস ব্যালেন্স' : 'Voice Bal'}</p>
                      </div>
                   </div>

                   <div className={`space-y-6 pt-4 border-t ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
                      {/* Tab Selectors */}
                      <div className="flex flex-wrap gap-2 pb-4 border-b border-dashed border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setDetailsTab('basic')}
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all active:scale-95 ${detailsTab === 'basic' ? (madrasah?.theme === 'dark' ? 'bg-[#0fb5ab] text-white shadow-lg' : 'bg-[#0fb5ab] text-white shadow-md') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}`}
                        >
                          <UserIcon size={14} />
                          <span>{lang === 'bn' ? 'প্রাথমিক ও ব্যালেন্স তথ্য' : 'General & Balance'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsTab('advanced')}
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all active:scale-95 ${detailsTab === 'advanced' ? (madrasah?.theme === 'dark' ? 'bg-[#0fb5ab] text-white shadow-lg' : 'bg-[#0fb5ab] text-white shadow-md') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}`}
                        >
                          <Sliders size={14} />
                          <span>{lang === 'bn' ? 'অ্যাডভান্সড কনফিগ' : 'Advanced Config'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsTab('subscription')}
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all active:scale-95 ${detailsTab === 'subscription' ? (madrasah?.theme === 'dark' ? 'bg-[#0fb5ab] text-white shadow-lg' : 'bg-[#0fb5ab] text-white shadow-md') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}`}
                        >
                          <CreditCard size={14} />
                          <span>{lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailsTab('settings')}
                          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all active:scale-95 ${detailsTab === 'settings' ? (madrasah?.theme === 'dark' ? 'bg-[#0fb5ab] text-white shadow-lg' : 'bg-[#0fb5ab] text-white shadow-md') : (madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}`}
                        >
                          <Settings size={14} />
                          <span>{lang === 'bn' ? 'সিস্টেম সেটিংস' : 'System Settings'}</span>
                        </button>
                      </div>

                      {/* Tab Contents */}
                      {detailsTab === 'basic' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          {/* Balance & Wallet Management Section */}
                          <div className={`p-6 rounded-[2.5rem] border ${madrasah?.theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-gradient-to-br from-teal-50/70 via-cyan-50/40 to-emerald-50/60 border-[#0fb5ab]/20'} space-y-6 shadow-sm`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#0fb5ab] text-white flex items-center justify-center shadow-md">
                                  <CreditCard size={20} />
                                </div>
                                <div>
                                  <h4 className={`text-sm font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                                    {lang === 'bn' ? 'ব্যালেন্স ও ওয়ালেট ম্যানেজমেন্ট' : 'SMS & Voice Balance Management'}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-bold font-noto">
                                    {lang === 'bn' ? 'ইউজারের অ্যাকাউন্টে সরাসরি ব্যালেন্স ও এসএমএস পরিবর্তন বা রিচার্জ করুন' : 'Directly adjust user SMS and Voice balance'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* SMS Balance Box */}
                              <div className={`p-5 rounded-3xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-100'} shadow-sm space-y-4`}>
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

                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    {lang === 'bn' ? 'ব্যালেন্স সংখ্যা লিখুন' : 'Enter SMS Count'}
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={editSmsBalance}
                                      onChange={(e) => setEditSmsBalance(e.target.value)}
                                      placeholder="0"
                                      className={`w-full h-13 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-2xl px-4 font-black text-base outline-none focus:border-[#0fb5ab] transition-all`}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-noto">
                                      {lang === 'bn' ? 'টি' : 'SMS'}
                                    </span>
                                  </div>
                                </div>

                                {/* Quick SMS Add Buttons */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {[10, 50, 100, 500, 1000].map((amt) => (
                                    <button
                                      type="button"
                                      key={amt}
                                      onClick={() => setEditSmsBalance(prev => String(Math.max(0, (parseInt(prev, 10) || 0) + amt)))}
                                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 border ${madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-400' : 'bg-cyan-50 hover:bg-cyan-100 border-cyan-100 text-cyan-700'}`}
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
                              <div className={`p-5 rounded-3xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-100'} shadow-sm space-y-4`}>
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

                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                                    {lang === 'bn' ? 'ব্যালেন্স পরিমাণ লিখুন (টাকা)' : 'Enter Balance Amount (৳)'}
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={editVoiceBalance}
                                      onChange={(e) => setEditVoiceBalance(e.target.value)}
                                      placeholder="0.00"
                                      className={`w-full h-13 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-2xl px-4 font-black text-base outline-none focus:border-[#0fb5ab] transition-all`}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-noto">
                                      ৳
                                    </span>
                                  </div>
                                </div>

                                {/* Quick Voice Balance Add Buttons */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {[10, 50, 100, 500, 1000].map((amt) => (
                                    <button
                                      type="button"
                                      key={amt}
                                      onClick={() => setEditVoiceBalance(prev => String(Math.max(0, (parseFloat(prev) || 0) + amt)))}
                                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 border ${madrasah?.theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-400' : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100 text-emerald-700'}`}
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

                            <p className="text-[10px] text-slate-400 font-bold font-noto flex items-center gap-1.5">
                              <CheckCircle2 size={12} className="text-emerald-500" />
                              {lang === 'bn' ? 'নিচের "Save Profile Changes" বাটনে ক্লিক করলে ইউজারের অ্যাকাউন্টে ব্যালেন্স অবিলম্বে আপডেট হয়ে যাবে।' : 'Clicking "Save Profile Changes" below will immediately update the balance in their account.'}
                            </p>
                          </div>

                          {/* Basic Profile Details */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Committee / Org Name</label>
                              <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#42f5e9]/50`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Gmail / Email</label>
                              <input type="email" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#42f5e9]/50`} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Phone</label>
                              <input type="tel" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#42f5e9]/50`} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Login Code</label>
                              <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#42f5e9]/50`} value={editLoginCode} onChange={(e) => setEditLoginCode(e.target.value)} />
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center justify-between">
                                <span>{lang === 'bn' ? 'লগইন পাসওয়ার্ড (পরিবর্তন করতে চাইলে লিখুন)' : 'Login Password (leave blank to keep current)'}</span>
                                {editPassword && <span className="text-xs text-[#0fb5ab] font-bold">{lang === 'bn' ? '✓ নতুন পাসওয়ার্ড সেট হবে' : '✓ Password will update'}</span>}
                              </label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 pr-14 font-black outline-none focus:border-[#42f5e9]/50`} 
                                  value={editPassword} 
                                  onChange={(e) => setEditPassword(e.target.value)} 
                                  placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড দিন (যেমন: 123456)' : 'Enter new password'} 
                                />
                                {editPassword && (
                                  <button 
                                    type="button" 
                                    onClick={() => setEditPassword('')} 
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-xs font-bold px-2 py-1"
                                  >
                                    মুছুন
                                  </button>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold px-2">
                                {lang === 'bn' ? 'ইউজারের লগইন পাসওয়ার্ড পরিবর্তন করতে চাইলে এখানে নতুন পাসওয়ার্ড দিন এবং "Save Profile Changes" চাপুন।' : 'To update user login password, enter new password and save.'}
                              </p>
                            </div>
                            <div className="space-y-2 lg:col-span-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Address</label>
                              <input type="text" className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border rounded-2xl px-6 font-black outline-none focus:border-[#42f5e9]/50`} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Full Address" />
                            </div>
                          </div>
                        </div>
                      )}

                      {detailsTab === 'advanced' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} p-6 rounded-[2.5rem] space-y-6`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Sliders size={14} className={madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} /> Advanced Config
                                 </h4>
                            <button onClick={() => setEditActive(!editActive)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${editActive ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                               {editActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                               <span className="text-[10px] font-black uppercase tracking-widest">{editActive ? 'Active' : 'Inactive'}</span>
                            </button>
                         </div>
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">MRAM API Key</label>
                                  <input type="text" className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-bold text-xs`} value={editReveApiKey} onChange={(e) => setEditReveApiKey(e.target.value)} placeholder="System Default Used" />
                               </div>
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">MRAM Sender ID</label>
                                  <input type="text" className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-black text-sm`} value={editReveCallerId} onChange={(e) => setEditReveCallerId(e.target.value)} placeholder="e.g. 12345" />
                               </div>
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Voice Sender ID</label>
                                  <input type="text" className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-black text-sm`} value={editVoiceSenderId} onChange={(e) => setEditVoiceSenderId(e.target.value)} placeholder="e.g. 8801..." />
                               </div>

                               <div className="space-y-3 lg:col-span-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Committee Type</label>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {DISPLAY_COMMITTEE_TYPES.map(type => (
                                      <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => {
                                          setEditInstitutionType(type.id);
                                          const defaultMods = ACCOUNT_TYPE_DEFAULT_MODULES[type.id] || ACCOUNT_TYPE_DEFAULT_MODULES.committee;
                                          setEditModules(defaultMods as any);
                                        }}
                                        className={`px-3 py-2.5 rounded-xl border text-[10px] font-black transition-all ${
                                          editInstitutionType === type.id 
                                            ? (madrasah?.theme === 'dark' ? 'bg-[#0fb5ab] border-[#42f5e9]/50 text-white shadow-lg' : 'bg-[#0fb5ab] border-[#0fb5ab] text-white shadow-md')
                                            : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
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
                                 <div className="space-y-3 lg:col-span-2 p-4 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700">
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
                                               : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium'
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
                            
                            <div className={`space-y-3 pt-4 border-t ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                               <div className="flex items-center justify-between px-1">
                                 <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   <Layers size={14} className={madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} />
                                   {lang === 'bn' ? 'সক্রিয় মডিউলসমূহ (Enabled Modules)' : 'Enabled Modules'}
                                 </h5>
                                 <span className="text-[10px] font-bold text-slate-400 font-noto">
                                   {Object.values(editModules || {}).filter(Boolean).length} {lang === 'bn' ? 'টি সক্রিয়' : 'Active'}
                                 </span>
                               </div>
                               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {Object.entries(editModules || {}).map(([key, value]) => {
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
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setEditModules({...editModules, [key]: !value});
                                        }}
                                        className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 text-left transition-all active:scale-95 ${
                                          value 
                                            ? (madrasah?.theme === 'dark' 
                                                ? 'bg-[#42f5e9]/10 border-[#42f5e9]/30 text-[#42f5e9] shadow-sm' 
                                                : 'bg-[#42f5e9]/10 border-[#0fb5ab]/30 text-[#0fb5ab] shadow-sm') 
                                            : (madrasah?.theme === 'dark' 
                                                ? 'bg-slate-900 border-slate-800 text-slate-500 opacity-60' 
                                                : 'bg-slate-50 border-slate-200/60 text-slate-400 opacity-70')
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                            value 
                                              ? (madrasah?.theme === 'dark' ? 'bg-[#42f5e9]/20 text-[#42f5e9]' : 'bg-[#0fb5ab]/15 text-[#0fb5ab]') 
                                              : 'bg-slate-200/50 dark:bg-slate-800 text-slate-400'
                                          }`}>
                                            <ModIcon size={15} />
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
                                        <div className="shrink-0">
                                          {value ? (
                                            <CheckCircle2 size={18} className={madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} />
                                          ) : (
                                            <XCircle size={18} className="text-slate-300 dark:text-slate-600" />
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                               </div>
                            </div>
                         </div>
                      </div>

                        </div>
                      )}

                      {detailsTab === 'subscription' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} p-6 rounded-[2.5rem] space-y-6`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <CreditCard size={14} className={madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'} /> Subscription Info
                                 </h4>
                         </div>
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">System Type</label>
                               <select className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-bold text-xs outline-none`} value={editSubscriptionType} onChange={(e) => setEditSubscriptionType(e.target.value as any)}>
                                  <option value="monthly">Monthly Subscription</option>
                                  <option value="yearly">Yearly Subscription</option>
                                  <option value="lifetime">Lifetime Access</option>
                               </select>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Portal Status</label>
                               <select className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-bold text-xs outline-none`} value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)}>
                                  <option value="active">Active</option>
                                  <option value="suspended">Suspended</option>
                                  <option value="trial">Trial Period</option>
                               </select>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Subscription End</label>
                               <input type="date" className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-bold text-xs`} value={editSubscriptionEnd} onChange={(e) => setEditSubscriptionEnd(e.target.value)} />
                            </div>
                         </div>
                      </div>

                        </div>
                      )}

                      {detailsTab === 'settings' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                           <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'} p-6 rounded-[2.5rem] space-y-6`}>
                              <div className="flex items-center justify-between px-1">
                                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Settings size={14} className={madrasah?.theme === 'dark' ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} /> System Settings
                                 </h4>
                         </div>
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Result Engine</label>
                                  <select 
                                    className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-black text-sm outline-none`}
                                    value={editResultEngine}
                                    onChange={(e) => setEditResultEngine(e.target.value as any)}
                                  >
                                    <option value="school">School (GPA)</option>
                                    <option value="befaq">Befaq (Division)</option>
                                    <option value="qawmi_custom">Qawmi Custom</option>
                                  </select>
                               </div>
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Result System</label>
                                  <select 
                                    className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-black text-sm outline-none`}
                                    value={editResultSystem}
                                    onChange={(e) => setEditResultSystem(e.target.value as any)}
                                  >
                                    <option value="grading">Grading (GPA)</option>
                                    <option value="marks">Marks Only</option>
                                  </select>
                               </div>
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Attendance Type</label>
                                  <select 
                                    className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-black text-sm outline-none`}
                                    value={editAttendanceType}
                                    onChange={(e) => setEditAttendanceType(e.target.value as any)}
                                  >
                                    <option value="daily">Daily</option>
                                    <option value="period">Period Wise</option>
                                  </select>
                               </div>
                               <div className="space-y-1.5">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Accounting Mode</label>
                                  <select 
                                    className={`w-full h-12 ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100'} border rounded-xl px-4 font-black text-sm outline-none`}
                                    value={editAccountingMode}
                                    onChange={(e) => setEditAccountingMode(e.target.value as any)}
                                  >
                                    <option value="qawmi_flexible">Qawmi Flexible</option>
                                    <option value="school_system">School System</option>
                                  </select>
                               </div>
                            </div>
                         </div>
                      </div>
                        </div>
                      )}

                      <button onClick={handleUserUpdate} disabled={isUpdatingUser} className="w-full h-16 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 text-lg">
                         {isUpdatingUser ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Save Profile Changes</>}
                      </button>
                   </div>
                </div>
             </div>
          )}
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
                  placeholder="admin@madrasah.com"
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
