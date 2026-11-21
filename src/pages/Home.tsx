
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Clock, User as UserIcon, RefreshCw, PhoneCall, X, MessageCircle, Phone, AlertCircle, Trash2, AlertTriangle, Loader2, Users, BookOpen, GraduationCap, Wallet, TrendingUp, DollarSign, CheckCircle2, Banknote, ClipboardList, ChevronRight, Trophy, Zap, Mic, UserCheck, Calendar, CreditCard } from 'lucide-react';
import { supabase, offlineApi } from 'supabase';
import { Member, Language, Institution, Profile, View } from 'types';
import { t } from 'translations';
import { isValidUUID } from 'utils/validation';
import { GenericDashboard } from 'components/dashboards/GenericDashboard';
import { ClubDashboard } from 'components/dashboards/ClubDashboard';
import { OrganizationDashboard } from 'components/dashboards/OrganizationDashboard';
import { MemberPortalDashboard } from 'components/dashboards/MemberPortalDashboard';

interface HomeProps {
  onMemberClick: (member: Member) => void;
  lang: Language;
  dataVersion: number;
  triggerRefresh: () => void;
  institutionId?: string;
  madrasah: Institution | null;
  profile?: any;
  onNavigateToWallet?: () => void;
  onNavigateToAccounting?: () => void;
  onNavigateToAttendance?: () => void;
  onNavigateToExams?: () => void;
  onNavigateToClasses?: () => void;
  onNavigateToMembers?: () => void;
  onNavigateToTeachers?: () => void;
  onNavigateToVoiceBroadcast?: () => void;
  onNavigateToMeetings?: () => void;
  onNavigateToSubscriptions?: () => void;
  onNavigateToEvents?: () => void;
  setView?: (view: View) => void;
}

const Home: React.FC<HomeProps> = ({ 
  lang, 
  dataVersion, 
  institutionId, 
  madrasah, 
  profile, 
  onNavigateToWallet, 
  onNavigateToAccounting, 
  onNavigateToAttendance, 
  onNavigateToExams, 
  onNavigateToClasses, 
  onNavigateToMembers, 
  onNavigateToTeachers, 
  onNavigateToVoiceBroadcast, 
  onNavigateToMeetings, 
  onNavigateToSubscriptions,
  onNavigateToEvents,
  setView
}) => {
  const instType = madrasah?.institution_type || 'committee';

  const handleDashboardNavigate = (targetView: string) => {
    switch (targetView) {
      case 'tournaments':
      case 'gallery':
      case 'events':
        if (onNavigateToEvents) onNavigateToEvents();
        else if (setView) setView('events');
        break;
      case 'certificates':
      case 'volunteers':
      case 'members':
        if (onNavigateToMembers) onNavigateToMembers();
        else if (setView) setView('members');
        break;
      case 'donations':
      case 'accounting':
        if (onNavigateToAccounting) onNavigateToAccounting();
        else if (setView) setView('accounting');
        break;
      case 'employees':
      case 'executives':
        if (onNavigateToTeachers) onNavigateToTeachers();
        else if (setView) setView('executives');
        break;
      case 'projects':
      case 'management':
        if (setView) setView('management');
        else if (onNavigateToEvents) onNavigateToEvents();
        break;
      default:
        if (setView) setView(targetView as View);
        break;
    }
  };

  const commonProps = {
    lang,
    madrasah,
    profile,
    institutionId,
    dataVersion,
    onNavigateToWallet,
    onNavigateToAccounting,
    onNavigateToAttendance,
    onNavigateToExams,
    onNavigateToClasses,
    onNavigateToMembers,
    onNavigateToTeachers,
    onNavigateToVoiceBroadcast,
    onNavigateToMeetings,
    onNavigateToSubscriptions,
    onNavigateToEvents
  };

  const renderDashboard = () => {
    if (profile?.role === 'member') {
      return <MemberPortalDashboard lang={lang} madrasah={madrasah} profile={profile} onNavigateToView={onNavigateToAccounting} />;
    }

    switch (instType) {
      case 'association':
        return <GenericDashboard {...commonProps} />;
      case 'club':
        return <ClubDashboard {...commonProps} setView={handleDashboardNavigate} />;
      case 'organization':
      case 'foundation':
        return <OrganizationDashboard {...commonProps} setView={handleDashboardNavigate} />;
      default:
        return <GenericDashboard {...commonProps} />;
    }
  };

  return renderDashboard();
};

export default Home;
