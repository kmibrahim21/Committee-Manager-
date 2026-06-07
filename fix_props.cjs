const fs = require('fs');
const path = require('path');

function fixProps(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixProps(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            let original = content;

            // Property replacements
            content = content.replace(/\bclass_name\b/g, 'name');
            content = content.replace(/\bstudent_name\b/g, 'name');
            content = content.replace(/\bguardian_phone\b/g, 'phone');
            content = content.replace(/\bexam_name\b/g, 'title');
            content = content.replace(/\bexam_date\b/g, 'date');
            content = content.replace(/\bclass_id\b/g, 'department_id');
            content = content.replace(/\bclasses\b/g, 'departments');
            content = content.replace(/\bClassFeeReportTemplate\b/g, 'DepartmentFeeReportTemplate');
            content = content.replace(/\bClassResultTemplate\b/g, 'DepartmentResultTemplate');
            
            // Fix specific Layout errors and View strings that are incompatible
            content = content.replace(/Type '"academic-calendar"'/g, ""); // Not string replacement
            // Just manual fixes

            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed props in', fullPath);
            }
        }
    }
}

fixProps('src');
