const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(/name: 'নাম',\s*phone/g, 'phone');
    content = content.replace(/name: 'Name',\s*phone/g, 'phone');
    content = content.replace(/name: std.name,\s*name: departments.find[^\n]+/g, 'name: std.name,\n                      department_name: departments.find(c => c.id === std.department_id)?.name,');
    
    // For school
    content = content.replace(/name: student.name,\s*name: student.departments\?.name \|\| '',/g, "name: student.name,\n                department_name: student.departments?.name || '',");
    
    // For shortcode
    content = content.replace(/name: \(s\.departments as any\)\?\.name,/g, "department_name: (s.departments as any)?.name,");

    fs.writeFileSync(file, content);
}

fix('src/translations.ts');
fix('src/components/SmartResultAnalytics.tsx');
fix('src/components/results/engines/school/SchoolResultEngine.tsx');
fix('src/components/results/engines/befaq/BefaqResultEngine.tsx');
fix('src/services/ShortcodeService.ts');
