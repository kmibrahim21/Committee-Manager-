
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, Edit3, User as UserIcon, Smartphone, PhoneCall, 
  UserCheck, MessageCircle, Hash, BookOpen, Phone, Trash2, 
  AlertTriangle, Loader2, X, MapPin, Calendar, Briefcase, 
  Dna, CreditCard, Share2, MoreHorizontal, GraduationCap, Camera,
  PiggyBank, Coins
} from 'lucide-react';
import { Member, Language, Institution } from 'types';
import { supabase } from 'supabase';
import { t } from 'translations';
import { compressAndUploadMemberPhoto } from '../utils/imageUpload';

interface StudentDetailsProps {
  student: Member;
  madrasah: Institution | null;
  onEdit: () => void;
  onBack: () => void;
  lang: Language;
  readOnly?: boolean;
  institutionId?: string;
  triggerRefresh?: () => void;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, madrasah, onEdit, onBack, lang, readOnly, institutionId, triggerRefresh }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'address'>('overview');
  const isDark = madrasah?.theme === 'dark';

  const associationConfig = React.useMemo(() => {
    if (!madrasah || !student.department_id) return null;
    
    let configObj = madrasah.config_json as any;
    if (typeof configObj === 'string') {
      try {
        configObj = JSON.parse(configObj);
      } catch {
        configObj = {};
      }
    }
    
    const deptConfig = configObj?.departments_config?.[student.department_id];
    if (deptConfig?.association_type) {
      return {
        type: deptConfig.association_type,
        settings: deptConfig.management_settings || {}
      };
    }
    return null;
  }, [madrasah, student.department_id]);

  const [financeLoading, setFinanceLoading] = useState(false);
  const [memberDeposited, setMemberDeposited] = useState(0);
  const [totalPool, setTotalPool] = useState(0);

  React.useEffect(() => {
    if (!associationConfig || !madrasah?.id || !student.name) return;

    const fetchFinancialStats = async () => {
      setFinanceLoading(true);
      try {
        const deptName = student.departments?.name || '';
        
        // Fetch member deposits
        const { data: memberData, error: mErr } = await supabase
          .from('ledger')
          .select('amount')
          .eq('institution_id', madrasah.id)
          .eq('category', 'Member Fee')
          .ilike('description', `%${student.name}%`);

        if (!mErr && memberData) {
          const sum = memberData.reduce((total, item) => total + Number(item.amount), 0);
          setMemberDeposited(sum);
        } else {
          setMemberDeposited(0);
        }

        // Fetch total department pool
        if (deptName) {
          const { data: deptData, error: dErr } = await supabase
            .from('ledger')
            .select('amount')
            .eq('institution_id', madrasah.id)
            .eq('category', 'Member Fee')
            .ilike('description', `%${deptName}%`);

          if (!dErr && deptData) {
            const sum = deptData.reduce((total, item) => total + Number(item.amount), 0);
            setTotalPool(sum);
          } else {
            setTotalPool(0);
          }
        }
      } catch (err) {
        console.error('Error fetching member financial stats:', err);
      } finally {
        setFinanceLoading(false);
      }
    };

    fetchFinancialStats();
  }, [associationConfig, madrasah?.id, student.name, student.departments?.name]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah || !student.id) return;

    setUploading(true);
    try {
      const photoUrl = await compressAndUploadMemberPhoto(file, madrasah.id, student.id);
      if (photoUrl) {
        const { error } = await supabase
          .from('members')
          .update({ photo_url: photoUrl })
          .eq('id', student.id);
        
        if (error) throw error;
        if (triggerRefresh) triggerRefresh();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const parsedAddress = React.useMemo(() => {
    try {
      if (madrasah?.institution_type === 'union' && student.address?.includes('{')) {
        return JSON.parse(student.address);
      }
    } catch { }
    return null;
  }, [student.address, madrasah?.institution_type]);

  const initiateWhatsAppCall = async (phone: string) => {
    window.location.href = `https://wa.me/88${phone.replace(/\D/g, '')}`;
  };

  const initiateWhatsAppMessage = async (phone: string) => {
    window.location.href = `https://wa.me/88${phone.replace(/\D/g, '')}?text=${encodeURIComponent('আস-সালামু আলাইকুম')}`;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (student.id) {
        await supabase.from('ledger')
          .delete()
          .eq('category', 'Member Fee')
          .like('description', `%${student.name}%Roll: ${student.roll}%`);
        await supabase.from('fees').delete().eq('student_id', student.id);
        await supabase.from('attendance').delete().eq('member_id', student.id);
      }

      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', student.id);
      
      if (error) throw error;
      
      if (triggerRefresh) triggerRefresh();
      onBack();
    } catch (err: any) {
      alert(err.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const statusColors: any = {
    general: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100',
    executive: isDark ? 'bg-[#42f5e9]/10 text-[#42f5e9] border-[#42f5e9]/20' : 'bg-[#42f5e9]/10 text-[#0fb5ab] border-[#42f5e9]/30',
    volunteer: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-orange-600 border-orange-100',
    donor: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  const getStatusColor = (type: string) => {
    return statusColors[type] || (isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-50 text-slate-500 border-slate-100');
  };

  const getMemberTypeLabel = (type: any) => {
    if (lang === 'bn') {
      switch (type) {
        case 'general': return 'সাধারণ সদস্য';
        case 'executive': return 'কার্যনির্বাহী সদস্য';
        case 'volunteer': return 'স্বেচ্ছাসেবক';
        case 'donor': return 'দাতা সদস্য';
        default: return type || 'সাধারণ সদস্য';
      }
    }
    return type?.charAt(0).toUpperCase() + type?.slice(1) || 'General';
  };

  const tabs = [
    { id: 'overview', label: lang === 'bn' ? 'সংক্ষিপ্ত' : 'Overview', icon: <UserIcon size={16} /> },
    { id: 'personal', label: lang === 'bn' ? 'ব্যক্তিগত' : 'Personal', icon: <Dna size={16} /> },
    { id: 'address', label: lang === 'bn' ? 'ঠিকানা ও অন্যান্য' : 'Address', icon: <MapPin size={16} /> },
  ];

  return (
    <div className="animate-in slide-in-from-right-4 duration-700 pb-32 space-y-6">
      {/* Dynamic Header Stage - COMPACTED */}
      <div className="relative h-[220px] w-full overflow-hidden rounded-[2.5rem] shadow-xl shadow-[#0fb5ab]/5 border border-white/10">
        <div className={`absolute inset-0 bg-gradient-to-br transition-all duration-1000 ${isDark ? 'from-slate-900 via-slate-800 to-[#0a8078]' : 'from-[#0fb5ab] via-[#42f5e9] to-[#0a8078]'}`} />
        
        {/* Abstract Background Orbs */}
        <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-[80px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#42f5e9]/20 rounded-full blur-[100px]" />
        
        <div className="relative z-10 w-full h-full flex flex-col p-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={onBack} 
              className="w-10 h-10 bg-white/10 backdrop-blur-2xl rounded-xl flex items-center justify-center text-white active:scale-90 transition-all border border-white/20"
            >
              <ArrowLeft size={20} strokeWidth={3} />
            </button>
            {!readOnly && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowDeleteConfirm(true)} 
                  className="w-10 h-10 bg-red-500/10 backdrop-blur-2xl rounded-xl flex items-center justify-center text-red-100 active:scale-90 transition-all border border-red-500/20 shadow-xl"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={onEdit} 
                  className="w-10 h-10 bg-white backdrop-blur-2xl rounded-xl flex items-center justify-center text-[#0fb5ab] active:scale-90 transition-all shadow-xl"
                >
                  <Edit3 size={20} strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center gap-5 pb-2">
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="relative group">
                <div className="absolute inset-0 bg-[#42f5e9] blur-[30px] opacity-20 scale-150 animate-pulse" />
                <div className={`relative w-28 h-28 rounded-[2rem] flex items-center justify-center text-[#0fb5ab] border-2 border-white shadow-xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                  {uploading ? (
                    <Loader2 className="animate-spin text-[#0fb5ab]" size={32} />
                  ) : student.photo_url ? (
                    <img 
                      src={student.photo_url} 
                      alt={student.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon size={56} strokeWidth={2.5} />
                  )}
                </div>

                {!readOnly && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute -top-1 -right-1 w-8 h-8 bg-white text-[#0fb5ab] rounded-lg flex items-center justify-center shadow-lg border-2 border-white active:scale-90 transition-all hover:bg-slate-50 z-20"
                    >
                      <Camera size={16} strokeWidth={3} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                  </>
                )}
              </div>

              {/* Member ID number cleanly rendered below the photo */}
              <div className={`h-7 px-3 bg-white text-[#0fb5ab] rounded-full flex items-center justify-center shadow-md border-2 border-white font-black text-[11px] font-mono tracking-wider`}>
                {student.member_id_number ? `ID: ${student.member_id_number}` : <Hash size={14} strokeWidth={3} />}
              </div>
            </div>
            
            <div className="flex flex-col text-left">
              <h1 className="text-2xl font-black text-white font-noto tracking-tighter drop-shadow-md leading-tight">{student.name}</h1>
              <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full w-fit">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{student.departments?.name || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu - STICKY-LIKE */}
      <div className={`flex p-1 rounded-2xl border-2 sticky top-0 z-[50] backdrop-blur-xl ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-100'}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 px-2 rounded-xl flex items-center justify-center gap-2 transition-all duration-500 font-black text-[11px] uppercase tracking-wider ${activeTab === tab.id ? (isDark ? 'bg-[#42f5e9]/10 text-[#42f5e9]' : 'bg-[#e0fdfb] text-[#0fb5ab]') : 'text-slate-400 hover:text-slate-500'}`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Organizational Identity Card */}
              <div className={`md:col-span-2 p-6 rounded-[2rem] border-2 transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#42f5e9] to-[#0fb5ab] rounded-xl flex items-center justify-center text-[#053d3a]">
                    <UserCheck size={22} strokeWidth={2.5} />
                  </div>
                  <h3 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{lang === 'bn' ? 'সাংগঠনিক পরিচিতি' : 'Identity'}</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <BentoItem 
                    label={lang === 'bn' ? 'সদস্য ধরণ' : 'Member Type'} 
                    value={getMemberTypeLabel(student.member_type)} 
                    icon={<UserCheck size={14} />} 
                    isDark={isDark} 
                    badge={getStatusColor(student.member_type || 'general')}
                  />
                  <BentoItem 
                    label={lang === 'bn' ? 'সদস্য পরিচিত নম্বর' : 'ID Number'} 
                    value={student.member_id_number || 'N/A'} 
                    icon={<Hash size={14} />} 
                    isDark={isDark} 
                  />
                  <BentoItem 
                    label={lang === 'bn' ? 'কমিটি / শাখা' : 'Committee'} 
                    value={student.departments?.name} 
                    icon={<MapPin size={14} />} 
                    isDark={isDark} 
                  />
                  <BentoItem 
                    label={lang === 'bn' ? 'যোগদানের তারিখ' : 'Member Since'} 
                    value={student.join_date} 
                    icon={<Calendar size={14} />} 
                    isDark={isDark} 
                  />
                </div>
              </div>

              {/* Action Center - Integrated into grid */}
              <div className={`p-6 rounded-[2rem] border-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white">
                    <Smartphone size={22} strokeWidth={2.5} />
                  </div>
                  <h3 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{lang === 'bn' ? 'যোগাযোগ কেন্দ্র' : 'Actions'}</h3>
                </div>
                
                <div className="space-y-2">
                   <button 
                     onClick={() => window.location.href = `tel:${student.phone}`}
                     className="w-full h-12 px-5 rounded-xl bg-[#0fb5ab] text-white font-black text-[12px] flex items-center justify-between shadow-lg shadow-[#0fb5ab]/10 active:scale-95 transition-all"
                   >
                      <div className="flex items-center gap-2">
                        <Phone size={16} fill="currentColor" />
                        <span>{student.phone}</span>
                      </div>
                   </button>
                   
                   <button 
                     onClick={() => initiateWhatsAppMessage(student.phone)}
                     className="w-full h-12 px-5 rounded-xl bg-emerald-500 text-white font-black text-[12px] flex items-center justify-between shadow-lg shadow-emerald-500/10 active:scale-95 transition-all"
                   >
                      <div className="flex items-center gap-2">
                        <MessageCircle size={16} fill="currentColor" />
                        <span>WhatsApp</span>
                      </div>
                   </button>

                   <button 
                     onClick={() => { student.email && (window.location.href = `mailto:${student.email}`) }}
                     disabled={!student.email}
                     className={`w-full h-12 px-5 rounded-xl font-black text-[12px] flex items-center justify-between transition-all ${student.email ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/10' : 'bg-slate-100 text-slate-400 opacity-50'}`}
                   >
                      <div className="flex items-center gap-2 truncate">
                        <Hash size={16} />
                        <span className="truncate">{student.email || (lang === 'bn' ? 'ইমেইল নেই' : 'No Email')}</span>
                      </div>
                   </button>
                </div>
              </div>
            </div>

            {/* Association / Management Policy & Stats Card */}
            {associationConfig && (
              <div className={`p-8 rounded-[2.5rem] border-2 transition-all space-y-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}>
                {associationConfig.type === 'capital_share' && (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                          <Share2 size={20} />
                        </div>
                        <div>
                          <h3 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {lang === 'bn' ? 'মূলধন ও শেয়ার বিবরণী' : 'Capital & Share Summary'}
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {lang === 'bn' ? 'নীতিমালা ও সদস্য প্রোফাইল বিশ্লেষণ' : 'Policy & Member Profile Analysis'}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 border border-purple-500/20 w-fit">
                        {lang === 'bn' ? 'মূলধন ও শেয়ার সমিতি' : 'Capital & Share Association'}
                      </span>
                    </div>

                    {financeLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                        <Loader2 className="animate-spin text-purple-600" size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading Stats...'}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* 4-Column Bento Box of Math Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সদস্যের মোট জমা' : 'Total Deposited'}</p>
                            <p className="text-lg font-black text-emerald-600 font-noto mt-1.5">৳{memberDeposited.toLocaleString('bn-BD')}</p>
                          </div>

                          {(() => {
                            const shareVal = Number(associationConfig.settings.share_value) || 0;
                            const memberShares = shareVal > 0 ? memberDeposited / shareVal : 0;
                            const maxShares = Number(associationConfig.settings.max_shares) || 0;
                            const isExceeded = maxShares > 0 && memberShares > maxShares;

                            return (
                              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="flex items-center justify-between">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'মোট শেয়ার সংখ্যা' : 'Shares Owned'}</p>
                                  {isExceeded && (
                                    <span className="bg-red-500 text-white text-[7px] px-1 rounded font-black">{lang === 'bn' ? 'সীমা অতিক্রম' : 'Limit'}</span>
                                  )}
                                </div>
                                <p className="text-lg font-black text-purple-600 font-noto mt-1.5">
                                  {memberShares.toFixed(1)} {lang === 'bn' ? 'টি' : 'Shares'}
                                </p>
                              </div>
                            );
                          })()}

                          {(() => {
                            const sharePct = totalPool > 0 ? (memberDeposited / totalPool) * 100 : 0;
                            return (
                              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পুলে শেয়ারের হার' : 'Share Ratio %'}</p>
                                <p className="text-lg font-black text-indigo-600 font-noto mt-1.5">{sharePct.toFixed(2)}%</p>
                              </div>
                            );
                          })()}

                          {(() => {
                            const sharePct = totalPool > 0 ? (memberDeposited / totalPool) * 100 : 0;
                            const profitPct = Number(associationConfig.settings.profit_percentage) || 100;
                            const memberProfitShare = (sharePct * profitPct) / 100;
                            return (
                              <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'নিট লাভ বণ্টন হার' : 'Profit Entitlement'}</p>
                                <p className="text-lg font-black text-blue-600 font-noto mt-1.5">{memberProfitShare.toFixed(2)}%</p>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Informational banner when values are 0 */}
                        {(memberDeposited === 0 || totalPool === 0) && (
                          <div className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isDark ? 'bg-indigo-950/20 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50/50 border-indigo-100 text-indigo-700'}`}>
                            <div className="space-y-1">
                              <p className="text-xs font-black font-noto">
                                {lang === 'bn' ? '💡 শতাংশ ও লাভ বণ্টন হার ০% কেন দেখাচ্ছে?' : '💡 Why is the share ratio & profit entitlement showing 0%?'}
                              </p>
                              <p className="text-[11px] leading-relaxed font-bold opacity-90">
                                {lang === 'bn' 
                                  ? 'এই মেম্বার বা ওনার শাখার কোনো মেম্বার এখনও "চাঁদা ও হিসাব" (Accounting) পেজ থেকে কোনো ফি বা ক্যাপিটাল জমা করেননি। কোনো জমা না থাকায় পুলে ওনার অবদানের হার ০% দেখাচ্ছে।'
                                  : 'No fees or capital deposits have been registered yet for this member or their department in the "Accounting" section. Once deposits are received, ratios will compute automatically.'}
                              </p>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                              {lang === 'bn' ? 'অটো-ক্যালকুলেশন' : 'Auto-Calculated'}
                            </span>
                          </div>
                        )}

                        {/* Management Policies Guidelines block */}
                        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'}`}>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            {lang === 'bn' ? 'ম্যানেজমেন্ট নীতিমালা ও নিয়মাবলী' : 'Management Rules & Guidelines'}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold text-slate-500">
                            <div>
                              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">{lang === 'bn' ? 'প্রতি শেয়ারের মূল্য' : 'Value Per Share'}</span>
                              <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>৳{Number(associationConfig.settings.share_value || 0).toLocaleString('bn-BD')}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">{lang === 'bn' ? 'সর্বোচ্চ শেয়ার সীমা' : 'Max Share Limit'}</span>
                              <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>{associationConfig.settings.max_shares || 'Unlimited'} {lang === 'bn' ? 'টি' : ''}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">{lang === 'bn' ? 'রিজার্ভ ফান্ড বরাদ্দ' : 'Reserve Percentage'}</span>
                              <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>{associationConfig.settings.reserve_percentage || 0}%</span>
                            </div>
                          </div>
                          {associationConfig.settings.capital_rules && (
                            <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1">{lang === 'bn' ? 'মূলধন সংগ্রহ ও ব্যবহারের নিয়ম' : 'Capital Rules'}</span>
                              <p className={`text-[11px] font-black font-noto leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                {associationConfig.settings.capital_rules}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {associationConfig.type === 'savings' && (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                          <PiggyBank size={20} />
                        </div>
                        <div>
                          <h3 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {lang === 'bn' ? 'সঞ্চয় সমিতি বিবরণী' : 'Savings Association Details'}
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {lang === 'bn' ? 'সদস্যের সঞ্চয় ও নীতি তথ্য' : 'Member Savings & Policy Details'}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-600 border border-blue-500/20 w-fit">
                        {lang === 'bn' ? 'সঞ্চয় সমিতি' : 'Savings Association'}
                      </span>
                    </div>

                    {financeLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                        <Loader2 className="animate-spin text-blue-600" size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সদস্যের মোট সঞ্চয়' : 'Total Savings'}</p>
                            <p className="text-lg font-black text-emerald-600 font-noto mt-1.5">৳{memberDeposited.toLocaleString('bn-BD')}</p>
                          </div>

                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'নির্ধারিত মাসিক সঞ্চয়' : 'Target Monthly Savings'}</p>
                            <p className="text-lg font-black text-blue-600 font-noto mt-1.5">৳{Number(associationConfig.settings.monthly_savings_amount || 0).toLocaleString('bn-BD')}</p>
                          </div>
                        </div>

                        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'}`}>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            {lang === 'bn' ? 'সঞ্চয় জমা ও উত্তোলনের নিয়মাবলী' : 'Savings Guidelines'}
                          </h4>
                          <div className="space-y-3 text-xs">
                            {associationConfig.settings.deposit_deadline && (
                              <div>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide">{lang === 'bn' ? 'জমার সময়সীমা' : 'Deposit Deadline'}</span>
                                <span className={`text-[12px] font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>{associationConfig.settings.deposit_deadline}</span>
                              </div>
                            )}
                            {associationConfig.settings.savings_rules && (
                              <div className="pt-2 border-t border-slate-100">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1">{lang === 'bn' ? 'সঞ্চয়ের নিয়ম' : 'Savings Rules'}</span>
                                <p className={`text-[11px] font-black font-noto leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{associationConfig.settings.savings_rules}</p>
                              </div>
                            )}
                            {associationConfig.settings.withdrawal_rules && (
                              <div className="pt-2 border-t border-slate-100">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1">{lang === 'bn' ? 'উত্তোলনের নিয়ম' : 'Withdrawal Rules'}</span>
                                <p className={`text-[11px] font-black font-noto leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{associationConfig.settings.withdrawal_rules}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {associationConfig.type === 'qard_hasan' && (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md">
                          <Coins size={20} />
                        </div>
                        <div>
                          <h3 className={`text-sm font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {lang === 'bn' ? 'করযে হাসানা বিবরণী' : 'Qard Hasan Association Details'}
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {lang === 'bn' ? 'সদস্যের লোন ও নীতি তথ্য' : 'Member Loan & Policy Details'}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-fit">
                        {lang === 'bn' ? 'করযে হাসানা' : 'Qard Hasan Association'}
                      </span>
                    </div>

                    {financeLoading ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                        <Loader2 className="animate-spin text-emerald-600" size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সদস্যের মোট জমা' : 'Total Contributions'}</p>
                            <p className="text-lg font-black text-emerald-600 font-noto mt-1.5">৳{memberDeposited.toLocaleString('bn-BD')}</p>
                          </div>

                          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'ঋণের সর্বোচ্চ সীমা' : 'Maximum Loan Limit'}</p>
                            <p className="text-lg font-black text-emerald-600 font-noto mt-1.5">৳{Number(associationConfig.settings.max_loan_limit || 0).toLocaleString('bn-BD')}</p>
                          </div>
                        </div>

                        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50/50 border-slate-100'}`}>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            {lang === 'bn' ? 'ঋণ ও কিস্তি পরিশোধের নিয়মাবলী' : 'Qard Hasan Guidelines'}
                          </h4>
                          <div className="space-y-3 text-xs">
                            {associationConfig.settings.eligibility_rules && (
                              <div>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1">{lang === 'bn' ? 'ঋণ পাওয়ার যোগ্যতা' : 'Eligibility Rules'}</span>
                                <p className={`text-[11px] font-black font-noto leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{associationConfig.settings.eligibility_rules}</p>
                              </div>
                            )}
                            {associationConfig.settings.repayment_rules && (
                              <div className="pt-2 border-t border-slate-100">
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1">{lang === 'bn' ? 'পরিশোধের নিয়মাবলী' : 'Repayment Rules'}</span>
                                <p className={`text-[11px] font-black font-noto leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{associationConfig.settings.repayment_rules}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="space-y-4">
             {/* Personal Specs */}
            <div className={`p-6 rounded-[2rem] border-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-xl flex items-center justify-center text-white">
                  <Dna size={22} strokeWidth={2.5} />
                </div>
                <h3 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{lang === 'bn' ? 'ব্যক্তিগত বিবরণ' : 'Personal Specs'}</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                 <BentoItem label={lang === 'bn' ? 'পিতার নাম' : 'Father'} value={student.father_name} icon={<UserIcon size={14} />} isDark={isDark} />
                 <BentoItem label={lang === 'bn' ? 'মাতার নাম' : 'Mother'} value={student.mother_name} icon={<UserIcon size={14} />} isDark={isDark} />
                 <BentoItem label={lang === 'bn' ? 'জন্ম তারিখ' : 'DOB'} value={student.dob} icon={<Calendar size={14} />} isDark={isDark} />
                 <BentoItem label={lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood'} value={student.blood_group} icon={<AlertTriangle size={14} />} isDark={isDark} badge={isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100'} />
                 <BentoItem label={lang === 'bn' ? 'লিঙ্গ' : 'Gender'} value={t(student.gender as any || 'male', lang)} icon={<Dna size={14} />} isDark={isDark} />
                 <BentoItem label={lang === 'bn' ? 'শিক্ষাগত যোগ্যতা' : 'Education'} value={student.education} icon={<GraduationCap size={14} />} isDark={isDark} />
              </div>
            </div>

            {/* Credentials Card */}
            <div className={`p-6 rounded-[2rem] border-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <CreditCard size={22} strokeWidth={2.5} />
                </div>
                <h3 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{lang === 'bn' ? 'ডকুমেন্টস' : 'ID & Docs'}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <BentoItem label={lang === 'bn' ? 'জাতীয় পরিচয়পত্র' : 'NID/NID'} value={student.nid} icon={<CreditCard size={14} />} isDark={isDark} />
                <BentoItem label={lang === 'bn' ? 'পেশা' : 'Profession'} value={student.occupation} icon={<Briefcase size={14} />} isDark={isDark} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'address' && (
          <div className="space-y-4">
             {/* Location & Addresses */}
            <div className={`p-6 rounded-[2rem] border-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0fb5ab] to-[#0a8078] rounded-xl flex items-center justify-center text-white shadow-lg">
                  <MapPin size={22} strokeWidth={2.5} />
                </div>
                <h3 className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{lang === 'bn' ? 'ঠিকানা' : 'Address'}</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {madrasah?.institution_type === 'union' && parsedAddress && (
                  <div className={`p-5 rounded-[1.5rem] border-2 md:col-span-2 ${isDark ? 'bg-[#42f5e9]/5 border-[#42f5e9]/20' : 'bg-[#0fb5ab]/5 border-[#0fb5ab]/20'}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{lang === 'bn' ? 'এলাকা' : 'Area'}</p>
                    <div className="flex gap-4">
                       {parsedAddress.division && <div><p className="text-[10px] font-bold text-slate-500">{lang === 'bn' ? 'বিভাগ' : 'Division'}</p><p className={`text-sm font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{parsedAddress.division}</p></div>}
                       {parsedAddress.district && <div><p className="text-[10px] font-bold text-slate-500">{lang === 'bn' ? 'জেলা' : 'District'}</p><p className={`text-sm font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{parsedAddress.district}</p></div>}
                       {parsedAddress.thana && <div><p className="text-[10px] font-bold text-slate-500">{lang === 'bn' ? 'থানা' : 'Thana'}</p><p className={`text-sm font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{parsedAddress.thana}</p></div>}
                       {parsedAddress.ward && <div><p className="text-[10px] font-bold text-slate-500">{lang === 'bn' ? 'ওয়ার্ড' : 'Ward'}</p><p className={`text-sm font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>{parsedAddress.ward}</p></div>}
                    </div>
                  </div>
                )}
                <div className={`p-5 rounded-[1.5rem] border-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{lang === 'bn' ? 'বর্তমান ঠিকানা' : 'Present Address'}</p>
                   <p className={`text-[13px] font-black font-noto leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{student.present_address || (madrasah?.institution_type !== 'union' ? student.address : null) || (lang === 'bn' ? 'যুক্ত করা হয়নি' : 'Not Added')}</p>
                </div>
                <div className={`p-5 rounded-[1.5rem] border-2 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{lang === 'bn' ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}</p>
                   <p className={`text-[13px] font-black font-noto leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{student.permanent_address || (lang === 'bn' ? 'যুক্ত করা হয়নি' : 'Not Added')}</p>
                </div>
              </div>
            </div>

            {/* History & Meta Card */}
            <div className={`p-6 rounded-[2rem] border-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50 shadow-sm'}`}>
              <div className="flex items-center gap-4">
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${isDark ? 'bg-slate-800 border-slate-700 text-[#42f5e9]' : 'bg-slate-50 border-white text-[#0fb5ab]'}`}>
                    <Calendar size={24} />
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{lang === 'bn' ? 'যোগদানের তারিখ' : 'Member Since'}</p>
                    <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{student.join_date || (lang === 'bn' ? 'তারিখ সেট করা নেই' : 'No Date set')}</p>
                 </div>
              </div>

              <div className="h-px w-full bg-slate-100 my-4 hidden md:block" />

              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50 sm:border-0 sm:mt-0 sm:pt-0">
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${isDark ? 'bg-slate-800 border-slate-700 text-[#42f5e9]' : 'bg-slate-50 border-white text-[#0fb5ab]'}`}>
                    <UserIcon size={24} />
                 </div>
                 <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{lang === 'bn' ? 'রেফারেন্স' : 'Referred By'}</p>
                    <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>{student.reference || (lang === 'bn' ? 'নেই' : 'None')}</p>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className={`w-full max-w-sm rounded-[4rem] p-12 shadow-[0_50px_120px_rgba(239,68,68,0.3)] border text-center space-y-8 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-red-50'}`}>
             <div className="relative">
               <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse" />
               <div className={`relative w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-inner border mb-6 ${isDark ? 'bg-red-900/20 text-red-400 border-red-800/50' : 'bg-red-50 text-red-500 border-red-100'}`}>
                  <AlertTriangle size={48} />
               </div>
             </div>
             <div>
                <h3 className={`text-2xl font-black font-noto tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('confirm_delete', lang)}</h3>
                <p className="text-[13px] font-bold text-slate-400 mt-3 uppercase tracking-wider px-2 leading-relaxed">
                  {lang === 'bn' ? `আপনি কি নিশ্চিতভাবে "${student.name}" এর সকল তথ্য মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।` : `Are you sure you want to delete all info for "${student.name}"? This cannot be undone.`}
                </p>
             </div>
             <div className="flex flex-col gap-4 pt-2">
                <button 
                  onClick={handleDelete} 
                  disabled={isDeleting} 
                  className="w-full py-6 bg-gradient-to-r from-red-500 to-red-600 text-white font-black rounded-full shadow-2xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center text-lg gap-3 border border-white/10"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={24} /> : (
                    <><Trash2 size={24} /> {t('confirm_btn', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  disabled={isDeleting}
                  className={`w-full py-5 font-black rounded-full active:scale-95 transition-all text-sm uppercase tracking-widest border ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  {t('cancel_btn', lang)}
                </button>
             </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentDetails;

const BentoItem: React.FC<{ 
  label: string; 
  value: string | null | undefined; 
  icon: React.ReactNode; 
  isDark: boolean; 
  highlight?: boolean;
  badge?: string;
  fullWidth?: boolean;
}> = ({ label, value, icon, isDark, highlight, badge, fullWidth }) => {
  return (
    <div className={`p-3 rounded-xl border flex flex-col justify-between min-h-[70px] transition-all duration-300 group ${fullWidth ? 'w-full' : ''} ${highlight ? (isDark ? 'bg-[#42f5e9]/10 border-[#42f5e9]/30' : 'bg-[#e0fdfb] border-[#42f5e9]/30') : (isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100')}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
           <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors group-hover:scale-110 ${highlight ? 'text-[#0fb5ab]' : isDark ? 'text-[#42f5e9]' : 'text-slate-400 group-hover:text-[#0fb5ab]'}`}>
             {icon}
           </div>
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
        </div>
        {badge && (
          <div className={`px-1.5 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-widest border ${badge}`}>
            {value || '-'}
          </div>
        )}
      </div>
      
      {!badge && (
        <p className={`text-[12px] font-black font-noto truncate mt-1 leading-none ${highlight ? (isDark ? 'text-white' : 'text-[#0fb5ab]') : isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {value || <span className="opacity-30 tracking-widest">---</span>}
        </p>
      )}
    </div>
  );
};
