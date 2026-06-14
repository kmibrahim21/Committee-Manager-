
import React, { useState } from 'react';
import { 
    Users, Calendar, Clock, MapPin, 
    ChevronRight, Loader2, AlertCircle, Save, X, 
    Download, Trash2, Edit3, ClipboardList, 
    FileText, CheckCircle, Search, QrCode, Plus, Sparkles
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
    onGenerateMinutes: () => void;
    generatingMinutes: boolean;
    onPrint: () => void;
    onAddAgenda: (topic: string) => void;
    onAddDecision: (title: string, description: string) => void;
    onDeleteAgenda: (id: string) => void;
    onDeleteDecision: (id: string) => void;
    onToggleAgenda: (id: string, completed: boolean) => void;
}

const MeetingDetailView: React.FC<MeetingDetailViewProps> = ({ 
    meeting, madrasah, agendas, decisions, attendanceMembers, attendanceRecords, 
    onBack, onUpdateAttendance, onGenerateMinutes, generatingMinutes, 
    onPrint, onAddAgenda, onAddDecision, onDeleteAgenda, onDeleteDecision, onToggleAgenda
}) => {
    const [activeSection, setActiveSection] = useState<'info' | 'agenda' | 'participants' | 'attendance' | 'decisions' | 'attachments'>('info');
    const [newAgenda, setNewAgenda] = useState('');
    const [newDecision, setNewDecision] = useState({ title: '', description: '' });
    const [memberSearch, setMemberSearch] = useState('');

    const filteredMembers = attendanceMembers.filter(m => 
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
        (m.designation?.toLowerCase() || '').includes(memberSearch.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-slate-50 z-[1000] flex flex-col animate-in fade-in slide-in-from-right-10 duration-500">
            {/* Top Bar */}
            <div className="bg-white border-b border-slate-100 px-4 sm:px-8 py-3 sm:py-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between sticky top-0 z-10 shadow-sm gap-4">
                <div className="flex items-center gap-4 sm:gap-6">
                    <button onClick={onBack} className="p-2 sm:p-3 hover:bg-slate-50 rounded-xl sm:rounded-2xl transition-all text-slate-400 hover:text-[#1E3A8A]">
                        <X size={20} className="sm:w-6 sm:h-6" />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <h2 className="text-lg sm:text-2xl font-black text-[#1E3A8A] font-noto leading-tight truncate max-w-[200px] sm:max-w-none">{meeting.title}</h2>
                            {meeting.type && (
                                <span className="px-2 sm:px-4 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">
                                    {meeting.type}
                                </span>
                            )}
                            <span className={`px-2 sm:px-4 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${
                                meeting.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                                meeting.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 
                                'bg-blue-100 text-blue-700'
                            }`}>
                                {meeting.status}
                            </span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
                            {new Date(meeting.date).toLocaleDateString()} • {meeting.time || '10:00 AM'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    <button 
                        onClick={onPrint}
                        className="flex-1 sm:flex-none p-2 sm:p-3 bg-white border border-slate-100 text-slate-600 rounded-xl sm:rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest"
                    >
                        <Download size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="sm:inline">Export PDF</span>
                    </button>
                    <button 
                        onClick={onGenerateMinutes}
                        disabled={generatingMinutes}
                        className="flex-2 sm:flex-none p-2 sm:p-3 bg-emerald-600 text-white rounded-xl sm:rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest disabled:opacity-50"
                    >
                        {generatingMinutes ? <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Sparkles size={16} className="sm:w-[18px] sm:h-[18px]" />}
                        <span className="sm:inline">AI Minutes</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
                {/* Mobile Navigation */}
                <div className="lg:hidden flex bg-white border-b border-slate-100 overflow-x-auto no-scrollbar px-4 py-2 sticky top-0 z-10">
                    {[
                        { id: 'info', label: 'Info', icon: InfoIcon },
                        { id: 'agenda', label: 'Agenda', icon: ClipboardList },
                        { id: 'participants', label: 'Members', icon: Users },
                        { id: 'attendance', label: 'Attendance', icon: CheckCircle },
                        { id: 'decisions', label: 'Decisions', icon: FileText },
                    ].map(item => (
                        <button
                            key={item.id}
                            //@ts-ignore
                            onClick={() => setActiveSection(item.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest whitespace-nowrap mr-2 ${
                                activeSection === item.id 
                                ? 'bg-[#1E3A8A] text-white shadow-lg' 
                                : 'text-slate-400 hover:text-[#1E3A8A]'
                            }`}
                        >
                            <item.icon size={14} /> {item.label}
                        </button>
                    ))}
                </div>
                {/* Sidebar Navigation */}
                <div className="w-80 bg-white border-r border-slate-100 p-8 space-y-2 overflow-y-auto hidden lg:block">
                    {[
                        { id: 'info', label: 'Meeting Information', icon: InfoIcon },
                        { id: 'agenda', label: 'Agendas & Topics', icon: ClipboardList },
                        { id: 'participants', label: 'Expected Members', icon: Users },
                        { id: 'attendance', label: 'Attendance (Tracking)', icon: CheckCircle },
                        { id: 'decisions', label: 'Decisions & Resolutions', icon: FileText },
                        { id: 'attachments', label: 'Attachments & Reports', icon: MapPin },
                    ].map(item => (
                        <button
                            key={item.id}
                            //@ts-ignore
                            onClick={() => setActiveSection(item.id)}
                            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${
                                activeSection === item.id 
                                ? 'bg-[#1E3A8A] text-white shadow-xl shadow-blue-900/20 translate-x-2' 
                                : 'text-slate-400 hover:bg-slate-50 hover:text-[#1E3A8A]'
                            }`}
                        >
                            <item.icon size={20} /> {item.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12 bg-slate-50/50">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="max-w-4xl mx-auto space-y-6 sm:space-y-10"
                        >
                            {/* Section Content */}
                            {activeSection === 'info' && (
                                <div className="space-y-6 sm:space-y-8">
                                    <div className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] border border-slate-100 shadow-sm space-y-6 sm:space-y-8">
                                        <div>
                                            <h3 className="text-xl sm:text-3xl font-black text-[#1E3A8A] font-noto mb-2 sm:mb-4">Meeting Description</h3>
                                            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed font-noto">
                                                {meeting.description || 'No detailed description provided for this meeting.'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6 sm:pt-8 border-t border-slate-50">
                                            <InfoCard label="Organizer" value={madrasah?.name || 'Admin'} icon={Users} />
                                            <InfoCard label="Audience" value={meeting.departments?.name || 'All Members'} icon={Users} />
                                            <InfoCard label="Venue" value={meeting.venue || 'Conference Room'} icon={MapPin} />
                                            <InfoCard label="Time" value={meeting.time || '10:00 AM'} icon={Clock} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'agenda' && (
                                <div className="space-y-4 sm:space-y-6">
                                     <div className="flex items-center justify-between mb-1 sm:mb-2 px-2 sm:px-0">
                                        <h3 className="text-lg sm:text-2xl font-black text-[#1E3A8A] font-noto">Meeting Agendas</h3>
                                        <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">{agendas.length} Topics</p>
                                    </div>
                                    <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                                        <div className="flex gap-2 sm:gap-3">
                                            <input 
                                                value={newAgenda}
                                                onChange={(e) => setNewAgenda(e.target.value)}
                                                placeholder="Add new topic..."
                                                className="flex-1 h-12 sm:h-14 bg-slate-50 rounded-xl sm:rounded-2xl px-4 sm:px-6 font-bold outline-none border-2 border-transparent focus:border-blue-100 transition-all text-sm sm:text-base"
                                            />
                                            <button 
                                                onClick={() => {
                                                    if (newAgenda) { 
                                                        onAddAgenda(newAgenda);
                                                        setNewAgenda('');
                                                    }
                                                }}
                                                className="px-4 sm:p-4 bg-blue-600 text-white rounded-xl sm:rounded-2xl shadow-lg hover:bg-blue-700 transition-all font-black uppercase text-[9px] sm:text-[10px] tracking-widest"
                                            >
                                                Add
                                            </button>
                                        </div>
                                        <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-4">
                                            {agendas.map((agenda, i) => (
                                                <div key={agenda.id} className="flex items-center justify-between p-4 sm:p-5 bg-slate-50 rounded-2xl sm:rounded-3xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                                                    <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                                                        <button 
                                                            onClick={() => onToggleAgenda(agenda.id, !agenda.completed)}
                                                            className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${agenda.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'}`}
                                                        >
                                                            {agenda.completed && <CheckCircle size={14} className="sm:w-4 sm:h-4" />}
                                                        </button>
                                                        <span className={`font-bold font-noto text-sm sm:text-base break-words ${agenda.completed ? 'text-slate-400 line-through' : 'text-[#1E3A8A]'}`}>
                                                            {i + 1}. {agenda.topic}
                                                        </span>
                                                    </div>
                                                    <button onClick={() => onDeleteAgenda(agenda.id)} className="flex-shrink-0 p-2 sm:p-3 text-slate-200 hover:text-rose-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'attendance' && (
                                <div className="space-y-4 sm:space-y-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 sm:px-0">
                                        <div>
                                            <h3 className="text-xl sm:text-2xl font-black text-[#1E3A8A] font-noto">Participation Tracking</h3>
                                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mark present/absent members</p>
                                        </div>
                                        <button className="w-fit px-4 sm:px-6 py-2 sm:py-3 bg-white border border-slate-100 rounded-xl sm:rounded-2xl flex items-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                                            <QrCode size={16} /> Switch to QR
                                        </button>
                                    </div>

                                    <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-10 border border-slate-100 shadow-sm">
                                        <div className="relative mb-6 sm:mb-8">
                                            <Search className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-5 sm:h-5" />
                                            <input 
                                                type="text"
                                                placeholder="Search members..."
                                                className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl pl-14 sm:pl-16 pr-6 font-bold outline-none border-2 border-transparent focus:border-blue-100 transition-all font-noto text-sm sm:text-base"
                                                value={memberSearch}
                                                onChange={(e) => setMemberSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2 sm:space-y-3">
                                            {filteredMembers.map(member => (
                                                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-slate-50 rounded-2xl sm:rounded-[2rem] hover:bg-white hover:shadow-premium transition-all border border-transparent hover:border-slate-50 gap-4">
                                                    <div className="flex items-center gap-3 sm:gap-4">
                                                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex-shrink-0 bg-[#1E3A8A] text-white flex items-center justify-center font-black text-lg sm:text-xl font-noto shadow-lg shadow-blue-900/10">
                                                            {member.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-black text-[#1E3A8A] font-noto leading-tight text-sm sm:text-base truncate">{member.name}</h4>
                                                            <p className="text-[8px] sm:text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">
                                                                {member.designation || 'Member'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex p-1 bg-slate-200/40 rounded-xl sm:rounded-2xl overflow-x-auto no-scrollbar">
                                                        {[
                                                            { id: 'present', color: 'bg-emerald-500', label: 'Present' },
                                                            { id: 'absent', color: 'bg-rose-500', label: 'Absent' },
                                                            { id: 'late', color: 'bg-amber-500', label: 'Late' },
                                                            { id: 'excused', color: 'bg-slate-500', label: 'Excused' }
                                                        ].map(stat => (
                                                            <button
                                                                key={stat.id}
                                                                onClick={() => onUpdateAttendance(member.id, stat.id)}
                                                                className={`flex-1 sm:px-4 py-2 px-3 rounded-[0.6rem] sm:rounded-[0.8rem] text-[7px] sm:text-[8px] font-black uppercase transition-all whitespace-nowrap ${
                                                                    attendanceRecords[member.id] === stat.id 
                                                                    ? `${stat.color} text-white shadow-lg` 
                                                                    : 'text-slate-400'
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

                            {activeSection === 'decisions' && (
                                <div className="space-y-4 sm:space-y-6">
                                     <div className="flex items-center justify-between px-2 sm:px-0">
                                        <h3 className="text-xl sm:text-2xl font-black text-[#1E3A8A] font-noto">Decisions & Resolutions</h3>
                                    </div>
                                    <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-12 border border-slate-100 shadow-sm space-y-6 sm:space-y-8">
                                        <div className="space-y-3 sm:space-y-4 bg-slate-50 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem]">
                                            <input 
                                                value={newDecision.title}
                                                onChange={(e) => setNewDecision({...newDecision, title: e.target.value})}
                                                placeholder="Decision Title..."
                                                className="w-full h-12 sm:h-14 bg-white rounded-xl sm:rounded-2xl px-4 sm:px-6 font-bold outline-none border border-slate-100 focus:border-blue-100 transition-all font-noto text-sm sm:text-base"
                                            />
                                            <textarea 
                                                value={newDecision.description}
                                                onChange={(e) => setNewDecision({...newDecision, description: e.target.value})}
                                                placeholder="Details..."
                                                className="w-full h-20 sm:h-24 bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 font-bold outline-none border border-slate-100 focus:border-blue-100 transition-all resize-none font-noto text-sm sm:text-base"
                                            />
                                            <button 
                                                onClick={() => {
                                                    if (newDecision.title) {
                                                        onAddDecision(newDecision.title, newDecision.description);
                                                        setNewDecision({ title: '', description: '' });
                                                    }
                                                }}
                                                className="w-full py-4 sm:py-5 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-all"
                                            >
                                                Add Decision
                                            </button>
                                        </div>

                                        <div className="space-y-6 sm:space-y-8">
                                            {decisions.map((decision, i) => (
                                                <div key={decision.id} className="relative pl-8 sm:pl-12 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-blue-100 group">
                                                    <div className="absolute left-[-1rem] sm:left-[-1.25rem] top-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-[10px] sm:text-xs border-4 border-white shadow-sm">
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <div className="min-w-0">
                                                            <h4 className="text-base sm:text-lg font-black text-[#1E3A8A] font-noto break-words">{decision.title}</h4>
                                                            <p className="text-sm sm:text-base text-slate-600 font-medium font-noto mt-1 sm:mt-2 leading-relaxed break-words">
                                                                {decision.description}
                                                            </p>
                                                        </div>
                                                        <button onClick={() => onDeleteDecision(decision.id)} className="flex-shrink-0 p-2 sm:p-3 text-slate-200 hover:text-rose-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100">
                                                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

const InfoCard = ({ label, value, icon: Icon }: any) => (
    <div className="bg-slate-50/50 p-6 rounded-3xl space-y-3">
        <div className="w-10 h-10 rounded-xl bg-white text-blue-500 shadow-sm flex items-center justify-center">
            <Icon size={20} />
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-xs font-black text-[#1E3A8A] truncate">{value}</p>
        </div>
    </div>
);

const InfoIcon = () => <AlertCircle size={20} />;

export default MeetingDetailView;
