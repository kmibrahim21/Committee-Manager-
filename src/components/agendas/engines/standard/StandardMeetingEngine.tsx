
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../supabase';
import { Institution, Language, UserRole, Profile, Department, Member } from '../../../../types';
import { 
    Users, Calendar, FileText, Plus, Search, 
    ChevronRight, Loader2, AlertCircle, Save, X, 
    Download, Trash2, Edit3, ClipboardList 
} from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<'meetings' | 'minutes'>('meetings');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newMeeting, setNewMeeting] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        department_id: '',
        description: ''
    });

    useEffect(() => {
        if (madrasah) {
            fetchInitialData();
        }
    }, [madrasah]);

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
            const { data, error } = await supabase
                .from('meetings')
                .insert([{
                    ...newMeeting,
                    institution_id: madrasah.id,
                    status: 'planned'
                }]);
            
            if (error) throw error;
            setShowAddModal(false);
            fetchInitialData();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Error creating meeting');
        } finally {
            setLoading(false);
        }
    };

    const isDark = madrasah?.theme === 'dark';

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
            <div className="flex items-center justify-between">
                <div>
                   <h2 className="text-2xl font-black text-[#1E3A8A] font-noto">মিটিং ও এজেন্ডা (Meetings)</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Standard Meeting Management</p>
                </div>
                <button 
                   onClick={() => setShowAddModal(true)}
                   className="p-4 bg-[#2563EB] text-white rounded-2xl shadow-premium active:scale-95 transition-all hover:bg-blue-600 flex items-center gap-2"
                >
                   <Plus size={20} strokeWidth={3} />
                   <span className="font-black text-sm">নতুন মিটিং</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                <button 
                  onClick={() => setActiveTab('meetings')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'meetings' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                >
                   মিটিং তালিকা
                </button>
                <button 
                  onClick={() => setActiveTab('minutes')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'minutes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                >
                   মিনিটস ও রেজাল্ট
                </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {meetings.map((meeting) => (
                    <div key={meeting.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl">
                                <Calendar size={24} />
                            </div>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${meeting.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                                {meeting.status}
                            </span>
                        </div>
                        <h3 className="text-lg font-black text-[#1E3A8A] font-noto mb-1">{meeting.title}</h3>
                        <p className="text-xs text-slate-400 font-bold flex items-center gap-2">
                           <Users size={14} /> {meeting.departments?.name || 'All Departments'}
                        </p>
                        <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                {new Date(meeting.date).toLocaleDateString()}
                            </div>
                            <button className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                ))}

                {meetings.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100">
                        <ClipboardList size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-black uppercase tracking-widest">কোনো মিটিং পাওয়া যায়নি</p>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-[#1E3A8A] font-noto">নতুন মিটিং তৈরি করুন</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-300"><X /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">মিটিং টাইটেল</label>
                                <input 
                                   className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-bold outline-none border-2 border-transparent focus:border-blue-100 transition-all"
                                   placeholder="Title..."
                                   value={newMeeting.title}
                                   onChange={(e) => setNewMeeting({...newMeeting, title: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">তারিখ</label>
                                <input 
                                   type="date"
                                   className="w-full h-14 bg-slate-50 rounded-2xl px-6 font-bold outline-none border-2 border-transparent focus:border-blue-100 transition-all"
                                   value={newMeeting.date}
                                   onChange={(e) => setNewMeeting({...newMeeting, date: e.target.value})}
                                />
                            </div>
                            <button 
                                onClick={handleCreateMeeting}
                                disabled={loading || !newMeeting.title}
                                className="w-full py-5 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <><Save size={20}/> সংরক্ষণ করুন</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StandardMeetingEngine;
