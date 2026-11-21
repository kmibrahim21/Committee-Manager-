
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../supabase';
import { Institution, Language, UserRole, Profile } from '../../../../types';
import { 
    ClipboardList, Download, Loader2, Search, 
    Calendar, Users, FileText, ChevronRight 
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
            console.error("Error parsing meeting metadata:", e);
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

const FinalMinutes: React.FC<FinalMinutesProps> = ({ lang, madrasah, onBack, role, profile }) => {
    const [minutes, setMinutes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const handleDownloadMinutes = async (m: any) => {
        if (!madrasah) return;
        setDownloadingId(m.id);
        try {
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

            await generateMeetingMinutesPDF(
                m,
                madrasah,
                lang,
                agendasData || [],
                decisionsData || [],
                membersData || [],
                attendanceRecords
            );
        } catch (err) {
            console.error('Error generating meeting minutes PDF:', err);
        } finally {
            setDownloadingId(null);
        }
    };

    const isDark = madrasah?.theme === 'dark';

    const filteredMinutes = useMemo(() => {
        return minutes.filter(m => !searchTerm.trim() || m.title?.toLowerCase().includes(searchTerm.toLowerCase().trim()));
    }, [minutes, searchTerm]);

    return (
        <div className={`space-y-6 ${isDark ? 'text-slate-200' : ''}`}>
             <div>
                <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-[#0fb5ab]'} font-noto`}>
                    {lang === 'bn' ? 'চূড়ান্ত মিনিটস ও রেজাল্ট' : 'Final Minutes & Decisions'}
                </h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Final Meeting Minutes</p>
             </div>

             <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                    type="text" 
                    placeholder={lang === 'bn' ? 'মিটিং খুঁজুন...' : 'Search meetings...'}
                    className={`w-full h-16 rounded-3xl pl-14 pr-6 font-bold outline-none border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]' : 'bg-white border-slate-100 shadow-sm focus:border-[#0fb5ab]'}`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>

             {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#0fb5ab]" /></div>
             ) : (
                <div className="space-y-3">
                    {filteredMinutes.length > 0 ? filteredMinutes.map(m => (
                        <div key={m.id} className={`p-6 rounded-3xl border flex items-center justify-between group transition-all ${isDark ? 'bg-slate-900 border-slate-800 hover:border-[#42f5e9]' : 'bg-white border-slate-100 hover:border-[#0fb5ab]'}`}>
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h4 className={`font-black font-noto ${isDark ? 'text-white' : 'text-[#0fb5ab]'}`}>{m.title}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {m.departments?.name || (lang === 'bn' ? 'সাধারণ' : 'General')} • {new Date(m.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDownloadMinutes(m)}
                                disabled={downloadingId === m.id}
                                className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-[#42f5e9]/10 hover:text-[#0fb5ab] active:scale-95 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                                title={lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Download PDF'}
                            >
                                {downloadingId === m.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            </button>
                        </div>
                    )) : (
                        <div className={`text-center py-20 rounded-[3rem] border-2 border-dashed ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                             <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
                             <p className="text-slate-400 font-black uppercase tracking-widest">
                                {lang === 'bn' ? 'কোনো মিনিটস পাওয়া যায়নি' : 'No Minutes Found'}
                             </p>
                        </div>
                    )}
                </div>
             )}
        </div>
    );
};

export default FinalMinutes;
