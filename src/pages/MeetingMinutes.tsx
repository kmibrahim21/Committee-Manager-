import React from 'react';
import { Institution, Language, UserRole, Profile } from 'types';
import { MeetingMinutesProvider, useMeetingMinutesEngine } from '../components/agendas/MeetingMinutesProvider';
import SchoolFinalResults from '../components/agendas/engines/standard/FinalMinutes';
import BefaqFinalResults from '../components/agendas/engines/board/FinalMinutes';
import QawmiFinalResults from '../components/agendas/engines/general/FinalMinutes';

import { AlertCircle } from 'lucide-react';

interface MeetingMinutesProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const MeetingMinutesContent: React.FC<MeetingMinutesProps> = (props) => {
  const { engine } = useMeetingMinutesEngine();
  const isTeacher = props.role === 'executive';
  const canManageMinutes = !isTeacher || props.profile?.permissions?.can_manage_meetings;

  if (!canManageMinutes) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {props.lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {props.lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={props.onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {props.lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  switch (engine) {
    case 'befaq':
      return <BefaqFinalResults {...props} />;
    case 'qawmi_custom':
      return <QawmiFinalResults {...props} />;
    case 'school':
    default:
      return <SchoolFinalResults {...props} />;
  }
};

const MeetingMinutes: React.FC<MeetingMinutesProps> = (props) => {
  if (!props.madrasah) return null;

  return (
    <MeetingMinutesProvider institution={props.madrasah}>
      <MeetingMinutesContent {...props} />
    </MeetingMinutesProvider>
  );
};

export default MeetingMinutes;
