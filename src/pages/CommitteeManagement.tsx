
import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Edit3, Trash2, Shield, 
  ChevronLeft, Loader2, CheckCircle2, AlertCircle,
  Smartphone, User, Briefcase, Lock, X, Save,
  Check, BookOpen, GraduationCap, Settings, 
  MessageSquare, Calendar, ClipboardCheck, Layout, TrendingUp, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Executive as Teacher, ExecutivePermissions as TeacherPermissions, Language, Institution, Department as Department } from 'types';
import { t } from 'translations';
import { supabase } from 'supabase';

interface CommitteeManagementProps {
  lang: Language;
  organization: Institution | null;
  onBack: () => void;
  role?: string;
  profile?: any;
}

const CommitteeManagement: React.FC<CommitteeManagementProps> = ({ lang, organization: madrasah, onBack, role, profile }) => {
  const isExecutive = role === 'executive';
  const canManageExecutives = !isExecutive || profile?.permissions?.can_manage_executives;

  if (!canManageExecutives) {
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
  const [executives, setExecutives] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExecutive, setSelectedExecutive] = useState<Teacher | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pin: '',
    designation: '',
    is_active: true
  });

  const [permissions, setPermissions] = useState<Partial<TeacherPermissions>>({
    can_manage_members: false,
    can_manage_attendance: false,
    can_manage_meetings: false,
    can_manage_accounting: false,
    can_send_sms: false,
    can_manage_classes: false,
    can_send_free_sms: false,
    can_use_voice_call: false,
    can_manage_settings: false,
    can_view_reports: false,
    allowed_departments: []
  });

  useEffect(() => {
    fetchExecutives();
    fetchDepartments();
  }, [madrasah?.id]);

  const fetchDepartments = async () => {
    if (!madrasah?.id) return;
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setDepartments(data || []);
    } catch (err: any) {
      console.error('Fetch departments error:', err);
    }
  };

  const fetchExecutives = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('executives')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setExecutives(data || []);
    } catch (err: any) {
      console.error('Fetch executives error:', err);
      setError(err.message || 'Failed to fetch executives');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!madrasah?.id) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        institution_id: madrasah.id,
        permissions
      };

      const { data, error } = await supabase
        .from('executives')
        .insert(payload)
        .select()
        .single();
        
      if (error) throw error;

      await fetchExecutives();
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      console.error('Create executive error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExecutive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExecutive) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        permissions
      };

      const { error } = await supabase
        .from('executives')
        .update(payload)
        .eq('id', selectedExecutive.id);

      if (error) throw error;
      
      await fetchExecutives();
      setShowEditModal(false);
      setSelectedExecutive(null);
      resetForm();
    } catch (err: any) {
      console.error('Update executive error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExecutive = async (id: string) => {
    if (!window.confirm(t('confirm_delete', lang))) return;
    
    try {
      const { error } = await supabase
        .from('executives')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchExecutives();
    } catch (err: any) {
      console.error('Delete executive error:', err);
      alert(err.message || 'Failed to delete executive');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      pin: '',
      designation: '',
      is_active: true
    });
    setPermissions({
      can_manage_members: false,
      can_manage_attendance: false,
      can_manage_meetings: false,
      can_manage_accounting: false,
      can_send_sms: false,
      can_manage_classes: false,
      can_send_free_sms: false,
      can_use_voice_call: false,
      can_manage_settings: false,
      can_view_reports: false,
      allowed_departments: []
    });
  };

  const openEditModal = (executive: Teacher) => {
    setSelectedExecutive(executive);
    setFormData({
      name: executive.name || '',
      phone: executive.phone || '',
      pin: '', 
      designation: executive.designation || '',
      is_active: executive.is_active
    });
    setPermissions(executive.permissions || {});
    setShowEditModal(true);
  };

  const filteredExecutives = executives.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.phone && t.phone.includes(searchQuery))
  );

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className={`min-h-screen pb-20 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`sticky top-0 z-30 px-4 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('executive_committee', lang)}
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {madrasah?.name}
              </p>
            </div>
          </div>
          <button 
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-slate-900 dark:bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">{t('add_executive', lang)}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder={lang === 'bn' ? 'নাম বা মোবাইল দিয়ে খুঁজুন...' : 'Search by name or mobile...'}
            className={`w-full pl-12 pr-4 py-4 border rounded-2xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 ${isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="text-blue-500 animate-spin" />
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest animate-pulse">Loading Committee...</p>
          </div>
        ) : filteredExecutives.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExecutives.map((executive) => (
              <motion.div 
                key={executive.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-3xl p-4 shadow-sm hover:shadow-md transition-all group ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${isDark ? 'bg-blue-900/20 text-blue-400 border-blue-900/30' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      <User size={24} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-black font-noto leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {executive.name}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {executive.designation || (lang === 'bn' ? 'সদস্য' : 'Executive Member')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => openEditModal(executive)}
                      className={`p-2 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteExecutive(executive.id)}
                      className={`p-2 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className={`flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Smartphone size={14} />
                    <span className="text-xs font-bold">{executive.phone}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {executive.permissions && Object.entries(executive.permissions)
                       .filter(([key, val]) => key.startsWith('can_') && val === true)
                       .map(([key]) => (
                        <div key={key} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          <Shield size={8} />
                          {key.replace('can_manage_', '').replace('can_send_', '').replace('can_use_', '').replace('_', ' ')}
                        </div>
                      ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className={`border rounded-[3rem] p-12 text-center space-y-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isDark ? 'bg-slate-800 text-slate-700' : 'bg-slate-50 text-slate-300'}`}>
              <Users size={40} />
            </div>
            <div>
              <h3 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {lang === 'bn' ? 'কোনো কমিটি সদস্য পাওয়া যায়নি' : 'No committee members found'}
              </h3>
              <p className="text-sm font-bold text-slate-400 mt-2">
                {lang === 'bn' ? 'নতুন সদস্য যোগ করতে উপরের বাটনে ক্লিক করুন' : 'Click the button above to add a new member'}
              </p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-lg rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-slate-900' : 'bg-white'}`}
            >
              <div className={`p-6 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    {showAddModal ? <UserPlus size={20} /> : <Edit3 size={20} />}
                  </div>
                  <h2 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {showAddModal ? t('add_executive', lang) : t('edit_executive', lang)}
                  </h2>
                </div>
                <button 
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                  className={`w-10 h-10 rounded-xl text-slate-400 flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={showAddModal ? handleAddExecutive : handleUpdateExecutive} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {error && (
                  <div className={`border p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${isDark ? 'bg-red-900/20 border-red-900/30 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Basic Information</h3>
                  <div className="space-y-4 px-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('executive_name', lang)}</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          required
                          className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700'}`}
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('designation', lang)}</label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700'}`}
                          value={formData.designation || ''}
                          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('phone', lang)}</label>
                      <div className="relative">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="tel" 
                          required
                          className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700'}`}
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('password', lang)}</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="password" 
                          required={showAddModal}
                          placeholder={showEditModal ? 'Leave blank to keep current' : ''}
                          className={`w-full pl-11 pr-4 py-3 border rounded-xl outline-none text-sm font-bold transition-all focus:border-blue-500/50 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-700'}`}
                          value={formData.pin || ''}
                          onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">{t('permissions', lang)}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'can_manage_members', label: t('members', lang), icon: <Users size={14} /> },
                      { key: 'can_manage_attendance', label: t('attendance', lang), icon: <ClipboardCheck size={14} /> },
                      { key: 'can_manage_meetings', label: t('meetings', lang), icon: <GraduationCap size={14} /> },
                      { key: 'can_manage_accounting', label: t('accounts', lang), icon: <Save size={14} /> },
                      { key: 'can_send_sms', label: t('sms', lang), icon: <MessageSquare size={14} /> },
                      { key: 'can_manage_classes', label: t('departments', lang), icon: <Layout size={14} /> },
                      { key: 'can_use_voice_call', label: t('voice_call', lang), icon: <Smartphone size={14} /> },
                      { key: 'can_manage_executives', label: t('executive_committee', lang), icon: <UserCheck size={14} /> },
                      { key: 'can_manage_settings', label: t('settings', lang), icon: <Settings size={14} /> },
                      { key: 'can_view_reports', label: t('reports', lang), icon: <TrendingUp size={14} /> },
                    ].map((perm) => (
                      <motion.label 
                        key={perm.key} 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${permissions[perm.key as keyof TeacherPermissions] ? (isDark ? 'bg-blue-900/20 border-blue-900/50' : 'bg-blue-50 border-blue-200 shadow-sm') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100')}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${permissions[perm.key as keyof TeacherPermissions] ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')}`}>
                            {perm.icon}
                          </div>
                          <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{perm.label}</span>
                        </div>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${permissions[perm.key as keyof TeacherPermissions] ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${permissions[perm.key as keyof TeacherPermissions] ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={permissions[perm.key as keyof TeacherPermissions] as boolean}
                          onChange={(e) => setPermissions({ ...permissions, [perm.key]: e.target.checked })}
                        />
                      </motion.label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 shrink-0">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-950/20 flex items-center justify-center gap-3 text-sm uppercase tracking-[0.2em] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> {t('save', lang)}</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CommitteeManagement;
