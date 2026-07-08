
import React, { useState } from 'react';
import { 
    Users, Calendar, Clock, MapPin, 
    ChevronRight, Loader2, AlertCircle, Save, X, 
    Download, Trash2, Edit3, ClipboardList, 
    FileText, CheckCircle, Search, QrCode, Plus, Sparkles,
    Info, Users2, LayoutDashboard, Target, History
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

    const filteredMembers = attendanceMembers.filter(m => 
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
        (m.member_type?.toLowerCase() || '').includes(memberSearch.toLowerCase())
    );

    const isDark = madrasah?.theme === 'dark';

    return (
        <div className={`fixed inset-0 ${isDark ? 'bg-[#080A12]' : 'bg-[#F8FAFC]'} z-[1000] flex flex-col font-noto animate-in fade-in slide-in-from-right-10 duration-500`}>
            {/* Elegant Header */}
            <header className={`${isDark ? 'bg-[#0F111A] border-slate-800' : 'bg-white border-slate-100'} border-b px-4 sm:px-10 py-5 sm:py-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between sticky top-0 z-50 shadow-sm gap-4 transition-colors`}>
                <div className="flex items-center gap-4 sm:gap-8">
                    <button 
                        onClick={onBack} 
                        className={`p-3 sm:p-4 ${isDark ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'} rounded-2xl sm:rounded-3xl transition-all hover:scale-110 active:scale-90`}
                    >
                        <X className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className={`text-xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} tracking-tight truncate max-w-[200px] sm:max-w-none`}>{meeting.title}</h2>
                            <div className="flex gap-2">
                                {meeting.type && (
                                    <span className={`px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'} border`}>
                                        {meeting.type}
                                    </span>
                                )}
                                <span className={`px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border ${
                                    meeting.status === 'completed' 
                                        ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100')
                                        : (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-100')
                                }`}>
                                    {meeting.status}
                                </span>
                            </div>
                        </div>
                        <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {new Date(meeting.date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')} • {meeting.time || '10:00 AM'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={onPrint}
                        className={`group flex-1 sm:flex-none px-6 py-4 rounded-2xl sm:rounded-[1.5rem] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all
                            ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>{lang === 'bn' ? 'পিডিএফ ডাউনলোড' : 'Export PDF'}</span>
                        </div>
                    </button>
                    {meeting.status !== 'completed' && (
                        <button 
                            onClick={() => onUpdateStatus('completed')}
                            className="flex-2 sm:flex-none px-8 py-4 bg-[#2563EB] text-white rounded-2xl sm:rounded-[1.5rem] hover:bg-[#1d4ed8] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest"
                        >
                            <CheckCircle className="w-5 h-5" />
                            <span>{lang === 'bn' ? 'সম্পন্ন করুন' : 'Finish Meeting'}</span>
                        </button>
                    )}
                    <button 
                        onClick={onDeleteMeeting}
                        className={`p-4 rounded-2xl sm:rounded-[1.5rem] transition-all flex items-center justify-center
                            ${isDark ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}
                    >
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Modern Navigation Menu - Desktop Sidebar */}
                <nav className={`w-72 ${isDark ? 'bg-[#0F111A] border-slate-800' : 'bg-white border-slate-100'} border-r p-6 space-y-2 overflow-y-auto hidden lg:block`}>
                    {[
                        { id: 'info', label: lang === 'bn' ? 'মিটিং বিবরণ' : 'Overview', icon: LayoutDashboard },
                        { id: 'agenda', label: lang === 'bn' ? 'আলোচ্য বিষয়' : 'Agenda & Topics', icon: ClipboardList },
                        { id: 'participants', label: lang === 'bn' ? 'সদস্য তালিকা' : 'Memberships', icon: Users },
                        { id: 'attendance', label: lang === 'bn' ? 'উপস্থিতি' : 'Participation', icon: Target },
                    ].map(item => (
                        <button
                            key={item.id}
                            //@ts-ignore
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest
                                ${activeSection === item.id 
                                ? 'bg-[#2563EB] text-white shadow-xl shadow-blue-500/30' 
                                : isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800/50' : 'text-slate-400 hover:bg-slate-50 hover:text-[#2563EB]'}`}
                        >
                            <item.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeSection === item.id ? 'text-white' : ''}`} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Mobile Tab Rail */}
                <div className={`lg:hidden flex ${isDark ? 'bg-[#0F111A] border-slate-800' : 'bg-white border-slate-100'} border-b overflow-x-auto no-scrollbar px-4 py-4 sticky top-0 z-40 gap-3`}>
                    {[
                        { id: 'info', icon: LayoutDashboard },
                        { id: 'agenda', icon: ClipboardList },
                        { id: 'participants', icon: Users },
                        { id: 'attendance', icon: Target },
                    ].map(item => (
                        <button
                            key={item.id}
                            //@ts-ignore
                            onClick={() => setActiveSection(item.id)}
                            className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all
                                ${activeSection === item.id 
                                ? 'bg-[#2563EB] text-white shadow-lg' 
                                : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'}`}
                        >
                            <item.icon className="w-5 h-5" />
                        </button>
                    ))}
                </div>

                {/* Aesthetic Content Area */}
                <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#080A12]' : 'bg-[#F8FAFC]'}`}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="max-w-4xl mx-auto"
                        >
                            {activeSection === 'info' && (
                                <div className="space-y-6">
                                    <div className={`${isDark ? 'bg-[#0F111A] border-slate-800 outline-white/5' : 'bg-white border-slate-100 outline-black/[0.02]'} p-6 sm:p-10 rounded-[2rem] border outline shadow-xl space-y-8`}>
                                        <div>
                                            <h3 className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} mb-4`}>
                                                {lang === 'bn' ? 'মিটিং এর উদ্দেশ্য' : 'Executive Objective'}
                                            </h3>
                                            <p className={`text-base sm:text-lg font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {meeting.description || (lang === 'bn' ? 'মিটিং এর জন্য কোন বর্ণনা প্রদান করা হয় নাই।' : 'No strategic description was provided for this assembly.')}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-slate-800/20">
                                            <BentoCard label={lang === 'bn' ? 'আয়োজক' : 'Convener'} value={madrasah?.name || 'Council'} icon={History} isDark={isDark} />
                                            <BentoCard label={lang === 'bn' ? 'কমিটি' : 'Committee'} value={meeting.departments?.name || (lang === 'bn' ? 'সাধারণ সভা' : 'General Assembly')} icon={Users2} isDark={isDark} />
                                            <BentoCard label={lang === 'bn' ? 'স্থান' : 'Location'} value={meeting.venue || (lang === 'bn' ? 'সভা কক্ষ' : 'Main Chamber')} icon={MapPin} isDark={isDark} />
                                            <BentoCard label={lang === 'bn' ? 'সাপ্তাহিক সূচী' : 'Timeline'} value={meeting.time || '10:00 AM'} icon={Clock} isDark={isDark} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'agenda' && (
                                <div className="space-y-6">
                                    <div className="flex items-end justify-between px-2">
                                        <div>
                                            <h3 className={`text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'আলোচ্য বিষয়' : 'Agenda Control'}</h3>
                                            <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Strategic Topics Enumeration</p>
                                        </div>
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-white text-slate-500 shadow-sm'}`}>
                                            {agendas.length} {lang === 'bn' ? 'টি বিষয়' : 'Points'}
                                        </span>
                                    </div>

                                    <div className={`${isDark ? 'bg-[#0F111A] border-slate-800' : 'bg-white border-slate-100'} rounded-[2rem] p-6 sm:p-10 border shadow-xl`}>
                                        <div className="flex flex-col sm:flex-row gap-3 mb-8">
                                            <div className="relative flex-1">
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500">
                                                    <Plus className="w-5 h-5" />
                                                </div>
                                                <input 
                                                    value={newAgenda}
                                                    onChange={(e) => setNewAgenda(e.target.value)}
                                                    placeholder={lang === 'bn' ? 'নতুন পয়েন্ট যুক্ত করুন...' : 'Propose new agenda item...'}
                                                    className={`w-full h-14 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-[#1E3A8A]'} rounded-xl sm:rounded-2xl pl-14 pr-6 font-black outline-none border-2 border-transparent focus:border-blue-500/20 transition-all text-sm sm:text-base`}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => { if (newAgenda) { onAddAgenda(newAgenda); setNewAgenda(''); } }}
                                                className="h-14 px-8 bg-[#2563EB] text-white rounded-xl sm:rounded-2xl shadow-lg shadow-blue-500/20 transition-all font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] active:scale-95"
                                            >
                                                {lang === 'bn' ? 'যুক্ত করুন' : 'Append'}
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {agendas.map((agenda, i) => (
                                                <motion.div 
                                                    layout
                                                    key={agenda.id} 
                                                    className={`flex items-center justify-between p-4 sm:p-6 ${isDark ? 'bg-slate-900/50 hover:bg-slate-900' : 'bg-slate-50/50 hover:bg-white'} rounded-2xl group transition-all border border-transparent hover:border-blue-500/10 hover:shadow-lg`}
                                                >
                                                    <div className="flex items-center gap-4 overflow-hidden">
                                                        <button 
                                                            onClick={() => onToggleAgenda(agenda.id, !agenda.completed)}
                                                            className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl border-2 flex items-center justify-center transition-all ${agenda.completed ? 'bg-emerald-500 border-emerald-500 text-white rotate-0' : 'border-slate-300 rotate-45'}`}
                                                        >
                                                            {agenda.completed && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                                                        </button>
                                                        <span className={`text-sm sm:text-base font-bold font-noto leading-tight ${agenda.completed ? 'text-slate-500 line-through opacity-50' : isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                                            {agenda.topic}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => onDeleteAgenda(agenda.id)} className={`flex-shrink-0 p-3 rounded-lg transition-all ${isDark ? 'hover:bg-rose-500/10 text-slate-700 hover:text-rose-500' : 'hover:bg-rose-50 text-slate-300 hover:text-rose-500'} sm:opacity-0 group-hover:opacity-100`}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </motion.div>
                                            ))}
                                            {agendas.length === 0 && (
                                                <div className="py-20 text-center space-y-4">
                                                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                                        <ClipboardList size={32} />
                                                    </div>
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{lang === 'bn' ? 'কোন আলোচ্য বিষয় নেই' : 'No agenda points defined'}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'participants' && (
                                <div className="space-y-8">
                                    <div className="flex items-end justify-between px-4">
                                        <div>
                                            <h3 className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'সদস্য তালিকা' : 'Membership Roster'}</h3>
                                            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.3em] mt-3">Verified Council Representatives</p>
                                        </div>
                                    </div>

                                    <div className={`${isDark ? 'bg-[#0F111A] border-slate-800' : 'bg-white border-slate-100'} rounded-[3rem] p-8 sm:p-12 border shadow-2xl`}>
                                        <div className="relative mb-10">
                                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-blue-500 w-6 h-6" />
                                            <input 
                                                type="text"
                                                placeholder={lang === 'bn' ? 'সদস্য খুঁজুন...' : 'Search meeting roster...'}
                                                className={`w-full h-18 sm:h-22 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-[#1E3A8A]'} rounded-2xl sm:rounded-[2rem] pl-20 pr-8 font-black outline-none border-2 border-transparent focus:border-blue-500/20 transition-all text-sm sm:text-lg`}
                                                value={memberSearch}
                                                onChange={(e) => setMemberSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {filteredMembers.map(member => (
                                                <div key={member.id} className={`flex items-center gap-6 p-6 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50/50'} rounded-[2rem] hover:scale-[1.02] transition-all border border-transparent hover:border-blue-500/10`}>
                                                    <div className="w-16 h-16 rounded-2xl flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg">
                                                        {member.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className={`text-lg font-black font-noto leading-tight truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{member.name}</h4>
                                                        <span className={`inline-block mt-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-white text-slate-400 shadow-sm border border-slate-50'}`}>
                                                            {member.member_type || 'Delegate'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'attendance' && (
                                <div className="space-y-8">
                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
                                        <div>
                                            <h3 className={`text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'উপস্থিতি ট্র্যাকিং' : 'Participation Protocol'}</h3>
                                            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-[0.3em] mt-3">Live Session Verification</p>
                                        </div>
                                        <button className={`w-fit px-8 py-4 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-100 shadow-sm'} rounded-2xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all`}>
                                            <QrCode className="w-5 h-5 text-blue-500" />
                                            <span>{lang === 'bn' ? 'কিউআর মোড' : 'Digital QR Signature'}</span>
                                        </button>
                                    </div>

                                    <div className={`${isDark ? 'bg-[#0F111A] border-slate-800' : 'bg-white border-slate-100'} rounded-[3rem] p-6 sm:p-12 border shadow-2xl`}>
                                        <div className="relative mb-10">
                                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-blue-500 w-6 h-6" />
                                            <input 
                                                type="text"
                                                placeholder={lang === 'bn' ? 'সদস্য খুঁজুন...' : 'Authenticate records...'}
                                                className={`w-full h-18 sm:h-22 ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-[#1E3A8A]'} rounded-2xl sm:rounded-[2rem] pl-20 pr-8 font-black outline-none border-2 border-transparent focus:border-blue-500/20 transition-all text-sm sm:text-lg`}
                                                value={memberSearch}
                                                onChange={(e) => setMemberSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            {filteredMembers.map(member => (
                                                <div key={member.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-6 sm:p-8 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50/50'} rounded-[2.5rem] hover:bg-white dark:hover:bg-slate-900 transition-all border border-transparent shadow-sm gap-6`}>
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] flex-shrink-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 text-white flex items-center justify-center font-black text-2xl shadow-inner">
                                                            {member.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className={`font-black font-noto leading-tight text-lg sm:text-2xl truncate ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{member.name}</h4>
                                                            <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-2">{member.designation || (lang === 'bn' ? 'পরিষদ সদস্য' : 'Council Delegate')}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`flex p-2 gap-2 ${isDark ? 'bg-[#080A12]' : 'bg-slate-200/50'} rounded-[2rem] overflow-x-auto no-scrollbar`}>
                                                        {[
                                                            { id: 'present', color: 'bg-emerald-500', label: lang === 'bn' ? 'উপস্থিত' : 'Present' },
                                                            { id: 'absent', color: 'bg-rose-500', label: lang === 'bn' ? 'অনুপস্থিত' : 'Absent' },
                                                            { id: 'late', color: 'bg-amber-500', label: lang === 'bn' ? 'বিলম্বিত' : 'Late' },
                                                            { id: 'excused', color: 'bg-slate-500', label: lang === 'bn' ? 'ছুটি' : 'Excused' }
                                                        ].map(stat => (
                                                            <button
                                                                key={stat.id}
                                                                onClick={() => onUpdateAttendance(member.id, stat.id)}
                                                                className={`flex-1 min-w-[70px] sm:min-w-[90px] px-4 py-3 rounded-[1.2rem] text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                                                                    attendanceRecords[member.id] === stat.id 
                                                                    ? `${stat.color} text-white shadow-xl scale-105` 
                                                                    : isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
                                                                }`}
                                                            >
                                                                {stat.label}
                                                            </button>
                                                        ))}
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

const BentoCard = ({ label, value, icon: Icon, isDark }: any) => (
    <div className={`${isDark ? 'bg-slate-900/50 hover:bg-slate-900 border-slate-800' : 'bg-white hover:bg-slate-50 border-slate-100 shadow-sm'} p-6 sm:p-8 rounded-[2rem] border transition-all flex flex-col items-center text-center gap-4 group`}>
        <div className={`w-14 h-14 rounded-2xl ${isDark ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
            <Icon size={24} />
        </div>
        <div>
            <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-sm sm:text-base font-black truncate max-w-[150px] ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{value}</p>
        </div>
    </div>
);

export default MeetingDetailView;
