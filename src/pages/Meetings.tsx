
import React from 'react';
import { Institution, Language, UserRole, Profile } from 'types';
import { MeetingMinutesProvider, useMeetingMinutesEngine } from '../components/agendas/MeetingMinutesProvider';
import StandardMeetingEngine from '../components/agendas/engines/standard/StandardMeetingEngine';
import BoardMeetingEngine from '../components/agendas/engines/board/BoardMeetingEngine';
import GeneralMeetingEngine from '../components/agendas/engines/general/GeneralMeetingEngine';

import { AlertCircle } from 'lucide-react';

interface MeetingsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  onNavigateToFinalResults?: () => void;
  profile?: Profile | null;
}

const MeetingsContent: React.FC<MeetingsProps> = (props) => {
  const { engine } = useMeetingMinutesEngine();
  const isTeacher = props.role === 'executive';
  const canManageMeetings = !isTeacher || props.profile?.permissions?.can_manage_meetings;

  if (!canManageMeetings) {
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
    case 'board':
      return <BoardMeetingEngine {...props} />;
    case 'general':
      return <GeneralMeetingEngine {...props} />;
    case 'standard':
    default:
      return <StandardMeetingEngine {...props} />;
  }
};

const Meetings: React.FC<MeetingsProps> = (props) => {
  if (!props.madrasah) return null;

  return (
    <MeetingMinutesProvider institution={props.madrasah}>
      <MeetingsContent {...props} />
    </MeetingMinutesProvider>
  );
};

export default Meetings;
