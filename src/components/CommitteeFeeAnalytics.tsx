import React from 'react';
import { Institution, Language } from 'types';
import CommitteeFinancialAnalytics from './CommitteeFinancialAnalytics';

interface CommitteeFeeAnalyticsProps {
  madrasah: Institution;
  lang: Language;
  refreshKey?: number;
}

const CommitteeFeeAnalytics: React.FC<CommitteeFeeAnalyticsProps> = ({ madrasah, lang, refreshKey }) => {
  return (
    <CommitteeFinancialAnalytics
      institutionId={madrasah.id}
      lang={lang}
      month={new Date().toISOString().slice(0, 7)}
      refreshKey={refreshKey}
      madrasah={madrasah}
    />
  );
};

export default CommitteeFeeAnalytics;
