const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(/setView\('classes'\)/g, "setView('departments')");
content = content.replace(/setView\('exams'\)/g, "setView('meetings')");
content = content.replace(/setView\('teachers'\)/g, "setView('executives')");
content = content.replace(/setView\('student-details'\)/g, "setView('member-details')");
content = content.replace(/setView\('academic-calendar'\)/g, "setView('meeting-calendar')");
content = content.replace(/academic_year_promotion/g, "membership_promotion");
content = content.replace(/can_manage_students/g, "can_manage_members");
content = content.replace(/can_manage_classes/g, "can_manage_departments");
content = content.replace(/can_manage_teachers/g, "can_manage_executives");
content = content.replace(/institutions/g, "organizations");

fs.writeFileSync('src/App.tsx', content);

// Let's do the same globally for Layout.tsx and others
let files = ['src/components/Layout.tsx', 'src/components/layouts/AppLayout.tsx', 'src/components/layouts/DesktopLayout.tsx', 'src/components/layouts/MobileLayout.tsx', 'src/pages/Account.tsx', 'src/pages/AdminPanel.tsx'];
for(let f of files) {
  let c = fs.readFileSync(f, 'utf-8');
  c = c.replace(/'classes'/g, "'departments'");
  c = c.replace(/'exams'/g, "'meetings'");
  c = c.replace(/'teachers'/g, "'executives'");
  c = c.replace(/'students'/g, "'members'");
  c = c.replace(/'student-details'/g, "'member-details'");
  c = c.replace(/'student-form'/g, "'member-form'");
  c = c.replace(/can_manage_students/g, "can_manage_members");
  c = c.replace(/can_manage_classes/g, "can_manage_departments");
  c = c.replace(/can_manage_teachers/g, "can_manage_executives");
  
  fs.writeFileSync(f, c);
}

console.log('Fixed globally');
