
import React, { useState, useEffect } from 'react';
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
  Timer
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
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''], end_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = role === 'super_admin' || role === 'org_admin' || profile?.permissions?.can_manage_settings;

  useEffect(() => {
    fetchPolls();
  }, []);

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

      if (!pollsError && pollsData) {
        setActivePolls(pollsData.filter(p => p.is_active));
        setCompletedPolls(pollsData.filter(p => !p.is_active));
      } else {
        // Mock data
        const mockPolls: Poll[] = [
          {
            id: '1',
            institution_id: madrasah.id,
            question: lang === 'bn' ? 'আগামী পিকনিকের জন্য কোনটি সেরা জায়গা?' : 'Which place is best for next picnic?',
            options: lang === 'bn' ? ['কক্সবাজার', 'সিলেট', 'সুন্দরবন'] : ['Coxs Bazar', 'Sylhet', 'Sundarban'],
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        setActivePolls(mockPolls);
      }
      
      if (!votesError && votesData) {
        setVotes(votesData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!profile) return;
    
    // Check if already voted
    if (votes.some(v => v.poll_id === pollId && v.member_id === profile.id)) return;

    try {
      const voteData = {
        poll_id: pollId,
        member_id: profile.id,
        option_index: optionIndex,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('poll_votes')
        .insert([voteData])
        .select();

      if (error) {
        setVotes(prev => [...prev, { ...voteData, id: Math.random().toString() }]);
      } else if (data) {
        setVotes(prev => [...prev, data[0]]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePoll = async () => {
    if (!madrasah || !newPoll.question || newPoll.options.some(o => !o)) return;
    setIsSubmitting(true);
    try {
      const pollData = {
        institution_id: madrasah.id,
        question: newPoll.question,
        options: newPoll.options,
        is_active: true,
        created_at: new Date().toISOString(),
        end_date: newPoll.end_date || null
      };

      const { data, error } = await supabase
        .from('polls')
        .insert([pollData])
        .select();

      if (error) {
        setActivePolls(prev => [{ ...pollData, id: Math.random().toString() }, ...prev]);
        setIsCreating(false);
        setNewPoll({ question: '', options: ['', ''], end_date: '' });
      } else if (data) {
        setActivePolls(prev => [data[0], ...prev]);
        setIsCreating(false);
        setNewPoll({ question: '', options: ['', ''], end_date: '' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePoll = async (id: string) => {
    if (!confirm(lang === 'bn' ? 'আপনি কি পোলটি বন্ধ করতে চান?' : 'Do you want to close this poll?')) return;
    try {
      const { error } = await supabase
        .from('polls')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        const poll = activePolls.find(p => p.id === id);
        if (poll) {
          setActivePolls(prev => prev.filter(p => p.id !== id));
          setCompletedPolls(prev => [{ ...poll, is_active: false }, ...prev]);
        }
      } else {
        const poll = activePolls.find(p => p.id === id);
        if (poll) {
          setActivePolls(prev => prev.filter(p => p.id !== id));
          setCompletedPolls(prev => [{ ...poll, is_active: false }, ...prev]);
        }
      }
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
      no_active: { bn: 'কোনো চলমান পোল নেই', en: 'No active polls found' }
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
                            const isSelected = userVote?.option_index === idx;
                            const stat = stats[idx];
                            
                            return (
                              <button
                                key={idx}
                                disabled={!!userVote}
                                onClick={() => handleVote(poll.id, idx)}
                                className={`w-full group relative overflow-hidden transition-all text-left rounded-2xl h-14 px-5 flex items-center justify-between font-bold border ${
                                  userVote
                                    ? (isSelected ? 'border-[#42f5e9] bg-[#42f5e9]/10 text-[#0fb5ab]' : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'))
                                    : (madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white hover:border-[#42f5e9]/50' : 'bg-slate-50 border-[#42f5e9]/10 text-[#0fb5ab] hover:border-[#42f5e9]/30')
                                }`}
                              >
                                {userVote && (
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stat.percentage}%` }}
                                    className={`absolute inset-0 opacity-10 transition-all ${isSelected ? 'bg-[#42f5e9]' : 'bg-slate-400'}`}
                                  />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                  {isSelected && <CheckCircle2 size={18} />}
                                  {option}
                                </span>
                                {userVote && (
                                  <span className="relative z-10 text-xs font-black">
                                    {stat.percentage}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        
                        <div className="mt-6 pt-5 border-t border-inherit flex items-center justify-between">
                          <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5">
                              <Users size={12} />
                              {totalVotes} {t('total_votes')}
                            </span>
                          </div>
                          
                          {canManage && (
                            <button 
                              onClick={() => handleClosePoll(poll.id)}
                              className="text-[10px] font-black text-red-500 uppercase tracking-widest px-3 py-1 bg-red-50 rounded-full hover:bg-red-100 transition-all"
                            >
                              {t('close_poll')}
                            </button>
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
                        className={`p-6 rounded-[2rem] border opacity-80 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-50'}`}
                      >
                        <h3 className={`text-lg font-black font-noto mb-4 ${madrasah?.theme === 'dark' ? 'text-slate-100' : 'text-slate-700'}`}>
                          {poll.question}
                        </h3>
                        
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

      {/* Create Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className={`relative w-full max-w-lg p-6 rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl ${madrasah?.theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}
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
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : lang === 'bn' ? 'তৈরি করুন' : 'Create Poll'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Polls;
