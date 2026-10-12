
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Institution, Language, Notice, Profile, UserRole } from '../types';
import { 
  Pin, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Bell, 
  ArrowLeft,
  Calendar,
  User,
  MoreVertical,
  CheckCircle2,
  Edit2,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';

interface NoticeBoardProps {
  lang: Language;
  madrasah: Institution | null;
  profile: Profile | null;
  role: UserRole;
  onBack: () => void;
}

const NoticeBoard: React.FC<NoticeBoardProps> = ({ lang, madrasah, profile, role, onBack }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [deleteNoticeId, setDeleteNoticeId] = useState<string | null>(null);
  const [newNotice, setNewNotice] = useState({ title: '', content: '', is_pinned: false, is_urgent: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = role === 'super_admin' || role === 'org_admin' || role === 'executive' || !!profile?.permissions?.can_manage_settings;

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    if (!madrasah) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      const localNoticesJson = localStorage.getItem(`local_notices_${madrasah.id}`);
      const localNotices: Notice[] = localNoticesJson ? JSON.parse(localNoticesJson) : [];

      let finalNotices: Notice[] = [];

      if (error) {
        console.error('Error fetching notices:', error);
        if (localNotices.length > 0) {
          finalNotices = localNotices;
        } else {
          // Fallback to demo data if table doesn't exist and no local data
          const demoNotices: Notice[] = [
            {
              id: '1',
              institution_id: madrasah.id,
              title: lang === 'bn' ? 'আগামী শুক্রবারের মিটিং' : 'Next Friday Meeting',
              content: lang === 'bn' ? 'সকল সদস্যকে আগামী শুক্রবার বিকেল ৪টায় উপস্থিত থাকার অনুরোধ করা হলো।' : 'All members are requested to attend next Friday at 4 PM.',
              is_pinned: true,
              is_urgent: true,
              created_at: new Date().toISOString()
            }
          ];
          finalNotices = demoNotices;
          localStorage.setItem(`local_notices_${madrasah.id}`, JSON.stringify(demoNotices));
        }
      } else {
        const supabaseIds = new Set((data || []).map(n => n.id));
        const nonDuplicateLocal = localNotices.filter(n => !supabaseIds.has(n.id));
        finalNotices = [...(data || []), ...nonDuplicateLocal];
      }

      // Re-sort to ensure pinned is always on top
      finalNotices.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setNotices(finalNotices);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNotice = async () => {
    if (!madrasah || !newNotice.title || !newNotice.content) return;
    setIsSubmitting(true);
    try {
      const noticeData: Notice = {
        id: Math.random().toString(),
        institution_id: madrasah.id,
        title: newNotice.title,
        content: newNotice.content,
        is_pinned: newNotice.is_pinned,
        is_urgent: newNotice.is_urgent,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('notices')
        .insert([{
          institution_id: noticeData.institution_id,
          title: noticeData.title,
          content: noticeData.content,
          is_pinned: noticeData.is_pinned,
          is_urgent: noticeData.is_urgent,
          created_at: noticeData.created_at
        }])
        .select();

      let savedNotice = noticeData;
      if (!error && data && data[0]) {
        savedNotice = data[0];
      }

      // Save to local storage fallback
      const localNoticesJson = localStorage.getItem(`local_notices_${madrasah.id}`);
      const localNotices: Notice[] = localNoticesJson ? JSON.parse(localNoticesJson) : [];
      const updatedLocalNotices = [savedNotice, ...localNotices];
      localStorage.setItem(`local_notices_${madrasah.id}`, JSON.stringify(updatedLocalNotices));

      setNotices(prev => [savedNotice, ...prev]);
      setIsAdding(false);
      setNewNotice({ title: '', content: '', is_pinned: false, is_urgent: false });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNotice = async () => {
    if (!madrasah || !editingNotice || !editingNotice.title || !editingNotice.content) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('notices')
        .update({
          title: editingNotice.title,
          content: editingNotice.content,
          is_pinned: editingNotice.is_pinned,
          is_urgent: editingNotice.is_urgent
        })
        .eq('id', editingNotice.id);

      if (error) throw error;

      // Update in local storage fallback
      const localNoticesJson = localStorage.getItem(`local_notices_${madrasah.id}`);
      if (localNoticesJson) {
        const localNotices: Notice[] = JSON.parse(localNoticesJson);
        const updated = localNotices.map(n => n.id === editingNotice.id ? editingNotice : n);
        localStorage.setItem(`local_notices_${madrasah.id}`, JSON.stringify(updated));
      }

      setNotices(prev => prev.map(n => n.id === editingNotice.id ? editingNotice : n));
      setEditingNotice(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await supabase
        .from('notices')
        .delete()
        .eq('id', id);

      // Remove from local storage fallback
      if (madrasah) {
        const localNoticesJson = localStorage.getItem(`local_notices_${madrasah.id}`);
        if (localNoticesJson) {
          const localNotices: Notice[] = JSON.parse(localNoticesJson);
          const updated = localNotices.filter(n => n.id !== id);
          localStorage.setItem(`local_notices_${madrasah.id}`, JSON.stringify(updated));
        }
      }

      setNotices(prev => prev.filter(n => n.id !== id));
      setDeleteNoticeId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const t = (key: string) => {
    const translations: any = {
      notice_board: { bn: 'নোটিশ বোর্ড', en: 'Notice Board' },
      add_notice: { bn: 'নতুন নোটিশ', en: 'Add Notice' },
      title: { bn: 'নোটিশের শিরোনাম', en: 'Notice Title' },
      content: { bn: 'বিস্তারিত তথ্য', en: 'Content' },
      pin: { bn: 'পিন করুন', en: 'Pin Notice' },
      urgent: { bn: 'জরুরী', en: 'Urgent' },
      submit: { bn: 'প্রকাশ করুন', en: 'Publish' },
      cancel: { bn: 'বাতিল', en: 'Cancel' },
      no_notices: { bn: 'কোনো নোটিশ নেই', en: 'No notices found' }
    };
    return translations[key]?.[lang] || key;
  };

  return (
    <div className={`flex flex-col h-full ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-20 px-6 py-4 flex items-center justify-between border-b ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`p-2 rounded-xl transition-colors ${madrasah?.theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-lg font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
            {t('notice_board')}
          </h1>
        </div>
        {canManage && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-[#42f5e9] text-[#0e8a84] px-4 py-2 rounded-xl font-black text-sm active:scale-95 transition-all"
          >
            <Plus size={18} />
            <span>{t('add_notice')}</span>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-[#42f5e9] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 opacity-50">
            <Bell size={48} className="mb-4 text-slate-300" />
            <p className="font-bold text-slate-400">{t('no_notices')}</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {notices.map((notice) => (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative p-5 rounded-3xl border shadow-sm ${
                  notice.is_urgent 
                    ? (madrasah?.theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-100')
                    : (madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100')
                }`}
              >
                {notice.is_pinned && (
                  <div className="absolute top-4 right-4 text-[#0fb5ab]">
                    <Pin size={16} fill="currentColor" />
                  </div>
                )}
                
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl shrink-0 ${
                    notice.is_urgent 
                      ? 'bg-red-100 text-red-600' 
                      : (madrasah?.theme === 'dark' ? 'bg-slate-700 text-[#42f5e9]' : 'bg-[#42f5e9]/10 text-[#0fb5ab]')
                  }`}>
                    {notice.is_urgent ? <AlertTriangle size={20} /> : <Bell size={20} />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                        {notice.title}
                      </h3>
                      {notice.is_urgent && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                          {t('urgent')}
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-sm leading-relaxed mb-4 ${madrasah?.theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {notice.content}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(notice.created_at)}
                        </span>
                      </div>
                      
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingNotice(notice); }}
                            className="p-2 text-slate-400 hover:text-[#0fb5ab] rounded-lg transition-colors"
                            title={lang === 'bn' ? 'এডিট করুন' : 'Edit Notice'}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteNoticeId(notice.id); }}
                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                            title={lang === 'bn' ? 'ডিলিট করুন' : 'Delete Notice'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modals Portaled */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-lg p-6 rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}
            >
              <h2 className={`text-xl font-black font-noto mb-6 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                {t('add_notice')}
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('title')}</label>
                  <input 
                    type="text" 
                    className={`w-full h-14 rounded-2xl px-6 font-bold outline-none border focus:border-[#42f5e9]/50 transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                    }`}
                    placeholder={lang === 'bn' ? 'নোটিশের টাইটেল দিন' : 'Enter notice title'}
                    value={newNotice.title}
                    onChange={(e) => setNewNotice({...newNotice, title: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('content')}</label>
                  <textarea 
                    rows={4}
                    className={`w-full p-6 rounded-2xl font-bold outline-none border focus:border-[#42f5e9]/50 transition-all resize-none ${
                      madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                    }`}
                    placeholder={lang === 'bn' ? 'বিস্তারিত নোটিশ লিখুন' : 'Enter notice description'}
                    value={newNotice.content}
                    onChange={(e) => setNewNotice({...newNotice, content: e.target.value})}
                  />
                </div>
                
                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => setNewNotice({...newNotice, is_pinned: !newNotice.is_pinned})}
                    className={`flex-1 p-4 rounded-2xl border flex items-center justify-center gap-2 transition-all ${
                      newNotice.is_pinned 
                        ? 'bg-[#42f5e9]/10 border-[#42f5e9]/20 text-[#0fb5ab]' 
                        : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400')
                    }`}
                  >
                    <Pin size={18} fill={newNotice.is_pinned ? "currentColor" : "none"} />
                    <span className="text-sm font-black">{t('pin')}</span>
                  </button>
                  
                  <button 
                    onClick={() => setNewNotice({...newNotice, is_urgent: !newNotice.is_urgent})}
                    className={`flex-1 p-4 rounded-2xl border flex items-center justify-center gap-2 transition-all ${
                      newNotice.is_urgent 
                        ? 'bg-red-50 border-red-200 text-red-600' 
                        : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400')
                    }`}
                  >
                    <AlertTriangle size={18} />
                    <span className="text-sm font-black">{t('urgent')}</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className={`flex-1 h-14 rounded-2xl font-black transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={handleAddNotice}
                    disabled={isSubmitting || !newNotice.title || !newNotice.content}
                    className="flex-[2] h-14 bg-[#42f5e9] text-[#0e8a84] rounded-2xl font-black shadow-lg shadow-[#42f5e9]/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('submit')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Modal */}
        {editingNotice && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingNotice(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-lg p-6 rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}
            >
              <h2 className={`text-xl font-black font-noto mb-6 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                {lang === 'bn' ? 'নোটিশ এডিট করুন' : 'Edit Notice'}
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('title')}</label>
                  <input 
                    type="text" 
                    className={`w-full h-14 rounded-2xl px-6 font-bold outline-none border focus:border-[#42f5e9]/50 transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                    }`}
                    value={editingNotice.title}
                    onChange={(e) => setEditingNotice({...editingNotice, title: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('content')}</label>
                  <textarea 
                    rows={4}
                    className={`w-full p-6 rounded-2xl font-bold outline-none border focus:border-[#42f5e9]/50 transition-all resize-none ${
                      madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                    }`}
                    value={editingNotice.content}
                    onChange={(e) => setEditingNotice({...editingNotice, content: e.target.value})}
                  />
                </div>
                
                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => setEditingNotice({...editingNotice, is_pinned: !editingNotice.is_pinned})}
                    className={`flex-1 p-4 rounded-2xl border flex items-center justify-center gap-2 transition-all ${
                      editingNotice.is_pinned 
                        ? 'bg-[#42f5e9]/10 border-[#42f5e9]/20 text-[#0fb5ab]' 
                        : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400')
                    }`}
                  >
                    <Pin size={18} fill={editingNotice.is_pinned ? "currentColor" : "none"} />
                    <span className="text-sm font-black">{t('pin')}</span>
                  </button>
                  
                  <button 
                    onClick={() => setEditingNotice({...editingNotice, is_urgent: !editingNotice.is_urgent})}
                    className={`flex-1 p-4 rounded-2xl border flex items-center justify-center gap-2 transition-all ${
                      editingNotice.is_urgent 
                        ? 'bg-red-50 border-red-200 text-red-600' 
                        : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-400' : 'bg-white border-slate-100 text-slate-400')
                    }`}
                  >
                    <AlertTriangle size={18} />
                    <span className="text-sm font-black">{t('urgent')}</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button 
                    onClick={() => setEditingNotice(null)}
                    className={`flex-1 h-14 rounded-2xl font-black transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    onClick={handleUpdateNotice}
                    disabled={isSubmitting || !editingNotice.title || !editingNotice.content}
                    className="flex-[2] h-14 bg-[#42f5e9] text-[#0e8a84] rounded-2xl font-black shadow-lg shadow-[#42f5e9]/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === 'bn' ? 'আপডেট করুন' : 'Update Notice')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteNoticeId && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteNoticeId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-sm p-6 rounded-[2.5rem] shadow-2xl text-center ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className={`text-lg font-black font-noto mb-2 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                {lang === 'bn' ? 'নোটিশ ডিলিট করবেন?' : 'Delete Notice?'}
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                {lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই নোটিশটি মুছে ফেলতে চান? এটি আর ফেরত পাওয়া যাবে না।' : 'Are you sure you want to delete this notice? This action cannot be undone.'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteNoticeId(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button 
                  onClick={() => handleDeleteNotice(deleteNoticeId)}
                  className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-rose-500/20 active:scale-95"
                >
                  {lang === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default NoticeBoard;
