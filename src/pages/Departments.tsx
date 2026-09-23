
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronRight, BookOpen, Users, Edit3, Trash2, X, Check, Loader2, AlertCircle, AlertTriangle, Hash } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Department, Language, Institution, Profile } from 'types';
import { t } from 'translations';

export const sortMadrasahClasses = (departments: any[]) => {
  if (!departments || !Array.isArray(departments)) return [];
  return [...departments].sort((a, b) => {
    // Primary sort by sort_order
    const orderA = a.sort_order ?? 999999;
    const orderB = b.sort_order ?? 999999;
    if (orderA !== orderB) return orderA - orderB;
    // Fallback to alphabetical
    return (a.name || '').localeCompare((b.name || ''), 'bn', { numeric: true });
  });
};

interface ClassesProps {
  onClassClick: (cls: Department) => void;
  lang: Language;
  madrasah: Institution | null;
  dataVersion: number;
  triggerRefresh: () => void;
  readOnly?: boolean;
  profile?: Profile | null;
}

const Departments: React.FC<ClassesProps> = ({ onClassClick, lang, madrasah, dataVersion, triggerRefresh, readOnly, profile }) => {
  const parsedConfig = typeof madrasah?.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah?.config_json || {});
  const [departments, setClasses] = useState<(Department & { student_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSortOrder, setNewSortOrder] = useState<string>('');
  const [newAssociationType, setNewAssociationType] = useState<string>('');
  const [editingClass, setEditingClass] = useState<Department | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Department | null>(null);
  const isDark = madrasah?.theme === 'dark';

  useEffect(() => { 
    if (madrasah?.id) {
      fetchClasses(); 
    }
  }, [dataVersion, madrasah?.id]);

  const fetchClasses = async () => {
    setLoading(true);
    const cached = offlineApi.getCache('departments');
    if (cached) setClasses(sortMadrasahClasses(cached));

    if (navigator.onLine && madrasah) {
      try {
        const { data: classesData, error } = await supabase
          .from('departments')
          .select('*')
          .eq('institution_id', madrasah.id);
        if (error) throw error;
        if (classesData) {
          let filteredClasses = classesData;
          if (profile?.role === 'executive' && Array.isArray(profile?.permissions?.allowed_departments) && profile.permissions.allowed_departments.length > 0) {
            filteredClasses = classesData.filter(cls => profile.permissions?.allowed_departments?.includes(cls.id));
          }

          const withCounts = await Promise.all(filteredClasses.map(async (cls) => {
            const { count } = await supabase
              .from('members')
              .select('*', { count: 'exact', head: true })
              .eq('department_id', cls.id);
            return { ...cls, student_count: count || 0 };
          }));
          const sorted = sortMadrasahClasses(withCounts);
          setClasses(sorted);
          offlineApi.setCache('departments', sorted);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    } else { setLoading(false); }
  };

  const handleSaveClass = async () => {
    if (!newClassName.trim() || !madrasah) return;
    setModalLoading(true);
    const order = newSortOrder ? parseInt(newSortOrder) : null;
    let deptId = editingClass?.id;
    try {
      if (editingClass) {
        if (navigator.onLine) {
          const { error } = await supabase.from('departments').update({ 
            name: newClassName.trim(),
            sort_order: order,
             
          }).eq('id', editingClass.id);
          if (error) throw error;
        } else {
          offlineApi.queueAction('departments', 'UPDATE', { 
            id: editingClass.id, 
            name: newClassName.trim(),
            sort_order: order
          });
        }
      } else {
        const payload = { 
          name: newClassName.trim(), 
          institution_id: madrasah.id,
          sort_order: order,
          
        };
        if (navigator.onLine) {
          const { data: newDept, error } = await supabase.from('departments').insert(payload).select().single();
          if (newDept) deptId = newDept.id; else alert('newDept is null after insert');
          if (error) throw error;
        } else {
          offlineApi.queueAction('departments', 'INSERT', payload);
        }
      }
      
      if (deptId && newAssociationType !== undefined) {
        const currentConfig = parsedConfig;
        const deptConfigs = currentConfig.departments_config || {};
        deptConfigs[deptId] = {
          ...deptConfigs[deptId],
          association_type: newAssociationType || null
        };
        const newConfig = { ...currentConfig, departments_config: deptConfigs };
        if (navigator.onLine) {
          const { error: configErr } = await supabase.from('institutions').update({ config_json: newConfig }).eq('id', madrasah.id);
          if (configErr) alert('Config update error: ' + configErr.message);
          // Mutate local state so UI reflects
          madrasah.config_json = newConfig;
        }
      }

      setShowModal(false);
      setNewClassName('');
      setNewSortOrder('');
      setNewAssociationType('');
      setEditingClass(null);
      triggerRefresh();
    } catch (err: any) {
      alert(lang === 'bn' ? `ব্যর্থ হয়েছে: ${err.message}` : `Failed: ${err.message}`);
    } finally { setModalLoading(false); }
  };

  const handleDeleteClass = async () => {
    if (!showDeleteConfirm) return;
    setModalLoading(true);
    try {
      if (navigator.onLine) {
        // Cascade manually: delete all members belonging to this department
        // Also delete their ledgers, fees, and attendance to avoid orphaned data
        const { data: members } = await supabase
          .from('members')
          .select('id')
          .eq('department_id', showDeleteConfirm.id);
          
        if (members && members.length > 0) {
          const memberIds = members.map(m => m.id);
          // Clean up financial and attendance records for these members
          // Delete ledger by matching the department name in the description string
          await supabase.from('ledger')
            .delete()
            .eq('category', 'Member Fee')
            .like('description', `%(${showDeleteConfirm.name} |%`);
          await supabase.from('fees').delete().in('member_id', memberIds);
          await supabase.from('attendance').delete().in('member_id', memberIds);
          // Delete the members
          await supabase.from('members').delete().in('id', memberIds);
        }

        // Clean up other potential restricting relationships
        await supabase.from('voice_broadcasts').delete().eq('department_id', showDeleteConfirm.id);
        await supabase.from('fee_structures').delete().eq('department_id', showDeleteConfirm.id);

        const { error } = await supabase.from('departments').delete().eq('id', showDeleteConfirm.id);
        if (error) {
          // Check for foreign key constraint violation (PostgreSQL error code 23503)
          if (error.code === '23503' || error.message?.includes('foreign key constraint')) {
             throw new Error(lang === 'bn' 
               ? 'এই ক্লাসটি ডিলিট করা যাবে না কারণ এটি অন্যান্য তথ্যের (যেমন: ছাত্র, ফি, পরীক্ষা) সাথে যুক্ত। প্রথমে যুক্ত তথ্যগুলো ডিলিট করুন।' 
               : 'This class cannot be deleted because it is linked to other records (e.g. students, fees, exams). Please delete the linked records first.');
          }
          throw error;
        }
      } else {
        // Offline check (limited)
        offlineApi.queueAction('departments', 'DELETE', { id: showDeleteConfirm.id });
      }
      setShowDeleteConfirm(null);
      triggerRefresh();
    } catch (err: any) { alert(err.message); } finally { setModalLoading(false); }
  };

  return (
    <>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">

        <div className="flex items-center justify-between px-2">
          <h1 className={`text-xl font-noto font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{t('classes_title', lang, madrasah?.institution_type)}</h1>
          {!readOnly && (
            <button onClick={() => { setNewClassName(''); setNewSortOrder(''); setNewAssociationType(''); setEditingClass(null); setShowModal(true); }} className="bg-[#42f5e9] text-[#0fb5ab] px-5 py-3 rounded-2xl text-[12px] font-black flex items-center gap-2 active:scale-95 transition-all border border-[#42f5e9]/20 shadow-premium">
              <Plus size={16} strokeWidth={4} /> {t('new_class', lang, madrasah?.institution_type)}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {departments.map(cls => (
            <div key={cls.id} onClick={() => onClassClick(cls)} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-4 sm:p-5 rounded-[2.2rem] border flex items-center justify-between active:scale-[0.98] transition-all group shadow-bubble relative overflow-hidden`}>
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 ${isDark ? 'bg-slate-700 text-[#0fb5ab] border-slate-600' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'} rounded-2xl flex items-center justify-center shrink-0 border shadow-inner`}>
                  <BookOpen size={20} className="sm:size-6" />
                </div>
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'} text-[16px] sm:text-[18px] font-noto line-clamp-2 leading-tight tracking-tight break-words`}>
                      {cls.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Users size={12} className={isDark ? 'text-[#0fb5ab]/60' : 'text-[#0fb5ab]/60'} />
                    <p className={`text-[9px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} uppercase tracking-[0.1em]`}>{cls.student_count || 0} {t('students_count', lang, madrasah?.institution_type)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {!readOnly && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setNewClassName(cls.name); setNewSortOrder(cls.sort_order?.toString() || ''); setNewAssociationType(parsedConfig?.departments_config?.[cls.id]?.association_type || ''); setEditingClass(cls); setShowModal(true); }} 
                      className={`w-9 h-9 sm:w-10 sm:h-10 ${isDark ? 'bg-slate-700 text-[#0fb5ab] border-slate-600' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'} rounded-xl flex items-center justify-center border active:scale-90 transition-all shadow-sm`}>
                      <Edit3 size={14} className="sm:size-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(cls); }} 
                      className={`w-9 h-9 sm:w-10 sm:h-10 ${isDark ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-500'} rounded-xl flex items-center justify-center border active:scale-90 transition-all shadow-sm`}>
                      <Trash2 size={14} className="sm:size-4" />
                    </button>
                  </>
                )}
                <ChevronRight className={`${isDark ? 'text-slate-600 group-hover:text-[#0fb5ab]' : 'text-[#42f5e9] group-hover:text-[#0fb5ab]'} transition-colors ml-0.5`} size={18} strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-sm rounded-[3.5rem] p-10 shadow-bubble border relative animate-in zoom-in-95 duration-300`}>
            <button onClick={() => setShowModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-[#0fb5ab] transition-all"><X size={26} strokeWidth={3} /></button>
            

            <div className="flex items-center gap-5 mb-8">
               <div className={`w-16 h-16 ${isDark ? 'bg-slate-800 text-[#0fb5ab] border-slate-700' : 'bg-[#42f5e9]/10 text-[#0fb5ab]'} rounded-[1.8rem] flex items-center justify-center shrink-0 border shadow-inner`}>
                  <BookOpen size={32} />
               </div>
               <div>
                  <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'} font-noto tracking-tight`}>
                    {editingClass ? t('edit_class', lang, madrasah?.institution_type) : t('new_class', lang, madrasah?.institution_type)}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Department Information</p>
               </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{t('class_name_label', lang, madrasah?.institution_type)}</label>
                <input 
                  type="text" 
                  autoFocus
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border-2 rounded-[1.8rem] font-black text-lg outline-none focus:border-[#42f5e9]/30 focus:bg-white transition-all shadow-inner`} 
                  value={newClassName} 
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="যেমন: হিফয বিভাগ"
                />
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                  <Hash size={12} /> সিরিয়াল নম্বর (Sorting)
                </label>
                <input 
                  type="number" 
                  className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border-2 rounded-[1.8rem] font-black text-lg outline-none focus:border-[#42f5e9]/30 focus:bg-white transition-all shadow-inner`} 
                  value={newSortOrder} 
                  onChange={(e) => setNewSortOrder(e.target.value)}
                  placeholder="যেমন: ১"
                />
              </div>

              {madrasah?.institution_type === 'association' && (
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
                    <BookOpen size={12} /> {lang === 'bn' ? 'সমিতির ধরন (ঐচ্ছিক)' : 'Association Type (Optional)'}
                  </label>
                  <select 
                    className={`w-full px-6 py-5 ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'} border-2 rounded-[1.8rem] font-black text-sm outline-none focus:border-[#42f5e9]/30 focus:bg-white transition-all shadow-inner appearance-none`}
                    value={newAssociationType}
                    onChange={(e) => setNewAssociationType(e.target.value)}
                  >
                    <option value="">{lang === 'bn' ? 'সাধারণ (কোনো ধরন নেই)' : 'General (None)'}</option>
                    <option value="savings">{lang === 'bn' ? 'সঞ্চয় সমিতি' : 'Savings Association'}</option>
                    <option value="qard_hasan">{lang === 'bn' ? 'করযে হাসানা সমিতি' : 'Qard Hasan Association'}</option>
                    <option value="capital_share">{lang === 'bn' ? 'মূলধন/শেয়ার সমিতি' : 'Capital/Share Association'}</option>
                    <option value="mudaraba">{lang === 'bn' ? 'মুদারাবা ভিত্তিক সমিতি' : 'Mudaraba Association'}</option>
                    <option value="musharaka">{lang === 'bn' ? 'মুশারাকা ভিত্তিক সমিতি' : 'Musharaka Association'}</option>
                    <option value="islamic_welfare">{lang === 'bn' ? 'ইসলামিক কল্যাণ/সামাজিক সমিতি' : 'Islamic Welfare Association'}</option>
                    <option value="hajj_savings">{lang === 'bn' ? 'ইসলামিক হজ/উমরাহ সঞ্চয় সমিতি' : 'Hajj/Umrah Savings Association'}</option>
                    <option value="islamic_education">{lang === 'bn' ? 'ইসলামিক শিক্ষা সমিতি' : 'Islamic Education Association'}</option>
                    <option value="cooperative_business">{lang === 'bn' ? 'সমবায়ধর্মী ইসলামিক ব্যবসায়িক সমিতি' : 'Cooperative Islamic Business'}</option>
                  </select>
                </div>
              )}

              <button onClick={handleSaveClass} disabled={modalLoading || !newClassName.trim()} className="w-full py-5 bg-[#42f5e9] text-[#0fb5ab] font-black rounded-full shadow-premium active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg">
                {modalLoading ? <Loader2 className="animate-spin" size={24} /> : <><Check size={24} strokeWidth={4} /> {t('save', lang)}</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/40 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-red-50'} w-full max-w-sm rounded-[3.5rem] p-10 shadow-bubble border text-center space-y-6 animate-in zoom-in-95 duration-500`}>
             <div className={`w-20 h-20 ${isDark ? 'bg-red-900/30 text-red-400 border-red-900/50' : 'bg-red-50 text-red-500'} rounded-full flex items-center justify-center mx-auto shadow-inner border`}>
                <AlertTriangle size={40} />
             </div>
             <div>
                <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'} font-noto`}>{t('confirm_delete', lang)}</h3>
                <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-4">"{showDeleteConfirm.name}" শ্রেণির সকল ছাত্রের তথ্য মুছে যাবে।</p>
             </div>
             <div className="flex flex-col gap-3 pt-2">
                <button onClick={handleDeleteClass} disabled={modalLoading} className="w-full py-5 bg-red-500 text-white font-black rounded-full shadow-xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center text-md">
                  {modalLoading ? <Loader2 className="animate-spin" size={22} /> : 'ডিলিট করুন'}
                </button>
                <button onClick={() => setShowDeleteConfirm(null)} className={`w-full py-4 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'} font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest`}>বাতিল</button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Departments;
