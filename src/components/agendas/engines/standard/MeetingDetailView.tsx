import React, { useState, useEffect } from 'react';
import { 
    Users, Calendar, Clock, MapPin, 
    ChevronRight, Loader2, AlertCircle, Save, X, ArrowLeft, Bell, MoreVertical,
    Download, Trash2, Edit3, ClipboardList, 
    FileText, CheckCircle, Search, QrCode, Plus, Sparkles,
    Info, Users2, LayoutDashboard, Target, History, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MeetingDetailViewProps {
    meeting: any;
    madrasah?: any;
    agendas: any[];
    decisions: any[];
    attendanceMembers: any[];
    attendanceRecords: Record<string, string>;
    onBack: () => void;
    onUpdateAttendance: (memberId: string, status: string) => void;
    onPrint: () => void;
    onAddAgenda: (topic: string) => void;
    onAddDecision: (title: string, description: string) => void;
    onDeleteAgenda: (id: string) => void;
    onDeleteDecision: (id: string) => void;
    onToggleAgenda: (id: string, completed: boolean) => void;
    onDeleteMeeting: () => void;
    onUpdateStatus: (status: string) => void;
    lang: string;
}

const MeetingDetailView: React.FC<MeetingDetailViewProps> = ({ 
    meeting, madrasah, agendas, decisions, attendanceMembers, attendanceRecords, 
    onBack, onUpdateAttendance, onPrint, onAddAgenda, onAddDecision, onDeleteAgenda, 
    onDeleteDecision, onToggleAgenda, onDeleteMeeting, onUpdateStatus, lang
}) => {
    const [activeSection, setActiveSection] = useState<'info' | 'agenda' | 'participants' | 'attendance'>('info');
    const [newAgenda, setNewAgenda] = useState('');
    const [newDecision, setNewDecision] = useState({ title: '', description: '' });
    const [memberSearch, setMemberSearch] = useState('');
    const [elapsedSeconds, setElapsedSeconds] = useState(5130); // starts around 1 hr 25 mins like in the photo

    // Keep counting up elapsed seconds if meeting is ongoing
    useEffect(() => {
        if (meeting.status === 'ongoing') {
            const interval = setInterval(() => {
                setElapsedSeconds(prev => prev + 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [meeting.status]);

    const formatElapsed = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleAttendanceStatus = (memberId: string) => {
        const current = attendanceRecords[memberId] || 'absent';
        const next = current === 'present' ? 'absent' : 'present';
        onUpdateAttendance(memberId, next);
    };

    const filteredMembers = attendanceMembers.filter(m => 
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
        (m.member_type?.toLowerCase() || '').includes(memberSearch.toLowerCase()) ||
        (m.designation?.toLowerCase() || '').includes(memberSearch.toLowerCase())
    );

    const isDark = madrasah?.theme === 'dark';
    
    // Dynamic theme styling - Elite Blue, Light Blue & Ocean palette
    const accentColor = isDark ? '#38BDF8' : '#2563EB';
    const textAccentClass = isDark ? 'text-[#38BDF8]' : 'text-[#2563EB]';
    const bgAccentClass = isDark ? 'bg-[#38BDF8] text-slate-950 hover:bg-[#0EA5E9]' : 'bg-linear-to-r from-[#2563EB] to-[#0284C7] text-white hover:from-[#1D4ED8] hover:to-[#0369A1] shadow-lg shadow-blue-500/10';
    const hoverBgAccentClass = isDark ? 'hover:bg-[#38BDF8]/10 hover:text-[#38BDF8]' : 'hover:bg-[#2563EB]/10 hover:text-[#2563EB]';
    const hoverTextAccentClass = isDark ? 'hover:text-[#38BDF8]' : 'hover:text-[#2563EB]';
    const borderAccentClass = isDark ? 'border-[#38BDF8]/20' : 'border-[#2563EB]/20';
    const borderFocusClass = isDark ? 'focus:border-[#38BDF8]/20' : 'focus:border-[#2563EB]/20';
    const softBgAccentClass = isDark ? 'bg-[#38BDF8]/10 text-[#38BDF8]' : 'bg-[#E0F2FE] text-[#0369A1]';
    const strokeAccentClass = isDark ? 'stroke-[#38BDF8]' : 'stroke-[#2563EB]';

    // Dynamic stats calculations
    const totalMembers = attendanceMembers.length;
    const presentCount = attendanceMembers.filter(m => attendanceRecords[m.id] === 'present').length;
    const absentCount = attendanceMembers.filter(m => attendanceRecords[m.id] === 'absent' || !attendanceRecords[m.id]).length;
    const totalAgendas = agendas.length;
    const attendanceRate = totalMembers > 0 ? Math.round((presentCount / totalMembers) * 100) : 0;

    // Detect President / Chairman
    const presidentMember = attendanceMembers.find(m => 
        m.designation === 'সভাপতি' || 
        m.designation?.toLowerCase().includes('president') || 
        m.member_type === 'সভাপতি'
    ) || attendanceMembers[0];
    const presidentName = presidentMember ? presidentMember.name : (lang === 'bn' ? 'নির্ধারিত নয়' : 'Not Set');

    const tabs = [
        { id: 'info', label: lang === 'bn' ? 'সংক্ষিপ্ত বিবরণ' : 'Overview', icon: LayoutDashboard },
        { id: 'agenda', label: lang === 'bn' ? 'আলোচ্য বিষয়' : 'Agenda', icon: ClipboardList },
        { id: 'participants', label: lang === 'bn' ? 'সদস্য তালিকা' : 'Members', icon: Users },
        { id: 'attendance', label: lang === 'bn' ? 'উপস্থিতি' : 'Attendance', icon: Target },
    ];

    const formattedDate = new Date(meeting.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US');

    return (
        <div className={`fixed inset-x-0 top-[calc(env(safe-area-inset-top)+68px)] bottom-[108px] md:inset-y-0 md:right-0 md:left-72 ${isDark ? 'bg-[#040814]' : 'bg-[#F5F9FD]'} z-[150] flex flex-col font-noto animate-in fade-in slide-in-from-right-10 duration-500 overflow-hidden`}>
            {/* Elegant Header */}
            <header className={`${isDark ? 'bg-[#0B1528] border-blue-900/40' : 'bg-linear-to-r from-white to-[#F0F9FF] border-blue-100/60'} border-b px-4 py-3 sm:px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-colors gap-4`}>
                <div className="flex items-center gap-3 min-w-0">
                    <button 
                        onClick={onBack} 
                        className={`p-2 ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-50 text-slate-700'} rounded-xl transition-all active:scale-95`}
                        id="back_to_meetings"
                    >
                        <ArrowLeft className="w-5 h-5 sm:w-6 h-6" />
                    </button>
                    <div className="min-w-0">
                        <h2 className={`text-sm sm:text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'} tracking-tight font-noto truncate`}>
                            {meeting.title || (lang === 'bn' ? 'মিটিং পরিচালনা' : 'Meeting Administration')}
                        </h2>
                        <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {formattedDate} • {meeting.time || '10:00:00'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
                    {/* PDF Download */}
                    <button 
                        onClick={onPrint} 
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold font-noto tracking-wide transition-all active:scale-95 hover:scale-[1.01]
                            ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850' : 'bg-white border-slate-200/60 text-slate-600 shadow-sm hover:bg-slate-50'}`}
                        id="btn_download_pdf"
                    >
                        <Download className={`w-3.5 h-3.5 ${textAccentClass}`} />
                        <span className="hidden sm:inline">{lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'PDF Download'}</span>
                        <span className="inline sm:hidden">{lang === 'bn' ? 'পিডিএফ' : 'PDF'}</span>
                    </button>

                    {/* Start / Finish Meeting */}
                    {meeting.status !== 'completed' && (
                        <button 
                            onClick={() => {
                                if (meeting.status === 'planned') onUpdateStatus('ongoing');
                                else if (meeting.status === 'ongoing') onUpdateStatus('completed');
                            }}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold font-noto tracking-wide transition-all active:scale-95 shadow-sm ${bgAccentClass}`}
                            id="btn_update_meeting_status"
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>
                                {meeting.status === 'planned' ? (lang === 'bn' ? 'শুরু করুন' : 'Start') :
                                 meeting.status === 'ongoing' ? (lang === 'bn' ? 'সম্পন্ন করুন' : 'Finish') : ''}
                            </span>
                        </button>
                    )}

                    {meeting.status === 'completed' && (
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold font-noto bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'সম্পন্ন' : 'Completed'}</span>
                        </span>
                    )}

                    {/* Delete Button */}
                    <button 
                        onClick={onDeleteMeeting}
                        className={`p-2 rounded-xl border transition-all active:scale-95 hover:bg-rose-500/10 hover:text-rose-500
                            ${isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50/50 border-rose-100 text-rose-500 shadow-sm'}`}
                        id="btn_delete_meeting"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Modern Navigation Menu - Desktop Sidebar */}
                <nav className={`w-72 ${isDark ? 'bg-[#060D1A] border-blue-950' : 'bg-[#F4F9FF] border-blue-100/70'} border-r p-5 space-y-1.5 overflow-y-auto hidden lg:block`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest px-3.5 mb-4 ${isDark ? 'text-sky-500/80' : 'text-blue-500/80'}`}>
                        {lang === 'bn' ? 'মেন্যু নেভিগেশন' : 'Navigation Menu'}
                    </p>
                    {tabs.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id as any)}
                            className={`w-full group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-black text-xs tracking-wide border-l-4
                                ${activeSection === item.id 
                                ? `${isDark ? 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]' : 'bg-white text-[#2563EB] border-[#2563EB] shadow-[0_4px_16px_rgba(37,99,235,0.06)]'}` 
                                : `border-transparent ${isDark ? 'text-sky-400/60 hover:text-sky-300 hover:bg-blue-950/30' : 'text-blue-900/60 hover:bg-blue-100/30 hover:text-blue-950'}`}`}
                        >
                            <item.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeSection === item.id ? textAccentClass : 'text-blue-400/70'}`} />
                            <span className="font-noto">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Mobile Tab Rail */}
                <div className={`lg:hidden flex ${isDark ? 'bg-[#0B1528] border-blue-900/40' : 'bg-[#F0F6FC] border-blue-100/50'} border-b px-3 py-2 sticky top-0 z-40`}>
                    <div className={`flex p-1 w-full gap-1 rounded-xl ${isDark ? 'bg-blue-950/40' : 'bg-blue-100/40'}`}>
                        {tabs.map(item => {
                            const isActive = activeSection === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id as any)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg transition-all text-[11px] font-black whitespace-nowrap
                                        ${isActive 
                                        ? `bg-white dark:bg-[#060D1A] ${textAccentClass} shadow-[0_2px_12px_rgba(37,99,235,0.06)]` 
                                        : 'text-blue-900/60 dark:text-sky-400/60 hover:text-[#2563EB]'}`}
                                >
                                    <item.icon className={`w-3.5 h-3.5 ${isActive ? textAccentClass : 'text-slate-400'}`} />
                                    <span className="font-noto">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Aesthetic Content Area */}
                <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#080A12]' : 'bg-[#F8FAFC]'}`}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6 max-w-4xl mx-auto pb-36 md:pb-24"
                        >
                            {/* --- TAB 1: OVERVIEW (সংক্ষিপ্ত বিবরণ) --- */}
                            {activeSection === 'info' && (
                                <div className="space-y-5">
                                    {/* 4 Stats Cards matching screenshot exactly */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                                        {/* Card 1: Total Members */}
                                        <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all hover:scale-[1.02] hover:shadow-md duration-300
                                            ${isDark ? 'bg-[#0B1528] border-blue-900/40' : 'bg-linear-to-br from-white to-blue-50/40 border-blue-100/60 shadow-[0_4px_16px_rgba(37,99,235,0.02)]'}`}>
                                            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-blue-950 text-sky-400' : 'bg-blue-100/50 text-[#2563EB]'} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block text-[10px] font-black text-blue-900/50 dark:text-sky-400/50 font-noto uppercase tracking-widest">
                                                    {lang === 'bn' ? 'মোট সদস্য' : 'Total Members'}
                                                </span>
                                                <div className="flex items-baseline gap-1 mt-0.5">
                                                    <span className={`text-lg sm:text-2xl font-black ${isDark ? 'text-white' : 'text-[#2563EB]'} leading-none`}>
                                                        {lang === 'bn' ? totalMembers.toLocaleString('bn-BD') : totalMembers}
                                                    </span>
                                                    <span className="text-[10px] text-blue-900/40 dark:text-sky-400/40 font-black font-noto">
                                                        {lang === 'bn' ? 'জন' : 'p'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 2: Present */}
                                        <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all hover:scale-[1.02] hover:shadow-md duration-300
                                            ${isDark ? 'bg-[#0B1528] border-blue-900/40' : 'bg-linear-to-br from-white to-emerald-50/40 border-emerald-100/60 shadow-[0_4px_16px_rgba(16,185,129,0.02)]'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block text-[10px] font-black text-emerald-900/50 dark:text-emerald-400/50 font-noto uppercase tracking-widest">
                                                    {lang === 'bn' ? 'উপস্থিত' : 'Present'}
                                                </span>
                                                <div className="flex items-baseline gap-1 mt-0.5">
                                                    <span className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                                        {lang === 'bn' ? presentCount.toLocaleString('bn-BD') : presentCount}
                                                    </span>
                                                    <span className="text-[10px] text-emerald-900/40 dark:text-emerald-400/40 font-black font-noto">
                                                        {lang === 'bn' ? 'জন' : 'p'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 3: Absent */}
                                        <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all hover:scale-[1.02] hover:shadow-md duration-300
                                            ${isDark ? 'bg-[#0B1528] border-blue-900/40' : 'bg-linear-to-br from-white to-amber-50/40 border-amber-100/60 shadow-[0_4px_16px_rgba(245,158,11,0.02)]'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block text-[10px] font-black text-amber-900/50 dark:text-amber-400/50 font-noto uppercase tracking-widest">
                                                    {lang === 'bn' ? 'অনুপস্থিত' : 'Absent'}
                                                </span>
                                                <div className="flex items-baseline gap-1 mt-0.5">
                                                    <span className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
                                                        {lang === 'bn' ? absentCount.toLocaleString('bn-BD') : absentCount}
                                                    </span>
                                                    <span className="text-[10px] text-amber-900/40 dark:text-amber-400/40 font-black font-noto">
                                                        {lang === 'bn' ? 'জন' : 'p'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 4: Agenda */}
                                        <div className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all hover:scale-[1.02] hover:shadow-md duration-300
                                            ${isDark ? 'bg-[#0B1528] border-blue-900/40' : 'bg-linear-to-br from-white to-sky-50/40 border-sky-100/60 shadow-[0_4px_16px_rgba(14,165,233,0.02)]'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                                                <ClipboardList className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="block text-[10px] font-black text-sky-900/50 dark:text-sky-400/50 font-noto uppercase tracking-widest">
                                                    {lang === 'bn' ? 'মোট এজেন্ডা' : 'Total Agenda'}
                                                </span>
                                                <div className="flex items-baseline gap-1 mt-0.5">
                                                    <span className="text-lg sm:text-2xl font-black text-sky-600 dark:text-sky-400 leading-none">
                                                        {lang === 'bn' ? totalAgendas.toLocaleString('bn-BD') : totalAgendas}
                                                    </span>
                                                    <span className="text-[10px] text-sky-900/40 dark:text-sky-400/40 font-black font-noto">
                                                        {lang === 'bn' ? 'টি' : 'pt'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attendance Tracking Card Section matching photo perfectly */}
                                    <div className={`p-5 sm:p-6 rounded-2xl border ${isDark ? 'bg-[#0A1224] border-blue-900/40' : 'bg-white border-blue-100/60 shadow-[0_4px_24px_rgba(37,99,235,0.01)]'} space-y-4`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-blue-950'} font-noto`}>
                                                    {lang === 'bn' ? 'উপস্থিতি ট্র্যাকিং' : 'Attendance Tracking'}
                                                </h3>
                                                <p className="text-[8px] sm:text-[9px] font-black text-blue-900/40 dark:text-sky-400/50 uppercase tracking-widest mt-0.5">
                                                    LIVE SESSION VERIFICATION
                                                </p>
                                            </div>
                                            <div className={`p-2 rounded-xl transition-all ${isDark ? 'bg-blue-950/60 text-sky-400 border border-blue-900/30' : 'bg-blue-50/60 text-[#2563EB] border border-blue-100/60'}`}>
                                                <QrCode className={`w-4 h-4 ${textAccentClass}`} />
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center gap-6 pt-1">
                                            {/* Left Column: Radial Progress Indicator */}
                                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                                    <circle
                                                        cx="50"
                                                        cy="50"
                                                        r="40"
                                                        className="stroke-blue-50 dark:stroke-blue-950/40 fill-none"
                                                        strokeWidth="7"
                                                    />
                                                    <circle
                                                        cx="50"
                                                        cy="50"
                                                        r="40"
                                                        className={`${strokeAccentClass} fill-none transition-all duration-700`}
                                                        strokeWidth="7"
                                                        strokeDasharray={`${2 * Math.PI * 40}`}
                                                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - attendanceRate / 100)}`}
                                                        strokeLinecap="round"
                                                    />
                                                </svg>
                                                <div className="absolute flex flex-col items-center justify-center">
                                                    <span className={`text-lg sm:text-xl font-extrabold ${textAccentClass} tracking-tight`}>
                                                        {lang === 'bn' ? attendanceRate.toLocaleString('bn-BD') : attendanceRate}%
                                                    </span>
                                                    <span className="text-[7px] sm:text-[9px] font-bold text-slate-400 font-noto tracking-wider">
                                                        {lang === 'bn' ? 'উপস্থিতি হার' : 'Present'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Right Column: Key Details */}
                                            <div className="flex-1 w-full space-y-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-noto">
                                                        {lang === 'bn' ? 'আজকের সভা' : 'Today\'s Assembly'}
                                                    </span>
                                                    <span className={`px-2 py-0.5 text-[8px] font-bold rounded-md font-noto uppercase 
                                                        ${meeting.status === 'ongoing' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                          meeting.status === 'planned' ? `${softBgAccentClass}` :
                                                          'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                        {lang === 'bn' ? (
                                                            meeting.status === 'planned' ? 'আসন্ন' :
                                                            meeting.status === 'ongoing' ? 'চলমান' :
                                                            meeting.status === 'completed' ? 'সম্পন্ন' : 'বাতিল'
                                                        ) : meeting.status}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[10px] sm:text-xs">
                                                    <div className="truncate">
                                                        <span className="text-slate-400 font-noto">{lang === 'bn' ? 'সভাপতি:' : 'Chair:'} </span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 font-noto">{presidentName}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-noto">{lang === 'bn' ? 'সময়:' : 'Time:'} </span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{formatElapsed(elapsedSeconds)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-noto">{lang === 'bn' ? 'সভা শুরু:' : 'Start:'} </span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">{meeting.time || '10:00 AM'}</span>
                                                    </div>
                                                    <div className="truncate">
                                                        <span className="text-slate-400 font-noto">{lang === 'bn' ? 'স্থান:' : 'Venue:'} </span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 font-noto">{meeting.venue || (lang === 'bn' ? 'সভা কক্ষ - ১' : 'Main Hall')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Horizontal Progress bar and indicator */}
                                        <div className="pt-2">
                                            <div className="w-full h-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-full overflow-hidden">
                                                <div className={`h-full ${bgAccentClass} rounded-full transition-all duration-500`} style={{ width: `${attendanceRate}%` }} />
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-2.5">
                                                <span className="relative flex h-1.5 w-1.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 font-noto">
                                                    {meeting.status === 'ongoing' ? (lang === 'bn' ? 'সদস্যরা উপস্থিতি দিচ্ছেন...' : 'Members are signing in...') : 
                                                     meeting.status === 'completed' ? (lang === 'bn' ? 'সভা সম্পন্ন হয়েছে।' : 'Meeting successfully concluded.') :
                                                     (lang === 'bn' ? 'সভা শুরু হতে প্রস্তুত...' : 'Ready to start...')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Member Roster list inside this overview */}
                                    <div className={`p-4 sm:p-6 rounded-2xl border ${isDark ? 'bg-[#0A1224] border-blue-900/40' : 'bg-white border-blue-100/60 shadow-[0_4px_24px_rgba(37,99,235,0.01)]'} space-y-4`}>
                                        {/* Elegant Search and Filter buttons */}
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                                                <input 
                                                    type="text"
                                                    placeholder={lang === 'bn' ? 'সদস্য খুঁজুন...' : 'Search members...'}
                                                    className={`w-full h-10 ${isDark ? 'bg-[#0E1726] text-white border-blue-950 focus:border-blue-800' : 'bg-blue-50/40 text-slate-800 border-blue-100 focus:border-blue-300 focus:bg-white'} rounded-xl pl-9 pr-4 font-bold outline-none border transition-all text-xs`}
                                                    value={memberSearch}
                                                    onChange={(e) => setMemberSearch(e.target.value)}
                                                />
                                            </div>
                                            
                                            <button className={`w-10 h-10 flex items-center justify-center rounded-xl border ${isDark ? 'bg-[#0E1726] border-blue-950 text-sky-400 hover:bg-[#1E293B]' : 'bg-blue-50/60 border-blue-100 text-[#2563EB] hover:bg-blue-100/50 shadow-sm'} transition-all`}>
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                                </svg>
                                            </button>

                                            <button className={`h-10 px-3.5 ${bgAccentClass} rounded-xl shadow-sm flex items-center gap-1.5 font-bold text-xs whitespace-nowrap active:scale-95 transition-all`}>
                                                <Users className="w-3.5 h-3.5" />
                                                <span>{lang === 'bn' ? `সকল (${totalMembers.toLocaleString('bn-BD')})` : `All (${totalMembers})`}</span>
                                            </button>
                                        </div>

                                        {/* Member list with interactive inline quick-toggle attendance */}
                                        <div className="space-y-2.5">
                                            {filteredMembers.map(member => {
                                                const status = attendanceRecords[member.id] || 'absent';
                                                const isPresent = status === 'present';
                                                const isLate = status === 'late';
                                                const isExcused = status === 'excused';
                                                
                                                const checkInTime = isPresent ? '10:01 AM' : isLate ? '10:15 AM' : '--:--';
                                                
                                                // Premium avatar color palette
                                                const avatarBgColor = isPresent 
                                                    ? 'bg-blue-600 text-white shadow-md' 
                                                    : 'bg-blue-50 text-blue-400 dark:bg-blue-950/40';

                                                return (
                                                    <div key={member.id} className={`flex items-center justify-between p-3 ${isDark ? 'bg-[#07101E] border-blue-950/40 hover:border-blue-900' : 'bg-white border-blue-50 hover:border-blue-150/80 hover:bg-blue-50/10 shadow-[0_2px_12px_rgba(37,99,235,0.01)] hover:shadow-[0_4px_20px_rgba(37,99,235,0.03)]'} rounded-xl border transition-all`}>
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            {/* Avatar */}
                                                            <div className={`w-9 h-9 rounded-xl ${avatarBgColor} flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0`}>
                                                                {member.name.charAt(0)}
                                                            </div>
                                                            
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className={`text-xs font-bold font-noto truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                                                        {member.name}
                                                                    </h4>
                                                                    {member.designation && (
                                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${softBgAccentClass} font-noto`}>
                                                                            {member.designation}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium font-noto mt-0.5">
                                                                    {member.member_type || (lang === 'bn' ? 'পরিষদ সদস্য' : 'Council Member')}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Status Badge & Actions */}
                                                        <div className="flex items-center gap-2.5">
                                                            {/* Attendance button badge */}
                                                            <button 
                                                                onClick={() => toggleAttendanceStatus(member.id)}
                                                                className={`px-2.5 py-1 rounded-lg text-[9px] font-bold font-noto transition-all shadow-sm active:scale-95 ${
                                                                    isPresent ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                                                    isLate ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' :
                                                                    isExcused ? `${softBgAccentClass}` :
                                                                    'bg-rose-50 text-rose-500 dark:bg-rose-950/20 dark:text-rose-400'
                                                                }`}
                                                            >
                                                                {lang === 'bn' ? (
                                                                    status === 'present' ? 'উপস্থিত' :
                                                                    status === 'absent' ? 'অনুপস্থিত' :
                                                                    status === 'late' ? 'বিলম্বিত' : 'ছুটি'
                                                                ) : status}
                                                            </button>

                                                            {/* Check-in Time text */}
                                                            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 hidden xs:inline min-w-[50px] text-right">
                                                                {checkInTime}
                                                            </span>

                                                            {/* Three Dots Action Menu */}
                                                            <button className={`p-1 text-slate-400 dark:text-slate-600 hover:text-slate-800 dark:hover:text-slate-300 transition-colors rounded-lg`}>
                                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <circle cx="12" cy="12" r="1"></circle>
                                                                    <circle cx="12" cy="5" r="1"></circle>
                                                                    <circle cx="12" cy="19" r="1"></circle>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Collapsible/Sleek Objective box below list */}
                                    <div className={`p-4 sm:p-5 rounded-2xl border ${isDark ? 'bg-[#0A1224] border-blue-900/40' : 'bg-linear-to-br from-white to-blue-50/20 border-blue-100/60 shadow-[0_4px_24px_rgba(37,99,235,0.01)]'}`}>
                                        <h3 className={`text-xs sm:text-sm font-black ${isDark ? 'text-white' : 'text-blue-950'} mb-2`}>
                                            {lang === 'bn' ? 'মিটিং এর উদ্দেশ্য' : 'Executive Objective'}
                                        </h3>
                                        <p className={`text-xs leading-relaxed ${isDark ? 'text-sky-300/80' : 'text-blue-900/75'}`}>
                                            {meeting.description || (lang === 'bn' ? 'মিটিং এর জন্য কোন বর্ণনা প্রদান করা হয় নাই।' : 'No strategic description was provided for this assembly.')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* --- TAB 2: AGENDA (আলোচ্য বিষয়) --- */}
                            {activeSection === 'agenda' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <div>
                                            <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-blue-950'}`}>{lang === 'bn' ? 'আলোচ্য বিষয়' : 'Agenda Control'}</h3>
                                            <p className="text-[8px] sm:text-[9px] font-black text-blue-900/40 dark:text-sky-400/50 uppercase tracking-widest mt-0.5">Strategic Topics Enumeration</p>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black ${isDark ? 'bg-blue-950 text-sky-400' : 'bg-blue-50 text-[#2563EB] border border-blue-100/60'}`}>
                                            {agendas.length} {lang === 'bn' ? 'টি বিষয়' : 'Points'}
                                        </span>
                                    </div>

                                    <div className={`${isDark ? 'bg-[#0A1224] border-blue-900/40' : 'bg-white border-blue-100/60 shadow-[0_4px_24px_rgba(37,99,235,0.01)]'} rounded-2xl p-4 sm:p-6 border space-y-4`}>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${textAccentClass}`}>
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                                <input 
                                                    value={newAgenda}
                                                    onChange={(e) => setNewAgenda(e.target.value)}
                                                    placeholder={lang === 'bn' ? 'নতুন পয়েন্ট...' : 'Propose agenda...'}
                                                    className={`w-full h-11 ${isDark ? 'bg-[#0E1726] text-white border-blue-950 focus:border-blue-800' : 'bg-blue-50/40 text-slate-800 border-blue-100 focus:border-blue-300 focus:bg-white'} rounded-xl pl-9 pr-4 font-bold outline-none border transition-all text-xs`}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => { if (newAgenda) { onAddAgenda(newAgenda); setNewAgenda(''); } }}
                                                className={`h-11 px-5 ${bgAccentClass} rounded-xl shadow-md transition-all font-bold uppercase text-[10px] tracking-wide hover:scale-[1.01] active:scale-95 whitespace-nowrap`}
                                            >
                                                {lang === 'bn' ? 'যুক্ত করুন' : 'Append'}
                                            </button>
                                        </div>

                                        <div className="space-y-2.5 pt-2">
                                            {agendas.map((agenda, i) => (
                                                <motion.div 
                                                    layout
                                                    key={agenda.id} 
                                                    className={`flex items-center justify-between p-3.5 ${isDark ? 'bg-[#07101E] border-blue-950/40 hover:bg-[#0A1224]' : 'bg-blue-50/20 border-blue-100/40 hover:bg-white'} rounded-xl group transition-all border hover:${borderAccentClass} hover:shadow-sm`}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <button 
                                                            onClick={() => onToggleAgenda(agenda.id, !agenda.completed)}
                                                            className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${agenda.completed ? 'bg-emerald-500 border-emerald-500 text-white rotate-0' : 'border-blue-200 dark:border-blue-900/60 rotate-45'}`}
                                                        >
                                                            {agenda.completed && <CheckCircle className="w-3.5 h-3.5" />}
                                                        </button>
                                                        <span className={`text-xs font-bold font-noto leading-tight ${agenda.completed ? 'text-slate-400 line-through opacity-50 dark:text-slate-600' : isDark ? 'text-white' : 'text-slate-800'}`}>
                                                            {agenda.topic}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => onDeleteAgenda(agenda.id)} className={`flex-shrink-0 p-2 rounded-lg transition-all ${isDark ? 'hover:bg-rose-500/10 text-slate-600 hover:text-rose-500' : 'hover:bg-rose-50 text-slate-300 hover:text-rose-500'} sm:opacity-0 group-hover:opacity-100`}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </motion.div>
                                            ))}
                                            {agendas.length === 0 && (
                                                <div className="py-12 text-center space-y-4">
                                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800/80 rounded-full flex items-center justify-center mx-auto text-slate-300 dark:text-slate-600">
                                                        <ClipboardList size={24} />
                                                    </div>
                                                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">{lang === 'bn' ? 'কোন আলোচ্য বিষয় নেই' : 'No agenda points defined'}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- TAB 3: MEMBERS LIST (সদস্য তালিকা) --- */}
                            {activeSection === 'participants' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <div>
                                            <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-blue-950'}`}>{lang === 'bn' ? 'সদস্য তালিকা' : 'Membership Roster'}</h3>
                                            <p className="text-[8px] sm:text-[9px] font-black text-blue-900/40 dark:text-sky-400/50 uppercase tracking-widest mt-0.5">Verified Council Representatives</p>
                                        </div>
                                    </div>

                                    <div className={`${isDark ? 'bg-[#0A1224] border-blue-900/40' : 'bg-white border-blue-100/60 shadow-[0_4px_24px_rgba(37,99,235,0.01)]'} rounded-2xl p-4 sm:p-6 border`}>
                                        <div className="relative mb-6">
                                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${textAccentClass} w-4 h-4`} />
                                            <input 
                                                type="text"
                                                placeholder={lang === 'bn' ? 'সদস্য খুঁজুন...' : 'Search meeting roster...'}
                                                className={`w-full h-11 ${isDark ? 'bg-[#0E1726] text-white border-blue-950 focus:border-blue-800' : 'bg-blue-50/40 text-slate-800 border-blue-100 focus:border-blue-300 focus:bg-white'} rounded-xl pl-10 pr-4 font-bold outline-none border transition-all text-xs`}
                                                value={memberSearch}
                                                onChange={(e) => setMemberSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {filteredMembers.map(member => (
                                                <div key={member.id} className={`flex items-center gap-4 p-3.5 ${isDark ? 'bg-[#07101E] border-blue-950/40' : 'bg-blue-50/20 border-blue-100/40'} rounded-xl hover:scale-[1.01] transition-all border hover:${borderAccentClass} hover:shadow-sm`}>
                                                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 ${bgAccentClass} text-white flex items-center justify-center font-bold text-lg shadow-md`}>
                                                        {member.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className={`text-sm font-black font-noto leading-tight truncate ${isDark ? 'text-white' : 'text-blue-950'}`}>{member.name}</h4>
                                                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${isDark ? 'bg-blue-950/60 text-sky-400' : 'bg-blue-50/60 text-[#2563EB] border border-blue-100/40'}`}>
                                                            {member.member_type || 'Delegate'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- TAB 4: ATTENDANCE TRACKING (উপস্থিতি) --- */}
                            {activeSection === 'attendance' && (
                                <div className="space-y-4">
                                    <div className="flex flex-row items-center justify-between gap-4 px-2">
                                        <div>
                                            <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-blue-950'}`}>{lang === 'bn' ? 'উপস্থিতি ট্র্যাকিং' : 'Participation Protocol'}</h3>
                                            <p className="text-[8px] sm:text-[9px] font-black text-blue-900/40 dark:text-sky-400/50 uppercase tracking-widest mt-0.5">Live Session Verification</p>
                                        </div>
                                        <button className={`w-fit px-3 py-2.5 ${isDark ? 'bg-[#0E1726] border border-blue-950 text-sky-400' : 'bg-blue-50/60 border border-blue-100 text-[#2563EB] hover:bg-blue-100/50 shadow-sm'} rounded-xl flex items-center gap-1.5 font-black text-[10px] uppercase active:scale-95 transition-all`}>
                                            <QrCode className={`w-4 h-4 ${textAccentClass}`} />
                                            <span>{lang === 'bn' ? 'কিউআর' : 'QR'}</span>
                                        </button>
                                    </div>

                                    <div className={`${isDark ? 'bg-[#0A1224] border-blue-900/40' : 'bg-white border-blue-100/60 shadow-[0_4px_24px_rgba(37,99,235,0.01)]'} rounded-2xl p-4 border`}>
                                        <div className="relative mb-5">
                                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${textAccentClass} w-4 h-4`} />
                                            <input 
                                                type="text"
                                                placeholder={lang === 'bn' ? 'সদস্য খুঁজুন...' : 'Authenticate records...'}
                                                className={`w-full h-11 ${isDark ? 'bg-[#0E1726] text-white border-blue-950 focus:border-blue-800' : 'bg-blue-50/40 text-slate-800 border-blue-100 focus:border-blue-300 focus:bg-white'} rounded-xl pl-10 pr-4 font-bold outline-none border transition-all text-xs`}
                                                value={memberSearch}
                                                onChange={(e) => setMemberSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-3.5">
                                            {filteredMembers.map((member, idx) => (
                                                <div key={member.id} className={`p-4 rounded-[2.2rem] border shadow-bubble flex items-center justify-between group active:scale-[0.99] transition-all gap-4 ${isDark ? 'bg-[#07101E] border-blue-950/40' : 'bg-white border-blue-100/40'}`}>
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center border shrink-0 ${isDark ? 'bg-blue-950/50 text-sky-400 border-blue-900/40' : 'bg-blue-50/70 text-[#2563EB] border-blue-100/60'}`}>
                                                            <span className="text-[8px] font-black opacity-60 leading-none">ID</span>
                                                            <span className="text-sm font-black leading-none mt-0.5">{idx + 1}</span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h5 className={`font-black font-noto truncate text-base leading-snug ${isDark ? 'text-slate-100' : 'text-slate-850'}`}>{member.name}</h5>
                                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mt-1">{member.designation || (lang === 'bn' ? 'পরিষদ সদস্য' : 'Council Delegate')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        {[
                                                            { id: 'present', activeBg: 'bg-[#00c896] text-white border-[#00c896] shadow-lg shadow-emerald-500/20', inactiveBg: isDark ? 'bg-blue-950/30 text-blue-700/60 border-blue-950 hover:text-sky-400 hover:border-blue-900' : 'bg-blue-50/40 text-blue-300 border-blue-100/50 hover:text-[#2563EB] hover:border-blue-300/80', label: lang === 'bn' ? 'উপস্থিত' : 'Present', icon: CheckCircle },
                                                            { id: 'absent', activeBg: 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20', inactiveBg: isDark ? 'bg-blue-950/30 text-blue-700/60 border-blue-950 hover:text-sky-400 hover:border-blue-900' : 'bg-blue-50/40 text-blue-300 border-blue-100/50 hover:text-[#2563EB] hover:border-blue-300/80', label: lang === 'bn' ? 'অনুপস্থিত' : 'Absent', icon: XCircle },
                                                            { id: 'late', activeBg: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20', inactiveBg: isDark ? 'bg-blue-950/30 text-blue-700/60 border-blue-950 hover:text-sky-400 hover:border-blue-900' : 'bg-blue-50/40 text-blue-300 border-blue-100/50 hover:text-[#2563EB] hover:border-blue-300/80', label: lang === 'bn' ? 'বিলম্ব' : 'Late', icon: Clock }
                                                        ].map(stat => {
                                                            const isActive = attendanceRecords[member.id] === stat.id;
                                                            return (
                                                                <button
                                                                    key={stat.id}
                                                                    onClick={() => onUpdateAttendance(member.id, stat.id)}
                                                                    className={`w-11 h-11 rounded-[1.1rem] flex items-center justify-center transition-all border active:scale-95
                                                                        ${isActive ? stat.activeBg : stat.inactiveBg}`}
                                                                    title={stat.label}
                                                                >
                                                                    <stat.icon size={18} strokeWidth={2.5} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
};

export default MeetingDetailView;
