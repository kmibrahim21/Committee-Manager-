
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import { Institution, Language, UserRole, Profile, Department, Member } from '../../../../types';
import { 
    Users, Calendar, FileText, Plus, Search, 
    ChevronRight, Loader2, AlertCircle, Save, X, 
    Download, Trash2, Edit3, ClipboardList, MapPin, Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import MeetingDashboard from './MeetingDashboard';
import MeetingDetailView from './MeetingDetailView';

interface MeetingEngineProps {
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
    let meeting_link = '';
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
                meeting_link = meta.meeting_link || '';
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
        if (meeting.meeting_link) meeting_link = meeting.meeting_link;
        if (meeting.require_attendance !== undefined) require_attendance = meeting.require_attendance;
        if (meeting.agenda) agenda = meeting.agenda;
    }

    return {
        ...meeting,
        type,
        notify_members,
        send_sms,
        send_voice,
        meeting_link,
        require_attendance,
        agenda,
        description: cleanDescription
    };
};

const StandardMeetingEngine: React.FC<MeetingEngineProps> = ({ lang, madrasah, onBack, role, profile }) => {
    const [meetings, setMeetings] = useState<any[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'meetings'>('dashboard');
    const [stats, setStats] = useState({
        total: 0,
        upcoming: 0,
        completed: 0,
        attendanceRate: 0
    });
    const [agendas, setAgendas] = useState<any[]>([]);
    const [decisions, setDecisions] = useState<any[]>([]);
    const [nextMeeting, setNextMeeting] = useState<any | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMeeting, setNewMeeting] = useState({
        title: '',
        type: 'General',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        venue: '',
        department_id: '',
        description: '',
        agenda: '',
        notify_members: true,
        send_sms: false,
        send_voice: false,
        meeting_link: '',
        require_attendance: true
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingMeeting, setEditingMeeting] = useState<any | null>(null);
    const [attendanceMembers, setAttendanceMembers] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});

    useEffect(() => {
        if (madrasah) {
            fetchInitialData();
        }
    }, [madrasah]);

    useEffect(() => {
        if (meetings.length > 0) {
            const total = meetings.length;
            const completed = meetings.filter(m => m.status === 'completed').length;
            const upcoming = meetings.filter(m => m.status === 'planned' || m.status === 'ongoing').length;
            
            setStats({ total, upcoming, completed, attendanceRate: 85 });

            // Filter all active/planned/ongoing meetings
            const upcomingMeetings = meetings.filter(m => m.status === 'planned' || m.status === 'ongoing');
            
            let next = null;
            if (upcomingMeetings.length > 0) {
                // Sort ascending so the closest upcoming meeting is first
                const sortedUpcoming = [...upcomingMeetings].sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
                    const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
                    return dateA - dateB;
                });
                next = sortedUpcoming[0];
            } else {
                // If no upcoming planned meetings, fallback to the latest completed/other meeting (most recent date)
                const sortedAllDesc = [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                next = sortedAllDesc[0];
            }
            setNextMeeting(next);
        } else {
            setNextMeeting(null);
        }
    }, [meetings]);

    const fetchDetailData = async (meetingId: string) => {
        const { data: ags } = await supabase.from('meeting_agendas').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });
        const { data: decs } = await supabase.from('meeting_decisions').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });
        if (ags) setAgendas(ags);
        if (decs) setDecisions(decs);
    };

    useEffect(() => {
        if (selectedMeeting) {
            fetchAttendanceData(selectedMeeting.id);
            fetchDetailData(selectedMeeting.id);
        }
    }, [selectedMeeting]);

    const fetchAttendanceData = async (meetingId: string) => {
        setLoading(true);
        try {
            let query = supabase.from('members').select('*').eq('institution_id', madrasah?.id);
            if (selectedMeeting?.department_id) {
                query = query.eq('department_id', selectedMeeting.department_id);
            }
            const { data: members } = await query;
            
            const { data: records } = await supabase
                .from('meeting_attendance')
                .select('*')
                .eq('meeting_id', meetingId);

            if (members) setAttendanceMembers(members);
            
            const recordMap: Record<string, string> = {};
            records?.forEach(r => {
                recordMap[r.member_id] = r.status;
            });
            setAttendanceRecords(recordMap);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAttendance = async (memberId: string, status: string) => {
        try {
            const { error } = await supabase
                .from('meeting_attendance')
                .upsert({
                    meeting_id: selectedMeeting.id,
                    member_id: memberId,
                    status
                }, { onConflict: 'meeting_id,member_id' });
            
            if (error) throw error;
            setAttendanceRecords(prev => ({ ...prev, [memberId]: status }));
        } catch (e) {
            alert(lang === 'bn' ? 'উপস্থিতি আপডেট করতে সমস্যা হয়েছে' : 'Error updating attendance');
        }
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const { data: deptData } = await supabase
                .from('departments')
                .select('*')
                .eq('institution_id', madrasah?.id);
            
            const { data: mtData, error: mtError } = await supabase
                .from('meetings')
                .select('*, departments(name)')
                .eq('institution_id', madrasah?.id)
                .order('date', { ascending: false });

            if (mtError) {
                console.error("Fetch meetings error:", mtError);
            }

            if (deptData) setDepartments(deptData);
            if (mtData) setMeetings(mtData.map(parseMeetingWithMeta));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMeeting = async () => {
        if (!newMeeting.title || !madrasah) return;
        setLoading(true);
        try {
            const targetInstitutionId = madrasah.id === 'super_admin' ? profile.institution_id : madrasah.id;

            const metadata = {
                type: newMeeting.type,
                notify_members: newMeeting.notify_members,
                send_sms: newMeeting.send_sms,
                send_voice: newMeeting.send_voice,
                meeting_link: newMeeting.meeting_link,
                require_attendance: newMeeting.require_attendance,
                agenda: newMeeting.agenda
            };

            const payload: any = {
                title: newMeeting.title,
                type: newMeeting.type,
                date: newMeeting.date,
                time: newMeeting.time,
                venue: newMeeting.venue,
                description: `---METADATA---\n${JSON.stringify(metadata)}\n---METADATA---\n${newMeeting.description}`,
                institution_id: targetInstitutionId,
                status: 'planned'
            };

            if (newMeeting.department_id && newMeeting.department_id !== '') {
                payload.department_id = newMeeting.department_id;
            } else {
                payload.department_id = null;
            }

            const { error } = await supabase
                .from('meetings')
                .insert([payload]);
            
            if (error) throw error;
            setShowAddModal(false);
            fetchInitialData();
            setNewMeeting({
                title: '',
                type: 'General',
                date: new Date().toISOString().split('T')[0],
                time: '10:00',
                venue: '',
                department_id: '',
                description: '',
                agenda: '',
                notify_members: true,
                send_sms: false,
                send_voice: false,
                meeting_link: '',
                require_attendance: true
            });
        } catch (e: any) {
            console.error("Meeting creation error:", e);
            alert(e.message || (lang === 'bn' ? 'মিটিং তৈরি করতে সমস্যা হয়েছে' : 'Error creating meeting'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMeeting = async (id: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('meetings').delete().eq('id', id);
            if (error) throw error;
            setDeletingId(null);
            setSelectedMeeting(null);
            fetchInitialData();
        } catch (e: any) {
            console.error("Meeting deletion error:", e);
            alert(e.message || (lang === 'bn' ? 'মিটিং ডিলিট করতে সমস্যা হয়েছে' : 'Error deleting meeting'));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('meetings').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            
            setMeetings(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
            
            if (selectedMeeting && selectedMeeting.id === id) {
                setSelectedMeeting({ ...selectedMeeting, status: newStatus });
            }

            fetchInitialData();
        } catch (e) {
            alert(lang === 'bn' ? 'স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে' : 'Error updating status');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMeeting = async () => {
        if (!editingMeeting || !editingMeeting.title) return;
        setLoading(true);
        try {
            const metadata = {
                type: editingMeeting.type,
                notify_members: editingMeeting.notify_members,
                send_sms: editingMeeting.send_sms,
                send_voice: editingMeeting.send_voice,
                meeting_link: editingMeeting.meeting_link,
                require_attendance: editingMeeting.require_attendance,
                agenda: editingMeeting.agenda
            };

            const { error } = await supabase.from('meetings').update({
                title: editingMeeting.title,
                type: editingMeeting.type,
                date: editingMeeting.date,
                time: editingMeeting.time,
                venue: editingMeeting.venue,
                description: `---METADATA---\n${JSON.stringify(metadata)}\n---METADATA---\n${editingMeeting.description}`,
                department_id: editingMeeting.department_id || null
            }).eq('id', editingMeeting.id);
            
            if (error) throw error;
            setShowEditModal(false);
            fetchInitialData();
        } catch (e: any) {
            console.error("Meeting update error:", e);
            alert(e.message || (lang === 'bn' ? 'মিটিং আপডেট করতে সমস্যা হয়েছে' : 'Error updating meeting'));
        } finally {
            setLoading(false);
        }
    };

    const handlePrintMinutes = (meeting: any) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Meeting Minutes - ${meeting.title}</title>
                    <style>
                        body { font-family: 'Noto Sans Bengali', 'Inter', sans-serif; padding: 40px; color: #1e293b; }
                        h1 { color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
                        .meta { margin-bottom: 30px; font-size: 14px; color: #64748b; }
                        .section { margin-bottom: 30px; }
                        .section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; color: #94a3b8; margin-bottom: 10px; }
                        .content { line-height: 1.6; white-space: pre-wrap; background: #f8fafc; padding: 20px; border-radius: 10px; }
                    </style>
                </head>
                <body>
                    <h1>${meeting.title}</h1>
                    <div class="meta">
                        Date: ${new Date(meeting.date).toLocaleDateString()} | 
                        Audience: ${meeting.departments?.name || 'All'}
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Description</div>
                        <div class="content">${meeting.description || 'N/A'}</div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const onAddAgenda = async (topic: string) => {
        if (!selectedMeeting) return;
        const { data, error } = await supabase.from('meeting_agendas').insert([{ meeting_id: selectedMeeting.id, topic }]).select();
        if (data) setAgendas([...agendas, data[0]]);
    };

    const onDeleteAgenda = async (id: string) => {
        await supabase.from('meeting_agendas').delete().eq('id', id);
        setAgendas(agendas.filter(a => a.id !== id));
    };

    const onToggleAgenda = async (id: string, completed: boolean) => {
        await supabase.from('meeting_agendas').update({ completed }).eq('id', id);
        setAgendas(agendas.map(a => a.id === id ? { ...a, completed } : a));
    };

    const onAddDecision = async (title: string, description: string) => {
        if (!selectedMeeting) return;
        const { data } = await supabase.from('meeting_decisions').insert([{ meeting_id: selectedMeeting.id, title, description }]).select();
        if (data) setDecisions([...decisions, data[0]]);
    };

    const onDeleteDecision = async (id: string) => {
        await supabase.from('meeting_decisions').delete().eq('id', id);
        setDecisions(decisions.filter(d => d.id !== id));
    };

    const isDark = madrasah?.theme === 'dark';

    const filteredMeetings = meetings.filter(m => {
        const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (m.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesDept = selectedDept === '' || m.department_id === selectedDept;
        return matchesSearch && matchesDept;
    });

    if (loading && meetings.length === 0) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${isDark ? 'text-slate-200' : ''}`}>
            {/* Header */}
            <header className="flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-4">
                <div>
                   <h2 className={`text-2xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto tracking-tight`}>
                        {lang === 'bn' ? 'মিটিং ব্যবস্থাপনা' : 'Meeting Management'}
                   </h2>
                   <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Durable Governance Protocol Engine</p>
                </div>
                <button 
                   onClick={() => setShowAddModal(true)}
                   className="w-full sm:w-auto px-8 py-5 bg-[#2563EB] text-white rounded-[2rem] shadow-2xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                >
                   <Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" />
                   <span className="font-black text-xs uppercase tracking-widest">{lang === 'bn' ? 'নতুন মিটিং' : 'New Assembly'}</span>
                </button>
            </header>

            {/* Tabs */}
            <div className={`flex p-1.5 ${isDark ? 'bg-slate-900/50' : 'bg-slate-100'} rounded-[1.5rem] w-full sm:w-fit overflow-x-auto no-scrollbar`}>
                {[
                    { id: 'dashboard', label: lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard' },
                    { id: 'meetings', label: lang === 'bn' ? 'সকল সভা' : 'Assemblies' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        //@ts-ignore
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 sm:flex-none px-10 py-3.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.1em] transition-all
                            ${activeTab === tab.id 
                                ? 'bg-white text-[#2563EB] shadow-xl' 
                                : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                       {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Switcher */}
            {activeTab === 'dashboard' && (
                <MeetingDashboard 
                    stats={stats}
                    nextMeeting={nextMeeting}
                    onViewMeeting={setSelectedMeeting}
                    onViewList={() => setActiveTab('meetings')}
                    lang={lang}
                />
            )}

            {activeTab === 'meetings' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-blue-500" size={22} />
                            <input 
                                type="text" 
                                placeholder={lang === 'bn' ? 'মিটিং খুঁজুন...' : 'Search assembly records...'}
                                className={`w-full h-18 sm:h-22 ${isDark ? 'bg-slate-900/50 text-white' : 'bg-white text-[#1E3A8A]'} rounded-[2rem] pl-20 pr-8 font-black text-sm sm:text-base shadow-sm border border-transparent focus:border-blue-500/20 outline-none transition-all`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="md:w-64">
                            <select 
                                className={`w-full h-14 ${isDark ? 'bg-[#0E1726]/80 text-white' : 'bg-white text-slate-600 border border-blue-50'} rounded-2xl px-6 font-black text-[10px] uppercase tracking-widest shadow-sm border border-transparent outline-none focus:border-blue-500/20 transition-all cursor-pointer appearance-none`}
                                value={selectedDept}
                                onChange={(e) => setSelectedDept(e.target.value)}
                            >
                                <option value="">{lang === 'bn' ? 'সকল বিভাগ' : 'All Departments'}</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMeetings.map((meeting) => (
                            <div key={meeting.id} className={`p-5 sm:p-6 rounded-[1.5rem] border ${isDark ? 'bg-[#0A1224] border-blue-900/40' : 'bg-white border-blue-100/60 shadow-[0_4px_24px_rgba(37,99,235,0.01)] hover:shadow-[0_8px_32px_rgba(37,99,235,0.03)] hover:border-blue-200/80'} hover:-translate-y-1 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[320px]`}>
                                <div>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className={`p-3 rounded-xl ${meeting.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : meeting.status === 'cancelled' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'} shadow-inner`}>
                                            <Calendar size={22} />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => { setEditingMeeting(meeting); setShowEditModal(true); }}
                                                className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-blue-500/10 text-sky-400 hover:text-blue-400' : 'hover:bg-blue-50 text-blue-300 hover:text-blue-600'}`}
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setDeletingId(meeting.id); }}
                                                className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-rose-500/10 text-slate-700 hover:text-rose-500' : 'hover:bg-rose-50 text-slate-300 hover:text-rose-500'}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${isDark ? 'bg-blue-950/60 text-sky-400' : 'bg-blue-50/60 text-blue-500'}`}>
                                                {new Date(meeting.date).toLocaleDateString()} • {meeting.time || '10:00 AM'}
                                            </div>
                                            {meeting.type && (
                                                <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600 border border-blue-50'}`}>
                                                    {lang === 'bn' ? (
                                                        meeting.type === 'General' ? 'সাধারণ' :
                                                        meeting.type === 'Emergency' ? 'জরুরি' :
                                                        meeting.type === 'Strategic' ? 'কৌশলগত' :
                                                        meeting.type === 'Annual' ? 'বার্ষিক' : meeting.type
                                                    ) : meeting.type}
                                                </div>
                                            )}
                                        </div>
                                        <h3 className={`text-lg font-black font-noto leading-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'} group-hover:text-[#2563EB] transition-colors line-clamp-2`}>{meeting.title}</h3>
                                        
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <div className={`flex items-center gap-2 ${isDark ? 'bg-blue-950/40 text-sky-400/80' : 'bg-blue-50/40 text-blue-900/60'} py-1.5 px-3 rounded-full`}>
                                                <MapPin size={12} className="text-blue-500" />
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-sky-300/80' : 'text-blue-900/60'}`}>{meeting.venue || (lang === 'bn' ? 'সভার কক্ষ' : 'HQ')}</span>
                                            </div>
                                            <div className={`flex items-center gap-2 ${isDark ? 'bg-blue-950/40 text-sky-400/80' : 'bg-blue-50/40 text-blue-900/60'} py-1.5 px-3 rounded-full`}>
                                                <Users size={12} className="text-blue-500" />
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${isDark ? 'text-sky-300/80' : 'text-blue-900/60'}`}>{meeting.departments?.name || (lang === 'bn' ? 'সাধারণ সভা' : 'General')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`pt-6 mt-auto flex items-center justify-between border-t ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                                    <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                        meeting.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 
                                        meeting.status === 'cancelled' ? 'bg-rose-500/10 text-rose-500' : 
                                        'bg-blue-500/10 text-blue-500'
                                    }`}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        {lang === 'bn' ? (
                                            meeting.status === 'planned' ? 'আসন্ন' :
                                            meeting.status === 'ongoing' ? 'চলমান' :
                                            meeting.status === 'completed' ? 'সম্পন্ন' :
                                            meeting.status === 'cancelled' ? 'বাতিল' : meeting.status
                                        ) : meeting.status}
                                    </div>
                                    
                                    <button 
                                        onClick={() => setSelectedMeeting(meeting)}
                                        className="group/btn flex items-center gap-2 text-[9px] font-black text-[#2563EB] uppercase tracking-widest hover:translate-x-1 transition-transform py-2 px-3 rounded-lg hover:bg-blue-50"
                                    >
                                        {lang === 'bn' ? 'পরিচালনা' : 'Manage'} <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {filteredMeetings.length === 0 && (
                            <div className={`col-span-full py-32 text-center rounded-[4rem] border-4 border-dashed ${isDark ? 'border-slate-800 bg-slate-900/20' : 'border-slate-50 bg-white'} space-y-6`}>
                                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
                                    <ClipboardList size={48} />
                                </div>
                                <div>
                                    <h4 className="text-2xl font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কোন মিটিং পাওয়া যায়নি' : 'Vault is Empty'}</h4>
                                    <p className="text-slate-500 font-medium mt-3">{lang === 'bn' ? 'নতুন মিটিং তৈরি করে কার্যক্রম শুরু করুন।' : 'Initiate a new assembly to commence protocol management.'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Selection/Detail Engine */}
            {selectedMeeting && (
                <MeetingDetailView 
                    meeting={selectedMeeting}
                    madrasah={madrasah}
                    agendas={agendas}
                    decisions={decisions}
                    attendanceMembers={attendanceMembers}
                    attendanceRecords={attendanceRecords}
                    onBack={() => setSelectedMeeting(null)}
                    onUpdateAttendance={handleUpdateAttendance}
                    onPrint={() => handlePrintMinutes(selectedMeeting)}
                    onAddAgenda={onAddAgenda}
                    onAddDecision={onAddDecision}
                    onDeleteAgenda={onDeleteAgenda}
                    onDeleteDecision={onDeleteDecision}
                    onToggleAgenda={onToggleAgenda}
                    onDeleteMeeting={() => setDeletingId(selectedMeeting.id)}
                    onUpdateStatus={(status) => handleUpdateStatus(selectedMeeting.id, status)}
                    lang={lang}
                />
            )}


            {/* Delete Confirmation Modal */}
            {deletingId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-3xl z-[3000] flex items-center justify-center p-4 sm:p-6">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white w-full max-w-sm rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-2xl text-center"
                    >
                        <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <Trash2 size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-[#1E3A8A] font-noto mb-3">
                            {lang === 'bn' ? 'মিটিংটি ডিলিট করতে চান?' : 'Purge Assembly?'}
                        </h3>
                        <p className="text-base text-slate-400 font-medium mb-10 leading-relaxed px-4">
                            {lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি এই মিটিংটি ডিলিট করতে চান? এটি আর ফিরে পাওয়া যাবে না।' : 'This action is irreversible. Are you prepared to permanently remove this record?'}
                        </p>
                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={() => setDeletingId(null)}
                                className="w-full py-5 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[11px]"
                            >
                                {lang === 'bn' ? 'বাতিল' : 'Abort'}
                            </button>
                            <button 
                                onClick={() => handleDeleteMeeting(deletingId)}
                                disabled={loading}
                                className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-900/20 hover:bg-rose-700 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-3"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : (lang === 'bn' ? 'ডিলিট করুন' : 'Confirm Purge')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[2000] flex items-center justify-center p-3 sm:p-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl sm:text-2xl font-black text-[#1E3A8A] font-noto tracking-tight">
                                {lang === 'bn' ? 'নতুন মিটিং সূচী' : 'New Assembly'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl flex items-center justify-center transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-5 py-2">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Assemble Name</label>
                                    <input 
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm font-noto"
                                        placeholder="সূচীর শিরোনাম..."
                                        value={newMeeting.title}
                                        onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Venue / Location</label>
                                    <input 
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm font-noto"
                                        placeholder="কোথায় অনুষ্ঠিত হবে?"
                                        value={newMeeting.venue}
                                        onChange={(e) => setNewMeeting({...newMeeting, venue: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Meeting Link</label>
                                <input 
                                    className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#2563EB] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm"
                                    placeholder="https://zoom.us/j/..."
                                    value={newMeeting.meeting_link}
                                    onChange={(e) => setNewMeeting({...newMeeting, meeting_link: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-noto">
                                    {lang === 'bn' ? 'কমিটি নির্বাচন' : 'Select Committee'}
                                </label>
                                <select 
                                    className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white cursor-pointer text-sm font-noto"
                                    value={newMeeting.department_id || ''}
                                    onChange={(e) => setNewMeeting({...newMeeting, department_id: e.target.value})}
                                >
                                    <option value="">{lang === 'bn' ? 'সকল কমিটি / সদস্য' : 'All Committees / Members'}</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সভার তারিখ' : 'Date of Convention'}</label>
                                    <input 
                                        type="date"
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm"
                                        value={newMeeting.date}
                                        onChange={(e) => setNewMeeting({...newMeeting, date: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সভার সময়' : 'Convention Time'}</label>
                                    <input 
                                        type="time"
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm"
                                        value={newMeeting.time}
                                        onChange={(e) => setNewMeeting({...newMeeting, time: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কৌশলগত বিবরণ ও লক্ষ্য' : 'Strategic description & Goals'}</label>
                                <textarea 
                                    className="w-full h-28 bg-slate-50 rounded-2xl p-4 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm resize-none font-noto"
                                    placeholder="সভার উদ্দেশ্য এবং বর্ণনা..."
                                    value={newMeeting.description}
                                    onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-100 flex gap-4 shrink-0">
                            <button 
                                onClick={() => setShowAddModal(false)}
                                className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[11px]"
                            >
                                {lang === 'bn' ? 'বাতিল' : 'Abort'}
                            </button>
                            <button 
                                onClick={handleCreateMeeting}
                                disabled={loading}
                                className="flex-1 py-3 bg-[#2563EB] text-white font-bold rounded-2xl shadow-lg shadow-blue-900/10 hover:bg-blue-700 hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-widest"
                            >
                                {loading ? <Loader2 className="animate-spin mx-auto text-white" size={16} /> : (lang === 'bn' ? 'সেভ করুন' : 'Authorize Convention')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingMeeting && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[2000] flex items-center justify-center p-3 sm:p-10">
                    <motion.div 
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl sm:text-2xl font-black text-[#1E3A8A] font-noto tracking-tight">
                                {lang === 'bn' ? 'সূচী সংশোধন' : 'Refine assembly'}
                            </h3>
                            <button onClick={() => setShowEditModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 hover:text-rose-500 rounded-xl flex items-center justify-center transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-5 py-2">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Assemble Name</label>
                                    <input 
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm font-noto"
                                        value={editingMeeting.title}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, title: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Venue / Location</label>
                                    <input 
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm font-noto"
                                        value={editingMeeting.venue}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, venue: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Meeting Link</label>
                                <input 
                                    className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#2563EB] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm"
                                    placeholder="https://zoom.us/j/..."
                                    value={editingMeeting.meeting_link}
                                    onChange={(e) => setEditingMeeting({...editingMeeting, meeting_link: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-noto">
                                    {lang === 'bn' ? 'কমিটি নির্বাচন' : 'Select Committee'}
                                </label>
                                <select 
                                    className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white cursor-pointer text-sm font-noto"
                                    value={editingMeeting.department_id || ''}
                                    onChange={(e) => setEditingMeeting({...editingMeeting, department_id: e.target.value})}
                                >
                                    <option value="">{lang === 'bn' ? 'সকল কমিটি / সদস্য' : 'All Committees / Members'}</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সভার তারিখ' : 'Date of Convention'}</label>
                                    <input 
                                        type="date"
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm"
                                        value={editingMeeting.date}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, date: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সভার সময়' : 'Convention Time'}</label>
                                    <input 
                                        type="time"
                                        className="w-full h-12 bg-slate-50 rounded-2xl px-5 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm"
                                        value={editingMeeting.time}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, time: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'কৌশলগত লক্ষ্য' : 'Strategic Goals'}</label>
                                <textarea 
                                    className="w-full h-28 bg-slate-50 rounded-2xl p-4 font-black text-[#1E3A8A] outline-none border border-slate-100 focus:border-blue-200 transition-all focus:bg-white text-sm resize-none font-noto"
                                    value={editingMeeting.description}
                                    onChange={(e) => setEditingMeeting({...editingMeeting, description: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-100 flex gap-4 shrink-0">
                            <button 
                                onClick={() => setShowEditModal(false)}
                                className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[11px]"
                            >
                                {lang === 'bn' ? 'বাতিল' : 'Abort'}
                            </button>
                            <button 
                                onClick={handleUpdateMeeting}
                                disabled={loading}
                                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 hover:scale-[1.01] active:scale-95 transition-all text-xs uppercase tracking-widest"
                            >
                                {loading ? <Loader2 className="animate-spin mx-auto text-white" size={16} /> : (lang === 'bn' ? 'আপডেট করুন' : 'Confirm refinement')}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default StandardMeetingEngine;
