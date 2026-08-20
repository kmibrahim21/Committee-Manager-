import React, { useState, useEffect } from 'react';
import { ChevronLeft, Sliders, Shield, BookOpen, Percent, HandCoins, PiggyBank, Settings2, Check, Loader2, AlertCircle, Handshake, Network, HeartPulse, Compass, GraduationCap, Briefcase, Users2, Heart, Scale, Coins, Wallet, History, Users } from 'lucide-react';
import { Institution, Language, Department, Profile } from '../types';
import { supabase } from '../supabase';

interface Props {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role?: string;
  profile?: Profile | null;
}

const AssociationManagement: React.FC<Props> = ({ lang, madrasah, onBack, role, profile }) => {
  const parsedConfig = typeof madrasah?.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah?.config_json || {});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({});

  const isDark = madrasah?.theme === 'dark';

  useEffect(() => {
    if (madrasah) fetchDepartments();
  }, [madrasah]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('departments').select('*').eq('institution_id', madrasah?.id);
      if (data) {
        setDepartments(data);
        if (data.length > 0) {
          selectDepartment(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectDepartment = (dept: Department) => {
    setSelectedDept(dept);
    setSettings(parsedConfig?.departments_config?.[dept.id]?.management_settings || {});
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  
  const saveSettings = async () => {
    if (!selectedDept || !madrasah) return;
    setSaving(true);
    try {
      const currentConfig = parsedConfig;
      const deptConfigs = currentConfig.departments_config || {};
      
      deptConfigs[selectedDept.id] = {
        ...(deptConfigs[selectedDept.id] || {}),
        management_settings: settings
      };
      
      const newConfig = { ...currentConfig, departments_config: deptConfigs };
      
      const { error } = await supabase
        .from('institutions')
        .update({ config_json: newConfig })
        .eq('id', madrasah.id);
        
      if (error) throw error;
      madrasah.config_json = newConfig; // mutate local state
      
      alert(lang === 'bn' ? 'সেটিংস সেভ হয়েছে!' : 'Settings saved successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return <div className="flex items-center justify-center h-[50vh]"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#080A12]' : 'bg-[#f4f7f6]'} pb-32 font-noto`}>
      {/* Header */}
      <div className={`px-4 pt-12 pb-6 ${isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-white shadow-sm'} sticky top-0 z-50`}>
        <div className="flex items-center justify-between">
          <button onClick={onBack} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {lang === 'bn' ? 'ম্যানেজমেন্ট (নীতিমালা)' : 'Management (Policies)'}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {lang === 'bn' ? 'সমিতির ধরন ও নিয়ম' : 'Type & Rules Configuration'}
            </p>
          </div>
          <div className="w-12"></div>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-6 mt-6">
        {/* Committee Selector */}
        {departments.length > 1 && (
          <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">
              {lang === 'bn' ? 'সমিতি নির্বাচন করুন' : 'Select Committee'}
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {departments.map(d => (
                <button
                  key={d.id}
                  onClick={() => selectDepartment(d)}
                  className={`px-5 py-3 rounded-2xl font-black text-sm whitespace-nowrap transition-all ${selectedDept?.id === d.id ? 'bg-[#42f5e9] text-[#0fb5ab]' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedDept && !parsedConfig?.departments_config?.[selectedDept.id]?.association_type && (
          <div className="text-center p-10">
            <AlertCircle className="mx-auto text-slate-400 mb-4" size={48} />
            <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>
              {lang === 'bn' ? 'এই সমিতির কোনো ধরন (Association Type) নির্ধারণ করা নেই।' : 'No association type assigned.'}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {lang === 'bn' ? 'নতুন সমিতি যোগ বা এডিট করার সময় ধরন নির্বাচন করুন।' : 'Set it up when creating or editing a committee.'}
            </p>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'savings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center shrink-0">
                  <PiggyBank size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>সঞ্চয় সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">সদস্যদের নিয়মিত সঞ্চয় ও উত্তোলনের নিয়মকানুন।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">মাসিক সঞ্চয়ের পরিমাণ (Monthly Savings Amount)</label>
                <input 
                  type="number"
                  value={settings.monthly_savings_amount || ''}
                  onChange={(e) => handleSettingChange('monthly_savings_amount', e.target.value)}
                  className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="যেমন: 500"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সঞ্চয়ের নিয়ম (Savings Rules)</label>
                <textarea 
                  rows={3}
                  value={settings.savings_rules || ''}
                  onChange={(e) => handleSettingChange('savings_rules', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="সঞ্চয় জমার নিয়মাবলী লিখুন..."
                ></textarea>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">জমার সময়সীমা (Deposit Deadline)</label>
                <input 
                  type="text"
                  value={settings.deposit_deadline || ''}
                  onChange={(e) => handleSettingChange('deposit_deadline', e.target.value)}
                  className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="যেমন: মাসের ১০ তারিখের মধ্যে"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">উত্তোলনের নিয়ম (Withdrawal Rules)</label>
                <textarea 
                  rows={3}
                  value={settings.withdrawal_rules || ''}
                  onChange={(e) => handleSettingChange('withdrawal_rules', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="উত্তোলনের নিয়মাবলী লিখুন..."
                ></textarea>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">চুক্তি/শর্ত (Agreements/Terms)</label>
                <textarea 
                  rows={4}
                  value={settings.terms_and_conditions || ''}
                  onChange={(e) => handleSettingChange('terms_and_conditions', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="অন্যান্য শর্তাবলী..."
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'qard_hasan' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center shrink-0">
                  <HandCoins size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-emerald-800'}`}>করযে হাসানা সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">সুদমুক্ত সহায়তা ও ঋণ প্রদানের ব্যবস্থা।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">ঋণের সর্বোচ্চ সীমা (Maximum Loan Limit)</label>
                <input 
                  type="number"
                  value={settings.max_loan_limit || ''}
                  onChange={(e) => handleSettingChange('max_loan_limit', e.target.value)}
                  className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-emerald-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="যেমন: 50000"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">ঋণ পাওয়ার যোগ্যতা (Eligibility)</label>
                <textarea 
                  rows={2}
                  value={settings.eligibility_rules || ''}
                  onChange={(e) => handleSettingChange('eligibility_rules', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-emerald-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="যোগ্যতার নিয়মাবলী..."
                ></textarea>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">কিস্তি/পরিশোধের নিয়ম (Repayment Rules)</label>
                <textarea 
                  rows={2}
                  value={settings.repayment_rules || ''}
                  onChange={(e) => handleSettingChange('repayment_rules', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-emerald-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="পরিশোধের নিয়মাবলী..."
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">ঋণের মেয়াদ (Loan Tenure)</label>
                  <input 
                    type="text"
                    value={settings.loan_tenure || ''}
                    onChange={(e) => handleSettingChange('loan_tenure', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-emerald-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: ১২ মাস"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">জামিনদার নিয়ম (Guarantor Rules)</label>
                  <input 
                    type="text"
                    value={settings.guarantor_rules || ''}
                    onChange={(e) => handleSettingChange('guarantor_rules', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-emerald-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: ২ জন জামিনদার"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'capital_share' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-purple-50 text-purple-500 rounded-3xl flex items-center justify-center shrink-0">
                  <Percent size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-purple-800'}`}>মূলধন/শেয়ার সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">শেয়ার ও মূলধনের হিসাব, লাভ বণ্টন ও Percentage কনফিগারেশন।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">প্রতি শেয়ারের মূল্য (Value Per Share)</label>
                  <input 
                    type="number"
                    value={settings.share_value || ''}
                    onChange={(e) => handleSettingChange('share_value', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-purple-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: 1000"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সর্বোচ্চ শেয়ার (Max Shares)</label>
                  <input 
                    type="number"
                    value={settings.max_shares || ''}
                    onChange={(e) => handleSettingChange('max_shares', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-purple-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: 50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">মূলধন সংগ্রহ ও ব্যবহারের নিয়ম (Capital Rules)</label>
                <textarea 
                  rows={2}
                  value={settings.capital_rules || ''}
                  onChange={(e) => handleSettingChange('capital_rules', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-purple-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="নিয়মাবলী..."
                ></textarea>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                 <h4 className={`text-sm font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>বণ্টন Percentage</h4>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">লাভ বণ্টন (Profit %)</label>
                      <input 
                        type="number"
                        value={settings.profit_percentage || ''}
                        onChange={(e) => handleSettingChange('profit_percentage', e.target.value)}
                        className={`w-full h-12 px-4 rounded-xl border-2 font-bold outline-none focus:border-purple-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                        placeholder="যেমন: 70"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">রিজার্ভ (Reserve %)</label>
                      <input 
                        type="number"
                        value={settings.reserve_percentage || ''}
                        onChange={(e) => handleSettingChange('reserve_percentage', e.target.value)}
                        className={`w-full h-12 px-4 rounded-xl border-2 font-bold outline-none focus:border-purple-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                        placeholder="যেমন: 20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">পরিচালনা ব্যয় (Expense %)</label>
                      <input 
                        type="number"
                        value={settings.expense_percentage || ''}
                        onChange={(e) => handleSettingChange('expense_percentage', e.target.value)}
                        className={`w-full h-12 px-4 rounded-xl border-2 font-bold outline-none focus:border-purple-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                        placeholder="যেমন: 10"
                      />
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'mudaraba' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-3xl flex items-center justify-center shrink-0">
                  <Handshake size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-orange-800'}`}>মুদারাবা ভিত্তিক সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">মূলধন প্রদানকারী ও পরিচালনাকারীর মধ্যে যৌথ ব্যবসায়িক নীতিমালা।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সর্বনিম্ন মূলধন (Min Capital)</label>
                  <input 
                    type="number"
                    value={settings.min_capital || ''}
                    onChange={(e) => handleSettingChange('min_capital', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সর্বোচ্চ মূলধন (Max Capital)</label>
                  <input 
                    type="number"
                    value={settings.max_capital || ''}
                    onChange={(e) => handleSettingChange('max_capital', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">বিনিয়োগের মেয়াদ (Investment Tenure)</label>
                  <input 
                    type="text"
                    value={settings.investment_tenure || ''}
                    onChange={(e) => handleSettingChange('investment_tenure', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: ১২ মাস"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">লাভ বণ্টন সময়কাল (Profit Payout)</label>
                  <input 
                    type="text"
                    value={settings.payout_period || ''}
                    onChange={(e) => handleSettingChange('payout_period', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: মাসিক/বার্ষিক"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl border-2 border-orange-100 dark:border-orange-900/30 space-y-4">
                <h4 className="text-xs font-black text-orange-600 uppercase tracking-widest">লাভ-ক্ষতি বণ্টন অনুপাত (Ratio)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">প্রদানকারীর লাভ (Provider Ratio %)</label>
                    <input 
                      type="number"
                      value={settings.provider_profit_ratio || ''}
                      onChange={(e) => handleSettingChange('provider_profit_ratio', e.target.value)}
                      className={`w-full h-12 px-4 rounded-xl border-2 font-bold outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                      placeholder="%"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">পরিচালকের লাভ (Manager Ratio %)</label>
                    <input 
                      type="number"
                      value={settings.manager_profit_ratio || ''}
                      onChange={(e) => handleSettingChange('manager_profit_ratio', e.target.value)}
                      className={`w-full h-12 px-4 rounded-xl border-2 font-bold outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                      placeholder="%"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">মুদারাবা নীতিমালা (Mudaraba Policy)</label>
                  <textarea 
                    rows={3}
                    value={settings.mudaraba_policy || ''}
                    onChange={(e) => handleSettingChange('mudaraba_policy', e.target.value)}
                    className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="ক্ষতির নিয়ম ও অন্যান্য শর্তাবলী..."
                  ></textarea>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">বিনিয়োগ/প্রকল্পের নিয়ম (Investment Rules)</label>
                  <textarea 
                    rows={2}
                    value={settings.investment_rules || ''}
                    onChange={(e) => handleSettingChange('investment_rules', e.target.value)}
                    className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-orange-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="কোন কোন খাতে বিনিয়োগ করা যাবে..."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'musharaka' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-teal-50 text-teal-500 rounded-3xl flex items-center justify-center shrink-0">
                  <Network size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-teal-800'}`}>মুশারাকা ভিত্তিক সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">একাধিক সদস্যের যৌথ মূলধন ও অংশীদারিত্বের ব্যবসায়িক নীতিমালা।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সর্বনিম্ন মূলধন (Min Capital)</label>
                  <input 
                    type="number"
                    value={settings.min_capital || ''}
                    onChange={(e) => handleSettingChange('min_capital', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-teal-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">লাভ বণ্টন সময়কাল (Profit Payout)</label>
                  <input 
                    type="text"
                    value={settings.payout_period || ''}
                    onChange={(e) => handleSettingChange('payout_period', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-teal-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: ৩ মাস পর পর"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Profit Sharing Ratio</label>
                  <input 
                    type="text"
                    value={settings.profit_sharing_ratio || ''}
                    onChange={(e) => handleSettingChange('profit_sharing_ratio', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-teal-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: মূলধন অনুপাতে"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Loss Sharing Ratio</label>
                  <input 
                    type="text"
                    value={settings.loss_sharing_ratio || ''}
                    onChange={(e) => handleSettingChange('loss_sharing_ratio', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-teal-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: মূলধন অনুপাতে"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">মুশারাকা নীতিমালা ও শর্তাবলী (Musharaka Rules)</label>
                <textarea 
                  rows={4}
                  value={settings.musharaka_policy || ''}
                  onChange={(e) => handleSettingChange('musharaka_policy', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-teal-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="সদস্য বের হয়ে গেলে settlement ও অন্যান্য নিয়মাবলী..."
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'islamic_welfare' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center shrink-0">
                  <Heart size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-red-800'}`}>ইসলামিক কল্যাণ/সামাজিক সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">যাকাত, সদকা ও দানের মাধ্যমে জনকল্যাণমূলক কার্যক্রমের নীতিমালা।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">অর্থ সংগ্রহের ধরন (Collection Types)</label>
                <input 
                  type="text"
                  value={settings.collection_types || ''}
                  onChange={(e) => handleSettingChange('collection_types', e.target.value)}
                  className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-red-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="যাকাত, সদকা, অনুদান..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সহায়তার সর্বোচ্চ পরিমাণ (Max Support)</label>
                  <input 
                    type="number"
                    value={settings.max_support_amount || ''}
                    onChange={(e) => handleSettingChange('max_support_amount', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-red-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সহায়তার ধরন (Support Type)</label>
                  <input 
                    type="text"
                    value={settings.support_type || ''}
                    onChange={(e) => handleSettingChange('support_type', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-red-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="চিকিৎসা, শিক্ষা, খাদ্য..."
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">যোগ্যতা ও অনুমোদনের নিয়ম (Eligibility & Approval)</label>
                <textarea 
                  rows={3}
                  value={settings.eligibility_approval_rules || ''}
                  onChange={(e) => handleSettingChange('eligibility_approval_rules', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-red-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="কাকে এবং কিভাবে সহায়তা প্রদান করা হবে..."
                ></textarea>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">কল্যাণ নীতিমালা (Welfare Policy)</label>
                <textarea 
                  rows={3}
                  value={settings.welfare_policy || ''}
                  onChange={(e) => handleSettingChange('welfare_policy', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-red-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="তহবিল ব্যবহারের অন্যান্য নিয়মাবলী..."
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'hajj_savings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center shrink-0">
                  <Compass size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-amber-800'}`}>ইসলামিক হজ/উমরাহ সঞ্চয় সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">পবিত্র হজ ও উমরাহ পালনের উদ্দেশ্যে দীর্ঘমেয়াদী সঞ্চয় পরিকল্পনা।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">মাসিক সঞ্চয়ের পরিমাণ (Monthly Amount)</label>
                  <input 
                    type="number"
                    value={settings.monthly_savings_amount || ''}
                    onChange={(e) => handleSettingChange('monthly_savings_amount', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-amber-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সঞ্চয়ের মেয়াদ (Savings Tenure)</label>
                  <input 
                    type="text"
                    value={settings.savings_tenure || ''}
                    onChange={(e) => handleSettingChange('savings_tenure', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-amber-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: ৫ বছর"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">লক্ষ্য পরিমাণ (Target Amount)</label>
                  <input 
                    type="number"
                    value={settings.target_amount || ''}
                    onChange={(e) => handleSettingChange('target_amount', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-amber-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">জমার তারিখ (Deposit Date)</label>
                  <input 
                    type="text"
                    value={settings.deposit_date_rule || ''}
                    onChange={(e) => handleSettingChange('deposit_date_rule', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-amber-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: প্রতি মাসের ৫ তারিখ"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">হজ/উমরাহ সঞ্চয় নীতিমালা (Hajj Policy)</label>
                <textarea 
                  rows={4}
                  value={settings.hajj_policy || ''}
                  onChange={(e) => handleSettingChange('hajj_policy', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-amber-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="সদস্য বাতিল করলে settlement ও হজ নির্বাচন প্রক্রিয়া..."
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'islamic_education' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shrink-0">
                  <GraduationCap size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-blue-800'}`}>ইসলামিক শিক্ষা সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">মাদরাসা, মক্তব ও শিক্ষার্থীদের শিক্ষা সহায়তামূলক কার্যক্রম।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">শিক্ষা কার্যক্রমের ধরন (Education Activities)</label>
                <input 
                  type="text"
                  value={settings.education_activities || ''}
                  onChange={(e) => handleSettingChange('education_activities', e.target.value)}
                  className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="হিফয, আলিম, মক্তব সহায়তা..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">মাসিক শিক্ষা ফান্ড (Monthly Fund)</label>
                  <input 
                    type="number"
                    value={settings.monthly_education_fund || ''}
                    onChange={(e) => handleSettingChange('monthly_education_fund', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">বৃত্তি/Scholarship নিয়ম (Scholarship Rules)</label>
                  <input 
                    type="text"
                    value={settings.scholarship_rules_summary || ''}
                    onChange={(e) => handleSettingChange('scholarship_rules_summary', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যোগ্যতা ও পরিমাণ..."
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">শিক্ষার্থী সহায়তার নিয়ম (Student Support Rules)</label>
                <textarea 
                  rows={3}
                  value={settings.student_support_rules || ''}
                  onChange={(e) => handleSettingChange('student_support_rules', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="কারা সহায়তা পাওয়ার যোগ্য এবং অনুমোদনের নিয়ম..."
                ></textarea>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">শিক্ষা নীতিমালা (Education Policy)</label>
                <textarea 
                  rows={3}
                  value={settings.education_policy || ''}
                  onChange={(e) => handleSettingChange('education_policy', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-blue-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="ফান্ড ব্যবহারের সুনির্দিষ্ট নিয়মাবলী..."
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {parsedConfig?.departments_config?.[selectedDept?.id || '']?.association_type === 'cooperative_business' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
               <div className="w-16 h-16 bg-slate-50 text-slate-600 rounded-3xl flex items-center justify-center shrink-0">
                  <Briefcase size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>সমবায়ধর্মী ইসলামিক ব্যবসায়িক সমিতি</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">সদস্যদের যৌথ ব্যবসায়িক কার্যক্রম, ক্রয়-বিক্রয় ও পণ্য ব্যবস্থাপনা।</p>
               </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border shadow-sm space-y-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">ব্যবসার ধরন (Business Type)</label>
                <input 
                  type="text"
                  value={settings.business_type || ''}
                  onChange={(e) => handleSettingChange('business_type', e.target.value)}
                  className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-slate-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="যেমন: পাইকারি পণ্য ক্রয়-বিক্রয়"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">সদস্যের মূলধন (Member Capital)</label>
                  <input 
                    type="number"
                    value={settings.member_capital_amount || ''}
                    onChange={(e) => handleSettingChange('member_capital_amount', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-slate-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="৳"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Profit Sharing Ratio</label>
                  <input 
                    type="text"
                    value={settings.business_profit_sharing || ''}
                    onChange={(e) => handleSettingChange('business_profit_sharing', e.target.value)}
                    className={`w-full h-14 px-4 rounded-2xl border-2 font-bold outline-none focus:border-slate-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                    placeholder="যেমন: মূলধন অনুপাতে"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">ব্যবসায়িক নীতিমালা ও শর্তাবলী (Business Policy)</label>
                <textarea 
                  rows={4}
                  value={settings.business_policy || ''}
                  onChange={(e) => handleSettingChange('business_policy', e.target.value)}
                  className={`w-full p-4 rounded-2xl border-2 font-bold text-sm outline-none focus:border-slate-400 ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
                  placeholder="ক্রয়-বিক্রয় ব্যবস্থাপনা, লস শেয়ারিং ও প্রজেক্ট সেটেলমেন্ট নিয়ম..."
                ></textarea>
              </div>
            </div>
          </div>
        )}

        {selectedDept && parsedConfig?.departments_config?.[selectedDept.id]?.association_type && (
          <div className="pt-4">
            <button 
              onClick={saveSettings} 
              disabled={saving}
              className="w-full py-5 bg-[#42f5e9] text-[#0fb5ab] font-black text-lg rounded-full shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              {saving ? <Loader2 className="animate-spin" /> : <><Check size={24} /> {lang === 'bn' ? 'সেটিংস সেভ করুন' : 'Save Settings'}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssociationManagement;
