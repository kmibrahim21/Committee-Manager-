
import React from 'react';
import { 
    Users, Calendar, Clock, MapPin, 
    ArrowRight, TrendingUp, CheckCircle, Clock3, Plus, ChevronRight, Loader2, Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';

interface Stats {
    total: number;
    upcoming: number;
    completed: number;
    attendanceRate: number;
}

interface MeetingDashboardProps {
    stats: Stats;
    nextMeeting: any | null;
    onViewMeeting: (meeting: any) => void;
    onViewList: () => void;
    lang: string;
    isDark?: boolean;
}

const MeetingDashboard: React.FC<MeetingDashboardProps> = ({ stats, nextMeeting, onViewMeeting, onViewList, lang, isDark = false }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: lang === 'bn' ? 'মোট' : 'Total', value: stats.total, icon: Calendar, color: 'text-[#0fb5ab]', bg: isDark ? 'bg-[#42f5e9]/10' : 'bg-[#42f5e9]/15' },
                    { label: lang === 'bn' ? 'আসন্ন' : 'Upcoming', value: stats.upcoming, icon: Clock3, color: 'text-amber-500', bg: isDark ? 'bg-amber-500/15' : 'bg-amber-50' },
                    { label: lang === 'bn' ? 'সম্পন্ন' : 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-500', bg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50' },
                    { label: lang === 'bn' ? 'উপস্থিতি হার' : 'Rate', value: `${stats.attendanceRate}%`, icon: TrendingUp, color: 'text-indigo-500', bg: isDark ? 'bg-indigo-500/15' : 'bg-indigo-50' },
                ].map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={stat.label} 
                        className={`p-3.5 rounded-2xl border flex items-center gap-3 group transition-all ${
                            isDark 
                                ? 'bg-slate-800 border-slate-700 hover:border-[#42f5e9]/40' 
                                : 'bg-white border-slate-100 shadow-sm hover:border-[#0fb5ab]/40 hover:shadow-md'
                        }`}
                    >
                        <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-105`}>
                            <stat.icon size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className={`text-[9px] font-black uppercase tracking-widest leading-none mb-1 truncate ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{stat.label}</p>
                            <h3 className={`text-lg font-black leading-none ${isDark ? 'text-white' : 'text-slate-800'}`}>{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Next Meeting Section */}
            <div className="w-full">
                <div className={`${isDark ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700' : 'bg-gradient-to-br from-[#0fb5ab] to-[#0a7c75]'} rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 text-white relative overflow-hidden group shadow-xl`}>
                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-bl from-blue-400/10 to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div className="space-y-4 flex-1">
                            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-300"></span>
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-100">{lang === 'bn' ? 'পরবর্তী সভা' : 'Next Assembly'}</span>
                            </div>
                            
                            {nextMeeting ? (
                                <div className="space-y-4">
                                    <h2 className="text-xl sm:text-3xl font-black font-noto leading-tight tracking-tight max-w-2xl">
                                        {nextMeeting.title}
                                    </h2>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg border border-white/5"><Calendar size={14} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">{lang === 'bn' ? 'তারিখ' : 'Date'}</p>
                                                <p className="text-sm font-black">{new Date(nextMeeting.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg border border-white/5"><Clock size={14} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">{lang === 'bn' ? 'সময়' : 'Time'}</p>
                                                <p className="text-sm font-black">{nextMeeting.time || '10:00 AM'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg border border-white/5"><MapPin size={14} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">{lang === 'bn' ? 'স্থান' : 'Venue'}</p>
                                                <p className="text-sm font-black truncate max-w-[120px]">{nextMeeting.venue || (lang === 'bn' ? 'মেইন চেম্বার' : 'Main Chamber')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg border border-white/5"><Users size={14} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">{lang === 'bn' ? 'কমিটি/গ্রুপ' : 'Group'}</p>
                                                <p className="text-sm font-black truncate max-w-[120px]">{nextMeeting.departments?.name || (lang === 'bn' ? 'সাধারণ সভা' : 'Council')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-6">
                                    <p className="text-base text-blue-200 font-black uppercase tracking-[0.2em] opacity-40">{lang === 'bn' ? 'কোনো আসন্ন মিটিং নেই' : 'No pending assemblies'}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-row xl:flex-col gap-2 min-w-[200px]">
                            <button 
                                onClick={() => nextMeeting && onViewMeeting(nextMeeting)}
                                className="flex-1 bg-white text-[#1E3A8A] px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-50 hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 group/btn"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                <span>{lang === 'bn' ? 'পরিচালনা' : 'Manage'}</span>
                                <ArrowRight size={12} />
                            </button>
                            <button 
                                onClick={onViewList}
                                className="flex-1 bg-blue-600/50 backdrop-blur-md text-white border border-white/10 px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600/70 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{lang === 'bn' ? 'ক্যালেন্ডার' : 'Calendar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingDashboard;
