
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import { Institution, Language, UserRole, Profile } from '../../../../types';
import { 
    ClipboardList, Download, Loader2, Search, 
    Calendar, Users, FileText, ChevronRight 
} from 'lucide-react';

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
                .is('status', 'completed')
                .order('date', { ascending: false });

            if (data) setMinutes(data.map(parseMeetingWithMeta));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const isDark = madrasah?.theme === 'dark';

    return (
        <div className={`space-y-6 ${isDark ? 'text-slate-200' : ''}`}>
             <div>
                <h2 className="text-2xl font-black text-[#0e8a84] font-noto">চুড়ান্ত মিনিটস ও রেজাল্ট</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Final Meeting Minutes</p>
             </div>

             <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                    type="text"
                    placeholder="মিটিং খুঁজুন..."
                    className="w-full h-16 bg-white rounded-3xl pl-14 pr-6 font-bold outline-none border border-slate-100 shadow-sm focus:border-[#42f5e9] transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>

             {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#42f5e9]" /></div>
             ) : (
                <div className="space-y-3">
                    {minutes.length > 0 ? minutes.map(m => (
                        <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-[#42f5e9] transition-all">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-[#0e8a84] font-noto">{m.title}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {m.departments?.name} • {new Date(m.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-[#42f5e9]/10 group-hover:text-[#0fb5ab] transition-all">
                                <Download size={18} />
                            </button>
                        </div>
                    )) : (
                        <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100">
                             <ClipboardList size={48} className="mx-auto text-slate-200 mb-4" />
                             <p className="text-slate-400 font-black uppercase tracking-widest">কোনো মিনিটস পাওয়া যায়নি</p>
                        </div>
                    )}
                </div>
             )}
        </div>
    );
};

export default FinalMinutes;
