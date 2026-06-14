
import React from 'react';
import { 
    Users, Calendar, Clock, MapPin, 
    ArrowRight, TrendingUp, CheckCircle, Clock3, Plus, ChevronRight, Loader2
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
}

const MeetingDashboard: React.FC<MeetingDashboardProps> = ({ stats, nextMeeting, onViewMeeting, onViewList }) => {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Meetings', value: stats.total, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Upcoming', value: stats.upcoming, icon: Clock3, color: 'text-amber-500', bg: 'bg-amber-50' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: TrendingUp, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                ].map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label} 
                        className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5 group hover:shadow-xl transition-all"
                    >
                        <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <h3 className="text-2xl font-black text-[#1E3A8A] leading-none">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Next Meeting Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="bg-[#1E3A8A] rounded-[2.5rem] sm:rounded-[3.5rem] p-6 sm:p-10 text-white relative overflow-hidden group shadow-2xl shadow-blue-900/20">
                        {/* Decorative background circle */}
                        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />
                        
                        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-8">
                            <div className="space-y-6">
                                <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Next Scheduled Meeting</span>
                                </div>
                                
                                {nextMeeting ? (
                                    <>
                                        <h2 className="text-2xl sm:text-4xl font-black font-noto leading-tight max-w-lg">{nextMeeting.title}</h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 sm:gap-y-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl"><Calendar size={20} className="text-blue-300" /></div>
                                                <div>
                                                    <p className="text-[9px] sm:text-[10px] text-blue-200 font-black uppercase tracking-widest mb-0.5">Date</p>
                                                    <p className="text-xs sm:text-sm font-black">{new Date(nextMeeting.date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl"><Clock size={20} className="text-blue-300" /></div>
                                                <div>
                                                    <p className="text-[9px] sm:text-[10px] text-blue-200 font-black uppercase tracking-widest mb-0.5">Time</p>
                                                    <p className="text-xs sm:text-sm font-black">{nextMeeting.time || '10:00 AM'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl"><MapPin size={20} className="text-blue-300" /></div>
                                                <div>
                                                    <p className="text-[9px] sm:text-[10px] text-blue-200 font-black uppercase tracking-widest mb-0.5">Location</p>
                                                    <p className="text-xs sm:text-sm font-black">{nextMeeting.venue || 'Main Hall'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 sm:p-2.5 bg-white/10 rounded-xl"><Users size={20} className="text-blue-300" /></div>
                                                <div>
                                                    <p className="text-[9px] sm:text-[10px] text-blue-200 font-black uppercase tracking-widest mb-0.5">Expected</p>
                                                    <p className="text-xs sm:text-sm font-black">{nextMeeting.departments?.name || 'All Members'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-10">
                                        <p className="text-blue-200 font-black uppercase tracking-widest">No upcoming meetings scheduled</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row xl:flex-col gap-3">
                                <button 
                                    onClick={() => nextMeeting && onViewMeeting(nextMeeting)}
                                    className="flex-1 bg-white text-[#1E3A8A] px-6 sm:px-10 py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] font-black text-[10px] sm:text-sm uppercase tracking-widest hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
                                >
                                    Join/Details Meeting <ArrowRight size={18} />
                                </button>
                                <button 
                                    onClick={onViewList}
                                    className="flex-1 bg-blue-600 text-white px-6 sm:px-10 py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] font-black text-[10px] sm:text-sm uppercase tracking-widest hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    View Full Calendar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] sm:rounded-[3.5rem] p-6 sm:p-10 border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-black text-[#1E3A8A] font-noto mb-2">Meeting Organizer</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-6 sm:mb-8">Role Based Management</p>
                        
                        <div className="space-y-4 sm:space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl"><Plus size={20} /></div>
                                <div>
                                    <h4 className="text-sm font-black text-[#1E3A8A]">Quick Agenda</h4>
                                    <p className="text-xs text-slate-500 font-bold">Draft your meeting agendas in seconds using our simplified workflow.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl"><Users size={20} /></div>
                                <div>
                                    <h4 className="text-sm font-black text-[#1E3A8A]">Participation</h4>
                                    <p className="text-xs text-slate-500 font-bold">Track attendance and member involvement across your organization.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-50">
                        <div className="flex items-center gap-4">
                             <div className="flex -space-x-3">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                        M{i}
                                    </div>
                                ))}
                             </div>
                             <p className="text-xs text-slate-400 font-black uppercase tracking-widest">+ 42 others</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingDashboard;
