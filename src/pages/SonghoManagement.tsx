import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, Plus, Trash2, CheckCircle2, Sliders, 
  FileText, Shield, DollarSign, Calendar, Users, AlertCircle, 
  Printer, Copy, Sparkles, BookOpen, Layers, Check, RefreshCw, 
  Settings, Award, HelpCircle, ChevronRight, X, ExternalLink
} from 'lucide-react';
import { Institution, Language, Profile } from '../types';
import { supabase } from '../supabase';
import { 
  SONGHO_ACTIVITIES, SonghoActivityDef, SonghoProject,
  getActiveSonghoActivities, getSonghoActivity, getDefaultSonghoActivityIds 
} from '../utils/songhoActivities';

interface Props {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role?: string;
  profile?: Profile | null;
  onUpdate?: () => void;
}

const SonghoManagement: React.FC<Props> = ({ 
  lang, 
  madrasah, 
  onBack, 
  role, 
  profile,
  onUpdate 
}) => {
  const isDark = madrasah?.theme === 'dark';
  const parsedConfig = madrasah?.config_json || {} as any;

  // Selected active activities for this Sangha
  const initialActiveActivities: string[] = Array.isArray(parsedConfig?.songho_activities) && parsedConfig.songho_activities.length > 0
    ? parsedConfig.songho_activities
    : getDefaultSonghoActivityIds();

  const [activeActivityIds, setActiveActivityIds] = useState<string[]>(initialActiveActivities);
  const [selectedTab, setSelectedTab] = useState<string>(initialActiveActivities[0] || 'islamic');
  const [showActivityPickerModal, setShowActivityPickerModal] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Songho Config state (keyed by activity ID)
  const [activitiesConfig, setActivitiesConfig] = useState<Record<string, any>>(parsedConfig?.songho_config || {});

  // General Policy state
  const [generalPolicy, setGeneralPolicy] = useState<{
    constitution?: string;
    membership_rules?: string;
    financial_rules?: string;
    code_of_conduct?: string;
  }>(parsedConfig?.songho_general_policy || {
    constitution: '১. সংঘের উদ্দেশ্য: সামাজিক কল্যাণ, নৈতিক উন্নয়ন ও সদস্যদের সক্রিয় অংশগ্রহণের মাধ্যমে সমাজ সংস্কার।\n২. কার্যনির্বাহী কমিটি ও সাধারণ পরিষদের যৌথ পরামর্শে সকল সিদ্ধান্ত গৃহীত হবে।\n৩. সংঘের অর্থ আত্মসাৎ বা বিশৃঙ্খলা সৃষ্টি সম্পূর্ণ নিষিদ্ধ।',
    membership_rules: '১. যেকোনো সৎ ও দায়িত্ববান নাগরিক সংঘের সদস্য হতে পারবেন।\n২. সদস্যদের নিয়মিত চাঁদা ও নির্ধারিত সভায় উপস্থিতি কাম্য।\n৩. শৃঙ্খলা ভঙ্গে সদস্যপদ স্থগিত বা বাতিলযোগ্য হবে।',
    financial_rules: '১. সংঘের নামে ব্যাংক হিসাব পরিচালিত হবে (যৌথ স্বাক্ষরে)।\n২. সকল আয়-ব্যয়ের ভাউচার ক্যাশিয়ার কর্তৃক সংরক্ষিত থাকবে।\n৩. বার্ষিক সাধারণ সভায় অডিট রিপোর্ট পেশ করতে হবে।',
    code_of_conduct: '১. পারস্পরিক ভ্রাতৃত্ব ও সৌহার্দ্য রক্ষা করতে হবে।\n২. রাজনৈতিক বা সংকীর্ণ বিদ্বেষমূলক আলোচনা পরিহার করতে হবে।'
  });

  // Project Modal for adding/editing project in an activity
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [newProject, setNewProject] = useState<Partial<SonghoProject>>({
    title: '',
    description: '',
    status: 'planning',
    targetBudget: '',
    leadPerson: ''
  });

  // Document preview modal
  const [activeDocPreview, setActiveDocPreview] = useState<{
    title: string;
    content: string;
  } | null>(null);

  // Sync state if madrasah config updates
  useEffect(() => {
    if (parsedConfig?.songho_activities && Array.isArray(parsedConfig.songho_activities)) {
      setActiveActivityIds(parsedConfig.songho_activities);
      if (!parsedConfig.songho_activities.includes(selectedTab) && !['general_policy', 'central_docs', 'reports_audit'].includes(selectedTab)) {
        setSelectedTab(parsedConfig.songho_activities[0] || 'islamic');
      }
    }
    if (parsedConfig?.songho_config) {
      setActivitiesConfig(parsedConfig.songho_config);
    }
    if (parsedConfig?.songho_general_policy) {
      setGeneralPolicy(parsedConfig.songho_general_policy);
    }
  }, [madrasah]);

  const activeActivityDefs = getActiveSonghoActivities(activeActivityIds);
  const currentActivityDef = getSonghoActivity(selectedTab);

  // Helper to get current activity's config
  const currentActivityConfig = activitiesConfig[selectedTab] || {
    is_active: true,
    coordinator_name: '',
    coordinator_phone: '',
    coordinator_email: '',
    goals: currentActivityDef?.defaultGoals?.join('\n') || '',
    meeting_frequency: 'মাসিক (Monthly)',
    allocated_budget: '',
    fund_source: 'সাধারণ তহবিল ও বিশেষ অনুদান',
    rules_and_policies: currentActivityDef?.defaultPolicies || '',
    projects: [],
    custom_notes: ''
  };

  const handleUpdateCurrentActivityConfig = (field: string, value: any) => {
    setActivitiesConfig(prev => ({
      ...prev,
      [selectedTab]: {
        ...(prev[selectedTab] || {}),
        [field]: value
      }
    }));
  };

  const handleToggleActivity = (activityId: string) => {
    let updated: string[];
    if (activeActivityIds.includes(activityId)) {
      if (activeActivityIds.length === 1) {
        alert(lang === 'bn' ? 'কমপক্ষে একটি কার্যক্রম নির্বাচন থাকতে হবে।' : 'At least one activity must remain active.');
        return;
      }
      updated = activeActivityIds.filter(id => id !== activityId);
      if (selectedTab === activityId) {
        setSelectedTab(updated[0] || 'general_policy');
      }
    } else {
      updated = [...activeActivityIds, activityId];
    }
    setActiveActivityIds(updated);
  };

  const handleSaveAll = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const updatedConfig = {
        ...parsedConfig,
        songho_activities: activeActivityIds,
        songho_config: activitiesConfig,
        songho_general_policy: generalPolicy
      };

      const { error } = await supabase
        .from('institutions')
        .update({
          config_json: updatedConfig
        })
        .eq('id', madrasah.id);

      if (error) throw error;

      setToastMessage(lang === 'bn' ? 'সংঘের সকল ম্যানেজমেন্ট ও কার্যক্রম সেটিংস সফলভাবে সংরক্ষিত হয়েছে!' : 'Sangha management settings saved successfully!');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);

      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Error saving songho config:', err);
      alert(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProject = () => {
    if (!newProject.title?.trim()) {
      alert(lang === 'bn' ? 'প্রকল্প/উদ্যোগের নাম লিখুন' : 'Please enter project title');
      return;
    }

    const currentProjects: SonghoProject[] = currentActivityConfig.projects || [];
    const projectItem: SonghoProject = {
      id: `proj_${Date.now()}`,
      title: newProject.title.trim(),
      description: newProject.description || '',
      status: (newProject.status as any) || 'planning',
      targetBudget: newProject.targetBudget || '',
      leadPerson: newProject.leadPerson || '',
      startDate: new Date().toISOString().split('T')[0]
    };

    handleUpdateCurrentActivityConfig('projects', [projectItem, ...currentProjects]);
    setNewProject({ title: '', description: '', status: 'planning', targetBudget: '', leadPerson: '' });
    setShowProjectModal(false);
  };

  const handleDeleteProject = (projectId: string) => {
    const currentProjects: SonghoProject[] = currentActivityConfig.projects || [];
    const updated = currentProjects.filter(p => p.id !== projectId);
    handleUpdateCurrentActivityConfig('projects', updated);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(lang === 'bn' ? 'টেক্সট কপি করা হয়েছে!' : 'Text copied to clipboard!');
  };

  const handlePrintDocument = (title: string, content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${madrasah?.name || 'সংঘ'}</title>
          <style>
            body { font-family: 'SolaimanLipi', 'SutonnyMJ', 'Noto Sans Bengali', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.8; }
            .header { text-align: center; border-bottom: 2px solid #0fb5ab; padding-bottom: 15px; margin-bottom: 30px; }
            .org-name { font-size: 24px; font-weight: bold; color: #0fb5ab; margin: 0; }
            .doc-title { font-size: 18px; font-weight: bold; margin-top: 10px; color: #334155; }
            .content { font-size: 14px; white-space: pre-wrap; margin-bottom: 50px; }
            .footer { display: flex; justify-content: space-between; margin-top: 80px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
            .sign-box { text-align: center; width: 200px; }
            .sign-line { border-top: 1px solid #475569; margin-top: 50px; padding-top: 5px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="org-name">${madrasah?.name || 'সংঘের নাম'}</h1>
            <div class="doc-title">${title}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">তারিখ: ${new Date().toLocaleDateString('bn-BD')}</div>
          </div>
          <div class="content">${content}</div>
          <div class="footer">
            <div class="sign-box">
              <div class="sign-line">সমন্বয়কারী / দায়িত্বপ্রাপ্ত কর্মকর্তা</div>
            </div>
            <div class="sign-box">
              <div class="sign-line">সভাপতি / সাধারণ সম্পাদক</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Calculate total budget & projects across all active activities
  const totalAllocatedBudget = activeActivityIds.reduce((sum, actId) => {
    const cfg = activitiesConfig[actId];
    const b = parseFloat(cfg?.allocated_budget || 0);
    return sum + (isNaN(b) ? 0 : b);
  }, 0);

  const totalActiveProjects = activeActivityIds.reduce((sum, actId) => {
    const cfg = activitiesConfig[actId];
    return sum + (cfg?.projects?.length || 0);
  }, 0);

  return (
    <div className={`min-h-screen pb-32 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50/70 text-slate-800'}`}>
      
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400">
            <CheckCircle2 size={24} />
            <span className="font-black text-sm">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header Container */}
      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border-b sticky top-0 z-30 shadow-sm backdrop-blur-md bg-opacity-90`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Title & Back */}
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack}
                className={`p-3 rounded-2xl border transition-all ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white' 
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
                title="Back to Account"
              >
                <ArrowLeft size={20} />
              </button>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className={`text-xl sm:text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                    {lang === 'bn' ? 'সংঘ ম্যানেজমেন্ট ও নীতিমালা' : 'Sangha Management & Activities'}
                  </h1>
                  <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#42f5e9]/10 text-[#0fb5ab] border border-[#42f5e9]/20">
                    {madrasah?.name || 'সংঘ'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  {lang === 'bn' 
                    ? `${activeActivityIds.length}টি সক্রিয় কার্যক্রম সমন্বিত ব্যবস্থাপনা` 
                    : `${activeActivityIds.length} active activities dynamic management`}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 self-end sm:self-auto">
              <button
                onClick={() => setShowActivityPickerModal(true)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs transition-all border shadow-sm active:scale-95 ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-[#42f5e9] hover:bg-slate-750' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <Sliders size={16} />
                <span>{lang === 'bn' ? 'কার্যক্রম নির্বাচন' : 'Manage Activities'} ({activeActivityIds.length})</span>
              </button>

              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs transition-all shadow-premium active:scale-95 bg-[#42f5e9] text-[#0fb5ab] hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                <span>{saving ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'সব সংরক্ষণ করুন' : 'Save All Changes')}</span>
              </button>
            </div>

          </div>
        </div>

        {/* Dynamic Activity Tabs Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 overflow-x-auto py-2.5 no-scrollbar scroll-smooth">
            
            {/* Active Activities List */}
            {activeActivityDefs.map((activity) => {
              const IconComp = activity.icon;
              const isSelected = selectedTab === activity.id;

              return (
                <button
                  key={activity.id}
                  onClick={() => setSelectedTab(activity.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                    isSelected
                      ? (isDark 
                          ? 'bg-[#0fb5ab] text-white border-[#42f5e9]/40 shadow-md scale-105' 
                          : 'bg-[#0fb5ab] text-white border-[#0fb5ab] shadow-md scale-105')
                      : (isDark 
                          ? 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')
                  }`}
                >
                  <IconComp size={15} />
                  <span>{lang === 'bn' ? activity.labelBn : activity.labelEn}</span>
                </button>
              );
            })}

            {/* General Policy & Documents Tabs */}
            <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />

            <button
              onClick={() => setSelectedTab('general_policy')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                selectedTab === 'general_policy'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md scale-105'
                  : (isDark ? 'bg-slate-800/80 border-slate-700/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600')
              }`}
            >
              <Shield size={15} />
              <span>{lang === 'bn' ? 'সাধারণ নীতিমালা' : 'General Bylaws'}</span>
            </button>

            <button
              onClick={() => setSelectedTab('central_docs')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                selectedTab === 'central_docs'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md scale-105'
                  : (isDark ? 'bg-slate-800/80 border-slate-700/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600')
              }`}
            >
              <FileText size={15} />
              <span>{lang === 'bn' ? 'চুক্তি ও ডকুমেন্টস' : 'Deeds & Documents'}</span>
            </button>

            <button
              onClick={() => setSelectedTab('reports_audit')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all border ${
                selectedTab === 'reports_audit'
                  ? 'bg-cyan-700 text-white border-cyan-600 shadow-md scale-105'
                  : (isDark ? 'bg-slate-800/80 border-slate-700/60 text-slate-300' : 'bg-white border-slate-200 text-slate-600')
              }`}
            >
              <Layers size={15} />
              <span>{lang === 'bn' ? 'সংশ্লিষ্ট রিপোর্ট ও হিসাব' : 'Reports & Audit'}</span>
            </button>

          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">

        {/* 1. If an individual Activity is selected */}
        {currentActivityDef && selectedTab !== 'general_policy' && selectedTab !== 'central_docs' && selectedTab !== 'reports_audit' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Activity Hero Banner */}
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                    currentActivityDef.bgLight
                  }`}>
                    {React.createElement(currentActivityDef.icon, { 
                      size: 32, 
                      className: currentActivityDef.textColor 
                    })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className={`text-2xl font-black font-noto ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {lang === 'bn' ? currentActivityDef.labelBn : currentActivityDef.labelEn} {lang === 'bn' ? 'কার্যক্রম' : 'Wing'}
                      </h2>
                      <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${currentActivityDef.badgeBg}`}>
                        {lang === 'bn' ? 'সক্রিয় উইং' : 'Active Wing'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                      {lang === 'bn' ? currentActivityDef.shortDescBn : currentActivityDef.shortDescEn}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`p-4 rounded-2xl border text-center min-w-[120px] ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {lang === 'bn' ? 'বরাদ্দকৃত বাজেট' : 'Budget'}
                    </p>
                    <p className="text-lg font-black text-[#0fb5ab] mt-0.5">
                      ৳ {currentActivityConfig.allocated_budget || '০'}
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl border text-center min-w-[120px] ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {lang === 'bn' ? 'উদ্যোগ/প্রকল্প' : 'Projects'}
                    </p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {currentActivityConfig.projects?.length || 0} টি
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid of Sections: Operational Settings, Leadership, Goals, Projects, Policies, Documents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Box 1: পরিচালনা ও সমন্বয়কারী তথ্য (Leadership & Operational) */}
              <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Users size={18} className="text-[#0fb5ab]" />
                  <h3 className="font-black text-sm font-noto">
                    {lang === 'bn' ? '১. পরিচালনা ও সমন্বয়কারী তথ্য' : '1. Leadership & Operations'}
                  </h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                      {lang === 'bn' ? 'দায়িত্বপ্রাপ্ত সমন্বয়কারী / প্রধানের নাম' : 'Coordinator / Lead Person'}
                    </label>
                    <input 
                      type="text"
                      className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none transition-all ${
                        isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                      placeholder="যেমন: মাওলানা হাফিজুর রহমান / মো: রফিকুল ইসলাম"
                      value={currentActivityConfig.coordinator_name || ''}
                      onChange={(e) => handleUpdateCurrentActivityConfig('coordinator_name', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                        {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone Number'}
                      </label>
                      <input 
                        type="tel"
                        className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none transition-all ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                        placeholder="017xxxxxxxx"
                        value={currentActivityConfig.coordinator_phone || ''}
                        onChange={(e) => handleUpdateCurrentActivityConfig('coordinator_phone', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                        {lang === 'bn' ? 'মিটিং / সেশন শিডিউল' : 'Meeting / Session Schedule'}
                      </label>
                      <select
                        className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none transition-all ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                        value={currentActivityConfig.meeting_frequency || 'মাসিক'}
                        onChange={(e) => handleUpdateCurrentActivityConfig('meeting_frequency', e.target.value)}
                      >
                        <option value="সাপ্তাহিক (Weekly)">সাপ্তাহিক (Weekly)</option>
                        <option value="পাক্ষিক (Fortnightly)">পাক্ষিক (Fortnightly)</option>
                        <option value="মাসিক (Monthly)">মাসিক (Monthly)</option>
                        <option value="ত্রৈমাসিক (Quarterly)">ত্রৈমাসিক (Quarterly)</option>
                        <option value="ইভেন্ট ভিত্তিক (Event Based)">ইভেন্ট ভিত্তিক (Event Based)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                        {lang === 'bn' ? 'বরাদ্দকৃত বাজেট (টাকা)' : 'Allocated Budget (BDT)'}
                      </label>
                      <input 
                        type="number"
                        className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none transition-all ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                        placeholder="যেমন: ৫০,০০০"
                        value={currentActivityConfig.allocated_budget || ''}
                        onChange={(e) => handleUpdateCurrentActivityConfig('allocated_budget', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                        {lang === 'bn' ? 'তহবিল ও আয়ের উৎস' : 'Fund Source'}
                      </label>
                      <input 
                        type="text"
                        className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none transition-all ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                        placeholder="যেমন: সাধারণ ফান্ড / অনুদান / স্পন্সর"
                        value={currentActivityConfig.fund_source || ''}
                        onChange={(e) => handleUpdateCurrentActivityConfig('fund_source', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2: লক্ষ্য ও উদ্দেশ্য (Goals & Objectives) */}
              <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Sparkles size={18} className="text-amber-500" />
                    <h3 className="font-black text-sm font-noto">
                      {lang === 'bn' ? '২. লক্ষ্য ও উদ্দেশ্য' : '2. Goals & Scope'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => handleUpdateCurrentActivityConfig('goals', currentActivityDef.defaultGoals.join('\n'))}
                    className="text-[10px] font-black text-[#0fb5ab] hover:underline"
                  >
                    {lang === 'bn' ? 'ডিফল্ট লক্ষ্য রিসেট' : 'Reset Default'}
                  </button>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={6}
                    className={`w-full p-4 rounded-2xl border font-bold text-xs outline-none transition-all leading-relaxed ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    placeholder="এই কার্যক্রমের মূল লক্ষ্যসমূহ উল্লেখ করুন..."
                    value={currentActivityConfig.goals || ''}
                    onChange={(e) => handleUpdateCurrentActivityConfig('goals', e.target.value)}
                  />
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                    💡 পরামর্শ: প্রতিটি লক্ষ্য নতুন লাইনে লিখুন যাতে সদস্য ও কমিটির মাঝে স্পষ্টভাবে বাস্তবায়িত হয়।
                  </div>
                </div>
              </div>

            </div>

            {/* Box 3: উদ্যোগ ও প্রকল্প ট্র্যাকার (Interactive Project / Initiative Tracker) */}
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-6 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-noto">
                      {lang === 'bn' ? 'চলমান ও পরিকল্পিত উদ্যোগসমূহ' : 'Initiatives & Project Tracker'}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold">
                      {lang === 'bn' ? 'এই কার্যক্রমের অধীনে সকল প্রজেক্ট, ইভেন্ট ও কর্মসূচির তালিকা' : 'Manage active campaigns, events, and sub-projects'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowProjectModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md active:scale-95 self-start sm:self-auto"
                >
                  <Plus size={16} />
                  <span>{lang === 'bn' ? 'নতুন উদ্যোগ যোগ করুন' : 'Add Project / Initiative'}</span>
                </button>
              </div>

              {/* Project List */}
              {currentActivityConfig.projects && currentActivityConfig.projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentActivityConfig.projects.map((proj: SonghoProject) => (
                    <div 
                      key={proj.id}
                      className={`p-5 rounded-2xl border transition-all relative group ${
                        isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          proj.status === 'completed' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'
                            : proj.status === 'ongoing'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                        }`}>
                          {proj.status === 'completed' ? 'সম্পন্ন' : proj.status === 'ongoing' ? 'চলমান' : 'পরিকল্পিত'}
                        </span>
                        
                        <button 
                          onClick={() => handleDeleteProject(proj.id)}
                          className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <h4 className="font-black text-sm mt-2 text-slate-900 dark:text-white font-noto">
                        {proj.title}
                      </h4>
                      {proj.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {proj.description}
                        </p>
                      )}

                      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>দায়িত্ব: {proj.leadPerson || 'কমিটি'}</span>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">
                          {proj.targetBudget ? `৳ ${proj.targetBudget}` : 'বাজেট নেই'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-12 rounded-2xl border-2 border-dashed ${
                  isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <Calendar size={36} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-xs font-bold text-slate-400">
                    {lang === 'bn' ? 'কোনো উদ্যোগ বা প্রজেক্ট যোগ করা হয়নি।' : 'No initiatives added yet for this activity.'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    উপরের 'নতুন উদ্যোগ যোগ করুন' বাটনে ক্লিক করে প্রজেক্ট যুক্ত করুন।
                  </p>
                </div>
              )}
            </div>

            {/* Box 4: নীতিমালা ও কার্যপ্রণালী (Activity-Specific Policies) */}
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Shield size={18} className="text-[#0fb5ab]" />
                  <h3 className="font-black text-sm font-noto">
                    {lang === 'bn' ? 'কার্যক্রম ভিত্তিক বিশেষ নীতিমালা ও দিকনির্দেশনা' : 'Activity Policies & Guidelines'}
                  </h3>
                </div>
                <button
                  onClick={() => handleUpdateCurrentActivityConfig('rules_and_policies', currentActivityDef.defaultPolicies)}
                  className="text-[10px] font-black text-[#0fb5ab] hover:underline"
                >
                  {lang === 'bn' ? 'আদর্শ নীতিমালা লোড করুন' : 'Load Standard Guidelines'}
                </button>
              </div>

              <textarea
                rows={6}
                className={`w-full p-4 rounded-2xl border font-bold text-xs outline-none transition-all leading-relaxed ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
                placeholder="এই কার্যক্রম সংক্রান্ত বিশেষ নিয়মাবলী ও আচরণবিধি..."
                value={currentActivityConfig.rules_and_policies || ''}
                onChange={(e) => handleUpdateCurrentActivityConfig('rules_and_policies', e.target.value)}
              />
            </div>

            {/* Box 5: চুক্তিপত্র ও ডকুমেন্টস টেমপ্লেট (Deeds, MOUs & Templates) */}
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-6 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black font-noto">
                    {lang === 'bn' ? 'চুক্তিপত্র, অঙ্গীকারনামা ও ফর্মসমূহ' : 'Activity Deeds & Document Templates'}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    {lang === 'bn' ? 'সংশ্লিষ্ট কার্যক্রম পরিচালনার জন্য প্রস্তুতকৃত অফিশিয়াল চুক্তি ও অঙ্গীকারনামা' : 'Ready-to-print official deeds and agreements'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentActivityDef.documentTemplates?.map((doc) => (
                  <div 
                    key={doc.id}
                    className={`p-5 rounded-2xl border flex flex-col justify-between ${
                      isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                        {doc.type}
                      </span>
                      <h4 className="font-black text-sm mt-2 text-slate-900 dark:text-white font-noto">
                        {doc.titleBn}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium line-clamp-3">
                        {doc.contentBn}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700">
                      <button
                        onClick={() => setActiveDocPreview({ title: doc.titleBn, content: doc.contentBn })}
                        className="flex-1 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <FileText size={14} />
                        <span>প্রিভিউ ও এডিট</span>
                      </button>

                      <button
                        onClick={() => handlePrintDocument(doc.titleBn, doc.contentBn)}
                        className="p-2 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
                        title="প্রিন্ট করুন"
                      >
                        <Printer size={16} />
                      </button>

                      <button
                        onClick={() => handleCopyText(doc.contentBn)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="কপি করুন"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* 2. General Bylaws Tab */}
        {selectedTab === 'general_policy' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-6 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Shield size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black font-noto">
                    {lang === 'bn' ? 'সংঘের সাধারণ গঠনতন্ত্র ও সামগ্রিক নীতিমালা' : 'Sangha Constitution & General Policies'}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold">
                    {lang === 'bn' ? 'সকল কার্যক্রমের মূল ভিত্তি ও পরিচালনা সংক্রান্ত কেন্দ্রীয় নিয়মাবলী' : 'Central governance bylaws and codes'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. গঠনতন্ত্র */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    ১. মূল গঠনতন্ত্র ও পরিচালনা নীতি
                  </label>
                  <textarea
                    rows={6}
                    className={`w-full p-4 rounded-2xl border font-bold text-xs outline-none transition-all leading-relaxed ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    value={generalPolicy.constitution || ''}
                    onChange={(e) => setGeneralPolicy(prev => ({ ...prev, constitution: e.target.value }))}
                  />
                </div>

                {/* 2. সদস্যপদের নিয়মাবলী */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    ২. সদস্য অন্তর্ভুক্তি ও দায়িত্ব নীতি
                  </label>
                  <textarea
                    rows={6}
                    className={`w-full p-4 rounded-2xl border font-bold text-xs outline-none transition-all leading-relaxed ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    value={generalPolicy.membership_rules || ''}
                    onChange={(e) => setGeneralPolicy(prev => ({ ...prev, membership_rules: e.target.value }))}
                  />
                </div>

                {/* 3. অর্থ ও তহবিল নীতি */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    ৩. অর্থায়ন ও তহবিল নীতিমালা
                  </label>
                  <textarea
                    rows={6}
                    className={`w-full p-4 rounded-2xl border font-bold text-xs outline-none transition-all leading-relaxed ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    value={generalPolicy.financial_rules || ''}
                    onChange={(e) => setGeneralPolicy(prev => ({ ...prev, financial_rules: e.target.value }))}
                  />
                </div>

                {/* 4. আচরণবিধি ও শৃঙ্খলা */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    ৪. শৃঙ্খলা ও আচরণবিধি (Code of Conduct)
                  </label>
                  <textarea
                    rows={6}
                    className={`w-full p-4 rounded-2xl border font-bold text-xs outline-none transition-all leading-relaxed ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    value={generalPolicy.code_of_conduct || ''}
                    onChange={(e) => setGeneralPolicy(prev => ({ ...prev, code_of_conduct: e.target.value }))}
                  />
                </div>

              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-8 py-3 rounded-2xl font-black text-xs bg-[#42f5e9] text-[#0fb5ab] shadow-premium active:scale-95 transition-all flex items-center gap-2"
                >
                  <Save size={16} />
                  <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'সাধারণ নীতিমালা সংরক্ষণ করুন'}</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 3. Central Deeds & Documents Tab */}
        {selectedTab === 'central_docs' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-6 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black font-noto">
                    {lang === 'bn' ? 'কেন্দ্রীয় চুক্তি, রেজুলেশন ও ফরম সংগ্রহশালা' : 'Central Deeds, Resolutions & Forms'}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold">
                    {lang === 'bn' ? 'সংঘের অফিশিয়াল প্রিন্টযোগ্য ও কার্যকর চুক্তিপত্রসমূহ' : 'Official downloadable agreements and resolution drafts'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Doc 1: সদস্যপদ অঙ্গীকারনামা */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                      সদস্যপদ ফরম
                    </span>
                    <h4 className="font-black text-sm mt-2 text-slate-900 dark:text-white font-noto">
                      সাধারণ সদস্যপদ আবেদন ও অঙ্গীকারনামা
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium line-clamp-3">
                      আমি অত্র সংঘের গঠনতন্ত্র, লক্ষ্য ও উদ্দেশ্যের সাথে পূর্ণ একমত পোষণ করে সদস্যপদের আবেদন করছি এবং সংঘের সকল নিয়মকানুন মেনে চলার অঙ্গীকার করছি।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700">
                    <button
                      onClick={() => handlePrintDocument('সাধারণ সদস্যপদ আবেদন ও অঙ্গীকারনামা', `আমি অত্র সংঘের গঠনতন্ত্র, লক্ষ্য ও উদ্দেশ্যের সাথে পূর্ণ একমত পোষণ করে সদস্যপদের আবেদন করছি এবং সংঘের সকল নিয়মকানুন মেনে চলার অঙ্গীকার করছি।\n\nআবেদনকারীর নাম:\nপিতার নাম:\nমোবাইল নম্বর:\nবর্তমান ঠিকানা:`)}
                      className="flex-1 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Printer size={14} />
                      <span>প্রিন্ট করুন</span>
                    </button>
                  </div>
                </div>

                {/* Doc 2: কার্যনির্বাহী পর্ষদ শপথপত্র */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                      শপথপত্র
                    </span>
                    <h4 className="font-black text-sm mt-2 text-slate-900 dark:text-white font-noto">
                      কার্যনির্বাহী সদস্য দায়িত্ব শপথপত্র
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium line-clamp-3">
                      আমি সততা, নিষ্ঠা ও নিঃস্বার্থ মনোভাবের সাথে সংঘের কার্যনির্বাহী পর্ষদের অর্পিত দায়িত্ব পালন করব। ব্যক্তিগত স্বার্থের ঊর্ধ্বে সংঘের সম্মান রক্ষা করব।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700">
                    <button
                      onClick={() => handlePrintDocument('কার্যনির্বাহী সদস্য দায়িত্ব শপথপত্র', `আমি সততা, নিষ্ঠা ও নিঃস্বার্থ মনোভাবের সাথে সংঘের কার্যনির্বাহী পর্ষদের অর্পিত দায়িত্ব পালন করব। ব্যক্তিগত স্বার্থের ঊর্ধ্বে সংঘের সম্মান রক্ষা করব।\n\nসদস্যের নাম:\nপদবি:\nস্বাক্ষর:`)}
                      className="flex-1 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Printer size={14} />
                      <span>প্রিন্ট করুন</span>
                    </button>
                  </div>
                </div>

                {/* Doc 3: সাধারণ সভা রেজুলেশন ফরম্যাট */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                      রেজুলেশন
                    </span>
                    <h4 className="font-black text-sm mt-2 text-slate-900 dark:text-white font-noto">
                      মাসিক / বার্ষিক সাধারণ সভা রেজুলেশন ফরম্যাট
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium line-clamp-3">
                      অদ্য অনুষ্ঠিত সাধারণ সভায় উপস্থিত সদস্যগণের সর্বসম্মতিক্রমে গৃহীত সিদ্ধান্ত ও কার্যবিবরণী লিপিবদ্ধকরণ ড্রাফট।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700">
                    <button
                      onClick={() => handlePrintDocument('সাধারণ সভা রেজুলেশন ফরম্যাট', `সভার স্থান:\nতারিখ ও সময়:\nসভাপতিত্বে:\n\nআলোচ্য বিষয়সমূহ:\n১.\n২.\n৩.\n\nগৃহীত সিদ্ধান্তসমূহ:`)}
                      className="flex-1 py-2 rounded-xl text-xs font-black bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Printer size={14} />
                      <span>প্রিন্ট করুন</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* 4. Integrated Reports & Audit Tab */}
        {selectedTab === 'reports_audit' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm space-y-6 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
                    <Layers size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black font-noto">
                      {lang === 'bn' ? 'সমন্বিত কার্যক্রম রিপোর্ট ও বাজেট অডিট' : 'Integrated Activities Report & Audit'}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold">
                      {lang === 'bn' ? 'সকল সক্রিয় উইংয়ের সমন্বিত অগ্রগতি, বাজেট ও কর্মপরিকল্পনা' : 'Consolidated performance overview of all active wings'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const reportContent = `সংঘের নাম: ${madrasah?.name}\nমোট সক্রিয় উইং: ${activeActivityIds.length}টি\nমোট বরাদ্দকৃত বাজেট: ৳ ${totalAllocatedBudget}\nমোট উদ্যোগ/প্রকল্প: ${totalActiveProjects}টি\n\nসক্রিয় উইং সমূহের বিবরণ:\n` +
                      activeActivityDefs.map((a, idx) => {
                        const cfg = activitiesConfig[a.id] || {};
                        return `\n${idx + 1}. ${a.labelBn}\n- সমন্বয়কারী: ${cfg.coordinator_name || 'নির্ধারিত হয়নি'}\n- বাজেট: ৳ ${cfg.allocated_budget || '০'}\n- প্রজেক্ট সংখ্যা: ${cfg.projects?.length || 0}টি\n- মিটিং ফ্রিকোয়েন্সি: ${cfg.meeting_frequency || 'মাসিক'}`;
                      }).join('\n');

                    handlePrintDocument('সংঘ সমন্বিত কার্যক্রম ও বাজেট অডিট রিপোর্ট', reportContent);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs bg-cyan-700 hover:bg-cyan-800 text-white transition-all shadow-md active:scale-95 self-start sm:self-auto"
                >
                  <Printer size={16} />
                  <span>{lang === 'bn' ? 'সম্পূর্ণ অডিট রিপোর্ট প্রিন্ট' : 'Print Full Audit Report'}</span>
                </button>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-emerald-50/60 border-emerald-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">সক্রিয় কার্যক্রম উইং</p>
                  <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeActivityIds.length} টি</p>
                </div>
                <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-cyan-50/60 border-cyan-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">সর্বমোট বরাদ্দকৃত বাজেট</p>
                  <p className="text-3xl font-black text-cyan-600 dark:text-cyan-400 mt-1">৳ {totalAllocatedBudget.toLocaleString('bn-BD')}</p>
                </div>
                <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-purple-50/60 border-purple-100'}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">মোট উদ্যোগ ও প্রকল্প</p>
                  <p className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">{totalActiveProjects} টি</p>
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs font-medium">
                  <thead className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    <tr>
                      <th className="p-4">কার্যক্রম (Wing)</th>
                      <th className="p-4">সমন্বয়কারী</th>
                      <th className="p-4">বরাদ্দকৃত বাজেট</th>
                      <th className="p-4">প্রকল্প সংখ্যা</th>
                      <th className="p-4">মিটিং শিডিউল</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeActivityDefs.map((act) => {
                      const cfg = activitiesConfig[act.id] || {};
                      return (
                        <tr key={act.id} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}>
                          <td className="p-4 font-black flex items-center gap-2">
                            {React.createElement(act.icon, { size: 16, className: act.textColor })}
                            <span>{act.labelBn}</span>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">
                            {cfg.coordinator_name || 'নির্ধারিত হয়নি'}
                          </td>
                          <td className="p-4 font-black text-emerald-600 dark:text-emerald-400">
                            ৳ {cfg.allocated_budget ? Number(cfg.allocated_budget).toLocaleString('bn-BD') : '০'}
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                              {cfg.projects?.length || 0} টি উদ্যোগ
                            </span>
                          </td>
                          <td className="p-4 text-slate-500">
                            {cfg.meeting_frequency || 'মাসিক'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: Multi-Select Activity Picker Modal (সংঘের কার্যক্রম নির্বাচন) */}
      {showActivityPickerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#42f5e9]/10 text-[#0fb5ab] flex items-center justify-center">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black font-noto">
                    {lang === 'bn' ? 'সংঘের কার্যক্রম নির্বাচন (Multi-Select)' : 'Select Sangha Activities'}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    {lang === 'bn' ? 'আপনার সংঘ যেসব কার্যক্রম পরিচালনা করে তা নির্বাচন করুন' : 'Choose all active activities and wings for this Sangha'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowActivityPickerModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
              {SONGHO_ACTIVITIES.map((act) => {
                const isActive = activeActivityIds.includes(act.id);
                const IconComp = act.icon;

                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => handleToggleActivity(act.id)}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 relative ${
                      isActive
                        ? (isDark 
                            ? 'bg-[#0fb5ab]/15 border-[#42f5e9]/50 shadow-sm' 
                            : 'bg-[#42f5e9]/15 border-[#0fb5ab]/40 shadow-sm')
                        : (isDark 
                            ? 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 text-slate-400' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600')
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? act.bgLight : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                    }`}>
                      <IconComp size={20} className={isActive ? act.textColor : ''} />
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <h4 className={`font-black text-xs font-noto ${isActive ? (isDark ? 'text-white' : 'text-slate-900') : ''}`}>
                        {lang === 'bn' ? act.labelBn : act.labelEn}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-2">
                        {lang === 'bn' ? act.shortDescBn : act.shortDescEn}
                      </p>
                    </div>

                    <div className="absolute top-4 right-4">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                        isActive 
                          ? 'bg-[#0fb5ab] border-[#0fb5ab] text-white' 
                          : 'border-slate-300 dark:border-slate-600 bg-transparent'
                      }`}>
                        {isActive && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black text-slate-400">
                {lang === 'bn' ? `মোট নির্বাচিত: ${activeActivityIds.length}টি` : `Total Selected: ${activeActivityIds.length}`}
              </span>
              <button
                onClick={() => {
                  setShowActivityPickerModal(false);
                  handleSaveAll();
                }}
                className="px-6 py-3 rounded-2xl font-black text-xs bg-[#42f5e9] text-[#0fb5ab] shadow-premium active:scale-95 transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>{lang === 'bn' ? 'কার্যক্রম প্রয়োগ ও সংরক্ষণ' : 'Apply & Save'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Project / Initiative Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black font-noto">
                {lang === 'bn' ? 'নতুন উদ্যোগ বা প্রজেক্ট যোগ করুন' : 'Add New Project / Initiative'}
              </h3>
              <button onClick={() => setShowProjectModal(false)} className="p-1 rounded-full text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                  উদ্যোগ / প্রজেক্টের নাম *
                </label>
                <input 
                  type="text"
                  className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  placeholder="যেমন: শীতবস্ত্র বিতরণ ক্যাম্প / বার্ষিক ক্রীড়া ২০২৬"
                  value={newProject.title || ''}
                  onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                  সংক্ষিপ্ত বিবরণ
                </label>
                <textarea 
                  rows={3}
                  className={`w-full p-4 rounded-2xl border font-bold text-xs mt-1 outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  placeholder="লক্ষ্য ও বাস্তবায়নের স্থান..."
                  value={newProject.description || ''}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                    বাজেট (টাকা)
                  </label>
                  <input 
                    type="number"
                    className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    placeholder="২০,০০০"
                    value={newProject.targetBudget || ''}
                    onChange={(e) => setNewProject(prev => ({ ...prev, targetBudget: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                    স্ট্যাটাস
                  </label>
                  <select
                    className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                    value={newProject.status || 'planning'}
                    onChange={(e) => setNewProject(prev => ({ ...prev, status: e.target.value as any }))}
                  >
                    <option value="planning">পরিকল্পিত (Planning)</option>
                    <option value="ongoing">চলমান (Ongoing)</option>
                    <option value="completed">সম্পন্ন (Completed)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                  দায়িত্বপ্রাপ্ত ব্যক্তি / টিম লিডার
                </label>
                <input 
                  type="text"
                  className={`w-full h-12 px-4 rounded-2xl border font-bold text-xs mt-1 outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                  placeholder="নাম ও পদবি"
                  value={newProject.leadPerson || ''}
                  onChange={(e) => setNewProject(prev => ({ ...prev, leadPerson: e.target.value }))}
                />
              </div>
            </div>

            <button
              onClick={handleAddProject}
              className="w-full py-3.5 rounded-2xl font-black text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
            >
              <Plus size={16} />
              <span>উদ্যোগ সংরক্ষণ করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Document Preview & Edit Modal */}
      {activeDocPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-xl rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border max-h-[90vh] flex flex-col ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black font-noto">
                {activeDocPreview.title}
              </h3>
              <button onClick={() => setActiveDocPreview(null)} className="p-1 rounded-full text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                চুক্তিপত্র বা দলিলের টেক্সট (প্রয়োজনে এডিট করুন)
              </label>
              <textarea 
                rows={10}
                className={`w-full p-4 rounded-2xl border font-bold text-xs mt-1 outline-none leading-relaxed ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
                value={activeDocPreview.content}
                onChange={(e) => setActiveDocPreview(prev => prev ? { ...prev, content: e.target.value } : null)}
              />
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => handleCopyText(activeDocPreview.content)}
                className="px-4 py-3 rounded-2xl font-black text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Copy size={14} />
                <span>কপি করুন</span>
              </button>

              <button
                onClick={() => handlePrintDocument(activeDocPreview.title, activeDocPreview.content)}
                className="flex-1 py-3 rounded-2xl font-black text-xs bg-purple-600 hover:bg-purple-700 text-white shadow-md flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                <span>অফিশিয়াল প্রিন্ট প্রিভিউ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SonghoManagement;
