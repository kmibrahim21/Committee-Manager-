
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Save, User as UserIcon, Phone, List, Hash, Loader2, ChevronDown, Camera, X, Check, UserCheck, AlertCircle, BookOpen } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { OfflineService } from 'services/OfflineService';
import { Member, Department, Language, Institution } from 'types';
import { t } from 'translations';
import { bdDivisions, bdDistricts, bdThanas } from '../utils/bdData';
import { sortMadrasahClasses } from 'pages/Departments';
import { uploadOptimizedImage } from '../utils/imageOptimizer';

interface StudentFormProps {
  student?: Member | null;
  madrasah: Institution | null;
  defaultClassId?: string;
  isEditing: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  lang: Language;
  title?: string;
}

const StudentForm: React.FC<StudentFormProps> = ({ student, madrasah, defaultClassId, isEditing, onSuccess, onCancel, lang, title }) => {
  const [name, setName] = useState(student?.name || '');
  const [roll, setRoll] = useState(student?.roll?.toString() || '');
  const [memberIdNumber, setMemberIdNumber] = useState(student?.member_id_number || '');
  const [classId, setClassId] = useState(student?.department_id || defaultClassId || '');
  const [memberType, setMemberType] = useState<string>(student?.member_type || 'general');
  const [customMemberTypes, setCustomMemberTypes] = useState<any[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string>(student?.photo_url || '');
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [photoSavings, setPhotoSavings] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // Personal Info
  const [fatherName, setFatherName] = useState(student?.father_name || '');
  const [motherName, setMotherName] = useState(student?.mother_name || '');
  const [dob, setDob] = useState(student?.dob || '');
  const [gender, setGender] = useState<Member['gender']>(student?.gender || 'male');
  const [bloodGroup, setBloodGroup] = useState(student?.blood_group || '');
  const [occupation, setOccupation] = useState(student?.occupation || '');
  const [nid, setNid] = useState(student?.nid || '');
  const [education, setEducation] = useState(student?.education || '');

  // Contact
  const [phone, setPhone] = useState(student?.phone || '');
  const [email, setEmail] = useState(student?.email || '');
  const [guardianName, setGuardianName] = useState(student?.guardian_name || '');
  const [phone2, setPhone2] = useState(student?.guardian_phone_2 || '');
  const [presentAddress, setPresentAddress] = useState(student?.present_address || student?.address || '');
  const [permanentAddress, setPermanentAddress] = useState(student?.permanent_address || '');

  // Other
  const [joinDate, setJoinDate] = useState(student?.join_date || new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState(student?.reference || '');

  // Union Specific Fields
  const initialAddressData = React.useMemo(() => {
    try { return JSON.parse(student?.address || '{}'); } 
    catch { return {}; }
  }, [student]);
  
  const [division, setDivision] = useState(initialAddressData?.division || '');
  const [district, setDistrict] = useState(initialAddressData?.district || '');
  const [thana, setThana] = useState(initialAddressData?.thana || '');
  const [ward, setWard] = useState(initialAddressData?.ward || '');

  const [departments, setClasses] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [showMemberTypeModal, setShowMemberTypeModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showBloodGroupModal, setShowBloodGroupModal] = useState(false);
  
  const [errorModal, setErrorModal] = useState<{show: boolean, message: string}>({show: false, message: ''});

  const isDark = madrasah?.theme === 'dark';

  useEffect(() => {
    fetchClasses();
    fetchCustomMemberTypes();
  }, []);

  const fetchCustomMemberTypes = async () => {
    if (madrasah) {
      const { data } = await supabase.from('member_types').select('*').eq('institution_id', madrasah.id);
      if (data) setCustomMemberTypes(data);
    }
  };

  const fetchClasses = async () => {
    const cached = offlineApi.getCache('departments');
    if (cached) setClasses(sortMadrasahClasses(cached));

    if (navigator.onLine && madrasah) {
      const { data } = await supabase.from('departments').select('*').eq('institution_id', madrasah.id);
      if (data) {
        const sorted = sortMadrasahClasses(data);
        setClasses(sorted);
        offlineApi.setCache('departments', sorted);
      }
    }
  };

  const getSelectedClassName = () => {
    const cls = departments.find(c => c.id === classId);
    return cls ? cls.name : (lang === 'bn' ? 'কমিটি নির্বাচন করুন' : 'Choose Committee');
  };

  const getMemberTypeLabel = (type: string) => {
    const custom = customMemberTypes.find(t => t.name === type);
    if (custom) return custom.name;

    if (lang === 'bn') {
      switch (type) {
        case 'general': return 'সাধারণ সদস্য';
        case 'executive': return 'কার্যনির্বাহী সদস্য';
        case 'volunteer': return 'স্বেচ্ছাসেবক';
        case 'donor': return 'দাতা সদস্য';
        default: return type;
      }
    }
    return type?.charAt(0).toUpperCase() + type?.slice(1) || 'General';
  };

  const getGenderLabel = (g: Member['gender']) => {
    if (lang === 'bn') {
      switch (g) {
        case 'male': return 'পুরুষ';
        case 'female': return 'মহিলা';
        case 'other': return 'অন্যান্য';
        default: return 'পুরুষ';
      }
    }
    return g?.charAt(0).toUpperCase() + g?.slice(1) || 'Male';
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setUploadingPhoto(true);
    setPhotoSavings('');
    try {
      const fileName = `member_${Date.now()}.jpg`;
      const uploadResult = await uploadOptimizedImage(file, {
        primaryBucket: 'member_photo',
        fallbackBuckets: ['madrasah-assets', 'voice-templates'],
        filePath: `${madrasah.id}/${fileName}`,
        maxWidthOrHeight: 500,
        maxSizeMB: 0.15,
        preserveTransparency: false
      });

      setPhotoUrl(uploadResult.url);
      if (uploadResult.savedPercent > 0) {
        setPhotoSavings(`${uploadResult.originalSizeKB}KB ➔ ${uploadResult.compressedSizeKB}KB (${uploadResult.savedPercent}% সাশ্রয়)`);
      }
    } catch (err: any) {
      console.error('Member photo optimization/upload failed:', err);
      setErrorModal({ show: true, message: lang === 'bn' ? 'ছবি অপটিমাইজ ও আপলোডে সমস্যা হয়েছে' : 'Photo upload failed' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDepartmentsEnabled = madrasah?.config_json?.modules?.departments !== false;
    if (!name.trim() || !phone.trim() || (isDepartmentsEnabled && !classId) || !madrasah) {
      setErrorModal({ show: true, message: lang === 'bn' ? 'সব তথ্য পূরণ করুন' : 'Fill required fields' });
      return;
    }

    if (phone.length < 10 || phone.length > 15) {
      setErrorModal({ 
        show: true, 
        message: t('invalid_phone', lang, madrasah?.institution_type)
      });
      return;
    }

    setLoading(true);
    try {
      let finalPhotoUrl = photoUrl.trim() || student?.photo_url || null;

      let addressPayload = student?.address || null;
      if (madrasah?.institution_type === 'union') {
        addressPayload = JSON.stringify({
          division: division.trim(),
          district: district.trim(),
          thana: thana.trim(),
          ward: ward.trim()
        });
      }

      const payload = {
        name: name.trim(),
        roll: roll ? parseInt(roll) : null,
        member_id_number: memberIdNumber.trim() || null,
        department_id: classId || null,
        member_type: memberType,
        
        father_name: fatherName.trim() || null,
        mother_name: motherName.trim() || null,
        dob: dob || null,
        gender: gender,
        blood_group: bloodGroup,
        occupation: occupation.trim() || null,
        nid: nid.trim() || null,
        education: education.trim() || null,

        phone: phone.trim(),
        email: email.trim() || null,
        guardian_name: guardianName.trim() || null,
        guardian_phone_2: phone2.trim() || null,
        present_address: presentAddress.trim() || null,
        permanent_address: permanentAddress.trim() || null,
        address: addressPayload,

        join_date: joinDate || null,
        reference: reference.trim() || null,
        photo_url: finalPhotoUrl,
        
        institution_id: madrasah.id
      };

      if (isEditing && student) {
        await OfflineService.safeUpdate('members', student.id, payload);
      } else {
        await OfflineService.safeInsert('members', payload);
      }
      onSuccess();
    } catch (err: any) { 
      let msg = err.message;
      if (err.code === '23505') {
        msg = t('duplicate_roll', lang, madrasah?.institution_type);
      }
      setErrorModal({ show: true, message: msg });
    } finally { setLoading(false); }
  };

  const handlePhoneChange = (val: string, setter: (v: string) => void) => {
    const numericValue = val.replace(/\D/g, '').slice(0, 15);
    setter(numericValue);
  };

  return (
    <div className="animate-in slide-in-from-bottom-6 duration-700 pb-24 space-y-8">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] p-6 bg-gradient-to-br from-[#2563EB] to-[#1E40AF] shadow-2xl border border-white/20">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
          <UserIcon size={100} strokeWidth={1} />
        </div>
        <div className="relative z-10 flex items-center gap-5">
          <button 
            onClick={onCancel} 
            className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-[1rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/20 shadow-lg shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-lg font-black text-white font-noto tracking-tight drop-shadow-sm">
              {title || (isEditing ? (lang === 'bn' ? 'সদস্য তথ্য আপডেট' : 'Update Member') : (lang === 'bn' ? 'নতুন সদস্য নিবন্ধন' : 'New Member Registration'))}
            </h1>
            <p className="text-white/60 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">
              {isEditing ? (lang === 'bn' ? 'বর্তমান তথ্য আপডেট করুন' : 'Update existing record') : (lang === 'bn' ? 'নতুন সদস্য নিবন্ধন করুন' : 'Register new member')}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Info */}
        <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-none' : 'bg-white border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)]'} p-6 rounded-[2.5rem] border space-y-6`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
              <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>{lang === 'bn' ? 'প্রাথমিক তথ্য ও ছবি' : 'Basic Information & Photo'}</h3>
            </div>
          </div>

          {/* Photo Upload with Instant Compression */}
          <div className={`p-4 rounded-2xl border flex items-center gap-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-blue-50/50 border-blue-100/60'}`}>
            <input 
              type="file" 
              ref={photoInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handlePhotoSelect} 
            />
            <div className="relative group shrink-0">
              <div 
                onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
                className={`w-16 h-16 rounded-2xl overflow-hidden border-2 cursor-pointer flex items-center justify-center transition-transform active:scale-95 shadow-md ${photoUrl ? (isDark ? 'border-blue-500' : 'border-[#2563EB]') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-200')}`}
              >
                {uploadingPhoto ? (
                  <Loader2 size={24} className="text-[#2563EB] animate-spin" />
                ) : photoUrl ? (
                  <img src={photoUrl} alt="Member" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={28} className={isDark ? 'text-slate-500' : 'text-blue-300'} />
                )}
              </div>
              <button 
                type="button"
                onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors"
                title={lang === 'bn' ? 'ছবি আপলোড' : 'Upload photo'}
              >
                <Camera size={12} />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black font-noto ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {lang === 'bn' ? 'সদস্যের ছবি (ঐচ্ছিক)' : 'Member Photo (Optional)'}
                </span>
                {photoSavings && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    ⚡ {photoSavings}
                  </span>
                )}
              </div>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {uploadingPhoto 
                  ? (lang === 'bn' ? 'ছবি অপটিমাইজ ও আপলোড হচ্ছে...' : 'Optimizing & uploading...') 
                  : (lang === 'bn' ? 'আপলোড করার সাথে সাথে স্বয়ংক্রিয় অপটিমাইজ ও কম্প্রেস হবে।' : 'Auto-compressed & optimized instantly.')}
              </p>
              {photoUrl && (
                <button 
                  type="button" 
                  onClick={() => { setPhotoUrl(''); setPhotoSavings(''); }} 
                  className="text-[11px] font-bold text-red-500 hover:underline mt-1 inline-block"
                >
                  {lang === 'bn' ? 'ছবি মুছুন' : 'Remove photo'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                <UserIcon size={11} className="text-[#2563EB]" /> 
                {lang === 'bn' ? 'সদস্যের পুরো নাম' : 'Full Name'} *
              </label>
              <input 
                type="text" required placeholder={lang === 'bn' ? 'পুরো নাম' : 'Full Name'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={name} onChange={(e) => setName(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                <Hash size={11} className="text-[#2563EB]" /> 
                {lang === 'bn' ? 'সদস্য আইডি নং' : 'Member ID Number'}
              </label>
              <input 
                type="text" placeholder={lang === 'bn' ? 'আইডি নাম্বার' : 'ID Number'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:bg-transparent focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={memberIdNumber} onChange={(e) => setMemberIdNumber(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                <UserCheck size={11} className="text-[#2563EB]" /> 
                {lang === 'bn' ? 'সদস্যপদ ধরণ' : 'Member Type'}
              </label>
              <div 
                onClick={() => setShowMemberTypeModal(true)} 
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 hover:border-blue-500/50' : 'bg-slate-50 border-slate-100 hover:border-[#2563EB]/30'} border-2 rounded-[1.2rem] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-sm group`}
              >
                <span className={`font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} truncate text-sm leading-none font-noto`}>{getMemberTypeLabel(memberType)}</span>
                <ChevronDown size={16} className="text-[#2563EB] shrink-0 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </div>

            {madrasah?.config_json?.modules?.departments !== false && (
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                <List size={11} className="text-[#2563EB]" /> 
                {lang === 'bn' ? 'কমিটি / শাখা' : 'Committee/Branch'}
              </label>
              <div 
                onClick={() => setShowClassModal(true)} 
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 hover:border-blue-500/50' : 'bg-slate-50 border-slate-100 hover:border-[#2563EB]/30'} border-2 rounded-[1.2rem] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-sm group`}
              >
                <span className={`font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} truncate text-sm leading-none font-noto`}>{getSelectedClassName()}</span>
                <ChevronDown size={16} className="text-[#2563EB] shrink-0 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Section 2: Personal info */}
        <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-none' : 'bg-white border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)]'} p-6 rounded-[2.5rem] border space-y-6`}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
            <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>{lang === 'bn' ? 'ব্যক্তিগত তথ্য' : 'Personal Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'পিতার নাম' : 'Father Name'}
              </label>
              <input 
                type="text" placeholder={lang === 'bn' ? 'পিতার নাম' : 'Father Name'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={fatherName} onChange={(e) => setFatherName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'মাতার নাম' : 'Mother Name'}
              </label>
              <input 
                type="text" placeholder={lang === 'bn' ? 'মাতার নাম' : 'Mother Name'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={motherName} onChange={(e) => setMotherName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'জন্ম তারিখ' : 'Date of Birth'}
              </label>
              <input 
                type="date"
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={dob} onChange={(e) => setDob(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'লিঙ্গ' : 'Gender'}
              </label>
              <div 
                onClick={() => setShowGenderModal(true)} 
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 hover:border-blue-500/50' : 'bg-slate-50 border-slate-100 hover:border-[#2563EB]/30'} border-2 rounded-[1.2rem] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-sm`}
              >
                <span className={`font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} text-sm leading-none font-noto`}>{getGenderLabel(gender)}</span>
                <ChevronDown size={16} className="text-[#2563EB] shrink-0" />
              </div>
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}
              </label>
              <div 
                onClick={() => setShowBloodGroupModal(true)} 
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 hover:border-blue-500/50' : 'bg-slate-50 border-slate-100 hover:border-[#2563EB]/30'} border-2 rounded-[1.2rem] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-sm`}
              >
                <span className={`font-black ${isDark ? 'text-white' : 'text-[#1E293B]'} text-sm leading-none font-noto`}>{bloodGroup || (lang === 'bn' ? 'নির্বাচন করুন' : 'Select')}</span>
                <ChevronDown size={16} className="text-[#2563EB] shrink-0" />
              </div>
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'পেশা' : 'Occupation'}
              </label>
              <input 
                type="text" placeholder={lang === 'bn' ? 'পেশা' : 'Occupation'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={occupation} onChange={(e) => setOccupation(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'জাতীয় পরিচয়পত্র / পাসপোর্ট' : 'NID / Passport'}
              </label>
              <input 
                type="text" placeholder={lang === 'bn' ? 'এনআইডি নাম্বার' : 'NID Number'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={nid} onChange={(e) => setNid(e.target.value)} 
              />
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-1">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'শিক্ষাগত যোগ্যতা' : 'Education'}
              </label>
              <input 
                type="text" placeholder={lang === 'bn' ? 'শিক্ষাগত যোগ্যতা' : 'Education Qualification'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={education} onChange={(e) => setEducation(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {madrasah?.institution_type === 'union' && (
          <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-none' : 'bg-white border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)]'} p-6 rounded-[2.5rem] border space-y-6`}>
            <div className="flex items-center gap-3 px-2">
              <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
              <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>{lang === 'bn' ? 'এলাকা নির্বাচন' : 'Area Selection'}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  {lang === 'bn' ? 'বিভাগ' : 'Division'}
                </label>
                <select
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm appearance-none`}
                  value={division}
                  onChange={(e) => {
                    setDivision(e.target.value);
                    setDistrict('');
                    setThana('');
                  }}
                >
                  <option value="">{lang === 'bn' ? 'নির্বাচন করুন' : 'Select'}</option>
                  {bdDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  {lang === 'bn' ? 'জেলা' : 'District'}
                </label>
                <select
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm appearance-none`}
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setThana('');
                  }}
                  disabled={!division}
                >
                  <option value="">{lang === 'bn' ? 'নির্বাচন করুন' : 'Select'}</option>
                  {division && bdDistricts[division]?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  {lang === 'bn' ? 'থানা' : 'Thana'}
                </label>
                <select
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm appearance-none`}
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  disabled={!district}
                >
                  <option value="">{lang === 'bn' ? 'নির্বাচন করুন' : 'Select'}</option>
                  {district && bdThanas[district]?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                  {lang === 'bn' ? 'ওয়ার্ড' : 'Ward'}
                </label>
                <input type="text" placeholder={lang === 'bn' ? 'ওয়ার্ড নম্বর বা নাম' : 'Ward'}
                  className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                  value={ward} onChange={(e) => setWard(e.target.value)} disabled={!district && !thana} />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Contact & Address */}
        <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-none' : 'bg-white border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)]'} p-6 rounded-[2.5rem] border space-y-6`}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
            <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>{lang === 'bn' ? 'যোগাযোগ ও ঠিকানা' : 'Contact & Address'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                <Phone size={11} className="text-[#2563EB]" /> 
                {lang === 'bn' ? 'প্রাথমিক মোবাইল নম্বর' : 'Primary Mobile Number'} *
              </label>
              <input 
                type="tel" required placeholder={lang === 'bn' ? '০১XXXXXXXXX' : '01XXXXXXXXX'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={phone} onChange={(e) => handlePhoneChange(e.target.value, setPhone)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'দ্বিতীয় মোবাইল (ঐচ্ছিক)' : 'Secondary Mobile (Optional)'}
              </label>
              <input 
                type="tel" placeholder={lang === 'bn' ? 'ঐচ্ছিক নাম্বার' : 'Optional Number'}
                className={`w-full h-[54px] px-4 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] font-black text-sm outline-none focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={phone2} onChange={(e) => handlePhoneChange(e.target.value, setPhone2)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'ইমেইল এড্রেস' : 'Email Address'}
              </label>
              <input 
                type="email" placeholder={lang === 'bn' ? 'ইমেইল এড্রেস' : 'email@example.com'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={email} onChange={(e) => setEmail(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'বর্তমান ঠিকানা' : 'Present Address'}
              </label>
              <textarea 
                rows={2} placeholder={lang === 'bn' ? 'বর্তমান ঠিকানা' : 'Present Address'}
                className={`w-full p-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm resize-none`} 
                value={presentAddress} onChange={(e) => setPresentAddress(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}
              </label>
              <textarea 
                rows={2} placeholder={lang === 'bn' ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}
                className={`w-full p-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm resize-none`} 
                value={permanentAddress} onChange={(e) => setPermanentAddress(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Section 4: Other info */}
        <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-none' : 'bg-white border-slate-100 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.08)]'} p-6 rounded-[2.5rem] border space-y-6`}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-1.5 h-5 bg-[#2563EB] rounded-full" />
            <h3 className={`text-[11px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E3A8A]'} uppercase tracking-widest`}>{lang === 'bn' ? 'অন্যান্য তথ্য' : 'Other Information'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'যোগদানের তারিখ' : 'Join Date'}
              </label>
              <input 
                type="date"
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={joinDate} onChange={(e) => setJoinDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 text-[9px] font-black ${isDark ? 'text-blue-400' : 'text-[#1E40AF]'} uppercase tracking-wider px-2`}>
                {lang === 'bn' ? 'কার মাধ্যমে যুক্ত হয়েছেন' : 'Reference'}
              </label>
              <input 
                type="text" placeholder={lang === 'bn' ? 'রেফারেন্স ব্যক্তির নাম' : 'Reference Name'}
                className={`w-full h-[54px] px-5 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' : 'bg-slate-50 border-slate-100 text-[#1E293B] focus:border-[#2563EB]'} border-2 rounded-[1.2rem] outline-none font-black text-sm focus:ring-4 focus:ring-[#2563EB]/5 transition-all shadow-sm`} 
                value={reference} onChange={(e) => setReference(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Enhanced Submit Button */}
        <button 
          type="submit" 
          disabled={loading} 
          className="w-full h-[64px] bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-black rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(37,99,235,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 text-base font-noto border border-white/10 uppercase tracking-[0.2em] relative overflow-hidden group disabled:opacity-50"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          {loading ? <Loader2 className="animate-spin" size={28} /> : (
            <>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <Save size={22} strokeWidth={2.5} />
              </div>
              <span className="drop-shadow-lg">{t('save', lang, madrasah?.institution_type)}</span>
            </>
          )}
        </button>
      </form>

      {/* Modals for selections */}
      {showClassModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-2xl' : 'bg-white border-[#2563EB]/5 shadow-[0_40px_100px_rgba(37,99,235,0.15)]'} w-full max-w-sm rounded-[2.5rem] p-8 relative animate-in zoom-in-95 duration-300 border`}>
            <button onClick={() => setShowClassModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-[#2563EB] transition-all"><X size={22} strokeWidth={3} /></button>
            <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto mb-6`}>{lang === 'bn' ? 'কমিটি নির্বাচন' : 'Select Committee'}</h2>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
               {departments.map(cls => (
                 <button key={cls.id} onClick={() => { setClassId(cls.id); setShowClassModal(false); }} className={`w-full p-4 rounded-[1.5rem] font-black transition-all flex items-center justify-between border-2 ${classId === cls.id ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xl' : isDark ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
                    <span className="font-noto text-base">{cls.name}</span>
                    {classId === cls.id && <Check size={18} strokeWidth={4} />}
                 </button>
               ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showMemberTypeModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-2xl' : 'bg-white border-[#2563EB]/5 shadow-[0_40px_100px_rgba(37,99,235,0.15)]'} w-full max-w-sm rounded-[2.5rem] p-8 relative animate-in zoom-in-95 duration-300 border max-h-[80vh] overflow-y-auto`}>
            <button onClick={() => setShowMemberTypeModal(false)} className="absolute top-4 right-6 text-slate-400 hover:text-[#2563EB] transition-all"><X size={22} strokeWidth={3} /></button>
            <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto mb-6`}>{lang === 'bn' ? 'সদস্যপদ ধরণ' : 'Member Type'}</h2>
            <div className="flex flex-col gap-2.5">
               {/* Custom Types Only */}
               {customMemberTypes.length === 0 && (
                 <div className="py-8 text-center space-y-3">
                   <p className="text-sm font-bold text-slate-400">
                     {lang === 'bn' ? 'কোন কাস্টম ধরন পাওয়া যায়নি। একাউন্ট পেইজ থেকে এড করুন।' : 'No custom types found. Please add them from Account settings.'}
                   </p>
                 </div>
               )}
               {customMemberTypes.map(type => (
                 <button key={type.id} onClick={() => { setMemberType(type.name); setShowMemberTypeModal(false); }} className={`w-full p-4 rounded-[1.5rem] font-black transition-all flex items-center justify-between border-2 ${memberType === type.name ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xl' : isDark ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
                    <span className="font-noto text-base">{type.name}</span>
                    {memberType === type.name && <Check size={18} strokeWidth={4} />}
                 </button>
               ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showGenderModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-2xl' : 'bg-white border-[#2563EB]/5 shadow-[0_40px_100px_rgba(37,99,235,0.15)]'} w-full max-w-sm rounded-[2.5rem] p-8 relative animate-in zoom-in-95 duration-300 border`}>
            <button onClick={() => setShowGenderModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-[#2563EB] transition-all"><X size={22} strokeWidth={3} /></button>
            <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto mb-6`}>{lang === 'bn' ? 'লিঙ্গ নির্বাচন' : 'Select Gender'}</h2>
            <div className="space-y-2.5">
               {(['male', 'female', 'other'] as Member['gender'][]).map(g => (
                 <button key={g} onClick={() => { setGender(g); setShowGenderModal(false); }} className={`w-full p-4 rounded-[1.5rem] font-black transition-all flex items-center justify-between border-2 ${gender === g ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xl' : isDark ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
                    <span className="font-noto text-base">{getGenderLabel(g)}</span>
                    {gender === g && <Check size={18} strokeWidth={4} />}
                 </button>
               ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showBloodGroupModal && createPortal(
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-2xl' : 'bg-white border-[#2563EB]/5 shadow-[0_40px_100px_rgba(37,99,235,0.15)]'} w-full max-w-sm rounded-[2.5rem] p-8 relative animate-in zoom-in-95 duration-300 border`}>
            <button onClick={() => setShowBloodGroupModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-[#2563EB] transition-all"><X size={22} strokeWidth={3} /></button>
            <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-[#1E3A8A]'} font-noto mb-6`}>{lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}</h2>
            <div className="grid grid-cols-2 gap-2.5">
               {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                 <button key={bg} onClick={() => { setBloodGroup(bg); setShowBloodGroupModal(false); }} className={`p-4 rounded-[1.5rem] font-black transition-all flex items-center justify-center border-2 ${bloodGroup === bg ? 'bg-[#2563EB] border-[#2563EB] text-white shadow-xl' : isDark ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}>
                    <span className="font-noto text-base">{bg}</span>
                 </button>
               ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {errorModal.show && createPortal(
         <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className={`${isDark ? 'bg-slate-800 border-red-900/30 shadow-2xl' : 'bg-white border-red-50 shadow-[0_40px_100px_rgba(239,68,68,0.2)]'} w-full max-w-sm p-10 rounded-[3.5rem] text-center space-y-6 animate-in zoom-in-95 duration-300 border`}>
               <div className={`w-20 h-20 ${isDark ? 'bg-red-900/20 border-red-800/30 text-red-400' : 'bg-red-50 border-red-100 text-red-500'} rounded-full flex items-center justify-center mx-auto shadow-inner border`}>
                 <AlertCircle size={40} />
               </div>
               <div>
                 <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'} font-noto tracking-tight`}>সতর্কবাণী</h3>
                 <p className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-400'} mt-2 text-[13px] leading-relaxed`}>{errorModal.message}</p>
               </div>
               <button onClick={() => setErrorModal({show: false, message: ''})} className={`w-full py-5 ${isDark ? 'bg-slate-900 text-blue-400' : 'bg-slate-100 text-[#2E0B5E]'} rounded-full font-black text-sm uppercase tracking-widest active:scale-95 transition-all`}>ঠিক আছে</button>
            </div>
         </div>,
        document.body
      )}
    </div>
  );
};

export default StudentForm;
