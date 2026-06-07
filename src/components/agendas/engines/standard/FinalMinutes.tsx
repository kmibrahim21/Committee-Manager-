
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

            if (data) setMinutes(data);
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
                <h2 className="text-2xl font-black text-[#1E3A8A] font-noto">চুড়ান্ত মিনিটস ও রেজাল্ট</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Final Meeting Minutes</p>
             </div>

             <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input 
                    type="text"
                    placeholder="মিটিং খুঁজুন..."
                    className="w-full h-16 bg-white rounded-3xl pl-14 pr-6 font-bold outline-none border border-slate-100 shadow-sm focus:border-blue-100 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>

             {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>
             ) : (
                <div className="space-y-3">
                    {minutes.length > 0 ? minutes.map(m => (
                        <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-blue-200 transition-all">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-[#1E3A8A] font-noto">{m.title}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {m.departments?.name} • {new Date(m.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
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
