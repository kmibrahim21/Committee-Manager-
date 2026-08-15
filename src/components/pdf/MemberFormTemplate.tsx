import React from 'react';
import { Institution } from '../../types';

interface MemberFormTemplateProps {
  madrasah: Institution | null;
  lang: 'en' | 'bn';
}

export const MemberFormTemplate: React.FC<MemberFormTemplateProps> = ({ madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const name = madrasah?.name || (isBangla ? 'কমিটি ম্যানেজমেন্ট' : 'Committee Management');
  const address = madrasah?.address || '';
  const phone = madrasah?.phone || '';

  return (
    <div className="w-[794px] h-[1123px] p-10 bg-white font-noto flex flex-col justify-between text-slate-800 border-[12px] border-double border-slate-200 relative box-border">
      {/* Background Watermark */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none -rotate-45 select-none">
        <h1 className="text-8xl font-black uppercase text-center tracking-widest">{name}</h1>
      </div>

      {/* Header Section */}
      <div>
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md">
              <span className="text-2xl font-extrabold uppercase">{name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight uppercase">{name}</h1>
              {address && <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{address}</p>}
              {phone && <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Phone: {phone}</p>}
            </div>
          </div>
          {/* Passport Photo Attachment Frame */}
          <div className="w-24 h-28 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-center p-2 bg-slate-50 relative shrink-0">
            <p className="text-[9px] font-black text-slate-400 leading-normal">
              {isBangla ? 'পাসপোর্ট সাইজ' : 'Passport Size'}
            </p>
            <p className="text-[8px] font-bold text-slate-400 leading-normal mt-1">
              {isBangla ? 'ছবি আঠা দিয়ে লাগান' : 'Attach Photo Here'}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-black text-slate-950 bg-slate-100 py-1.5 px-4 rounded-xl inline-block tracking-wide border border-slate-200 font-noto">
            {isBangla ? 'কমিটি সদস্যপদ আবেদন ফরম' : 'COMMITTEE MEMBERSHIP APPLICATION FORM'}
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            {isBangla ? 'অফলাইনে ফরম পূরণের জন্য ব্যবহার করুন' : 'For Offline Registration & Records'}
          </p>
        </div>

        {/* General Instructions */}
        <div className="mb-4 bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-[8.5px] text-slate-500 leading-relaxed font-bold">
          <span className="text-slate-800 font-black">নির্দেশনা / Note:</span>{' '}
          {isBangla 
            ? 'দয়া করে ফরমটি স্পষ্ট অক্ষরে পূরণ করুন। তারকাচিহ্নিত (*) ঘরগুলো অবশ্যই পূরণীয়।' 
            : 'Please fill out the form in clear capital letters. Fields marked with (*) are mandatory.'}
        </div>

        {/* SECTION 1: BASIC INFO */}
        <div className="space-y-3.5 mb-5">
          <div className="bg-slate-900 text-white text-[10px] font-black py-1 px-3 rounded uppercase tracking-wider flex justify-between">
            <span>১. প্রাথমিক তথ্য / Basic Information</span>
          </div>

          {/* Full Name */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-700 min-w-[170px] shrink-0">
              সদস্যের পুরো নাম / Member's Name <span className="text-red-500">*</span>
            </span>
            <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
          </div>

          {/* Member ID Grid and Member Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[170px] shrink-0">
                আইডি নং / Member ID
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <span key={idx} className="w-4 h-5 border border-slate-400 block" />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[110px] shrink-0">
                কমিটি / Committee <span className="text-red-500">*</span>
              </span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>

          {/* Member Type Selection Checkboxes */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-700 min-w-[170px] shrink-0">
              সদস্যপদ ধরণ / Member Type
            </span>
            <div className="flex gap-4 text-[9.5px] font-bold">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 block shrink-0" /> সাধারণ (General)</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 block shrink-0" /> কার্যনির্বাহী (Executive)</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 block shrink-0" /> দাতা (Donor)</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 block shrink-0" /> স্বেচ্ছাসেবক (Volunteer)</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: PERSONAL INFO */}
        <div className="space-y-3.5 mb-5">
          <div className="bg-slate-900 text-white text-[10px] font-black py-1 px-3 rounded uppercase tracking-wider">
            <span>২. ব্যক্তিগত বিবরণ / Personal Information</span>
          </div>

          {/* Father's and Mother's Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">পিতার নাম / Father's Name</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">মাতার নাম / Mother's Name</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>

          {/* Date of Birth and Occupation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">জন্ম তারিখ / Date of Birth</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5 text-slate-400 text-[8.5px] leading-5 font-bold">
                DD / MM / YYYY
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">পেশা / Occupation</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>

          {/* Gender and Blood Group */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">লিঙ্গ / Gender</span>
              <div className="flex gap-4 text-[9.5px] font-bold">
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 block shrink-0" /> পুরুষ (Male)</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 block shrink-0" /> মহিলা (Female)</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">রক্তের গ্রুপ / Blood Group</span>
              <div className="flex gap-2 text-[8px] font-bold">
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                  <span key={bg} className="flex items-center gap-0.5">
                    <span className="w-3 h-3 border border-slate-500 block shrink-0" />
                    {bg}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* NID No and Education */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">এনআইডি নং / NID Number</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 13 }).map((_, idx) => (
                  <span key={idx} className="w-3.5 h-5 border border-slate-400 block" />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">যোগ্যতা / Education</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>
        </div>

        {/* SECTION 3: CONTACT INFO */}
        <div className="space-y-3.5 mb-5">
          <div className="bg-slate-900 text-white text-[10px] font-black py-1 px-3 rounded uppercase tracking-wider">
            <span>৩. যোগাযোগ ও ঠিকানা / Contact & Address</span>
          </div>

          {/* Primary Mobile Number */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">
                মোবাইল নং / Mobile No <span className="text-red-500">*</span>
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: 11 }).map((_, idx) => (
                  <span key={idx} className="w-3.5 h-5 border border-slate-400 block" />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">বিকল্প মোবাইল / Phone 2</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>

          {/* Email Address */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">ইমেইল / Email Address</span>
            <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
          </div>

          {/* Present Address */}
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0 mt-1">বর্তমান ঠিকানা / Present Address</span>
            <div className="flex-1 space-y-3">
              <div className="border-b border-dotted border-slate-400 h-5" />
              <div className="border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>

          {/* Permanent Address */}
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0 mt-1">স্থায়ী ঠিকানা / Permanent Address</span>
            <div className="flex-1 space-y-3">
              <div className="border-b border-dotted border-slate-400 h-5" />
              <div className="border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>
        </div>

        {/* SECTION 4: OTHER INFO */}
        <div className="space-y-3.5 mb-5">
          <div className="bg-slate-900 text-white text-[10px] font-black py-1 px-3 rounded uppercase tracking-wider">
            <span>৪. অন্যান্য তথ্য / Other Details</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">যোগদানের তারিখ / Join Date</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5 text-slate-400 text-[8.5px] leading-5 font-bold">
                DD / MM / YYYY
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700 min-w-[120px] shrink-0">রেফারেন্স / Reference</span>
              <div className="flex-1 border-b border-dotted border-slate-400 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER & SIGNATURE SECTION */}
      <div>
        {/* Declaration */}
        <div className="border-t border-slate-200 pt-3.5 mb-8">
          <p className="text-[8px] font-bold text-slate-400 leading-relaxed text-center italic">
            {isBangla 
              ? 'আমি অঙ্গীকার করছি যে উপরে বর্ণিত সকল তথ্য সম্পূর্ণ সত্য এবং আমি কমিটির সকল নিয়ম-কানুন ও নীতিমালা মেনে চলব।' 
              : 'I declare that the information provided above is complete and correct. I agree to abide by all rules and regulations of the committee.'}
          </p>
        </div>

        {/* Signature Line Fields */}
        <div className="flex justify-between items-end px-4">
          <div className="text-center space-y-1">
            <div className="w-36 border-t border-slate-400" />
            <p className="text-[9px] font-black text-slate-700">আবেদনকারীর স্বাক্ষর</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Applicant's Signature</p>
          </div>
          <div className="text-center space-y-1">
            <p className="text-[9px] font-black text-slate-500">তারিখ / Date: ...... / ...... / 20......</p>
          </div>
          <div className="text-center space-y-1">
            <div className="w-36 border-t border-slate-400" />
            <p className="text-[9px] font-black text-slate-700">অনুমোদনকারী স্বাক্ষর (অফিস)</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Authorized Signature</p>
          </div>
        </div>

        {/* Printed and App watermark footer */}
        <div className="border-t border-slate-100 pt-3.5 mt-6 text-center">
          <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
            {isBangla ? 'কমিটি ম্যানেজার সফটওয়্যার দ্বারা প্রস্তুতকৃত' : 'Generated via Committee Manager Portal'}
          </p>
        </div>
      </div>
    </div>
  );
};
