
import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, Loader2, X, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from 'supabase';
import { Language, Institution } from 'types';

interface MemberType {
    id: string;
    name: string;
}

interface MemberTypeManagerProps {
    institution: Institution;
    onClose: () => void;
    lang: Language;
}

export const MemberTypeManager: React.FC<MemberTypeManagerProps> = ({ institution, onClose, lang }) => {
    const [types, setTypes] = useState<MemberType[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    const isDark = institution.theme === 'dark';

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('member_types')
                .select('*')
                .eq('institution_id', institution.id)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setTypes(data || []);
        } catch (e) {
            console.error('Error fetching member types:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('member_types')
                .insert([{ institution_id: institution.id, name: newName.trim() }]);
            if (error) throw error;
            setNewName('');
            fetchTypes();
        } catch (e: any) {
            alert(e.message || 'Error adding member type');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি এটি ডিলিট করতে চান?' : 'Are you sure you want to delete this?')) return;
        
        try {
            const { error } = await supabase
                .from('member_types')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchTypes();
        } catch (e: any) {
            alert(e.message || 'Error deleting member type');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[3000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
            <div className={`w-full max-w-md rounded-[3rem] p-6 sm:p-8 shadow-2xl relative animate-in zoom-in-95 duration-500 overflow-hidden ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white'}`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-[#0fb5ab]/10 text-[#42f5e9]' : 'bg-[#e0fdfb] text-[#0fb5ab]'}`}>
                            <Layers size={24} />
                        </div>
                        <div>
                            <h3 className={`text-xl font-black font-noto tracking-tight ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                                {lang === 'bn' ? 'সদস্য ধরন ম্যানেজার' : 'Member Type Manager'}
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                {lang === 'bn' ? 'কাস্টম ক্যাটাগরি তৈরি করুন' : 'Manage Custom Categories'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDark ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-50 text-slate-300 hover:text-slate-600'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Input Area */}
                <div className="space-y-4 mb-8">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {lang === 'bn' ? 'নতুন ধরনের নাম' : 'New Type Name'}
                        </label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={lang === 'bn' ? 'যেমন: আজীবন সদস্য' : 'e.g. Life Member'}
                                className={`flex-1 h-12 px-5 rounded-2xl font-black text-sm outline-none border-2 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-[#42f5e9]/30' : 'bg-slate-50 border-slate-100 text-[#0fb5ab] focus:border-[#42f5e9]/30'}`}
                            />
                            <button 
                                onClick={handleAdd}
                                disabled={saving || !newName.trim()}
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90 ${saving || !newName.trim() ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-[#42f5e9] text-[#0fb5ab] shadow-[#42f5e9]/20 hover:scale-105'}`}
                            >
                                {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Area */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                        <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 size={32} className="animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Loading types...</p>
                        </div>
                    ) : types.length === 0 ? (
                        <div className="py-10 text-center space-y-3">
                            <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mx-auto">
                                <Layers size={32} />
                            </div>
                            <p className="text-xs font-bold text-slate-400">
                                {lang === 'bn' ? 'কোন কাস্টম ধরন নেই' : 'No custom types found'}
                            </p>
                        </div>
                    ) : (
                        types.map((type) => (
                            <div 
                                key={type.id}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-[#0fb5ab]" />
                                    <span className={`font-black text-sm font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{type.name}</span>
                                </div>
                                <button 
                                    onClick={() => handleDelete(type.id)}
                                    className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-all border border-rose-100/50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className={`mt-8 p-4 rounded-2xl flex items-start gap-3 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                    <AlertTriangle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-blue-500/80 leading-relaxed uppercase tracking-wider">
                        {lang === 'bn' ? 'এগুলো নতুন সদস্য পোর্টালে ড্রপডাউন হিসেবে শো করবে।' : 'These will appear in the dropdown when adding new members.'}
                    </p>
                </div>
            </div>
        </div>
    );
};
