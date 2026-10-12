
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Institution, Language, Poll, PollVote, Profile, UserRole } from '../types';
import { 
  Plus, 
  Trash2, 
  BarChart3, 
  ArrowLeft,
  Calendar,
  CheckCircle2,
  BarChart,
  Users,
  Timer,
  Edit2,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';

interface PollsProps {
  lang: Language;
  madrasah: Institution | null;
  profile: Profile | null;
  role: UserRole;
  onBack: () => void;
}

const Polls: React.FC<PollsProps> = ({ lang, madrasah, profile, role, onBack }) => {
  const [activePolls, setActivePolls] = useState<Poll[]>([]);
  const [completedPolls, setCompletedPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [deletePollId, setDeletePollId] = useState<string | null>(null);
  const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''], end_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = role === 'super_admin' || role === 'org_admin' || role === 'executive' || !!profile?.permissions?.can_manage_settings || !!profile?.permissions?.can_manage_members;

  useEffect(() => {
    fetchPolls();
  }, []);

  useEffect(() => {
    if (profile && votes.length > 0) {
      const initialSelections: Record<string, number> = {};
      votes.forEach(v => {
        if (v.member_id === profile.id) {
          initialSelections[v.poll_id] = v.option_index;
        }
      });
      setSelectedOptions(prev => ({ ...initialSelections, ...prev }));
    }
  }, [votes, profile]);

  const fetchPolls = async () => {
    if (!madrasah) return;
    setIsLoading(true);
    try {
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false });

      const { data: votesData, error: votesError } = await supabase
        .from('poll_votes')
        .select('*');

      const localPollsJson = localStorage.getItem(`local_polls_${madrasah.id}`);
      const localVotesJson = localStorage.getItem(`local_poll_votes_${madrasah.id}`);
      const localPolls: Poll[] = localPollsJson ? JSON.parse(localPollsJson) : [];
      const localVotes: PollVote[] = localVotesJson ? JSON.parse(localVotesJson) : [];

      let finalPolls: Poll[] = [];
      let finalVotes: PollVote[] = [];

      if (!pollsError && pollsData) {
        const supabaseIds = new Set(pollsData.map(p => p.id));
        const nonDuplicateLocal = localPolls.filter(p => !supabaseIds.has(p.id));
        finalPolls = [...pollsData, ...nonDuplicateLocal];
      } else {
        if (localPolls.length > 0) {
          finalPolls = localPolls;
        } else {
          const demoPolls: Poll[] = [
            {
              id: '1',
              institution_id: madrasah.id,
              question: lang === 'bn' ? 'আগামী পিকনিকের জন্য কোনটি সেরা জায়গা?' : 'Which place is best for next picnic?',
              options: lang === 'bn' ? ['কক্সবাজার', 'সিলেট', 'সুন্দরবন'] : ['Coxs Bazar', 'Sylhet', 'Sundarban'],
              is_active: true,
              created_at: new Date().toISOString()
            }
          ];
          finalPolls = demoPolls;
          localStorage.setItem(`local_polls_${madrasah.id}`, JSON.stringify(demoPolls));
        }
      }

      if (!votesError && votesData) {
        const supabaseVoteKeys = new Set(votesData.map(v => `${v.poll_id}_${v.member_id}`));
        const nonDuplicateLocalVotes = localVotes.filter(v => !supabaseVoteKeys.has(`${v.poll_id}_${v.member_id}`));
        finalVotes = [...votesData, ...nonDuplicateLocalVotes];
      } else {
        finalVotes = localVotes;
      }

      setActivePolls(finalPolls.filter(p => p.is_active));
      setCompletedPolls(finalPolls.filter(p => !p.is_active));
      setVotes(finalVotes);

      if (profile) {
        const initialSelections: Record<string, number> = {};
        finalVotes.forEach(v => {
          if (v.member_id === profile.id) {
            initialSelections[v.poll_id] = v.option_index;
          }
        });
        setSelectedOptions(initialSelections);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveVote = async (pollId: string) => {
    if (!profile || !madrasah) return;
    const selectedIndex = selectedOptions[pollId];
    if (selectedIndex === undefined) return;

    try {
      const voteData = {
        poll_id: pollId,
        member_id: profile.id,
        option_index: selectedIndex,
        created_at: new Date().toISOString()
      };

      // 1. Delete previous vote from Supabase to prevent duplicate key error
      try {
        await supabase
          .from('poll_votes')
          .delete()
          .eq('poll_id', pollId)
          .eq('member_id', profile.id);
      } catch (err) {
        console.error('Database clean up error:', err);
      }

      // 2. Insert new vote into Supabase
      const { data, error } = await supabase
        .from('poll_votes')
        .insert([voteData])
        .select();

      let savedVote = { ...voteData, id: Math.random().toString() };
      if (!error && data && data[0]) {
        savedVote = data[0];
      }

      // 3. Update local storage
      const localVotesJson = localStorage.getItem(`local_poll_votes_${madrasah.id}`);
      let localVotes: PollVote[] = localVotesJson ? JSON.parse(localVotesJson) : [];
      localVotes = localVotes.filter(v => !(v.poll_id === pollId && v.member_id === profile.id));
      localVotes.push(savedVote);
      localStorage.setItem(`local_poll_votes_${madrasah.id}`, JSON.stringify(localVotes));

      // 4. Update state
      setVotes(prev => {
        const filtered = prev.filter(v => !(v.poll_id === pollId && v.member_id === profile.id));
        return [...filtered, savedVote];
      });

      alert(lang === 'bn' ? 'ভোট সফলভাবে সংরক্ষিত হয়েছে!' : 'Vote saved successfully!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePoll = async () => {
    if (!madrasah || !newPoll.question || newPoll.options.some(o => !o)) return;
    setIsSubmitting(true);
    try {
      const pollData: Poll = {
        id: Math.random().toString(),
        institution_id: madrasah.id,
        question: newPoll.question,
        options: newPoll.options,
        is_active: true,
        created_at: new Date().toISOString(),
        end_date: newPoll.end_date || undefined
      };

      const { data, error } = await supabase
        .from('polls')
        .insert([{
          institution_id: pollData.institution_id,
          question: pollData.question,
          options: pollData.options,
          is_active: pollData.is_active,
          created_at: pollData.created_at,
          end_date: pollData.end_date || null
        }])
        .select();

      let savedPoll = pollData;
      if (!error && data && data[0]) {
        savedPoll = data[0];
      }

      // Save to local storage fallback
      const localPollsJson = localStorage.getItem(`local_polls_${madrasah.id}`);
      const localPolls: Poll[] = localPollsJson ? JSON.parse(localPollsJson) : [];
      const updatedLocalPolls = [savedPoll, ...localPolls];
      localStorage.setItem(`local_polls_${madrasah.id}`, JSON.stringify(updatedLocalPolls));

      setActivePolls(prev => [savedPoll, ...prev]);
      setIsCreating(false);
      setNewPoll({ question: '', options: ['', ''], end_date: '' });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePoll = async () => {
    if (!madrasah || !editingPoll || !editingPoll.question || editingPoll.options.some(o => !o)) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('polls')
        .update({
          question: editingPoll.question,
          options: editingPoll.options,
          end_date: editingPoll.end_date
        })
        .eq('id', editingPoll.id);

      if (error) throw error;

      // Update local storage fallback
      if (madrasah) {
        const localPollsJson = localStorage.getItem(`local_polls_${madrasah.id}`);
        if (localPollsJson) {
          const localPolls: Poll[] = JSON.parse(localPollsJson);
          const updated = localPolls.map(p => p.id === editingPoll.id ? editingPoll : p);
          localStorage.setItem(`local_polls_${madrasah.id}`, JSON.stringify(updated));
        }
      }

      setActivePolls(prev => prev.map(p => p.id === editingPoll.id ? editingPoll : p));
      setCompletedPolls(prev => prev.map(p => p.id === editingPoll.id ? editingPoll : p));
      setEditingPoll(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePoll = async (id: string) => {
    try {
      await supabase
        .from('polls')
        .update({ is_active: false })
        .eq('id', id);

      // Update in local storage fallback
      if (madrasah) {
        const localPollsJson = localStorage.getItem(`local_polls_${madrasah.id}`);
        if (localPollsJson) {
          const localPolls: Poll[] = JSON.parse(localPollsJson);
          const updated = localPolls.map(p => p.id === id ? { ...p, is_active: false } : p);
          localStorage.setItem(`local_polls_${madrasah.id}`, JSON.stringify(updated));
        }
      }

      const poll = activePolls.find(p => p.id === id);
      if (poll) {
        setActivePolls(prev => prev.filter(p => p.id !== id));
        setCompletedPolls(prev => [{ ...poll, is_active: false }, ...prev]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePoll = async (id: string) => {
    try {
      await supabase
        .from('polls')
        .delete()
        .eq('id', id);

      // Remove from local storage fallback
      if (madrasah) {
        const localPollsJson = localStorage.getItem(`local_polls_${madrasah.id}`);
        if (localPollsJson) {
          const localPolls: Poll[] = JSON.parse(localPollsJson);
          const updated = localPolls.filter(p => p.id !== id);
          localStorage.setItem(`local_polls_${madrasah.id}`, JSON.stringify(updated));
        }
      }

      setActivePolls(prev => prev.filter(p => p.id !== id));
      setCompletedPolls(prev => prev.filter(p => p.id !== id));
      setDeletePollId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const calculateResults = (pollId: string, options: string[]) => {
    const pollVotes = votes.filter(v => v.poll_id === pollId);
    const total = pollVotes.length;
    return options.map((_, idx) => {
      const count = pollVotes.filter(v => v.option_index === idx).length;
      return {
        percentage: total === 0 ? 0 : Math.round((count / total) * 100),
        count
      };
    });
  };

  const t = (key: string) => {
    const translations: any = {
      voting_polls: { bn: 'ভোট ও পোলিং', en: 'Voting & Polls' },
      create_poll: { bn: 'নতুন পোল তৈরি', en: 'Create Poll' },
      question: { bn: 'পোলের প্রশ্ন', en: 'Poll Question' },
      options: { bn: 'বিকল্পসমূহ', en: 'Options' },
      active: { bn: 'চলমান পোল', en: 'Active Polls' },
      completed: { bn: 'সম্পন্ন পোল', en: 'Completed Polls' },
      vote: { bn: 'ভোট দিন', en: 'Vote Now' },
      voted: { bn: 'ভোট দিয়েছেন', en: 'You Voted' },
      total_votes: { bn: 'মোট ভোট', en: 'Total Votes' },
      close_poll: { bn: 'বন্ধ করুন', en: 'Close Poll' },
      no_active: { bn: 'কোনো চলমান পোল নেই', en: 'No active polls found' },
      save_vote: { bn: 'ভোট সংরক্ষণ করুন', en: 'Save Vote' },
      change_vote: { bn: 'ভোট পরিবর্তন করুন', en: 'Change Vote' }
    };
    return translations[key]?.[lang] || key;
  };

  return (
    <div className={`flex flex-col h-full ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <header className={`sticky top-0 z-20 px-6 py-4 flex items-center justify-between border-b ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#42f5e9]/20'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`p-2 rounded-xl transition-colors ${madrasah?.theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-lg font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
            {t('voting_polls')}
          </h1>
        </div>
        {canManage && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-[#42f5e9] text-[#0e8a84] px-4 py-2 rounded-xl font-black text-sm active:scale-95 transition-all"
          >
            <Plus size={18} />
            <span>{t('create_poll')}</span>
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-[#42f5e9] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Active Polls */}
            <section>
              <h2 className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                <Timer size={14} />
                {t('active')}
              </h2>
              {activePolls.length === 0 ? (
                <div className="p-10 text-center opacity-50 border-2 border-dashed rounded-[2rem] border-slate-200">
                  <p className="font-bold text-slate-400">{t('no_active')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activePolls.map((poll) => {
                    const stats = calculateResults(poll.id, poll.options);
                    const totalVotes = stats.reduce((acc, curr) => acc + curr.count, 0);
                    const userVote = votes.find(v => v.poll_id === poll.id && v.member_id === profile?.id);
                    
                    return (
                      <motion.div
                        key={poll.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-[2rem] border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                      >
                        <h3 className={`text-lg font-black font-noto mb-4 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                          {poll.question}
                        </h3>
                        
                        <div className="space-y-3">
                          {poll.options.map((option, idx) => {
                            const isSelected = selectedOptions[poll.id] === idx;
                            const isSavedUserVote = userVote?.option_index === idx;
                            const stat = stats[idx];
                            const hasVoted = !!userVote;
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedOptions(prev => ({ ...prev, [poll.id]: idx }))}
                                className={`w-full group relative overflow-hidden transition-all text-left rounded-2xl h-14 px-5 flex items-center justify-between font-bold border ${
                                  isSelected
                                    ? 'border-[#42f5e9] bg-[#42f5e9]/10 text-[#0fb5ab]'
                                    : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white hover:border-[#42f5e9]/50' : 'bg-slate-50 border-[#42f5e9]/10 text-[#0fb5ab] hover:border-[#42f5e9]/30')
                                }`}
                              >
                                {hasVoted && (
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stat.percentage}%` }}
                                    className={`absolute inset-0 opacity-10 transition-all ${isSelected ? 'bg-[#42f5e9]' : 'bg-slate-400'}`}
                                  />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                  {isSelected && <CheckCircle2 size={18} />}
                                  {option}
                                  {isSavedUserVote && (
                                    <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 ml-2">
                                      {lang === 'bn' ? 'সংরক্ষিত' : 'Saved'}
                                    </span>
                                  )}
                                </span>
                                {hasVoted && (
                                  <span className="relative z-10 text-xs font-black">
                                    {stat.percentage}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Save / Change Vote Button */}
                        {selectedOptions[poll.id] !== undefined && selectedOptions[poll.id] !== userVote?.option_index && (
                          <div className="mt-4 flex justify-end">
                            <button
                              onClick={() => handleSaveVote(poll.id)}
                              className="bg-[#42f5e9] text-[#0e8a84] px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-md shadow-[#42f5e9]/15 flex items-center gap-2"
                            >
                              <span>{userVote ? t('change_vote') : t('save_vote')}</span>
                            </button>
                          </div>
                        )}
                        
                        <div className="mt-6 pt-5 border-t border-inherit flex items-center justify-between">
                          <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5">
                              <Users size={12} />
                              {totalVotes} {t('total_votes')}
                            </span>
                          </div>
                          
                          {canManage && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setEditingPoll(poll)}
                                className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-widest px-3 py-1.5 bg-[#42f5e9]/10 hover:bg-[#42f5e9]/20 rounded-full transition-all flex items-center gap-1"
                                title={lang === 'bn' ? 'এডিট করুন' : 'Edit Poll'}
                              >
                                <Edit2 size={12} />
                                <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                              </button>
                              <button 
                                onClick={() => handleClosePoll(poll.id)}
                                className="text-[10px] font-black text-amber-600 uppercase tracking-widest px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 rounded-full transition-all"
                              >
                                {t('close_poll')}
                              </button>
                              <button 
                                onClick={() => setDeletePollId(poll.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-all"
                                title={lang === 'bn' ? 'ডিলিট করুন' : 'Delete Poll'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Completed Polls */}
            {completedPolls.length > 0 && (
              <section>
                <h2 className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  <BarChart3 size={14} />
                  {t('completed')}
                </h2>
                <div className="space-y-4">
                  {completedPolls.map((poll) => {
                    const stats = calculateResults(poll.id, poll.options);
                    const totalVotes = stats.reduce((acc, curr) => acc + curr.count, 0);
                    const maxPercentage = Math.max(...stats.map(s => s.percentage));
                    
                    return (
                      <div
                        key={poll.id}
                        className={`p-6 rounded-[2rem] border opacity-90 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-50'}`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <h3 className={`text-lg font-black font-noto ${madrasah?.theme === 'dark' ? 'text-slate-100' : 'text-slate-700'}`}>
                            {poll.question}
                          </h3>
                          {canManage && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingPoll(poll); }}
                                className="p-1.5 text-slate-400 hover:text-[#0fb5ab] rounded-full transition-all"
                                title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setDeletePollId(poll.id); }}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-all"
                                title={lang === 'bn' ? 'ডিলিট করুন' : 'Delete'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {poll.options.map((option, idx) => {
                            const stat = stats[idx];
                            const isWinner = stat.percentage === maxPercentage && totalVotes > 0;
                            
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold mb-1">
                                  <span className={isWinner ? 'text-[#0fb5ab]' : 'text-slate-500'}>{option}</span>
                                  <span className="text-slate-400">{stat.percentage}% ({stat.count})</span>
                                </div>
                                <div className={`h-2 w-full rounded-full ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stat.percentage}%` }}
                                    className={`h-full rounded-full ${isWinner ? 'bg-[#42f5e9]' : 'bg-slate-300'}`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Modals Portaled */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-lg p-6 rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}
            >
              <h2 className={`text-xl font-black font-noto mb-6 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                {t('create_poll')}
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('question')}</label>
                  <input 
                    type="text" 
                    className={`w-full h-14 rounded-2xl px-6 font-bold outline-none border focus:border-[#42f5e9]/50 transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                    }`}
                    placeholder={lang === 'bn' ? 'আপনার প্রশ্ন লিখুন...' : 'Enter your question...'}
                    value={newPoll.question}
                    onChange={(e) => setNewPoll({...newPoll, question: e.target.value})}
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('options')}</label>
                  {newPoll.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        type="text" 
                        className={`flex-1 h-12 rounded-xl px-5 font-bold outline-none border focus:border-[#42f5e9]/50 transition-all ${
                          madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                        }`}
                        placeholder={`${lang === 'bn' ? 'বিকল্প' : 'Option'} ${i + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...newPoll.options];
                          newOpts[i] = e.target.value;
                          setNewPoll({...newPoll, options: newOpts});
                        }}
                      />
                      {newPoll.options.length > 2 && (
                        <button 
                          onClick={() => {
                            const newOpts = newPoll.options.filter((_, idx) => idx !== i);
                            setNewPoll({...newPoll, options: newOpts});
                          }}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {newPoll.options.length < 5 && (
                    <button 
                      onClick={() => setNewPoll({...newPoll, options: [...newPoll.options, '']})}
                      className="flex items-center gap-2 text-xs font-black text-[#0fb5ab] uppercase tracking-widest px-2 hover:text-[#0e8a84] transition-all"
                    >
                      <Plus size={14} />
                      <span>{lang === 'bn' ? 'আরও যোগ করুন' : 'Add More'}</span>
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button 
                    onClick={() => setIsCreating(false)}
                    className={`flex-1 h-14 rounded-2xl font-black transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button 
                    onClick={handleCreatePoll}
                    disabled={isSubmitting || !newPoll.question || newPoll.options.some(o => !o)}
                    className="flex-[2] h-14 bg-[#42f5e9] text-[#0e8a84] rounded-2xl font-black shadow-lg shadow-[#42f5e9]/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : lang === 'bn' ? 'তৈরি করুন' : 'Create Poll'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Modal */}
        {editingPoll && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPoll(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-lg p-6 rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}
            >
              <h2 className={`text-xl font-black font-noto mb-6 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#0fb5ab]'}`}>
                {lang === 'bn' ? 'পোল এডিট করুন' : 'Edit Poll'}
              </h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('question')}</label>
                  <input 
                    type="text" 
                    className={`w-full h-14 rounded-2xl px-6 font-bold outline-none border focus:border-[#42f5e9]/50 transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                    }`}
                    value={editingPoll.question}
                    onChange={(e) => setEditingPoll({...editingPoll, question: e.target.value})}
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{t('options')}</label>
                  {editingPoll.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        type="text" 
                        className={`flex-1 h-12 rounded-xl px-5 font-bold outline-none border focus:border-[#42f5e9]/50 transition-all ${
                          madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#0fb5ab]'
                        }`}
                        placeholder={`${lang === 'bn' ? 'বিকল্প' : 'Option'} ${i + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...editingPoll.options];
                          newOpts[i] = e.target.value;
                          setEditingPoll({...editingPoll, options: newOpts});
                        }}
                      />
                      {editingPoll.options.length > 2 && (
                        <button 
                          onClick={() => {
                            const newOpts = editingPoll.options.filter((_, idx) => idx !== i);
                            setEditingPoll({...editingPoll, options: newOpts});
                          }}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center gap-3 pt-4">
                  <button 
                    onClick={() => setEditingPoll(null)}
                    className={`flex-1 h-14 rounded-2xl font-black transition-all ${
                      madrasah?.theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button 
                    onClick={handleUpdatePoll}
                    disabled={isSubmitting || !editingPoll.question || editingPoll.options.some(o => !o)}
                    className="flex-[2] h-14 bg-[#42f5e9] text-[#0e8a84] rounded-2xl font-black shadow-lg shadow-[#42f5e9]/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : lang === 'bn' ? 'আপডেট করুন' : 'Update Poll'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletePollId && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletePollId(null)}
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
                {lang === 'bn' ? 'পোল ডিলিট করবেন?' : 'Delete Poll?'}
              </h3>
              <p className="text-xs text-slate-400 mb-6 font-noto">
                {lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই পোল ও এর সকল ভোট মুছে ফেলতে চান?' : 'Are you sure you want to delete this poll and all its votes?'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletePollId(null)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button 
                  onClick={() => handleDeletePoll(deletePollId)}
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

export default Polls;
