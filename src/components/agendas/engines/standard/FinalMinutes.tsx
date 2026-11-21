import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../../supabase';
import { Institution, Language, UserRole, Profile } from '../../../../types';
import {
  ClipboardList,
  Download,
  Loader2,
  Search,
  Calendar,
  Users,
  FileText,
  X,
  CheckCircle2,
  Clock,
  MapPin,
  Eye,
  UserCheck,
  UserX
} from 'lucide-react';
import { generateMeetingMinutesPDF } from '../../../../utils/pdfGenerator';

interface FinalMinutesProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const parseMeetingWithMeta = (meeting: any) => {
  if (!meeting) return meeting;
  let type = 'General';
  let notify_members = true;
  let send_sms = false;
  let send_voice = false;
  let require_attendance = true;
  let agenda = '';
  let cleanDescription = meeting.description || '';

  if (meeting.description && meeting.description.includes('---METADATA---')) {
    try {
      const parts = meeting.description.split('---METADATA---');
      if (parts.length >= 3) {
        const jsonStr = parts[1].trim();
        const meta = JSON.parse(jsonStr);
        type = meta.type || 'General';
        notify_members = meta.notify_members !== undefined ? meta.notify_members : true;
        send_sms = meta.send_sms !== undefined ? meta.send_sms : false;
        send_voice = meta.send_voice !== undefined ? meta.send_voice : false;
        require_attendance = meta.require_attendance !== undefined ? meta.require_attendance : true;
        agenda = meta.agenda || '';
        cleanDescription = parts.slice(2).join('---METADATA---').trim();
      }
    } catch (e) {
      console.error('Error parsing meeting metadata:', e);
    }
  } else {
    if (meeting.type) type = meeting.type;
    if (meeting.notify_members !== undefined) notify_members = meeting.notify_members;
    if (meeting.send_sms !== undefined) send_sms = meeting.send_sms;
    if (meeting.send_voice !== undefined) send_voice = meeting.send_voice;
    if (meeting.require_attendance !== undefined) require_attendance = meeting.require_attendance;
    if (meeting.agenda) agenda = meeting.agenda;
  }

  return {
    ...meeting,
    type,
    notify_members,
    send_sms,
    send_voice,
    require_attendance,
    agenda,
    description: cleanDescription
  };
};

const FinalMinutes: React.FC<FinalMinutesProps> = ({ lang, madrasah }) => {
  const [minutes, setMinutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Preview Modal States
  const [previewMeeting, setPreviewMeeting] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewDetails, setPreviewDetails] = useState<{
    agendas: any[];
    decisions: any[];
    members: any[];
    attendanceRecords: Record<string, string>;
  }>({
    agendas: [],
    decisions: [],
    members: [],
    attendanceRecords: {}
  });

  useEffect(() => {
    if (madrasah) {
      fetchMinutes();
    }
  }, [madrasah]);

  const fetchMinutes = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('meetings')
        .select('*, departments(name)')
        .eq('institution_id', madrasah?.id)
        .eq('status', 'completed')
        .order('date', { ascending: false });

      if (data) setMinutes(data.map(parseMeetingWithMeta));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingDetailsBundle = async (m: any) => {
    if (!madrasah) return { agendas: [], decisions: [], members: [], attendanceRecords: {} };
    let membersQuery = supabase
      .from('members')
      .select('*')
      .eq('institution_id', madrasah.id);
    if (m.department_id) {
      membersQuery = membersQuery.eq('department_id', m.department_id);
    }

    const [
      { data: agendasData },
      { data: decisionsData },
      { data: attendanceData },
      { data: membersData }
    ] = await Promise.all([
      supabase.from('meeting_agendas').select('*').eq('meeting_id', m.id).order('created_at', { ascending: true }),
      supabase.from('meeting_decisions').select('*').eq('meeting_id', m.id).order('created_at', { ascending: true }),
      supabase.from('meeting_attendance').select('*').eq('meeting_id', m.id),
      membersQuery
    ]);

    const attendanceRecords: Record<string, string> = {};
    const cached = localStorage.getItem(`meeting_attendance_${m.id}`);
    if (cached) {
      try {
        Object.assign(attendanceRecords, JSON.parse(cached));
      } catch (e) {
        console.error(e);
      }
    }
    (attendanceData || []).forEach((r: any) => {
      if (r.member_id && r.status) {
        attendanceRecords[r.member_id] = r.status;
      }
    });

    return {
      agendas: agendasData || [],
      decisions: decisionsData || [],
      members: membersData || [],
      attendanceRecords
    };
  };

  const handleOpenPreview = async (m: any) => {
    setPreviewMeeting(m);
    setLoadingPreview(true);
    try {
      const bundle = await fetchMeetingDetailsBundle(m);
      setPreviewDetails(bundle);
    } catch (err) {
      console.error('Error loading meeting preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownloadMinutes = async (m: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!madrasah) return;
    setDownloadingId(m.id);
    try {
      const bundle = previewMeeting?.id === m.id && !loadingPreview
        ? previewDetails
        : await fetchMeetingDetailsBundle(m);

      await generateMeetingMinutesPDF(
        m,
        madrasah,
        lang,
        bundle.agendas,
        bundle.decisions,
        bundle.members,
        bundle.attendanceRecords
      );
    } catch (err) {
      console.error('Error generating meeting minutes PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const isDark = madrasah?.theme === 'dark';

  const filteredMinutes = useMemo(() => {
    return minutes.filter((m) => !searchTerm.trim() || m.title?.toLowerCase().includes(searchTerm.toLowerCase().trim()));
  }, [minutes, searchTerm]);

  const previewAttendanceSummary = useMemo(() => {
    const total = previewDetails.members.length;
    const present = previewDetails.members.filter(
      (mem) => previewDetails.attendanceRecords[mem.id] === 'present' || previewDetails.attendanceRecords[mem.id] === 'late'
    ).length;
    const absent = Math.max(0, total - present);
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, rate };
  }, [previewDetails]);

  return (
    <div className={`space-y-6 ${isDark ? 'text-slate-200' : ''}`}>
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
          {lang === 'bn' ? 'চূড়ান্ত মিনিটস ও রেজাল্ট' : 'Final Minutes & Decisions'}
        </h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
          {lang === 'bn' ? 'প্রিভিউ দেখতে মিটিংয়ে ক্লিক করুন অথবা পিডিএফ ডাউনলোড করুন' : 'Click any meeting to preview or download PDF'}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder={lang === 'bn' ? 'মিটিং খুঁজুন...' : 'Search meetings...'}
          className={`w-full h-14 sm:h-16 rounded-3xl pl-14 pr-6 font-bold outline-none border transition-all ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]'
              : 'bg-white border-slate-100 shadow-sm focus:border-[#0fb5ab]'
          }`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[#0fb5ab]" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMinutes.length > 0 ? (
            filteredMinutes.map((m) => (
              <div
                key={m.id}
                onClick={() => handleOpenPreview(m)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenPreview(m)}
                className={`p-5 sm:p-6 rounded-3xl border flex items-center justify-between gap-4 group transition-all cursor-pointer active:scale-[0.99] ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 hover:border-[#42f5e9]'
                    : 'bg-white border-slate-100 hover:border-[#0fb5ab] shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-500'
                  }`}>
                    <FileText size={22} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`font-black font-noto text-sm sm:text-base break-words ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                      {m.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {m.departments?.name || (lang === 'bn' ? 'সাধারণ' : 'General')} • {new Date(m.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPreview(m);
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isDark ? 'bg-slate-800 text-slate-300 hover:text-[#42f5e9]' : 'bg-slate-50 text-slate-500 hover:bg-[#42f5e9]/15 hover:text-[#0fb5ab]'
                    }`}
                    title={lang === 'bn' ? 'বিস্তারিত দেখুন' : 'Preview Minutes'}
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDownloadMinutes(m, e)}
                    disabled={downloadingId === m.id}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 ${
                      isDark
                        ? 'bg-slate-800 text-[#42f5e9] hover:bg-[#42f5e9]/20'
                        : 'bg-[#42f5e9]/15 text-[#0fb5ab] hover:bg-[#0fb5ab] hover:text-white'
                    }`}
                    title={lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}
                  >
                    {downloadingId === m.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest">
                {lang === 'bn' ? 'কোনো মিনিটস পাওয়া যায়নি' : 'No Minutes Found'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Meeting Minutes Preview Modal */}
      {previewMeeting && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewMeeting(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-3xl max-h-[90vh] rounded-[2rem] border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-100 text-slate-800'
            }`}
          >
            {/* Modal Header */}
            <div className={`px-5 sm:px-7 py-5 border-b flex items-start justify-between gap-4 ${isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/70'}`}>
              <div className="min-w-0 space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500">
                  <CheckCircle2 size={12} />
                  {lang === 'bn' ? 'সম্পন্ন মিটিং' : 'Completed Meeting'}
                </span>
                <h3 className={`text-lg sm:text-xl font-black font-noto break-words ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>
                  {previewMeeting.title}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={13} />
                    {new Date(previewMeeting.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                  </span>
                  {previewMeeting.time && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} />
                      {previewMeeting.time}
                    </span>
                  )}
                  {previewMeeting.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} />
                      {previewMeeting.venue}
                    </span>
                  )}
                  <span>• {previewMeeting.departments?.name || (lang === 'bn' ? 'সাধারণ' : 'General')}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewMeeting(null)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-400 hover:text-slate-700 border border-slate-200'
                }`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
              {loadingPreview ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-[#0fb5ab]" size={28} />
                </div>
              ) : (
                <>
                  {previewMeeting.description && (
                    <div className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed ${
                      isDark ? 'bg-slate-800/70 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
                    }`}>
                      {previewMeeting.description}
                    </div>
                  )}

                  {/* Attendance Summary Cards */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Users size={14} className="text-[#0fb5ab]" />
                      {lang === 'bn' ? 'উপস্থিতির সারসংক্ষেপ' : 'Attendance Summary'}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase">{lang === 'bn' ? 'মোট সদস্য' : 'Total'}</p>
                        <p className="text-lg font-black mt-0.5">{previewAttendanceSummary.total}</p>
                      </div>
                      <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">{lang === 'bn' ? 'উপস্থিত' : 'Present'}</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{previewAttendanceSummary.present}</p>
                      </div>
                      <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                        <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase">{lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}</p>
                        <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{previewAttendanceSummary.absent}</p>
                      </div>
                      <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-[#42f5e9]/10 border-[#42f5e9]/20' : 'bg-[#42f5e9]/15 border-[#42f5e9]/30'}`}>
                        <p className="text-[10px] font-black text-[#0fb5ab] uppercase">{lang === 'bn' ? 'উপস্থিতি হার' : 'Rate'}</p>
                        <p className="text-lg font-black text-[#0fb5ab] mt-0.5">{previewAttendanceSummary.rate}%</p>
                      </div>
                    </div>

                    {previewDetails.members.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {previewDetails.members.map((mem) => {
                          const st = previewDetails.attendanceRecords[mem.id] || 'absent';
                          const isPres = st === 'present' || st === 'late';
                          return (
                            <span
                              key={mem.id}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                                isPres
                                  ? isDark
                                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : isDark
                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                    : 'bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              {isPres ? <UserCheck size={11} /> : <UserX size={11} />}
                              {mem.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Agendas */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <ClipboardList size={14} className="text-indigo-500" />
                      {lang === 'bn' ? 'আলোচ্য বিষয় (এজেন্ডা)' : 'Meeting Agendas'}
                    </h4>
                    {previewDetails.agendas.length > 0 ? (
                      <div className="space-y-2">
                        {previewDetails.agendas.map((ag, idx) => (
                          <div
                            key={ag.id}
                            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                              isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50/70 border-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                                ag.completed ? 'bg-emerald-500 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {idx + 1}
                              </span>
                              <p className="text-xs sm:text-sm font-bold font-noto break-words">{ag.topic}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                              ag.completed ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                            }`}>
                              {ag.completed ? (lang === 'bn' ? 'সম্পন্ন' : 'Done') : (lang === 'bn' ? 'বাকি' : 'Pending')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-400 italic">
                        {lang === 'bn' ? 'কোনো এজেন্ডা যুক্ত করা হয়নি' : 'No agendas recorded'}
                      </p>
                    )}
                  </div>

                  {/* Decisions / Resolutions */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-amber-500" />
                      {lang === 'bn' ? 'গৃহীত সিদ্ধান্ত ও রেজুলেশন' : 'Decisions & Resolutions'}
                    </h4>
                    {previewDetails.decisions.length > 0 ? (
                      <div className="space-y-2.5">
                        {previewDetails.decisions.map((dec, idx) => (
                          <div
                            key={dec.id}
                            className={`p-4 rounded-2xl border space-y-1 ${
                              isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-[#42f5e9]/10 border-[#42f5e9]/30'
                            }`}
                          >
                            <h5 className={`text-xs sm:text-sm font-black font-noto ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                              {idx + 1}. {dec.title}
                            </h5>
                            {dec.description && (
                              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                {dec.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-400 italic">
                        {lang === 'bn' ? 'কোনো সিদ্ধান্ত লিপিবদ্ধ হয়নি' : 'No decisions recorded'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`px-5 sm:px-7 py-4 border-t flex items-center justify-end gap-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50/70'}`}>
              <button
                type="button"
                onClick={() => setPreviewMeeting(null)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
              <button
                type="button"
                onClick={(e) => handleDownloadMinutes(previewMeeting, e)}
                disabled={downloadingId === previewMeeting.id || loadingPreview}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-[#0fb5ab] text-white shadow-lg shadow-[#0fb5ab]/20 hover:bg-[#0da097] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {downloadingId === previewMeeting.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                <span>{lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FinalMinutes;
