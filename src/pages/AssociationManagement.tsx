import React, { useState, useEffect } from 'react';
import { ChevronLeft, Sliders, Shield, BookOpen, Percent, HandCoins, PiggyBank, Settings2, Check, Loader2, AlertCircle } from 'lucide-react';
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
