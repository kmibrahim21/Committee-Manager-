
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

const StandardMeetingEngine: React.FC<MeetingEngineProps> = ({ lang, madrasah, onBack, role, profile }) => {
    const [meetings, setMeetings] = useState<any[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'meetings' | 'minutes'>('dashboard');
    const [stats, setStats] = useState({
        total: 0,
        upcoming: 0,
        completed: 0,
        attendanceRate: 0
    });
    const [agendas, setAgendas] = useState<any[]>([]);
    const [decisions, setDecisions] = useState<any[]>([]);
    const [nextMeeting, setNextMeeting] = useState<any | null>(null);
    const [generatingMinutes, setGeneratingMinutes] = useState(false);
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
        require_attendance: true
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMeeting, setEditingMeeting] = useState<any | null>(null);
    const [detailsTab, setDetailsTab] = useState<'info' | 'attendance'>('info');
    const [attendanceMembers, setAttendanceMembers] = useState<any[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});

    const [editingMinutes, setEditingMinutes] = useState<{id: string, content: string} | null>(null);

    useEffect(() => {
        if (madrasah) {
            fetchInitialData();
        }
    }, [madrasah]);

    useEffect(() => {
        if (meetings.length > 0) {
            const now = new Date();
            const total = meetings.length;
            const completed = meetings.filter(m => m.status === 'completed').length;
            const upcoming = meetings.filter(m => m.status === 'planned' || m.status === 'ongoing').length;
            
            // Just for UI, if I had attendance counts I'd compute
            const rate = 85; 

            setStats({ total, upcoming, completed, attendanceRate: rate });

            const sorted = [...meetings].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const next = sorted.find(m => new Date(m.date) >= now && m.status !== 'cancelled' && m.status !== 'completed');
            setNextMeeting(next || sorted[0]);
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
            // First fetch all related members (e.g. teachers or members in dept)
            let query = supabase.from('members').select('*').eq('institution_id', madrasah?.id);
            if (selectedMeeting?.department_id) {
                query = query.eq('department_id', selectedMeeting.department_id);
            }
            const { data: members } = await query;
            
            // Then fetch attendance records
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
            alert('Error updating attendance');
        }
    };

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const { data: deptData } = await supabase
                .from('departments')
                .select('*')
                .eq('institution_id', madrasah?.id);
            
            const { data: mtData } = await supabase
                .from('meetings')
                .select('*, departments(name)')
                .eq('institution_id', madrasah?.id)
                .order('date', { ascending: false });

            if (deptData) setDepartments(deptData);
            if (mtData) setMeetings(mtData);
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
            const payload: any = {
                title: newMeeting.title,
                type: newMeeting.type,
                date: newMeeting.date,
                time: newMeeting.time,
                venue: newMeeting.venue,
                description: newMeeting.description,
                agenda: newMeeting.agenda,
                notify_members: newMeeting.notify_members,
                send_sms: newMeeting.send_sms,
                send_voice: newMeeting.send_voice,
                require_attendance: newMeeting.require_attendance,
                institution_id: madrasah.id,
                status: 'planned'
            };

            if (newMeeting.department_id && newMeeting.department_id !== '') {
                payload.department_id = newMeeting.department_id;
            }

            const { data, error } = await supabase
                .from('meetings')
                .insert([payload]);
            
            if (error) throw error;
            setShowAddModal(false);
            fetchInitialData();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error creating meeting');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMeeting = async (id: string) => {
        if (!confirm('Are you sure you want to delete this meeting?')) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('meetings').delete().eq('id', id);
            if (error) throw error;
            fetchInitialData();
        } catch (e) {
            alert('Error deleting meeting');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('meetings').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            fetchInitialData();
        } catch (e) {
            alert('Error updating status');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMeeting = async () => {
        if (!editingMeeting || !editingMeeting.title) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('meetings').update({
                title: editingMeeting.title,
                type: editingMeeting.type,
                date: editingMeeting.date,
                time: editingMeeting.time,
                venue: editingMeeting.venue,
                description: editingMeeting.description,
                agenda: editingMeeting.agenda,
                notify_members: editingMeeting.notify_members,
                send_sms: editingMeeting.send_sms,
                send_voice: editingMeeting.send_voice,
                require_attendance: editingMeeting.require_attendance,
                department_id: editingMeeting.department_id || null
            }).eq('id', editingMeeting.id);
            
            if (error) throw error;
            setShowEditModal(false);
            fetchInitialData();
        } catch (e) {
            alert('Error updating meeting');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateMinutes = async () => {
        if (!selectedMeeting || !agendas.length) return;
        setGeneratingMinutes(true);
        try {
            const response = await fetch('/api/gemini/generate-minutes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: selectedMeeting.title,
                    agendas: agendas.map(a => a.topic),
                    description: selectedMeeting.description
                })
            });
            const data = await response.json();
            if (data.minutes) {
                setEditingMinutes({ id: selectedMeeting.id, content: data.minutes });
                setActiveTab('minutes');
                setSelectedMeeting(null);
            }
        } catch (e) {
            alert('Error generating minutes');
        } finally {
            setGeneratingMinutes(false);
        }
    };

    const handleUpdateMinutes = async () => {
        if (!editingMinutes) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('meetings')
                .update({ minutes_content: editingMinutes.content })
                .eq('id', editingMinutes.id);
            
            if (error) throw error;
            setEditingMinutes(null);
            fetchInitialData();
        } catch (e) {
            alert('Error updating minutes');
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
                    
                    <div class="section">
                        <div class="section-title">Agenda</div>
                        <div class="content">${meeting.agenda || 'N/A'}</div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Minutes & Decisions</div>
                        <div class="content">${meeting.minutes_content || 'Not recorded yet.'}</div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Agenda/Decision Handlers
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                   <h2 className="text-2xl sm:text-3xl font-black text-[#1E3A8A] font-noto leading-tight sm:leading-none">Meeting Management Center</h2>
                   <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 sm:mt-2">Durable Governance & Protocol Engine</p>
                </div>
                <button 
                   onClick={() => setShowAddModal(true)}
                   className="w-full sm:w-auto p-4 bg-[#2563EB] text-white rounded-[1.2rem] sm:rounded-[1.5rem] shadow-premium active:scale-95 transition-all hover:bg-blue-600 flex items-center justify-center gap-2 group"
                >
                   <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                   <span className="font-black text-xs uppercase tracking-widest px-2">Create New Meeting</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl w-full sm:w-fit overflow-x-auto no-scrollbar">
                {[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'meetings', label: 'All Meetings' },
                    { id: 'minutes', label: 'Resolution Center' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        //@ts-ignore
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 sm:flex-none whitespace-nowrap px-4 sm:px-8 py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-[#1E3A8A] text-white shadow-xl shadow-blue-900/20' : 'text-slate-400 hover:text-blue-600'}`}
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
                />
            )}

            {activeTab === 'meetings' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                            <input 
                                type="text" 
                                placeholder="Search meetings by title or info..."
                                className="w-full h-16 bg-white rounded-[1.5rem] pl-16 pr-6 font-black text-sm shadow-sm border border-slate-100 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="md:w-72">
                            <select 
                                className="w-full h-16 bg-white rounded-[1.5rem] px-8 font-black text-xs uppercase tracking-widest shadow-sm border border-slate-100 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all cursor-pointer"
                                value={selectedDept}
                                onChange={(e) => setSelectedDept(e.target.value)}
                            >
                                <option value="">সকল বিভাগ (All)</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMeetings.map((meeting) => (
                            <div key={meeting.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[380px]">
                                <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-5 transition-opacity group-hover:opacity-10 ${meeting.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                
                                <div>
                                    <div className="flex items-start justify-between mb-8">
                                        <div className={`p-5 rounded-3xl ${meeting.status === 'completed' ? 'bg-emerald-50 text-emerald-500' : meeting.status === 'cancelled' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'} shadow-inner`}>
                                            <Calendar size={32} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    setEditingMeeting(meeting);
                                                    setShowEditModal(true);
                                                }}
                                                className="p-3 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"
                                            >
                                                <Edit3 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteMeeting(meeting.id)}
                                                className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            <div className="inline-block px-4 py-1.5 bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                                                {new Date(meeting.date).toLocaleDateString()} • {meeting.time || '10:00 AM'}
                                            </div>
                                            {meeting.type && (
                                                <div className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                                    {meeting.type}
                                                </div>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-black text-[#1E3A8A] font-noto leading-[1.3] line-clamp-2 h-[3.2rem]">{meeting.title}</h3>
                                        
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            <div className="flex items-center gap-2 bg-blue-50/50 py-2 px-4 rounded-full">
                                                <MapPin size={14} className="text-blue-500" />
                                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{meeting.venue || 'No Venue'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-50 py-2 px-4 rounded-full">
                                                <Users size={14} className="text-slate-400" />
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{meeting.departments?.name || 'All'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 mt-auto flex items-center justify-between border-t border-slate-50">
                                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                                        meeting.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                                        meeting.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 
                                        meeting.status === 'ongoing' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        {meeting.status}
                                    </div>
                                    
                                    <button 
                                        onClick={() => setSelectedMeeting(meeting)}
                                        className="flex items-center gap-2 text-[10px] font-black text-[#1E3A8A] uppercase tracking-widest hover:translate-x-2 transition-transform h-10 px-4 rounded-xl hover:bg-slate-50"
                                    >
                                        Manage <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {filteredMeetings.length === 0 && (
                            <div className="col-span-full py-24 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100 shadow-sm">
                                <ClipboardList size={64} className="mx-auto text-slate-100 mb-6" />
                                <h4 className="text-xl font-black text-slate-300 uppercase tracking-widest">No meetings recorded</h4>
                                <p className="text-slate-400 text-xs font-bold mt-2">Start by creating a new meeting to manage agendas and participation.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'minutes' && (
                 <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 transition-colors" size={20} />
                            <input 
                                type="text" 
                                placeholder="মিটিং খুঁজুন..."
                                className="w-full h-16 bg-white rounded-[2rem] pl-16 pr-6 font-black text-sm shadow-sm border border-slate-100 outline-none focus:border-blue-500 transition-all font-noto"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMeetings.map((meeting) => (
                            <div key={meeting.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 flex items-center justify-between group hover:border-emerald-200 hover:shadow-2xl transition-all h-32">
                                <div className="flex items-center gap-6">
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all ${meeting.minutes_content ? 'bg-emerald-50 text-emerald-500 shadow-emerald-100 shadow-lg' : 'bg-slate-50 text-slate-300'}`}>
                                        <ClipboardList size={32} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[#1E3A8A] font-noto text-lg leading-tight line-clamp-1">{meeting.title}</h4>
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">
                                            {new Date(meeting.date).toLocaleDateString()} • {meeting.departments?.name || 'সকল বিভাগ'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setEditingMinutes({ id: meeting.id, content: meeting.minutes_content || '' })}
                                    className="p-4 bg-slate-50 group-hover:bg-emerald-600 group-hover:text-white rounded-2xl transition-all shadow-sm hover:scale-110"
                                >
                                    <Edit3 size={24} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {editingMinutes && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[2000] flex items-center justify-center p-8">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white w-full max-w-6xl rounded-[4rem] p-16 shadow-2xl flex flex-col h-[90vh] border border-white/20"
                            >
                                <div className="flex items-center justify-between mb-12">
                                    <div className="flex items-center gap-8">
                                        <div className="p-6 rounded-[2rem] bg-emerald-50 text-emerald-500 shadow-xl shadow-emerald-500/10">
                                            <ClipboardList size={48} />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-black text-[#1E3A8A] font-noto leading-tight">মিটিং রেজুলেশন লিকার করুন</h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Professional Governance Protocol (PGP)</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setEditingMinutes(null)} className="text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 p-5 rounded-3xl hover:bg-rose-50"><X size={32} /></button>
                                </div>

                                <div className="flex-1 min-h-0 mb-12 relative group">
                                    <textarea 
                                        className="w-full h-full bg-slate-50/50 rounded-[3rem] p-16 font-black text-[#1E3A8A] text-xl outline-none border-2 border-transparent focus:border-emerald-200 focus:bg-white transition-all resize-none shadow-inner font-noto leading-[1.6]"
                                        placeholder="মিটিং এর আলোচ্য বিষয় এবং সিদ্ধান্তসমূহ এখানে বিস্তারিত লিখুন..."
                                        value={editingMinutes.content}
                                        onChange={(e) => setEditingMinutes({...editingMinutes, content: e.target.value})}
                                    />
                                    <div className="absolute bottom-12 right-12 flex items-center gap-3 bg-white/80 backdrop-blur-md px-6 py-3 rounded-full border border-slate-100 shadow-sm">
                                        <Sparkles size={20} className="text-amber-500" />
                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Enhanced with Organization Intelligence</span>
                                    </div>
                                </div>

                                <div className="flex gap-8">
                                    <button 
                                        onClick={() => setEditingMinutes(null)}
                                        className="px-14 py-7 bg-slate-100 text-slate-600 font-black rounded-[2rem] hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                                    >
                                        বাতিল (Cancel)
                                    </button>
                                    <button 
                                        onClick={handleUpdateMinutes}
                                        disabled={loading}
                                        className="flex-1 py-7 bg-emerald-600 text-white font-black rounded-[2rem] shadow-2xl shadow-emerald-900/20 flex items-center justify-center gap-4 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest text-sm"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <><Save size={28}/> রেজুলেশন সংরক্ষণ করুন (Save Protocol)</>}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
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
                    onGenerateMinutes={handleGenerateMinutes}
                    generatingMinutes={generatingMinutes}
                    onPrint={() => handlePrintMinutes(selectedMeeting)}
                    onAddAgenda={onAddAgenda}
                    onAddDecision={onAddDecision}
                    onDeleteAgenda={onDeleteAgenda}
                    onDeleteDecision={onDeleteDecision}
                    onToggleAgenda={onToggleAgenda}
                />
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[2000] flex items-center justify-center p-4 sm:p-6">
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="bg-white w-full max-w-xl rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-12 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
                    >
                         <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-[100px] -mr-24 -mt-24 opacity-50" />
                         <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6 sm:mb-10">
                                <div>
                                    <h3 className="text-xl sm:text-3xl font-black text-[#1E3A8A] font-noto">নতুন মিটিং তৈরি করুন</h3>
                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 sm:mt-2">Initialize Organization Protocol</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="text-slate-300 hover:text-rose-500 transition-all p-2 sm:p-4 bg-slate-50 rounded-2xl sm:rounded-3xl hover:bg-rose-50"><X size={24} className="sm:w-8 sm:h-8" /></button>
                            </div>
                            
                            <div className="space-y-4 sm:space-y-6">
                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Title</label>
                                    <input 
                                        className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-base sm:text-lg text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white"
                                        placeholder="Enter Meeting Title..."
                                        value={newMeeting.title}
                                        onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-2">
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Type</label>
                                        <select 
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm cursor-pointer appearance-none"
                                            value={newMeeting.type}
                                            onChange={(e) => setNewMeeting({...newMeeting, type: e.target.value})}
                                        >
                                            <option value="General">General (সাধারণ)</option>
                                            <option value="Executive">Executive (কার্যনির্বাহী)</option>
                                            <option value="Emergency">Emergency (জরুরী)</option>
                                            <option value="Annual">Annual (বার্ষিক)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Audience/Dept</label>
                                        <select 
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white appearance-none cursor-pointer text-sm"
                                            value={newMeeting.department_id || ''}
                                            onChange={(e) => setNewMeeting({...newMeeting, department_id: e.target.value})}
                                        >
                                            <option value="">সকল সদস্য (General Member)</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-2">
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Date</label>
                                        <input 
                                            type="date"
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm"
                                            value={newMeeting.date}
                                            onChange={(e) => setNewMeeting({...newMeeting, date: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</label>
                                        <input 
                                            type="time"
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm"
                                            value={newMeeting.time}
                                            onChange={(e) => setNewMeeting({...newMeeting, time: e.target.value})}
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Venue / Location</label>
                                    <input 
                                        className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm"
                                        placeholder="Meeting Hall, Zoom, Offices..."
                                        value={newMeeting.venue}
                                        onChange={(e) => setNewMeeting({...newMeeting, venue: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Description (বিবরণ)</label>
                                    <textarea 
                                        className="w-full h-24 bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 font-bold text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm resize-none"
                                        placeholder="Meeting context..."
                                        value={newMeeting.description}
                                        onChange={(e) => setNewMeeting({...newMeeting, description: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Agenda (আলোচ্য বিষয়)</label>
                                    <textarea 
                                        className="w-full h-24 bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 font-bold text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm resize-none"
                                        placeholder="List agenda items here..."
                                        value={newMeeting.agenda}
                                        onChange={(e) => setNewMeeting({...newMeeting, agenda: e.target.value})}
                                    />
                                </div>

                                <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50 space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles size={14} /> Notification & Protocol
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={newMeeting.notify_members}
                                                onChange={(e) => setNewMeeting({...newMeeting, notify_members: e.target.checked})}
                                                className="w-5 h-5 rounded-lg border-2 border-blue-200 text-blue-600 focus:ring-blue-500 transition-all"
                                            />
                                            <span className="text-[11px] font-bold text-blue-900">Notify Members (সদস্যদের জানান)</span>
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={newMeeting.require_attendance}
                                                onChange={(e) => setNewMeeting({...newMeeting, require_attendance: e.target.checked})}
                                                className="w-5 h-5 rounded-lg border-2 border-blue-200 text-blue-600 focus:ring-blue-500 transition-all"
                                            />
                                            <span className="text-[11px] font-bold text-blue-900">Require Attendance (উপস্থিতি প্রয়োজন)</span>
                                        </label>
                                    </div>

                                    {newMeeting.notify_members && (
                                        <div className="pt-2 flex flex-wrap gap-4 border-t border-blue-100 mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={newMeeting.send_sms}
                                                    onChange={(e) => setNewMeeting({...newMeeting, send_sms: e.target.checked})}
                                                    className="w-4 h-4 rounded border-blue-200"
                                                />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Send SMS</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={newMeeting.send_voice}
                                                    onChange={(e) => setNewMeeting({...newMeeting, send_voice: e.target.checked})}
                                                    className="w-4 h-4 rounded border-blue-200"
                                                />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Send Voice Call</span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleCreateMeeting}
                                    disabled={loading || !newMeeting.title}
                                    className="w-full py-5 sm:py-7 bg-blue-600 text-white font-black rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-blue-900/20 flex items-center justify-center gap-4 mt-4 sm:mt-6 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest text-[10px] sm:text-xs"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <><Plus size={24}/> Initialize Meeting</>}
                                </button>
                            </div>
                         </div>
                    </motion.div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingMeeting && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[2000] flex items-center justify-center p-4 sm:p-6">
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="bg-white w-full max-w-xl rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-12 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
                    >
                         <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-[100px] -mr-24 -mt-24 opacity-50" />
                         <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6 sm:mb-10">
                                <div>
                                    <h3 className="text-xl sm:text-3xl font-black text-[#1E3A8A] font-noto">মিটিং সংশোধন করুন</h3>
                                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 sm:mt-2">Update Organization Protocol</p>
                                </div>
                                <button onClick={() => setShowEditModal(false)} className="text-slate-300 hover:text-rose-500 transition-all p-2 sm:p-4 bg-slate-50 rounded-2xl sm:rounded-3xl hover:bg-rose-50"><X size={24} className="sm:w-8 sm:h-8" /></button>
                            </div>
                            
                            <div className="space-y-4 sm:space-y-6">
                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Title</label>
                                    <input 
                                        className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-base sm:text-lg text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white"
                                        placeholder="Enter Meeting Title..."
                                        value={editingMeeting.title}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, title: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-2">
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Type</label>
                                        <select 
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm cursor-pointer appearance-none"
                                            value={editingMeeting.type || 'General'}
                                            onChange={(e) => setEditingMeeting({...editingMeeting, type: e.target.value})}
                                        >
                                            <option value="General">General (সাধারণ)</option>
                                            <option value="Executive">Executive (কার্যনির্বাহী)</option>
                                            <option value="Emergency">Emergency (জরুরী)</option>
                                            <option value="Annual">Annual (বার্ষিক)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Audience/Dept</label>
                                        <select 
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white appearance-none cursor-pointer text-sm"
                                            value={editingMeeting.department_id || ''}
                                            onChange={(e) => setEditingMeeting({...editingMeeting, department_id: e.target.value})}
                                        >
                                            <option value="">সকল সদস্য (General Member)</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-2">
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Date</label>
                                        <input 
                                            type="date"
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm"
                                            value={editingMeeting.date}
                                            onChange={(e) => setEditingMeeting({...editingMeeting, date: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</label>
                                        <input 
                                            type="time"
                                            className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm"
                                            value={editingMeeting.time || ''}
                                            onChange={(e) => setEditingMeeting({...editingMeeting, time: e.target.value})}
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Venue / Location</label>
                                    <input 
                                        className="w-full h-12 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl px-5 sm:px-6 font-black text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm"
                                        placeholder="Meeting Hall, Zoom, Offices..."
                                        value={editingMeeting.venue || ''}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, venue: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Description (বিবরণ)</label>
                                    <textarea 
                                        className="w-full h-24 bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 font-bold text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm resize-none"
                                        placeholder="Meeting context..."
                                        value={editingMeeting.description || ''}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, description: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2 px-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Agenda (আলোচ্য বিষয়)</label>
                                    <textarea 
                                        className="w-full h-24 bg-slate-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 font-bold text-[#1E3A8A] outline-none border-2 border-transparent focus:border-blue-100 transition-all focus:bg-white text-sm resize-none"
                                        placeholder="List agenda items here..."
                                        value={editingMeeting.agenda || ''}
                                        onChange={(e) => setEditingMeeting({...editingMeeting, agenda: e.target.value})}
                                    />
                                </div>

                                <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50 space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles size={14} /> Notification & Protocol
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={!!editingMeeting.notify_members}
                                                onChange={(e) => setEditingMeeting({...editingMeeting, notify_members: e.target.checked})}
                                                className="w-5 h-5 rounded-lg border-2 border-blue-200 text-blue-600 focus:ring-blue-500 transition-all"
                                            />
                                            <span className="text-[11px] font-bold text-blue-900">Notify Members (সদস্যদের জানান)</span>
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={!!editingMeeting.require_attendance}
                                                onChange={(e) => setEditingMeeting({...editingMeeting, require_attendance: e.target.checked})}
                                                className="w-5 h-5 rounded-lg border-2 border-blue-200 text-blue-600 focus:ring-blue-500 transition-all"
                                            />
                                            <span className="text-[11px] font-bold text-blue-900">Require Attendance (উপস্থিতি প্রয়োজন)</span>
                                        </label>
                                    </div>

                                    {editingMeeting.notify_members && (
                                        <div className="pt-2 flex flex-wrap gap-4 border-t border-blue-100 mt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={!!editingMeeting.send_sms}
                                                    onChange={(e) => setEditingMeeting({...editingMeeting, send_sms: e.target.checked})}
                                                    className="w-4 h-4 rounded border-blue-200"
                                                />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Send SMS</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox"
                                                    checked={!!editingMeeting.send_voice}
                                                    onChange={(e) => setEditingMeeting({...editingMeeting, send_voice: e.target.checked})}
                                                    className="w-4 h-4 rounded border-blue-200"
                                                />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Send Voice Call</span>
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleUpdateMeeting}
                                    disabled={loading || !editingMeeting.title}
                                    className="w-full py-5 sm:py-7 bg-blue-600 text-white font-black rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-blue-900/20 flex items-center justify-center gap-4 mt-4 sm:mt-6 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest text-[10px] sm:text-xs"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <><Save size={24}/> Update Meeting Strategy</>}
                                </button>
                            </div>
                         </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default StandardMeetingEngine;
