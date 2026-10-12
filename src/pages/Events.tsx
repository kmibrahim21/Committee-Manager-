
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Calendar, MapPin, User, Clock, 
  MoreVertical, Edit2, Trash2, ChevronLeft, 
  Filter, X, AlertCircle, Loader2, CalendarDays,
  Sparkles, Megaphone, CheckCircle2, History,
  LayoutGrid, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Language, Institution, Event, Department } from '../types';
import { format } from 'date-fns';

interface EventsPageProps {
  lang: Language;
  onBack: () => void;
  madrasah: Institution | null;
  role: string;
}

const EventsPage: React.FC<EventsPageProps> = ({ lang, onBack, madrasah, role }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    description: '',
    venue: '',
    event_type: 'General',
    start_date: new Date().toISOString(),
    end_date: '',
    organizer: '',
    guest_name: '',
    status: 'planned',
    department_id: undefined
  });

  const isDark = madrasah?.theme === 'dark';

  useEffect(() => {
    if (madrasah?.id) {
      fetchEvents();
      fetchDepartments();
    }
  }, [madrasah]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`*, departments(name)`)
        .eq('institution_id', madrasah?.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('institution_id', madrasah?.id)
        .order('name');
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.start_date) return;
    
    try {
      setLoading(true);
      const { error } = await supabase.from('events').insert({
        ...newEvent,
        institution_id: madrasah?.id,
      });

      if (error) throw error;
      
      setShowAddModal(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !editingEvent.title || !editingEvent.start_date) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('events')
        .update({
          title: editingEvent.title,
          description: editingEvent.description,
          venue: editingEvent.venue,
          event_type: editingEvent.event_type,
          start_date: editingEvent.start_date,
          end_date: editingEvent.end_date,
          organizer: editingEvent.organizer,
          guest_name: editingEvent.guest_name,
          status: editingEvent.status,
          department_id: editingEvent.department_id || null
        })
        .eq('id', editingEvent.id);

      if (error) throw error;
      setEditingEvent(null);
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      fetchEvents();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const resetForm = () => {
    setNewEvent({
      title: '',
      description: '',
      venue: '',
      event_type: 'General',
      start_date: new Date().toISOString(),
      end_date: '',
      organizer: '',
      guest_name: '',
      status: 'planned',
      department_id: undefined
    });
  };

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         e.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || e.event_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const eventTypes = ['General', 'Meeting', 'Seminar', 'Cultural', 'Religious', 'Exam', 'Holiday', 'Other'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/20';
      case 'ongoing': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'completed': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'cancelled': return 'bg-rose-100 text-rose-600 border-rose-200';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-40 px-6 py-5 border-b backdrop-blur-md flex items-center justify-between ${
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-100'
      }`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`p-3 rounded-2xl active:scale-95 transition-all ${
            isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400'
          }`}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black font-noto tracking-tight">
              {lang === 'bn' ? 'ইভেন্ট ম্যানেজমেন্ট' : 'Event Management'}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
               {madrasah?.name} Protocol
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-[#42f5e9] text-[#0e8a84] rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">{lang === 'bn' ? 'নতুন ইভেন্ট' : 'Create Event'}</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Statistics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {[
               { label: lang === 'bn' ? 'আসন্ন' : 'Upcoming', count: events.filter(e => e.status === 'planned').length, icon: <Sparkles className="text-[#0fb5ab]" /> },
               { label: lang === 'bn' ? 'চলমান' : 'Ongoing', count: events.filter(e => e.status === 'ongoing').length, icon: <Megaphone className="text-amber-500" /> },
               { label: lang === 'bn' ? 'সম্পন্ন' : 'Completed', count: events.filter(e => e.status === 'completed').length, icon: <CheckCircle2 className="text-emerald-500" /> },
               { label: lang === 'bn' ? 'মোট' : 'Total', count: events.length, icon: <History className="text-slate-500" /> }
             ].map((stat, i) => (
             <div key={i} className={`p-4 rounded-[2rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} flex items-center gap-4`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  {stat.icon}
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                   <h4 className="text-xl font-black">{stat.count}</h4>
                </div>
             </div>
           ))}
        </div>

        {/* Search & Filters */}
        <div className={`p-4 rounded-3xl border flex flex-col md:flex-row items-center gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={lang === 'bn' ? 'ইভেন্ট খুঁজুন...' : 'Search events...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-12 pr-6 py-4 rounded-2xl outline-none border-2 transition-all font-bold text-sm ${
                isDark ? 'bg-slate-800 border-transparent focus:border-[#42f5e9] text-white' : 'bg-slate-50 border-transparent focus:border-[#42f5e9]/10 text-slate-700'
              }`}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
             <select 
               value={filterType}
               onChange={(e) => setFilterType(e.target.value)}
               className={`flex-1 md:w-48 px-4 py-4 rounded-2xl outline-none font-black text-xs uppercase tracking-widest ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}
             >
                <option value="all">{lang === 'bn' ? 'সকল ধরন' : 'All Types'}</option>
                {eventTypes.map(t => <option key={t} value={t}>{lang === 'bn' ? (
                  t === 'General' ? 'সাধারণ' : 
                  t === 'Meeting' ? 'মিটিং' : 
                  t === 'Seminar' ? 'সেমিনার' : 
                  t === 'Cultural' ? 'সাংস্কৃতিক' : 
                  t === 'Religious' ? 'ধর্মীয়' : 
                  t === 'Exam' ? 'পরীক্ষা' : 
                  t === 'Holiday' ? 'ছুটি' : 'অন্যান্য'
                ) : t}</option>)}
             </select>

             <div className={`flex p-1 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                 <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? (isDark ? 'bg-slate-700 text-[#42f5e9]' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? (isDark ? 'bg-slate-700 text-[#42f5e9]' : 'bg-white text-[#0fb5ab] shadow-sm') : 'text-slate-400'}`}
                >
                  <List size={18} />
                </button>
             </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
             <Loader2 className="animate-spin text-[#0fb5ab]" size={40} />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing Protocol...</p>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
             {filteredEvents.map((event) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={event.id}
                  className={`group rounded-[2.5rem] border overflow-hidden transition-all hover:shadow-2xl hover:shadow-[#42f5e9]/10 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  }`}
                >
                  <div className="p-8 space-y-6">
                    <div className="flex items-start justify-between">
                       <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(event.status)}`}>
                          {lang === 'bn' ? (
                            event.status === 'planned' ? 'আসন্ন' :
                            event.status === 'ongoing' ? 'চলমান' :
                            event.status === 'completed' ? 'সম্পন্ন' :
                            event.status === 'cancelled' ? 'বাতিল' : event.status
                          ) : event.status}
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setEditingEvent(event); }} 
                           className={`p-2 rounded-lg border transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-slate-50 hover:bg-blue-50 border-slate-100'}`}
                           title={lang === 'bn' ? 'এডিট করুন' : 'Edit Event'}
                         >
                           <Edit2 size={16} className="text-[#0fb5ab]" />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(event.id); }} 
                           className={`p-2 rounded-lg border transition-all ${isDark ? 'bg-slate-800 hover:bg-rose-950/40 border-slate-700' : 'bg-rose-50 hover:bg-rose-100 border-rose-100'}`}
                           title={lang === 'bn' ? 'ডিলিট করুন' : 'Delete Event'}
                         >
                           <Trash2 size={16} className="text-rose-500" />
                         </button>
                       </div>
                    </div>

                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                         {lang === 'bn' ? (
                           event.event_type === 'General' ? 'সাধারণ' : 
                           event.event_type === 'Meeting' ? 'মিটিং' : 
                           event.event_type === 'Seminar' ? 'সেমিনার' : 
                           event.event_type === 'Cultural' ? 'সাংস্কৃতিক' : 
                           event.event_type === 'Religious' ? 'ধর্মীয়' : 
                           event.event_type === 'Exam' ? 'পরীক্ষা' : 
                           event.event_type === 'Holiday' ? 'ছুটি' : event.event_type
                         ) : event.event_type}
                       </p>
                       <h3 className="text-xl font-black leading-tight line-clamp-2">{event.title}</h3>
                    </div>

                    <div className="space-y-3 pt-2">
                       <div className="flex items-center gap-3 text-slate-500">
                          <Calendar size={16} className="text-[#0fb5ab] flex-shrink-0" />
                          <span className="text-[11px] font-bold">
                            {format(new Date(event.start_date), 'EEE, dd MMM yyyy • hh:mm a')}
                          </span>
                       </div>
                       {event.venue && (
                         <div className="flex items-center gap-3 text-slate-500">
                            <MapPin size={16} className="text-rose-400 flex-shrink-0" />
                            <span className="text-[11px] font-bold truncate">{event.venue}</span>
                         </div>
                       )}
                       {event.guest_name && (
                         <div className="flex items-center gap-3 text-slate-500">
                            <User size={16} className="text-emerald-400 flex-shrink-0" />
                            <span className="text-[11px] font-bold truncate">{event.guest_name}</span>
                         </div>
                       )}
                    </div>

                    {event.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 italic">"{event.description}"</p>
                    )}

                    <div className={`pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-50'} flex items-center justify-between`}>
                       <div className="flex -space-x-2">
                          <div className={`w-8 h-8 rounded-full border-2 ${isDark ? 'bg-slate-800 border-slate-900' : 'bg-slate-100 border-white'} flex items-center justify-center text-[10px] font-black`}>M</div>
                          <div className={`w-8 h-8 rounded-full border-2 ${isDark ? 'bg-slate-700 border-slate-900' : 'bg-slate-200 border-white'} flex items-center justify-center text-[10px] font-black`}>A</div>
                          <div className={`w-8 h-8 rounded-full border-2 ${isDark ? 'bg-slate-600 border-slate-900' : 'bg-slate-300 border-white'} flex items-center justify-center text-[10px] font-black`}>+</div>
                       </div>
                       <button className="text-[10px] font-black text-[#0fb5ab] uppercase tracking-widest hover:underline">{lang === 'bn' ? 'বিস্তারিত দেখুন' : 'View Details'}</button>
                    </div>
                  </div>
                </motion.div>
             ))}
          </div>
        ) : (
          <div className="h-96 flex flex-col items-center justify-center text-center p-8">
             <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${isDark ? 'bg-slate-900' : 'bg-[#42f5e9]/10'}`}>
                <CalendarDays size={40} className="text-[#0fb5ab]/40" />
             </div>
             <h3 className="text-xl font-black mb-2">{lang === 'bn' ? 'কোনো ইভেন্ট পাওয়া যায়নি' : 'No Events Found'}</h3>
             <p className="text-slate-400 text-sm max-w-xs">{lang === 'bn' ? 'আপনার প্রতিষ্ঠানের ইভেন্ট যোগ করে শুরু করুন।' : 'Start building your organization strategy by adding your first event protocol.'}</p>
          </div>
        )}
      </div>

      {/* Modals Portaled */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <AnimatePresence>
            {showAddModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
                isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between p-8 border-b border-transparent shrink-0">
                <h3 className="text-2xl font-black font-noto">{lang === 'bn' ? 'নতুন ইভেন্ট যোগ করুন' : 'Create New Event'}</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 flex-1 overflow-y-auto space-y-6 max-h-[60vh]">
                 {/* Title */}
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'ইভেন্টের শিরোনাম' : 'Event Title'}</label>
                     <input 
                      placeholder={lang === 'bn' ? 'গ্র্যান্ড সেমিনার ২০২৪...' : 'Grand Seminar 2024...'}
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                      className={`w-full h-14 rounded-2xl px-6 font-bold outline-none border-2 transition-all ${
                        isDark ? 'bg-slate-800 border-transparent focus:border-[#42f5e9]' : 'bg-slate-50 border-transparent focus:border-[#42f5e9]/20'
                      }`}
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'ধরন' : 'Type'}</label>
                      <select 
                        value={newEvent.event_type}
                        onChange={(e) => setNewEvent({...newEvent, event_type: e.target.value})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      >
                         {eventTypes.map(t => <option key={t} value={t}>{lang === 'bn' ? (
                          t === 'General' ? 'সাধারণ' : 
                          t === 'Meeting' ? 'মিটিং' : 
                          t === 'Seminar' ? 'সেমিনার' : 
                          t === 'Cultural' ? 'সাংস্কৃতিক' : 
                          t === 'Religious' ? 'ধর্মীয়' : 
                          t === 'Exam' ? 'পরীক্ষা' : 
                          t === 'Holiday' ? 'ছুটি' : 'অন্যান্য'
                        ) : t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</label>
                      <select 
                        value={newEvent.status}
                        onChange={(e) => setNewEvent({...newEvent, status: e.target.value as any})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      >
                         <option value="planned">{lang === 'bn' ? 'আসন্ন (Planned)' : 'Planned (আসন্ন)'}</option>
                         <option value="ongoing">{lang === 'bn' ? 'চলমান (Ongoing)' : 'Ongoing (চলমান)'}</option>
                         <option value="completed">{lang === 'bn' ? 'সম্পন্ন (Completed)' : 'Completed (সম্পন্ন)'}</option>
                         <option value="cancelled">{lang === 'bn' ? 'বাতিল (Cancelled)' : 'Cancelled (বাতিল)'}</option>
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'শুরুর তারিখ ও সময়' : 'Start Date & Time'}</label>
                      <input 
                        type="datetime-local"
                        value={newEvent.start_date?.slice(0, 16)}
                        onChange={(e) => setNewEvent({...newEvent, start_date: new Date(e.target.value).toISOString()})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'শেষের তারিখ (ঐচ্ছিক)' : 'End Date (Optional)'}</label>
                      <input 
                        type="datetime-local"
                        value={newEvent.end_date?.slice(0, 16)}
                        onChange={(e) => setNewEvent({...newEvent, end_date: new Date(e.target.value).toISOString()})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'স্থান/লোকেশন' : 'Venue / Location'}</label>
                       <input 
                         placeholder={lang === 'bn' ? 'মেইন অডিটোরিয়াম...' : 'Main Auditorium...'}
                         value={newEvent.venue}
                         onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
                         className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'গেস্টের নাম' : 'Select Guest/Guest Name'}</label>
                       <input 
                         placeholder={lang === 'bn' ? 'প্রধান অতিথির নাম...' : 'Chief Guest Name...'}
                         value={newEvent.guest_name}
                         onChange={(e) => setNewEvent({...newEvent, guest_name: e.target.value})}
                         className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'বিস্তারিত তথ্য' : 'Description / Details'}</label>
                    <textarea 
                      placeholder={lang === 'bn' ? 'ইভেন্টের বিস্তারিত...' : 'Protocol description...'}
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                      className={`w-full h-24 rounded-2xl p-6 font-bold outline-none resize-none ${isDark ? 'bg-slate-800 border-transparent' : 'bg-slate-50 border-transparent'}`}
                    />
                 </div>
              </div>

              <div className="p-8 border-t border-slate-50/10">
                 <button 
                   onClick={handleCreateEvent}
                   disabled={loading || !newEvent.title}
                   className="w-full py-6 bg-[#42f5e9] text-[#0e8a84] rounded-[2rem] font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                 >
                   {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={18} /> {lang === 'bn' ? 'ইভেন্ট তৈরি করুন' : 'Initialize Event Protocol'}</>}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Edit Modal */}
        {editingEvent && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingEvent(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
                isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between p-8 border-b border-transparent shrink-0">
                <h3 className="text-2xl font-black font-noto">{lang === 'bn' ? 'ইভেন্ট এডিট করুন' : 'Edit Event'}</h3>
                <button onClick={() => setEditingEvent(null)} className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 flex-1 overflow-y-auto space-y-6 max-h-[60vh]">
                 {/* Title */}
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'ইভেন্টের শিরোনাম' : 'Event Title'}</label>
                     <input 
                      value={editingEvent.title || ''}
                      onChange={(e) => setEditingEvent({...editingEvent, title: e.target.value})}
                      className={`w-full h-14 rounded-2xl px-6 font-bold outline-none border-2 transition-all ${
                        isDark ? 'bg-slate-800 border-transparent focus:border-[#42f5e9]' : 'bg-slate-50 border-transparent focus:border-[#42f5e9]/20'
                      }`}
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'ধরন' : 'Type'}</label>
                      <select 
                        value={editingEvent.event_type}
                        onChange={(e) => setEditingEvent({...editingEvent, event_type: e.target.value as any})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      >
                         {eventTypes.map(t => <option key={t} value={t}>{lang === 'bn' ? (
                          t === 'General' ? 'সাধারণ' : 
                          t === 'Meeting' ? 'মিটিং' : 
                          t === 'Seminar' ? 'সেমিনার' : 
                          t === 'Cultural' ? 'সাংস্কৃতিক' : 
                          t === 'Religious' ? 'ধর্মীয়' : 
                          t === 'Exam' ? 'পরীক্ষা' : 
                          t === 'Holiday' ? 'ছুটি' : 'অন্যান্য'
                        ) : t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</label>
                      <select 
                        value={editingEvent.status}
                        onChange={(e) => setEditingEvent({...editingEvent, status: e.target.value as any})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      >
                         <option value="planned">{lang === 'bn' ? 'আসন্ন (Planned)' : 'Planned'}</option>
                         <option value="ongoing">{lang === 'bn' ? 'চলমান (Ongoing)' : 'Ongoing'}</option>
                         <option value="completed">{lang === 'bn' ? 'সম্পন্ন (Completed)' : 'Completed'}</option>
                         <option value="cancelled">{lang === 'bn' ? 'বাতিল (Cancelled)' : 'Cancelled'}</option>
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'শুরুর তারিখ ও সময়' : 'Start Date & Time'}</label>
                      <input 
                        type="datetime-local"
                        value={editingEvent.start_date?.slice(0, 16)}
                        onChange={(e) => setEditingEvent({...editingEvent, start_date: new Date(e.target.value).toISOString()})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'শেষের তারিখ (ঐচ্ছিক)' : 'End Date (Optional)'}</label>
                      <input 
                        type="datetime-local"
                        value={editingEvent.end_date ? editingEvent.end_date.slice(0, 16) : ''}
                        onChange={(e) => setEditingEvent({...editingEvent, end_date: e.target.value ? new Date(e.target.value).toISOString() : ''})}
                        className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                      />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'স্থান/লোকেশন' : 'Venue / Location'}</label>
                       <input 
                         value={editingEvent.venue || ''}
                         onChange={(e) => setEditingEvent({...editingEvent, venue: e.target.value})}
                         className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'গেস্টের নাম' : 'Select Guest/Guest Name'}</label>
                       <input 
                         value={editingEvent.guest_name || ''}
                         onChange={(e) => setEditingEvent({...editingEvent, guest_name: e.target.value})}
                         className={`w-full h-14 rounded-2xl px-6 font-bold outline-none ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{lang === 'bn' ? 'বিস্তারিত তথ্য' : 'Description / Details'}</label>
                    <textarea 
                      value={editingEvent.description || ''}
                      onChange={(e) => setEditingEvent({...editingEvent, description: e.target.value})}
                      className={`w-full h-24 rounded-2xl p-6 font-bold outline-none resize-none ${isDark ? 'bg-slate-800 border-transparent' : 'bg-slate-50 border-transparent'}`}
                    />
                 </div>
              </div>

              <div className="p-8 border-t border-slate-50/10">
                 <button 
                   onClick={handleUpdateEvent}
                   disabled={loading || !editingEvent.title}
                   className="w-full py-6 bg-[#42f5e9] text-[#0e8a84] rounded-[2rem] font-black shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                 >
                   {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={18} /> {lang === 'bn' ? 'ইভেন্ট আপডেট করুন' : 'Update Event Protocol'}</>}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
           <div className={`relative w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-6 mx-auto">
                 <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-center mb-2">{lang === 'bn' ? 'ইভেন্ট ডিলিট করবেন?' : 'Delete Protocol?'}</h3>
              <p className="text-slate-400 text-sm font-bold text-center mb-8">{lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি এই ইভেন্টটি ডিলিট করতে চান?' : 'Are you sure you want to permanently erase this event from the neural registers?'}</p>
              <div className="flex gap-3">
                 <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest">{lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                 <button onClick={() => handleDeleteEvent(showDeleteConfirm)} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-rose-200">{lang === 'bn' ? 'ডিলিট করুন' : 'Erase Data'}</button>
              </div>
           </div>
        </div>
      )}
        </>,
        document.body
      )}
    </div>
  );
};

export default EventsPage;
