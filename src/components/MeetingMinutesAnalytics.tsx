import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from 'supabase';
import { Language } from 'types';
import {
  TrendingUp,
  Award,
  AlertCircle,
  Loader2,
  ChevronRight,
  BarChart2,
  Users,
  Filter,
  Check,
  Search,
  Calendar,
  CheckCircle2,
  FileText,
  ClipboardList,
  UserCheck,
  UserX,
  Clock
} from 'lucide-react';
import { isValidUUID } from 'utils/validation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface MeetingMinutesAnalyticsProps {
  institutionId: string;
  lang: Language;
  madrasah?: any;
}

type PeriodFilter = 'all' | 'recent_5' | 'this_year';

const localT = {
  allDepts: { en: 'All Committees / Depts', bn: 'সকল কমিটি / বিভাগ' },
  selectDept: { en: 'Select Department', bn: 'বিভাগ নির্বাচন করুন' },
  filterByDept: { en: 'Filter by Committee / Dept', bn: 'কমিটি / বিভাগ ফিল্টার' },
  searchDept: { en: 'Search committee...', bn: 'কমিটি খুঁজুন...' },
  noDeptsFound: { en: 'No committees found', bn: 'কোনো কমিটি পাওয়া যায়নি' },
  periodAll: { en: 'All Meetings', bn: 'সব মিটিং' },
  periodRecent5: { en: 'Recent 5', bn: 'সাম্প্রতিক ৫টি' },
  periodThisYear: { en: 'This Year', bn: 'এই বছর' },
  totalMeetings: { en: 'Total Meetings', bn: 'মোট মিটিং' },
  avgAttendance: { en: 'Avg Attendance', bn: 'গড় উপস্থিতি' },
  agendaCompletion: { en: 'Agenda Completion', bn: 'এজেন্ডা বাস্তবায়ন' },
  totalDecisions: { en: 'Total Resolutions', bn: 'মোট সিদ্ধান্ত' },
  completed: { en: 'Completed', bn: 'সম্পন্ন' },
  upcoming: { en: 'Upcoming', bn: 'আসন্ন' },
  attendanceTrend: { en: 'Meeting Attendance Trend', bn: 'মিটিং উপস্থিতি ট্রেন্ড' },
  recentResolutions: { en: 'Recent Resolutions & Decisions', bn: 'সাম্প্রতিক সিদ্ধান্তসমূহ' },
  activeMembers: { en: 'Most Active Members', bn: 'সর্বাধিক সক্রিয় সদস্য' },
  lowParticipation: { en: 'Low Participation Members', bn: 'কম অংশগ্রহণকারী সদস্য' },
  noData: { en: 'No meeting data available yet', bn: 'এখনো কোনো মিটিংয়ের তথ্য নেই' },
  noResolutions: { en: 'No resolutions recorded yet', bn: 'এখনো কোনো সিদ্ধান্ত লিপিবদ্ধ হয়নি' },
  noMemberAttendance: { en: 'No attendance records found', bn: 'উপস্থিতির কোনো রেকর্ড পাওয়া যায়নি' },
  meetingsAttended: { en: 'attended', bn: 'টি মিটিংয়ে উপস্থিত' },
  present: { en: 'Present', bn: 'উপস্থিত' },
  general: { en: 'General', bn: 'সাধারণ' }
};

const MeetingMinutesAnalytics: React.FC<MeetingMinutesAnalyticsProps> = ({ institutionId, lang, madrasah }) => {
  const isDark = madrasah?.theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  const [rawData, setRawData] = useState<{
    meetings: any[];
    agendas: any[];
    decisions: any[];
    attendance: any[];
    members: any[];
  }>({
    meetings: [],
    agendas: [],
    decisions: [],
    attendance: [],
    members: []
  });

  useEffect(() => {
    if (!isValidUUID(institutionId)) return;
    fetchAllData();
  }, [institutionId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [deptRes, meetingsRes, membersRes] = await Promise.all([
        supabase.from('departments').select('id, name').eq('institution_id', institutionId).order('name'),
        supabase.from('meetings').select('*, departments(name)').eq('institution_id', institutionId).order('date', { ascending: true }),
        supabase.from('members').select('id, name, roll, member_id_number, department_id, designation').eq('institution_id', institutionId)
      ]);

      const meetings = meetingsRes.data || [];
      const meetingIds = meetings.map((m: any) => m.id);

      let agendas: any[] = [];
      let decisions: any[] = [];
      let attendance: any[] = [];

      if (meetingIds.length > 0) {
        const [agRes, decRes, attRes] = await Promise.all([
          supabase.from('meeting_agendas').select('*').in('meeting_id', meetingIds),
          supabase.from('meeting_decisions').select('*').in('meeting_id', meetingIds).order('created_at', { ascending: false }),
          supabase.from('meeting_attendance').select('*').in('meeting_id', meetingIds)
        ]);
        agendas = agRes.data || [];
        decisions = decRes.data || [];
        attendance = attRes.data || [];
      }

      setDepartments(deptRes.data || []);
      setRawData({
        meetings,
        agendas,
        decisions,
        attendance,
        members: membersRes.data || []
      });
    } catch (err) {
      console.error('Error loading meeting analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const analytics = useMemo(() => {
    const currentYear = new Date().getFullYear();

    let filteredMeetings = rawData.meetings.filter((m) => {
      if (selectedDeptId !== 'all' && m.department_id !== selectedDeptId) return false;
      if (periodFilter === 'this_year' && m.date) {
        return new Date(m.date).getFullYear() === currentYear;
      }
      return true;
    });

    if (periodFilter === 'recent_5' && filteredMeetings.length > 5) {
      filteredMeetings = filteredMeetings.slice(-5);
    }

    const meetingIdSet = new Set(filteredMeetings.map((m) => m.id));
    const filteredAgendas = rawData.agendas.filter((a) => meetingIdSet.has(a.meeting_id));
    const filteredDecisions = rawData.decisions.filter((d) => meetingIdSet.has(d.meeting_id));
    const filteredAttendance = rawData.attendance.filter((r) => meetingIdSet.has(r.meeting_id));
    const scopedMembers =
      selectedDeptId === 'all'
        ? rawData.members
        : rawData.members.filter((m) => m.department_id === selectedDeptId);

    const totalMeetings = filteredMeetings.length;
    const completedMeetings = filteredMeetings.filter((m) => m.status === 'completed').length;
    const upcomingMeetings = filteredMeetings.filter((m) => m.status === 'planned' || m.status === 'ongoing').length;

    const totalAgendas = filteredAgendas.length;
    const completedAgendas = filteredAgendas.filter((a) => Boolean(a.completed)).length;
    const agendaImplementationRate = totalAgendas > 0 ? Math.round((completedAgendas / totalAgendas) * 100) : 0;

    // Build attendance trend per meeting
    let sumRates = 0;
    let meetingsWithAttendanceBase = 0;

    const attendanceTrend = filteredMeetings.slice(-10).map((m) => {
      const mAtt = filteredAttendance.filter((r) => r.meeting_id === m.id);
      const eligibleMembers = m.department_id
        ? rawData.members.filter((mem) => mem.department_id === m.department_id)
        : rawData.members;

      const denominator = eligibleMembers.length > 0 ? eligibleMembers.length : mAtt.length;
      const presentCount = mAtt.filter((r) => r.status === 'present' || r.status === 'late').length;
      const rate = denominator > 0 ? Math.min(100, Math.round((presentCount / denominator) * 100)) : 0;

      if (denominator > 0 && mAtt.length > 0) {
        sumRates += rate;
        meetingsWithAttendanceBase++;
      }

      const shortTitle = m.title && m.title.length > 14 ? `${m.title.slice(0, 14)}…` : (m.title || 'Meeting');
      return {
        name: shortTitle,
        fullTitle: m.title || 'Meeting',
        rate,
        present: presentCount,
        total: denominator
      };
    });

    // Compute overall avg attendance across all filtered meetings with records
    let allRatesSum = 0;
    let allRatesCount = 0;
    filteredMeetings.forEach((m) => {
      const mAtt = filteredAttendance.filter((r) => r.meeting_id === m.id);
      if (mAtt.length === 0) return;
      const eligibleMembers = m.department_id
        ? rawData.members.filter((mem) => mem.department_id === m.department_id)
        : rawData.members;
      const denominator = eligibleMembers.length > 0 ? eligibleMembers.length : mAtt.length;
      if (denominator > 0) {
        const presentCount = mAtt.filter((r) => r.status === 'present' || r.status === 'late').length;
        allRatesSum += Math.min(100, (presentCount / denominator) * 100);
        allRatesCount++;
      }
    });

    const avgAttendanceRate = allRatesCount > 0 ? Math.round(allRatesSum / allRatesCount) : 0;

    // Recent resolutions joined with meeting metadata
    const meetingMap = new Map<string, any>();
    filteredMeetings.forEach((m) => meetingMap.set(m.id, m));

    const recentDecisions = [...filteredDecisions]
      .sort((a, b) => {
        const dateA = meetingMap.get(a.meeting_id)?.date || a.created_at || '';
        const dateB = meetingMap.get(b.meeting_id)?.date || b.created_at || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })
      .slice(0, 6)
      .map((d) => {
        const mt = meetingMap.get(d.meeting_id);
        return {
          ...d,
          meetingTitle: mt?.title || '',
          meetingDate: mt?.date || d.created_at,
          departmentName: mt?.departments?.name || localT.general[lang]
        };
      });

    // Member participation stats
    const meetingsWithAnyAttendance = filteredMeetings.filter((m) =>
      filteredAttendance.some((r) => r.meeting_id === m.id)
    );

    const memberStats = scopedMembers
      .map((mem) => {
        const eligibleMeetings = meetingsWithAnyAttendance.filter(
          (m) => !m.department_id || m.department_id === mem.department_id
        );
        if (eligibleMeetings.length === 0) return null;

        const eligibleIds = new Set(eligibleMeetings.map((m) => m.id));
        const attendedCount = filteredAttendance.filter(
          (r) =>
            r.member_id === mem.id &&
            eligibleIds.has(r.meeting_id) &&
            (r.status === 'present' || r.status === 'late')
        ).length;

        const rate = Math.round((attendedCount / eligibleMeetings.length) * 100);
        return {
          id: mem.id,
          name: mem.name,
          memberCode: mem.member_id_number || mem.roll || '-',
          designation: mem.designation || '',
          attendedCount,
          totalMeetings: eligibleMeetings.length,
          rate
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const topActiveMembers = [...memberStats]
      .sort((a, b) => b.rate - a.rate || b.attendedCount - a.attendedCount)
      .slice(0, 5);

    const lowParticipationMembers = [...memberStats]
      .filter((m) => m.rate < 75)
      .sort((a, b) => a.rate - b.rate || a.attendedCount - b.attendedCount)
      .slice(0, 5);

    return {
      totalMeetings,
      completedMeetings,
      upcomingMeetings,
      avgAttendanceRate,
      agendaImplementationRate,
      totalAgendas,
      completedAgendas,
      totalDecisions: filteredDecisions.length,
      attendanceTrend,
      recentDecisions,
      topActiveMembers,
      lowParticipationMembers,
      hasAttendanceTrendData: meetingsWithAttendanceBase > 0
    };
  }, [rawData, selectedDeptId, periodFilter, lang]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-[#0fb5ab]" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Filter Bar: Period Pills + Department Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-30">
        <div className={`inline-flex p-1 rounded-2xl border w-full sm:w-fit ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/80 border-slate-200/70'}`}>
          {([
            { id: 'all', label: localT.periodAll[lang] },
            { id: 'recent_5', label: localT.periodRecent5[lang] },
            { id: 'this_year', label: localT.periodThisYear[lang] }
          ] as const).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodFilter(p.id)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[11px] font-black transition-all ${
                periodFilter === p.id
                  ? isDark
                    ? 'bg-[#42f5e9] text-slate-950 shadow-sm'
                    : 'bg-[#0fb5ab] text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="relative flex justify-end">
          <button
            type="button"
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-2 border rounded-2xl px-4 py-2.5 text-xs font-black transition-all active:scale-95 shadow-sm ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-[#42f5e9]'
                : 'bg-white border-slate-200 text-slate-700 hover:border-[#0fb5ab]'
            }`}
          >
            <Filter size={14} className={isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} />
            <span className="truncate max-w-[180px]">
              {selectedDeptId === 'all'
                ? localT.allDepts[lang]
                : departments.find((d) => d.id === selectedDeptId)?.name || localT.selectDept[lang]}
            </span>
            <ChevronRight
              size={14}
              className={`transition-transform duration-300 ${showFilter ? 'rotate-90' : ''} ${isDark ? 'text-slate-400' : 'text-slate-400'}`}
            />
          </button>

          {showFilter && (
            <>
              <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setShowFilter(false)} />
              <div
                className={`absolute top-full right-0 mt-2 w-72 rounded-[2rem] shadow-2xl border p-4 z-50 animate-in zoom-in-95 origin-top-right ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                }`}
              >
                <div className="mb-3 px-1">
                  <h4 className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                    {localT.filterByDept[lang]}
                  </h4>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={localT.searchDept[lang]}
                      className={`w-full h-9 rounded-xl pl-9 pr-3 text-xs font-bold outline-none border transition-all ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-[#42f5e9]'
                          : 'bg-slate-50 border-slate-200 focus:border-[#0fb5ab] focus:bg-white'
                      }`}
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDeptId('all');
                      setShowFilter(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                      selectedDeptId === 'all'
                        ? 'bg-[#0fb5ab] text-white shadow-md'
                        : isDark
                          ? 'text-slate-300 hover:bg-slate-700/60'
                          : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{localT.allDepts[lang]}</span>
                    {selectedDeptId === 'all' && <Check size={14} className="text-white" />}
                  </button>

                  {departments
                    .filter((d) => d.name.toLowerCase().includes(filterSearch.toLowerCase()))
                    .map((d) => (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => {
                          setSelectedDeptId(d.id);
                          setShowFilter(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-between ${
                          selectedDeptId === d.id
                            ? 'bg-[#0fb5ab] text-white shadow-md'
                            : isDark
                              ? 'text-slate-300 hover:bg-slate-700/60'
                              : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{d.name}</span>
                        {selectedDeptId === d.id && <Check size={14} className="text-white shrink-0" />}
                      </button>
                    ))}

                  {departments.filter((d) => d.name.toLowerCase().includes(filterSearch.toLowerCase())).length === 0 && (
                    <div className="text-center py-4 text-[11px] font-bold text-slate-400">{localT.noDeptsFound[lang]}</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Meetings */}
        <div className="bg-gradient-to-br from-[#0fb5ab] to-[#0a8d85] p-5 rounded-[2rem] text-white shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15 blur-xl" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2 opacity-90">
              <Calendar size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{localT.totalMeetings[lang]}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black font-noto">{analytics.totalMeetings}</h3>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-white/85">
              <span>{localT.completed[lang]}: {analytics.completedMeetings}</span>
              <span>•</span>
              <span>{localT.upcoming[lang]}: {analytics.upcomingMeetings}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Average Attendance Rate */}
        <div className={`p-5 rounded-[2rem] border shadow-sm relative overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-500">
              <Users size={16} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                {localT.avgAttendance[lang]}
              </span>
            </div>
            <h3 className={`text-2xl sm:text-3xl font-black font-noto ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
              {analytics.avgAttendanceRate}%
            </h3>
            <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${analytics.avgAttendanceRate}%` }} />
            </div>
          </div>
        </div>

        {/* Card 3: Agenda Implementation Rate */}
        <div className={`p-5 rounded-[2rem] border shadow-sm relative overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-500">
              <ClipboardList size={16} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                {localT.agendaCompletion[lang]}
              </span>
            </div>
            <h3 className={`text-2xl sm:text-3xl font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {analytics.agendaImplementationRate}%
            </h3>
            <p className="text-[10px] font-bold text-slate-400">
              {analytics.completedAgendas} / {analytics.totalAgendas} {lang === 'bn' ? 'এজেন্ডা সম্পন্ন' : 'completed'}
            </p>
          </div>
        </div>

        {/* Card 4: Total Decisions */}
        <div className={`p-5 rounded-[2rem] border shadow-sm relative overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-500">
              <CheckCircle2 size={16} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                {localT.totalDecisions[lang]}
              </span>
            </div>
            <h3 className={`text-2xl sm:text-3xl font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {analytics.totalDecisions}
            </h3>
            <p className="text-[10px] font-bold text-slate-400">
              {lang === 'bn' ? 'গৃহীত রেজুলেশন' : 'Approved resolutions'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Attendance Trend Chart */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <BarChart2 size={16} className={isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'} />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {localT.attendanceTrend[lang]}
            </h3>
          </div>
          <div className={`p-5 rounded-[2rem] border shadow-sm h-72 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            {analytics.hasAttendanceTrendData && analytics.attendanceTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} unit="%" />
                  <Tooltip
                    cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
                    contentStyle={{
                      borderRadius: '16px',
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      color: isDark ? '#f1f5f9' : '#1e293b'
                    }}
                    formatter={(value: any, _name: any, item: any) => [
                      `${value}% (${item?.payload?.present || 0}/${item?.payload?.total || 0})`,
                      localT.present[lang]
                    ]}
                    labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.fullTitle || _label}
                  />
                  <Bar dataKey="rate" fill={isDark ? '#42f5e9' : '#0fb5ab'} radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <TrendingUp size={28} className="opacity-40" />
                <p className="text-xs font-bold">{localT.noData[lang]}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Resolutions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <FileText size={16} className="text-amber-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {localT.recentResolutions[lang]}
            </h3>
          </div>
          <div className={`p-5 rounded-[2rem] border shadow-sm space-y-3 min-h-[18rem] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            {analytics.recentDecisions.length > 0 ? (
              analytics.recentDecisions.map((dec) => (
                <div
                  key={dec.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isDark ? 'bg-slate-900/60 border-slate-700/70' : 'bg-slate-50/80 border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`text-xs sm:text-sm font-black font-noto ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                      {dec.title}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black shrink-0 ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-500 border border-slate-200/70'
                    }`}>
                      {dec.departmentName}
                    </span>
                  </div>
                  {dec.description && (
                    <p className={`text-xs mt-1 line-clamp-2 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {dec.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-slate-400">
                    <Clock size={11} />
                    <span className="truncate">{dec.meetingTitle}</span>
                    {dec.meetingDate && (
                      <>
                        <span>•</span>
                        <span>{new Date(dec.meetingDate).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 gap-2">
                <FileText size={28} className="opacity-40" />
                <p className="text-xs font-bold">{localT.noResolutions[lang]}</p>
              </div>
            )}
          </div>
        </div>

        {/* Most Active Members */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <Award size={16} className="text-emerald-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {localT.activeMembers[lang]}
            </h3>
          </div>
          <div className="space-y-2.5">
            {analytics.topActiveMembers.length > 0 ? (
              analytics.topActiveMembers.map((mem, idx) => (
                <div
                  key={mem.id}
                  className={`p-4 rounded-[1.6rem] border shadow-sm flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <UserCheck size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`font-black text-xs sm:text-sm truncate font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        #{idx + 1} {mem.name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 truncate">
                        ID: {mem.memberCode} • {mem.attendedCount}/{mem.totalMeetings} {localT.meetingsAttended[lang]}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm sm:text-base font-black text-emerald-500 shrink-0">{mem.rate}%</span>
                </div>
              ))
            ) : (
              <div className={`p-8 rounded-[2rem] border text-center text-xs font-bold text-slate-400 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                {localT.noMemberAttendance[lang]}
              </div>
            )}
          </div>
        </div>

        {/* Low Participation Members */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <AlertCircle size={16} className="text-rose-500" />
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {localT.lowParticipation[lang]}
            </h3>
          </div>
          <div className="space-y-2.5">
            {analytics.lowParticipationMembers.length > 0 ? (
              analytics.lowParticipationMembers.map((mem) => (
                <div
                  key={mem.id}
                  className={`p-4 rounded-[1.6rem] border shadow-sm flex items-center justify-between gap-3 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-500'
                    }`}>
                      <UserX size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`font-black text-xs sm:text-sm truncate font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {mem.name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 truncate">
                        ID: {mem.memberCode} • {mem.attendedCount}/{mem.totalMeetings} {localT.meetingsAttended[lang]}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm sm:text-base font-black text-rose-500 shrink-0">{mem.rate}%</span>
                </div>
              ))
            ) : (
              <div className={`p-8 rounded-[2rem] border text-center text-xs font-bold text-slate-400 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                {analytics.topActiveMembers.length > 0
                  ? (lang === 'bn' ? 'সকল সদস্যের অংশগ্রহণ সন্তোষজনক' : 'All members have good participation')
                  : localT.noMemberAttendance[lang]}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingMinutesAnalytics;
