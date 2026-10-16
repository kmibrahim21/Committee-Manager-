import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, UserPlus, Shield, ShieldCheck, Check, X, Edit2, Trash2, 
  Search, Key, Phone, Mail, UserCheck, AlertTriangle, CheckCircle2,
  Lock, RefreshCw, Eye, EyeOff, Sliders, AlertCircle, Info, Sparkles
} from 'lucide-react';
import { supabase } from '../supabase';
import { Language, Institution, Profile, ManagerProfile, ManagerPermissions } from '../types';

interface ManagerManagementProps {
  lang: Language;
  madrasah?: Institution | null;
  profile?: Profile | null;
  setStatusModal: (modal: { show: boolean; type: 'success' | 'error'; title: string; message: string }) => void;
  onBack?: () => void;
}

const DEFAULT_MANAGER_PERMISSIONS: ManagerPermissions = {
  can_manage_committees: true,
  can_approve_payments: true,
  can_send_sms: false,
  can_manage_rates: false,
  can_view_dashboard: true,
  can_manage_tutorials: false,
  can_access_voice_service: false,
  can_manage_managers: false,
};

export const ManagerManagement: React.FC<ManagerManagementProps> = ({
  lang,
  madrasah,
  profile,
  setStatusModal,
  onBack
}) => {
  const isSuperAdmin = profile?.role === 'super_admin';
  const isManagerWithManagerPermission = profile?.role === 'manager' && !!profile?.permissions?.can_manage_managers;
  const canManage = isSuperAdmin || isManagerWithManagerPermission;

  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ManagerProfile | null>(null);
  const [deleteConfirmManager, setDeleteConfirmManager] = useState<ManagerProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<ManagerPermissions>(DEFAULT_MANAGER_PERMISSIONS);

  // Local storage fallback key for resilience
  const LOCAL_MANAGERS_KEY = 'super_admin_managers_list';

  const loadLocalManagers = (): ManagerProfile[] => {
    try {
      const data = localStorage.getItem(LOCAL_MANAGERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const saveLocalManagers = (list: ManagerProfile[]) => {
    try {
      localStorage.setItem(LOCAL_MANAGERS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  };

  const fetchManagers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Fetch profiles where role = 'manager'
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'manager')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch error, fallback to local storage:', error);
        setManagers(loadLocalManagers());
      } else if (data && data.length > 0) {
        const mapped: ManagerProfile[] = data.map((p: any) => ({
          id: p.id,
          full_name: p.full_name || 'Unnamed Manager',
          email: p.email || (p.id.includes('@') ? p.id : ''),
          phone: p.phone || '',
          role: 'manager',
          is_active: p.is_active !== false,
          created_at: p.created_at || new Date().toISOString(),
          permissions: {
            ...DEFAULT_MANAGER_PERMISSIONS,
            ...(p.permissions || {})
          }
        }));
        setManagers(mapped);
        saveLocalManagers(mapped);
      } else {
        // Fallback to local storage if remote returns empty but local has items
        const local = loadLocalManagers();
        setManagers(local);
      }
    } catch (err: any) {
      console.error('Error fetching managers:', err);
      setManagers(loadLocalManagers());
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const handleOpenAdd = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setIsActive(true);
    setFormPermissions({ ...DEFAULT_MANAGER_PERMISSIONS });
    setShowAddModal(true);
  };

  const handleOpenEdit = (m: ManagerProfile) => {
    setSelectedManager(m);
    setFullName(m.full_name);
    setEmail(m.email || '');
    setPhone(m.phone || '');
    setPassword('');
    setIsActive(m.is_active);
    setFormPermissions({
      ...DEFAULT_MANAGER_PERMISSIONS,
      ...(m.permissions || {})
    });
    setShowEditModal(true);
  };

  const togglePermission = (key: keyof ManagerPermissions) => {
    setFormPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveNewManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'ম্যানেজারের নাম প্রদান করুন।' });
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'ইমেইল অথবা ফোন নম্বর প্রদান করুন।' });
      return;
    }

    setIsSubmitting(true);
    try {
      const newManagerId = 'mgr_' + Date.now();
      const newManager: ManagerProfile = {
        id: newManagerId,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: 'manager',
        is_active: isActive,
        created_at: new Date().toISOString(),
        permissions: formPermissions
      };

        if (email.trim() && password.trim()) {
          try {
            const currentSession = (await supabase.auth.getSession()).data.session;
            await fetch('/api/admin/update-user-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email.trim().toLowerCase(),
                new_password: password.trim(),
                auth_token: currentSession?.access_token
              })
            });
          } catch (e) {
            console.warn('Auth user creation for manager error:', e);
          }
        }

        // 1. Try Supabase upsert
        try {
          const { error } = await supabase.from('profiles').insert({
          id: newManagerId,
          institution_id: 'super_admin',
          full_name: newManager.full_name,
          role: 'manager',
          is_active: newManager.is_active,
          permissions: {
            ...formPermissions,
            dashboard: formPermissions.can_view_dashboard,
            organizations: formPermissions.can_manage_committees,
            approvals: formPermissions.can_approve_payments,
          }
        });
        if (error) {
          console.warn('Profiles table insert warning:', error);
        }
      } catch (err) {
        console.warn('Direct insert skipped, updating local store:', err);
      }

      // 2. Update local state & storage
      const updated = [newManager, ...managers];
      setManagers(updated);
      saveLocalManagers(updated);

      setShowAddModal(false);
      setStatusModal({
        show: true,
        type: 'success',
        title: 'সফল হয়েছে',
        message: 'নতুন ম্যানেজার সফলভাবে যুক্ত করা হয়েছে।'
      });
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ হয়েছে', message: err.message || 'ম্যানেজার যোগ করতে সমস্যা হয়েছে।' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) return;
    if (!fullName.trim()) {
      setStatusModal({ show: true, type: 'error', title: 'ত্রুটি', message: 'ম্যানেজারের নাম প্রদান করুন।' });
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedItem: ManagerProfile = {
        ...selectedManager,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        is_active: isActive,
        permissions: formPermissions
      };

      // 1. If password provided, update user auth password
      if (password.trim()) {
        try {
          const currentSession = (await supabase.auth.getSession()).data.session;
          const res = await fetch('/api/admin/update-user-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: selectedManager.id,
              email: (email.trim() || selectedManager.email || '').toLowerCase(),
              new_password: password.trim(),
              auth_token: currentSession?.access_token
            })
          });
          const contentType = res.headers.get('content-type') || '';
          let resData: any = null;
          if (contentType.includes('application/json')) {
            resData = await res.json();
          }
          if (!res.ok || !resData?.success) {
            console.warn('API password update failed, attempting RPC fallback:', resData?.error);
            await supabase.rpc('update_user_by_admin', {
              p_user_id: selectedManager.id,
              p_password: password.trim()
            });
          }
        } catch (pwErr) {
          console.warn('Password update error:', pwErr);
          await supabase.rpc('update_user_by_admin', {
            p_user_id: selectedManager.id,
            p_password: password.trim()
          });
        }
      }

      // 2. Try Supabase update
      try {
        await supabase.from('profiles').update({
          full_name: updatedItem.full_name,
          is_active: updatedItem.is_active,
          permissions: {
            ...formPermissions,
            dashboard: formPermissions.can_view_dashboard,
            organizations: formPermissions.can_manage_committees,
            approvals: formPermissions.can_approve_payments,
          }
        }).eq('id', selectedManager.id);
      } catch (err) {
        console.warn('Supabase update warning:', err);
      }

      // 3. Update local state
      const updatedList = managers.map(m => m.id === selectedManager.id ? updatedItem : m);
      setManagers(updatedList);
      saveLocalManagers(updatedList);

      setShowEditModal(false);
      setSelectedManager(null);
      setStatusModal({
        show: true,
        type: 'success',
        title: 'আপডেট সফল',
        message: 'ম্যানেজারের তথ্য ও পারমিশন সফলভাবে আপডেট করা হয়েছে।'
      });
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ হয়েছে', message: err.message || 'আপডেট করতে সমস্যা হয়েছে।' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteManager = async () => {
    if (!deleteConfirmManager) return;
    setIsSubmitting(true);
    try {
      try {
        await supabase.from('profiles').delete().eq('id', deleteConfirmManager.id);
      } catch (e) {
        console.warn('Supabase delete error:', e);
      }

      const updated = managers.filter(m => m.id !== deleteConfirmManager.id);
      setManagers(updated);
      saveLocalManagers(updated);

      setDeleteConfirmManager(null);
      setStatusModal({
        show: true,
        type: 'success',
        title: 'মুছে ফেলা হয়েছে',
        message: 'ম্যানেজারকে সফলভাবে অপসারন করা হয়েছে।'
      });
    } catch (err: any) {
      setStatusModal({ show: true, type: 'error', title: 'ব্যর্থ হয়েছে', message: err.message || 'মুছে ফেলতে সমস্যা হয়েছে।' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleManagerStatus = async (m: ManagerProfile) => {
    const updatedStatus = !m.is_active;
    const updated = managers.map(item => item.id === m.id ? { ...item, is_active: updatedStatus } : item);
    setManagers(updated);
    saveLocalManagers(updated);

    try {
      await supabase.from('profiles').update({ is_active: updatedStatus }).eq('id', m.id);
    } catch (e) {
      console.warn('Status toggle error:', e);
    }

    setStatusModal({
      show: true,
      type: 'success',
      title: updatedStatus ? 'সক্রিয় করা হয়েছে' : 'নিষ্ক্রিয় করা হয়েছে',
      message: `${m.full_name} এর একাউন্ট স্ট্যাটাস পরিবর্তন করা হয়েছে।`
    });
  };

  const filteredManagers = managers.filter(m => {
    const q = searchQuery.toLowerCase();
    return m.full_name.toLowerCase().includes(q) || 
           (m.email && m.email.toLowerCase().includes(q)) ||
           (m.phone && m.phone.includes(q));
  });

  const PERMISSION_CONFIG: { key: keyof ManagerPermissions; titleBn: string; titleEn: string; descBn: string }[] = [
    {
      key: 'can_manage_committees',
      titleBn: 'কমিটি ম্যানেজমেন্ট',
      titleEn: 'Manage Committees',
      descBn: 'কমিটি তৈরি, তথ্য এডিট, মডিউল সক্রিয়/নিষ্ক্রিয় করা'
    },
    {
      key: 'can_approve_payments',
      titleBn: 'পেমেন্ট ও রিচার্জ অনুমোদন',
      titleEn: 'Payment & Topup Approvals',
      descBn: 'ইউজারদের এসএমএস ও ভয়েস রিচার্জ পেমেন্ট অনুমোদন বা বাতিল'
    },
    {
      key: 'can_view_dashboard',
      titleBn: 'সিস্টেম ড্যাশবোর্ড দেখা',
      titleEn: 'View System Dashboard',
      descBn: 'মোট কমিটি, অ্যাক্টিভ পোর্টাল ও রেভিনিউ পরিসংখ্যান দেখা'
    },
    {
      key: 'can_send_sms',
      titleBn: 'সিস্টেম বাল্ক এসএমএস',
      titleEn: 'Master Bulk SMS',
      descBn: 'সুপার অ্যাডমিন গেটওয়ে থেকে নোটিফিকেশন এসএমএস ব্রডকাস্ট'
    },
    {
      key: 'can_access_voice_service',
      titleBn: 'ভয়েস সার্ভিস ও ডিরেক্ট কল',
      titleEn: 'Voice Call Service',
      descBn: 'ভয়েস অডিও ফাইল আপলোড ও সার্বিক কল সার্ভিস পরিচালনা'
    },
    {
      key: 'can_manage_rates',
      titleBn: 'রেট ও প্যাকেজ ম্যানেজমেন্ট',
      titleEn: 'Rates & Pricing',
      descBn: 'এসএমএস ও ভয়েস কল রেট এবং বিক্রয় মূল্য নির্ধারণ'
    },
    {
      key: 'can_manage_tutorials',
      titleBn: 'টিউটোরিয়াল ম্যানেজমেন্ট',
      titleEn: 'Tutorial Guides',
      descBn: 'ভিডিও গাইডলাইন ও সহায়তা টিউটোরিয়াল যুক্ত/মুছে ফেলা'
    },
    {
      key: 'can_manage_managers',
      titleBn: 'অন্যান্য ম্যানেজার পরিচালনা',
      titleEn: 'Manage Other Managers',
      descBn: 'সাব-ম্যানেজার তৈরি এবং তাদের পারমিশন কনফিগার করা'
    }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-2 animate-in fade-in duration-300 pb-28">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[12px] bg-[#BFE8DD] dark:bg-teal-900/40 text-[#0fb5ab] flex items-center justify-center font-bold">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#22303C] dark:text-white font-noto">
              {lang === 'bn' ? 'ম্যানেজার প্যানেল' : 'Manager Management'}
            </h1>
            <p className="text-sm text-[#8A94A6] font-noto">
              {lang === 'bn' ? 'সুপার অ্যাডমিন সহকারী ও পারমিশন কন্ট্রোল' : 'Manage sub-administrators and role permissions'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchManagers()}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#22303C] dark:text-white rounded-[12px] hover:bg-slate-50 transition-all flex items-center gap-2 text-sm font-semibold active:scale-95"
            title="রিফ্রেশ"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-5 py-3 bg-[#0fb5ab] text-white rounded-[12px] font-bold text-sm shadow-md active:scale-95 hover:brightness-105 transition-all"
            >
              <UserPlus size={18} />
              <span>{lang === 'bn' ? 'নতুন ম্যানেজার' : 'Add Manager'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-[12px] bg-[#BFE8DD] text-[#0fb5ab] flex items-center justify-center font-bold">
            <Users size={22} />
          </div>
          <div>
            <h4 className="text-2xl font-extrabold text-[#22303C] dark:text-white">
              {managers.length}
            </h4>
            <p className="text-xs text-[#8A94A6] font-noto font-bold">
              {lang === 'bn' ? 'মোট ম্যানেজার' : 'Total Managers'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-[12px] bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-2xl font-extrabold text-[#22303C] dark:text-white">
              {managers.filter(m => m.is_active).length}
            </h4>
            <p className="text-xs text-[#8A94A6] font-noto font-bold">
              {lang === 'bn' ? 'সক্রিয় অ্যাকাউন্ট' : 'Active Accounts'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-[12px] bg-[#F6D9CE] text-[#e06d4e] flex items-center justify-center font-bold">
            <Shield size={22} />
          </div>
          <div>
            <h4 className="text-2xl font-extrabold text-[#22303C] dark:text-white">
              {managers.filter(m => m.permissions?.can_approve_payments).length}
            </h4>
            <p className="text-xs text-[#8A94A6] font-noto font-bold">
              {lang === 'bn' ? 'পেমেন্ট অনুমোদক' : 'Approval Access'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-[12px] bg-[#FBEFC9] text-amber-600 flex items-center justify-center font-bold">
            <Sliders size={22} />
          </div>
          <div>
            <h4 className="text-2xl font-extrabold text-[#22303C] dark:text-white">
              {managers.filter(m => m.permissions?.can_manage_committees).length}
            </h4>
            <p className="text-xs text-[#8A94A6] font-noto font-bold">
              {lang === 'bn' ? 'কমিটি নিয়ন্ত্রক' : 'Committee Access'}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <Search size={20} className="text-[#8A94A6] ml-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={lang === 'bn' ? 'ম্যানেজারের নাম, ইমেইল বা ফোন দিয়ে খুঁজুন...' : 'Search by name, email or phone...'}
          className="flex-1 bg-transparent border-none outline-none text-sm text-[#22303C] dark:text-white font-noto placeholder:text-[#8A94A6]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Managers List */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[20px] text-center border border-slate-100 dark:border-slate-800">
          <RefreshCw className="animate-spin mx-auto text-[#0fb5ab] mb-3" size={32} />
          <p className="text-sm font-bold text-[#8A94A6] font-noto">ম্যানেজার তালিকা লোড হচ্ছে...</p>
        </div>
      ) : filteredManagers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[20px] text-center border border-slate-100 dark:border-slate-800 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="w-16 h-16 rounded-full bg-[#BFE8DD] text-[#0fb5ab] flex items-center justify-center mx-auto mb-4 font-bold">
            <ShieldCheck size={32} />
          </div>
          <h3 className="text-lg font-bold text-[#22303C] dark:text-white font-noto mb-1">
            {searchQuery ? 'কোনো ম্যানেজার পাওয়া যায়নি' : 'এখনও কোনো ম্যানেজার যুক্ত করা হয়নি'}
          </h3>
          <p className="text-sm text-[#8A94A6] font-noto max-w-md mx-auto mb-6">
            {searchQuery 
              ? 'অনুগ্রহ করে অন্য কোনো নাম বা নম্বর দিয়ে খুঁজুন।'
              : 'সুপার অ্যাডমিন প্যানেল পরিচালনার জন্য নতুন সহকারী ম্যানেজার যোগ করুন এবং পারমিশন নির্ধারণ করুন।'}
          </p>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="px-6 py-3 bg-[#0fb5ab] text-white rounded-[12px] font-bold text-sm shadow-md active:scale-95 hover:brightness-105 transition-all inline-flex items-center gap-2"
            >
              <UserPlus size={18} />
              <span>{lang === 'bn' ? 'প্রথম ম্যানেজার যোগ করুন' : 'Add First Manager'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredManagers.map((m) => {
            const initial = m.full_name ? m.full_name.charAt(0).toUpperCase() : 'M';
            const permCount = Object.values(m.permissions || {}).filter(Boolean).length;

            return (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 p-6 rounded-[20px] shadow-[0_8px_24px_rgba(0,0,0,0.06)] border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
              >
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar with initial */}
                      <div className="w-12 h-12 rounded-full bg-[#0fb5ab] text-white flex items-center justify-center text-lg font-extrabold shadow-sm shrink-0">
                        {initial}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#22303C] dark:text-white font-noto">
                            {m.full_name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.is_active 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' 
                              : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                          }`}>
                            {m.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                          </span>
                        </div>
                        <div className="text-xs text-[#8A94A6] flex flex-wrap items-center gap-3 mt-1">
                          {m.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={12} /> {m.email}
                            </span>
                          )}
                          {m.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={12} /> {m.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Role badge */}
                    <div className="px-2.5 py-1 rounded-[12px] bg-[#BFE8DD] text-[#0fb5ab] text-xs font-extrabold font-noto">
                      ম্যানেজার
                    </div>
                  </div>

                  {/* Permissions chip summary */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto flex items-center gap-1.5">
                        <Lock size={13} className="text-[#0fb5ab]" />
                        পারমিশন সামারি ({permCount}/8)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.permissions?.can_manage_committees && (
                        <span className="px-2 py-1 bg-teal-50 dark:bg-teal-950/40 text-[#0fb5ab] rounded-full text-[11px] font-semibold">
                          কমিটি ম্যানেজ
                        </span>
                      )}
                      {m.permissions?.can_approve_payments && (
                        <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-full text-[11px] font-semibold">
                          পেমেন্ট অ্যাপ্রুভ
                        </span>
                      )}
                      {m.permissions?.can_view_dashboard && (
                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-full text-[11px] font-semibold">
                          ড্যাশবোর্ড
                        </span>
                      )}
                      {m.permissions?.can_send_sms && (
                        <span className="px-2 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full text-[11px] font-semibold">
                          বাল্ক SMS
                        </span>
                      )}
                      {m.permissions?.can_access_voice_service && (
                        <span className="px-2 py-1 bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 rounded-full text-[11px] font-semibold">
                          ভয়েস সার্ভিস
                        </span>
                      )}
                      {m.permissions?.can_manage_rates && (
                        <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full text-[11px] font-semibold">
                          রেট কনফিগ
                        </span>
                      )}
                      {m.permissions?.can_manage_tutorials && (
                        <span className="px-2 py-1 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-full text-[11px] font-semibold">
                          টিউটোরিয়াল
                        </span>
                      )}
                      {m.permissions?.can_manage_managers && (
                        <span className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full text-[11px] font-semibold">
                          ম্যানেজার অ্যাড
                        </span>
                      )}
                      {permCount === 0 && (
                        <span className="text-xs text-slate-400 italic font-noto">
                          কোনো পারমিশন দেওয়া হয়নি
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                {canManage && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => toggleManagerStatus(m)}
                      className="text-xs font-bold text-[#8A94A6] hover:text-[#22303C] dark:hover:text-white transition-colors font-noto"
                    >
                      {m.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#22303C] dark:text-white rounded-[12px] hover:bg-slate-50 transition-all text-xs font-bold flex items-center gap-1 active:scale-95"
                      >
                        <Edit2 size={13} />
                        <span>এডিট ও পারমিশন</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmManager(m)}
                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-[12px] transition-all active:scale-95"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Manager Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[20px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#BFE8DD] text-[#0fb5ab] flex items-center justify-center font-bold">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#22303C] dark:text-white font-noto">
                    নতুন ম্যানেজার যোগ করুন
                  </h3>
                  <p className="text-xs text-[#8A94A6] font-noto">
                    ম্যানেজারের তথ্য ও পারমিশন নির্বাচন করুন
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-[12px] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewManager} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto mb-1.5">
                    পূর্ণ নাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ম্যানেজারের নাম"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-sm text-[#22303C] dark:text-white outline-none focus:border-[#0fb5ab]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto mb-1.5">
                    ফোন নম্বর
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="০১XXXXXXXXX"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-sm text-[#22303C] dark:text-white outline-none focus:border-[#0fb5ab]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto mb-1.5">
                    লগইন ইমেইল
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@domain.com"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-sm text-[#22303C] dark:text-white outline-none focus:border-[#0fb5ab]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto mb-1.5">
                    পাসওয়ার্ড
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="লগইন পাসওয়ার্ড নির্ধারণ করুন"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-sm text-[#22303C] dark:text-white outline-none focus:border-[#0fb5ab]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Account Status Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-[12px]">
                <div>
                  <h4 className="text-sm font-bold text-[#22303C] dark:text-white font-noto">একাউন্ট স্ট্যাটাস</h4>
                  <p className="text-xs text-[#8A94A6] font-noto">নিষ্ক্রিয় থাকলে ম্যানেজার লগইন করতে পারবে না</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${isActive ? 'bg-[#0fb5ab]' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${isActive ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Permissions Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-extrabold text-[#22303C] dark:text-white font-noto flex items-center gap-2">
                    <Shield size={16} className="text-[#0fb5ab]" />
                    ম্যানেজার পারমিশন সমূহ (Permissions)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const allTrue = Object.values(formPermissions).every(Boolean);
                      const updated: ManagerPermissions = {};
                      Object.keys(DEFAULT_MANAGER_PERMISSIONS).forEach(k => {
                        (updated as any)[k] = !allTrue;
                      });
                      setFormPermissions(updated);
                    }}
                    className="text-xs text-[#0fb5ab] font-bold font-noto hover:underline"
                  >
                    {Object.values(formPermissions).every(Boolean) ? 'সব আনচেক করুন' : 'সব চেক করুন'}
                  </button>
                </div>

                {/* Permissions Grid */}
                <div className="space-y-2">
                  {PERMISSION_CONFIG.map(p => {
                    const checked = !!formPermissions[p.key];
                    return (
                      <div
                        key={p.key}
                        onClick={() => togglePermission(p.key)}
                        className={`p-3.5 rounded-[12px] border transition-all cursor-pointer flex items-center justify-between ${
                          checked
                            ? 'bg-teal-50/50 dark:bg-teal-950/20 border-[#0fb5ab]/40'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="flex-1 pr-3">
                          <h5 className="text-xs font-bold text-[#22303C] dark:text-white font-noto">
                            {p.titleBn}
                          </h5>
                          <p className="text-[11px] text-[#8A94A6] font-noto mt-0.5">
                            {p.descBn}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all ${
                          checked 
                            ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white' 
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}>
                          {checked && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#22303C] dark:text-white rounded-[12px] font-bold text-sm active:scale-95"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-[#0fb5ab] text-white rounded-[12px] font-bold text-sm shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Manager Modal */}
      {showEditModal && selectedManager && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[20px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#BFE8DD] text-[#0fb5ab] flex items-center justify-center font-bold">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#22303C] dark:text-white font-noto">
                    ম্যানেজার এডিট ও পারমিশন কনফিগ
                  </h3>
                  <p className="text-xs text-[#8A94A6] font-noto">
                    {selectedManager.full_name} এর এক্সেস কন্ট্রোল
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-[12px] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateManager} className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto mb-1.5">
                    পূর্ণ নাম *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-sm text-[#22303C] dark:text-white outline-none focus:border-[#0fb5ab]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto mb-1.5">
                    ফোন নম্বর
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-sm text-[#22303C] dark:text-white outline-none focus:border-[#0fb5ab]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#22303C] dark:text-slate-300 font-noto mb-1.5">
                  ইমেইল
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[12px] text-sm text-[#22303C] dark:text-white outline-none focus:border-[#0fb5ab]"
                />
              </div>

              {/* Account Status Switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-[12px]">
                <div>
                  <h4 className="text-sm font-bold text-[#22303C] dark:text-white font-noto">একাউন্ট স্ট্যাটাস</h4>
                  <p className="text-xs text-[#8A94A6] font-noto">নিষ্ক্রিয় থাকলে ম্যানেজার লগইন করতে পারবে না</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${isActive ? 'bg-[#0fb5ab]' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${isActive ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Permissions Block */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-extrabold text-[#22303C] dark:text-white font-noto flex items-center gap-2">
                    <Shield size={16} className="text-[#0fb5ab]" />
                    পারমিশন সেটিংস
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const allTrue = Object.values(formPermissions).every(Boolean);
                      const updated: ManagerPermissions = {};
                      Object.keys(DEFAULT_MANAGER_PERMISSIONS).forEach(k => {
                        (updated as any)[k] = !allTrue;
                      });
                      setFormPermissions(updated);
                    }}
                    className="text-xs text-[#0fb5ab] font-bold font-noto hover:underline"
                  >
                    {Object.values(formPermissions).every(Boolean) ? 'সব আনচেক করুন' : 'সব চেক করুন'}
                  </button>
                </div>

                <div className="space-y-2">
                  {PERMISSION_CONFIG.map(p => {
                    const checked = !!formPermissions[p.key];
                    return (
                      <div
                        key={p.key}
                        onClick={() => togglePermission(p.key)}
                        className={`p-3.5 rounded-[12px] border transition-all cursor-pointer flex items-center justify-between ${
                          checked
                            ? 'bg-teal-50/50 dark:bg-teal-950/20 border-[#0fb5ab]/40'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="flex-1 pr-3">
                          <h5 className="text-xs font-bold text-[#22303C] dark:text-white font-noto">
                            {p.titleBn}
                          </h5>
                          <p className="text-[11px] text-[#8A94A6] font-noto mt-0.5">
                            {p.descBn}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all ${
                          checked 
                            ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white' 
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}>
                          {checked && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#22303C] dark:text-white rounded-[12px] font-bold text-sm active:scale-95"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-[#0fb5ab] text-white rounded-[12px] font-bold text-sm shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'আপডেট হচ্ছে...' : 'আপডেট সম্পন্ন করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmManager && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[20px] p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-lg font-extrabold text-[#22303C] dark:text-white font-noto mb-2">
              আপনি কি নিশ্চিত?
            </h3>
            <p className="text-xs text-[#8A94A6] font-noto mb-6">
              ম্যানেজার <strong className="text-[#22303C] dark:text-white">{deleteConfirmManager.full_name}</strong> কে স্থায়ীভাবে সিস্টেম থেকে মুছে ফেলতে চান?
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirmManager(null)}
                className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#22303C] dark:text-white rounded-[12px] font-bold text-sm active:scale-95"
              >
                বাতিল
              </button>
              <button
                onClick={handleDeleteManager}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-red-600 text-white rounded-[12px] font-bold text-sm shadow-md active:scale-95"
              >
                {isSubmitting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, মুছুন'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
