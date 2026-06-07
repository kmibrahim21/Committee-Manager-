const fs = require('fs');
const path = require('path');

const replacements = [
  ['pages/Accounting', 'pages/CommitteeFinances'],
  ['pages/Attendance', 'pages/MemberParticipation'],
  ['AttendanceAnalyticsDashboard', 'MemberParticipationAnalytics'],
  ['components/results/ResultEngineProvider', 'components/agendas/MeetingMinutesProvider'],
  ['components/results/engines/school/SchoolResultEngine', 'components/agendas/engines/standard/StandardMeetingEngine'],
  ['components/results/engines/school/FinalResults', 'components/agendas/engines/standard/FinalMinutes'],
  ['components/results/engines/befaq/BefaqResultEngine', 'components/agendas/engines/board/BoardMeetingEngine'],
  ['components/results/engines/befaq/FinalResults', 'components/agendas/engines/board/FinalMinutes'],
  ['components/results/engines/qawmi/QawmiResultEngine', 'components/agendas/engines/general/GeneralMeetingEngine'],
  ['components/results/engines/qawmi/FinalResults', 'components/agendas/engines/general/FinalMinutes'],
  ['components/pdf/DepartmentFeeReportTemplate', 'components/pdf/DepartmentSubscriptionReportTemplate'],
  ['components/pdf/DepartmentResultTemplate', 'components/pdf/DepartmentMinutesTemplate'],
  ['components/pdf/FeeReceiptTemplate', 'components/pdf/SubscriptionReceiptTemplate'],
  ['components/pdf/FinalResultTemplate', 'components/pdf/FinalMinutesTemplate'],
  ['components/pdf/ResultSheetTemplate', 'components/pdf/MinutesSheetTemplate'],
  ['components/pdf/SeatPlanTemplate', 'components/pdf/SeatingPlanTemplate'],
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      for (const [find, replace] of replacements) {
        if (content.includes(find)) {
          content = content.split(find).join(replace);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory('./src');
console.log('Done replacement.');
