import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Phone, Mail, MapPin, Calendar, CreditCard, CheckCircle2, 
  Clock, AlertCircle, FileText, Download, ChevronRight, ShieldCheck, 
  HelpCircle, Printer, MessageSquare, Vote, Bell, Award, DollarSign,
  TrendingUp, RefreshCw, Eye, Sparkles, Check, ChevronDown
} from 'lucide-react';
import { Institution, Language, Member, Profile, Poll, PollVote } from '../../types';
import { supabase } from '../../supabase';
import { t } from '../../translations';

interface MemberPortalDashboardProps {
  lang: Language;
  madrasah: Institution | null;
  profile: Profile | null;
  onNavigateToView?: (view: string) => void;
}

export const MemberPortalDashboard: React.FC<MemberPortalDashboardProps> = ({
  lang,
  madrasah,
  profile,
  onNavigateToView
}) => {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fees, setFees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [selectedPollOption, setSelectedPollOption] = useState<Record<string, number>>({});
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'finances' | 'attendance' | 'notices' | 'meetings' | 'polls'>('overview');
  const [idCardModal, setIdCardModal] = useState(false);

  const permissions = madrasah?.member_portal_config?.permissions || {
    view_meetings: true,
    view_minutes: true,
    view_polls: true,
    view_notices: true,
    view_finances: true,
    view_attendance: true
  };

  const fetchMemberFullData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Member record
      const { data: memberData } = await supabase
        .from('members')
        .select('*, departments(*)')
        .eq('id', profile.id)
        .maybeSingle();

      if (memberData) {
        setMember(memberData);
      } else {
        // Fallback from localStorage
        const stored = localStorage.getItem('member_session');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed?.member) setMember(parsed.member);
          } catch (e) {}
        }
      }

      // 2. Fetch Member Fees (if permitted)
      if (permissions.view_finances) {
        const { data: feeData } = await supabase
          .from('fees')
          .select('*, fee_structures(*)')
          .eq('member_id', profile.id)
          .order('created_at', { ascending: false });

        if (feeData) {
          setFees(feeData);
        } else {
          // Check local fees cache if any
          const localFees = localStorage.getItem(`local_fees_${madrasah?.id}`);
          if (localFees) {
            try {
              const allF = JSON.parse(localFees);
              setFees(allF.filter((f: any) => f.member_id === profile.id));
            } catch (e) {}
          }
        }
      }

      // 3. Fetch Member Attendance (if permitted)
      if (permissions.view_attendance) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .eq('member_id', profile.id)
          .order('date', { ascending: false })
          .limit(30);

        if (attData) {
          setAttendance(attData);
        }
      }

      // 4. Fetch Notices (if permitted)
      if (permissions.view_notices && madrasah?.id) {
        const { data: noticeData } = await supabase
          .from('notices')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (noticeData) setNotices(noticeData);
      }

      // 5. Fetch Meetings (if permitted)
      if (permissions.view_meetings && madrasah?.id) {
        const { data: meetData } = await supabase
          .from('meetings')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (meetData) setMeetings(meetData);
      }

      // 6. Fetch Polls & Votes (if permitted)
      if (permissions.view_polls && madrasah?.id) {
        const { data: pollData } = await supabase
          .from('polls')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('created_at', { ascending: false });

        const { data: voteData } = await supabase
          .from('poll_votes')
          .select('*');

        if (pollData) setPolls(pollData);
        if (voteData) {
          setVotes(voteData);
          const initialSelections: Record<string, number> = {};
          voteData.forEach((v: any) => {
            if (v.member_id === profile.id) {
              initialSelections[v.poll_id] = v.option_index;
            }
          });
          setSelectedPollOption(initialSelections);
        }
      }
    } catch (err) {
      console.error('Error fetching member portal data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, madrasah?.id, permissions.view_finances, permissions.view_attendance, permissions.view_notices, permissions.view_meetings, permissions.view_polls]);

  useEffect(() => {
    fetchMemberFullData();
  }, [fetchMemberFullData]);

  // Calculations for Member's Personal Finances
  const totalAssignedFee = fees.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
  const totalPaidFee = fees.filter(f => f.status === 'paid').reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
  const totalDueFee = fees.filter(f => f.status !== 'paid').reduce((acc, f) => acc + (Number(f.amount) || 0), 0);

  // Calculations for Attendance
  const totalDaysTracked = attendance.length;
  const presentDays = attendance.filter(a => a.status === 'present').length;
  const attendanceRate = totalDaysTracked > 0 ? Math.round((presentDays / totalDaysTracked) * 100) : 100;

  // Cast Vote Handler
  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!profile?.id) return;
    setVotingPollId(pollId);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .upsert({
          poll_id: pollId,
          member_id: profile.id,
          option_index: optionIndex
        }, { onConflict: 'poll_id,member_id' });

      if (error) throw error;

      setSelectedPollOption(prev => ({ ...prev, [pollId]: optionIndex }));
      // Refresh votes
      const { data: newVotes } = await supabase.from('poll_votes').select('*');
      if (newVotes) setVotes(newVotes);
    } catch (err: any) {
      alert(lang === 'bn' ? 'ভোট গ্রহণে সমস্যা হয়েছে: ' + err.message : 'Failed to cast vote: ' + err.message);
    } finally {
      setVotingPollId(null);
    }
  };

  const isDark = madrasah?.theme === 'dark';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-28 max-w-5xl mx-auto px-2 sm:px-4">
      
      {/* 1. Member Profile & Identity Header Card */}
      <div className={`relative overflow-hidden rounded-[2.5rem] border shadow-xl p-6 sm:p-8 ${
        isDark ? 'bg-slate-800/90 border-slate-700 text-white' : 'bg-gradient-to-br from-white to-sky-50/50 border-sky-100 text-slate-800'
      }`}>
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-sky-400/10 to-teal-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10 text-center sm:text-left">
          <div className="relative group shrink-0">
            <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] border-4 p-1 shadow-xl overflow-hidden flex items-center justify-center ${
              isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-sky-100'
            }`}>
              {member?.photo_url ? (
                <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover rounded-[1.7rem]" />
              ) : (
                <div className="w-full h-full rounded-[1.7rem] bg-sky-500/10 flex items-center justify-center text-sky-600">
                  <User size={54} strokeWidth={1.5} />
                </div>
              )}
            </div>
            <span className="absolute -bottom-2 right-1/2 translate-x-1/2 sm:translate-x-0 sm:-right-2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {lang === 'bn' ? 'সক্রিয় সদস্য' : 'Active'}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-wider">
                {member?.member_type || (lang === 'bn' ? 'সাধারণ সদস্য' : 'General Member')}
              </span>
              {member?.member_id_number && (
                <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs">
                  ID: #{member.member_id_number}
                </span>
              )}
              {member?.departments?.name && (
                <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  {member.departments.name}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-noto tracking-tight">
              {member?.name || profile?.full_name || 'সদস্য একাউন্ট'}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1.5">
              <ShieldCheck size={16} className="text-sky-500" />
              {madrasah?.name || 'Committee Manager'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {member?.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" />
                  <span>{member.phone}</span>
                </div>
              )}
              {member?.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-400" />
                  <span className="truncate">{member.email}</span>
                </div>
              )}
              {member?.blood_group && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-500">Blood:</span>
                  <span>{member.blood_group}</span>
                </div>
              )}
              {member?.join_date && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400" />
                  <span>{lang === 'bn' ? 'যোগদান:' : 'Joined:'} {member.join_date}</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-5">
              <button
                onClick={() => setIdCardModal(true)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <Printer size={15} />
                <span>{lang === 'bn' ? 'ডিজিটাল আইডি কার্ড' : 'Digital ID Card'}</span>
              </button>
              <button
                onClick={fetchMemberFullData}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center gap-2 active:scale-95 transition-all"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs for Member Features */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveSection('overview')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition-all ${
            activeSection === 'overview'
              ? 'bg-sky-600 text-white shadow-md'
              : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {lang === 'bn' ? 'সারসংক্ষেপ' : 'Overview'}
        </button>

        {permissions.view_finances && (
          <button
            onClick={() => setActiveSection('finances')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSection === 'finances'
                ? 'bg-sky-600 text-white shadow-md'
                : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CreditCard size={15} />
            <span>{lang === 'bn' ? 'আমার ফি ও হিসাব' : 'My Finances'}</span>
            {totalDueFee > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        )}

        {permissions.view_attendance && (
          <button
            onClick={() => setActiveSection('attendance')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSection === 'attendance'
                ? 'bg-sky-600 text-white shadow-md'
                : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Clock size={15} />
            <span>{lang === 'bn' ? 'আমার উপস্থিতি' : 'My Attendance'}</span>
          </button>
        )}

        {permissions.view_notices && (
          <button
            onClick={() => setActiveSection('notices')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSection === 'notices'
                ? 'bg-sky-600 text-white shadow-md'
                : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Bell size={15} />
            <span>{lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notices'}</span>
            {notices.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black">
                {notices.length}
              </span>
            )}
          </button>
        )}

        {permissions.view_meetings && (
          <button
            onClick={() => setActiveSection('meetings')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSection === 'meetings'
                ? 'bg-sky-600 text-white shadow-md'
                : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquare size={15} />
            <span>{lang === 'bn' ? 'সভা ও সিদ্ধান্ত' : 'Meetings'}</span>
          </button>
        )}

        {permissions.view_polls && (
          <button
            onClick={() => setActiveSection('polls')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSection === 'polls'
                ? 'bg-sky-600 text-white shadow-md'
                : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Vote size={15} />
            <span>{lang === 'bn' ? 'পোল ও ভোট' : 'Polls'}</span>
          </button>
        )}
      </div>

      {/* 3. Section Content */}
      {/* 3.1 Overview Tab */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          
          {/* Stats Grid for Member */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {permissions.view_finances && (
              <>
                <div className={`p-5 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                    <DollarSign size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'bn' ? 'পরিশোধিত ফি' : 'Paid Amount'}
                  </p>
                  <p className="text-xl sm:text-2xl font-black mt-1 text-emerald-600">
                    ৳{totalPaidFee.toLocaleString()}
                  </p>
                </div>

                <div className={`p-5 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3">
                    <Clock size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'bn' ? 'বকেয়া ফি' : 'Due Amount'}
                  </p>
                  <p className="text-xl sm:text-2xl font-black mt-1 text-amber-600">
                    ৳{totalDueFee.toLocaleString()}
                  </p>
                </div>
              </>
            )}

            {permissions.view_attendance && (
              <>
                <div className={`p-5 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center mb-3">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'bn' ? 'উপস্থিতির হার' : 'Attendance'}
                  </p>
                  <p className="text-xl sm:text-2xl font-black mt-1 text-sky-600">
                    {attendanceRate}%
                  </p>
                </div>

                <div className={`p-5 rounded-[2rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-3">
                    <Calendar size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'bn' ? 'মোট দিন' : 'Total Days'}
                  </p>
                  <p className="text-xl sm:text-2xl font-black mt-1 text-indigo-600">
                    {presentDays}/{totalDaysTracked}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Quick Recent Dues / Payments */}
          {permissions.view_finances && fees.length > 0 && (
            <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-sky-500" />
                  <h3 className="text-base font-black font-noto">
                    {lang === 'bn' ? 'সাম্প্রতিক ফি ও লেনদেন' : 'Recent Fees & Payments'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSection('finances')}
                  className="text-xs font-black text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>{lang === 'bn' ? 'সকল বিবরণ' : 'View All'}</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {fees.slice(0, 3).map((fee) => (
                  <div key={fee.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold">{fee.fee_structures?.title || fee.title || (lang === 'bn' ? 'নির্ধারিত ফি' : 'Membership Fee')}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{new Date(fee.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">৳{Number(fee.amount).toLocaleString()}</p>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        fee.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {fee.status === 'paid' ? (lang === 'bn' ? 'পরিশোধিত' : 'Paid') : (lang === 'bn' ? 'বকেয়া' : 'Due')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Notice Banner */}
          {permissions.view_notices && notices.length > 0 && (
            <div className={`p-6 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-red-500" />
                  <h3 className="text-base font-black font-noto">
                    {lang === 'bn' ? 'সর্বশেষ নোটিশ' : 'Latest Announcements'}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSection('notices')}
                  className="text-xs font-black text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>{lang === 'bn' ? 'সকল নোটিশ' : 'All Notices'}</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-3">
                {notices.slice(0, 2).map((notice) => (
                  <div
                    key={notice.id}
                    onClick={() => setSelectedNotice(notice)}
                    className={`p-4 rounded-2xl border cursor-pointer hover:border-sky-300 transition-all ${
                      isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-black text-slate-800 dark:text-white truncate">{notice.title}</h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(notice.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{notice.description || notice.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* 3.2 Finances Tab */}
      {activeSection === 'finances' && permissions.view_finances && (
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black font-noto">{lang === 'bn' ? 'আমার আর্থিক বিবরণী ও ফি' : 'My Financial Records'}</h2>
              <p className="text-xs text-slate-400 mt-1">{lang === 'bn' ? 'আপনার সকল নির্ধারিত ফি এবং পরিশোধের হিসাব' : 'Your assigned fees and transaction history'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                {lang === 'bn' ? 'পরিশোধ:' : 'Paid:'} ৳{totalPaidFee.toLocaleString()}
              </div>
              <div className="px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-black text-xs">
                {lang === 'bn' ? 'বকেয়া:' : 'Due:'} ৳{totalDueFee.toLocaleString()}
              </div>
            </div>
          </div>

          {fees.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
              <p>{lang === 'bn' ? 'কোনো ফি বা বকেয়ার রেকর্ড পাওয়া যায়নি।' : 'No fee records found.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-2">{lang === 'bn' ? 'বিবরণ' : 'Description'}</th>
                    <th className="py-3 px-2">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                    <th className="py-3 px-2">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                    <th className="py-3 px-2">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {fees.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3.5 px-2 font-bold">{f.fee_structures?.title || f.title || (lang === 'bn' ? 'সদস্য ফি' : 'Fee')}</td>
                      <td className="py-3.5 px-2 font-black">৳{Number(f.amount).toLocaleString()}</td>
                      <td className="py-3.5 px-2 text-slate-500 dark:text-slate-400">{new Date(f.created_at).toLocaleDateString()}</td>
                      <td className="py-3.5 px-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          f.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {f.status === 'paid' ? (lang === 'bn' ? 'পরিশোধিত' : 'Paid') : (lang === 'bn' ? 'বকেয়া' : 'Due')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3.3 Attendance Tab */}
      {activeSection === 'attendance' && permissions.view_attendance && (
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black font-noto">{lang === 'bn' ? 'আমার উপস্থিতি রেকর্ড' : 'My Attendance Logs'}</h2>
              <p className="text-xs text-slate-400 mt-1">{lang === 'bn' ? 'সভা ও কার্যক্রমে আপনার অংশগ্রহণের তথ্য' : 'Your participation and attendance logs'}</p>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-black text-xs">
              {lang === 'bn' ? 'গড় উপস্থিতি:' : 'Attendance Rate:'} {attendanceRate}%
            </div>
          </div>

          {attendance.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              <Clock size={40} className="mx-auto mb-2 opacity-50" />
              <p>{lang === 'bn' ? 'কোনো উপস্থিতির রেকর্ড পাওয়া যায়নি।' : 'No attendance logs recorded yet.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {attendance.map((att) => (
                <div key={att.id} className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                }`}>
                  <div>
                    <p className="text-xs font-black">{new Date(att.date).toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                    <p className="text-[10px] text-slate-400">{att.remarks || (lang === 'bn' ? 'সাধারণ মিটিং/সেশন' : 'Regular Session')}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    att.status === 'present'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {att.status === 'present' ? (lang === 'bn' ? 'উপস্থিত' : 'Present') : (lang === 'bn' ? 'অনুপস্থিত' : 'Absent')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3.4 Notices Tab */}
      {activeSection === 'notices' && permissions.view_notices && (
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <h2 className="text-xl font-black font-noto mb-1">{lang === 'bn' ? 'নোটিশ বোর্ড' : 'Notice Board'}</h2>
          <p className="text-xs text-slate-400 mb-6">{lang === 'bn' ? 'প্রতিষ্ঠানের সকল আনুষ্ঠানিক বিজ্ঞপ্তি ও ঘোষণা' : 'Official notices and announcements'}</p>

          {notices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              <Bell size={40} className="mx-auto mb-2 opacity-50" />
              <p>{lang === 'bn' ? 'বর্তমানে কোনো সক্রিয় নোটিশ নেই।' : 'No active notices found.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notices.map((n) => (
                <div
                  key={n.id}
                  onClick={() => setSelectedNotice(n)}
                  className={`p-5 rounded-2xl border cursor-pointer hover:border-sky-400 transition-all ${
                    isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="text-base font-black text-slate-800 dark:text-white">{n.title}</h3>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">{n.description || n.content}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-black text-sky-600 dark:text-sky-400">
                    <span>{lang === 'bn' ? 'সম্পূর্ণ পড়ুন' : 'Read Full Notice'}</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3.5 Meetings Tab */}
      {activeSection === 'meetings' && permissions.view_meetings && (
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <h2 className="text-xl font-black font-noto mb-1">{lang === 'bn' ? 'সভা ও মিটিং এজেন্ডা' : 'Meetings & Agenda'}</h2>
          <p className="text-xs text-slate-400 mb-6">{lang === 'bn' ? 'আসন্ন ও পূর্ববর্তী সভার বিবরণ' : 'Upcoming and past meetings'}</p>

          {meetings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              <MessageSquare size={40} className="mx-auto mb-2 opacity-50" />
              <p>{lang === 'bn' ? 'কোনো সভার তথ্য পাওয়া যায়নি।' : 'No meetings scheduled.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((m) => (
                <div key={m.id} className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                    <h3 className="text-base font-black text-slate-800 dark:text-white">{m.title || m.name}</h3>
                    <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">
                      {m.meeting_date || m.date || new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{m.agenda || m.description || (lang === 'bn' ? 'কার্যবিবরণী ও আলোচনা' : 'General Discussion')}</p>
                  {m.venue && (
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                      <MapPin size={13} />
                      <span>{lang === 'bn' ? 'স্থান:' : 'Venue:'} {m.venue}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3.6 Polls Tab */}
      {activeSection === 'polls' && permissions.view_polls && (
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <h2 className="text-xl font-black font-noto mb-1">{lang === 'bn' ? 'মতামত ও ভোটিং (পোল)' : 'Polls & Voting'}</h2>
          <p className="text-xs text-slate-400 mb-6">{lang === 'bn' ? 'সংগঠনের সিদ্ধান্তে আপনার মূল্যবান মতামত দিন' : 'Participate and cast your vote on active polls'}</p>

          {polls.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">
              <Vote size={40} className="mx-auto mb-2 opacity-50" />
              <p>{lang === 'bn' ? 'বর্তমানে কোনো সক্রিয় পোল নেই।' : 'No active polls available.'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {polls.map((poll) => {
                const myVotedOption = selectedPollOption[poll.id];
                const pollVotes = votes.filter(v => v.poll_id === poll.id);
                const totalVotes = pollVotes.length;

                return (
                  <div key={poll.id} className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <h3 className="text-base font-black text-slate-800 dark:text-white mb-3">{poll.question}</h3>

                    <div className="space-y-2.5">
                      {poll.options.map((opt, idx) => {
                        const optionVoteCount = pollVotes.filter(v => v.option_index === idx).length;
                        const percent = totalVotes > 0 ? Math.round((optionVoteCount / totalVotes) * 100) : 0;
                        const isSelected = myVotedOption === idx;

                        return (
                          <div
                            key={idx}
                            onClick={() => handleVote(poll.id, idx)}
                            className={`p-3.5 rounded-xl border relative overflow-hidden cursor-pointer transition-all ${
                              isSelected
                                ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40'
                                : isDark ? 'border-slate-700 bg-slate-800 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div
                              className="absolute top-0 left-0 bottom-0 bg-sky-500/10 pointer-events-none transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                            <div className="relative z-10 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300'
                                }`}>
                                  {isSelected && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span className={`text-xs font-bold ${isSelected ? 'text-sky-700 dark:text-sky-300' : ''}`}>{opt}</span>
                              </div>
                              <span className="text-xs font-black text-slate-500">{percent}% ({optionVoteCount})</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                      <span>{lang === 'bn' ? 'মোট ভোট:' : 'Total Votes:'} {totalVotes}</span>
                      {myVotedOption !== undefined && (
                        <span className="text-emerald-500 font-black">{lang === 'bn' ? '✓ আপনার ভোট গৃহীত হয়েছে' : '✓ You have voted'}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Digital ID Card Modal */}
      {idCardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-6 border shadow-2xl relative ${
            isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <h3 className="text-base font-black text-center mb-4">{lang === 'bn' ? 'ডিজিটাল সদস্য পরিচয়পত্র' : 'Digital Member ID Card'}</h3>

            {/* ID Card Box */}
            <div className="rounded-2xl bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 text-white p-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white p-1">
                    {madrasah?.logo_url ? <img src={madrasah.logo_url} className="w-full h-full object-contain" /> : <ShieldCheck className="text-sky-600 w-full h-full" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black leading-none">{madrasah?.name || 'Organization'}</h4>
                    <p className="text-[8px] opacity-80 uppercase tracking-wider mt-0.5">{lang === 'bn' ? 'সদস্য কার্ড' : 'Member Card'}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-white/10 border-2 border-white/30 overflow-hidden flex items-center justify-center shrink-0">
                  {member?.photo_url ? (
                    <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={36} className="text-white/70" />
                  )}
                </div>
                <div className="min-w-0">
                  <h5 className="text-base font-black truncate">{member?.name}</h5>
                  <p className="text-[10px] text-sky-200 font-bold">ID: #{member?.member_id_number || 'N/A'}</p>
                  <p className="text-[10px] opacity-90">{member?.phone}</p>
                  <span className="inline-block px-2 py-0.5 mt-1 rounded bg-white/20 text-[9px] font-black">
                    {member?.member_type || 'Member'}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[9px] opacity-80">
                <span>{madrasah?.phone || ''}</span>
                <span>{member?.blood_group ? `Blood: ${member.blood_group}` : ''}</span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-sky-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95"
              >
                <Printer size={15} />
                <span>{lang === 'bn' ? 'প্রিন্ট করুন' : 'Print'}</span>
              </button>
              <button
                onClick={() => setIdCardModal(false)}
                className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Notice Details Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 border shadow-2xl relative ${
            isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-800'
          }`}>
            <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">
              {new Date(selectedNotice.created_at).toLocaleDateString()}
            </span>
            <h3 className="text-xl font-black mt-1 mb-4">{selectedNotice.title}</h3>
            <div className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line max-h-[50vh] overflow-y-auto ${
              isDark ? 'bg-slate-900/50 text-slate-300' : 'bg-slate-50 text-slate-700'
            }`}>
              {selectedNotice.description || selectedNotice.content}
            </div>
            <div className="mt-6 text-right">
              <button
                onClick={() => setSelectedNotice(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-sky-600 text-white font-black text-xs active:scale-95"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
