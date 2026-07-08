
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
}

const MeetingDashboard: React.FC<MeetingDashboardProps> = ({ stats, nextMeeting, onViewMeeting, onViewList, lang }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: stats.total, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Upcoming', value: stats.upcoming, icon: Clock3, color: 'text-amber-500', bg: 'bg-amber-50' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Rate', value: `${stats.attendanceRate}%`, icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                ].map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={stat.label} 
                        className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 group hover:shadow-md transition-all"
                    >
                        <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} transition-transform group-hover:scale-105`}>
                            <stat.icon size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{stat.label}</p>
                            <h3 className="text-lg font-black text-[#1E3A8A] leading-none">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Next Meeting Section */}
            <div className="w-full">
                <div className="bg-[#1E3A8A] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 text-white relative overflow-hidden group shadow-xl">
                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-bl from-blue-400/10 to-transparent pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div className="space-y-4 flex-1">
                            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-300"></span>
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-100">Next Assembly</span>
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
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">Date</p>
                                                <p className="text-sm font-black">{new Date(nextMeeting.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg border border-white/5"><Clock size={14} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">Time</p>
                                                <p className="text-sm font-black">{nextMeeting.time || '10:00 AM'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg border border-white/5"><MapPin size={14} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">Venue</p>
                                                <p className="text-sm font-black truncate max-w-[120px]">{nextMeeting.venue || 'Main Chamber'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg border border-white/5"><Users size={14} className="text-blue-300" /></div>
                                            <div>
                                                <p className="text-[8px] text-blue-200 font-black uppercase tracking-widest mb-0.5 opacity-60">Group</p>
                                                <p className="text-sm font-black truncate max-w-[120px]">{nextMeeting.departments?.name || 'Council'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-6">
                                    <p className="text-base text-blue-200 font-black uppercase tracking-[0.2em] opacity-40">No pending assemblies</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-row xl:flex-col gap-2 min-w-[200px]">
                            <button 
                                onClick={() => nextMeeting && onViewMeeting(nextMeeting)}
                                className="flex-1 bg-white text-[#1E3A8A] px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-50 hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 group/btn"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                <span>Manage</span>
                                <ArrowRight size={12} />
                            </button>
                            <button 
                                onClick={onViewList}
                                className="flex-1 bg-blue-600/50 backdrop-blur-md text-white border border-white/10 px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600/70 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Calendar</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingDashboard;
