import * as fs from 'fs';
import * as path from 'path';

function fixImports(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            fixImports(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            let original = content;

            // Fix the error `Module '"types"' has no exported member 'Class'` etc.
            content = content.replace(/import\s*{([^}]*)}\s*from\s*['"]types['"]/g, (match, p1) => {
                let imports = p1.split(',').map((i: string) => i.trim());
                imports = imports.map((i: string) => {
                    if (i === 'Class') return 'Department';
                    if (i === 'Student') return 'Member';
                    if (i === 'Exam') return 'Meeting';
                    if (i === 'ExamSubject') return 'MeetingSubject';
                    if (i === 'View') return 'View';
                    return i;
                });
                return `import { ${imports.join(', ')} } from 'types'`;
            });
            // Also for '../types' etc
            content = content.replace(/import\s*{([^}]*)}\s*from\s*['"]\.\.\/types['"]/g, (match, p1) => {
                let imports = p1.split(',').map((i: string) => i.trim());
                imports = imports.map((i: string) => {
                    if (i === 'Class') return 'Department';
                    if (i === 'Student') return 'Member';
                    if (i === 'Exam') return 'Meeting';
                    if (i === 'ExamSubject') return 'MeetingSubject';
                    return i;
                });
                return `import { ${imports.join(', ')} } from '../types'`;
            });
            // And '../../../../types' and such - generic match
            content = content.replace(/import\s*{([^}]*)}\s*from\s*['"](.*types.*)['"]/g, (match, p1, p2) => {
                let imports = p1.split(',').map((i: string) => i.trim());
                imports = imports.map((i: string) => {
                    if (i === 'Class') return 'Department';
                    if (i === 'Student') return 'Member';
                    if (i === 'Exam') return 'Meeting';
                    if (i === 'ExamSubject') return 'MeetingSubject';
                    return i;
                });
                return `import { ${imports.join(', ')} } from '${p2}'`;
            });

            // Specific type replacements (case sensitive mappings)
            // Be careful to not replace Partial<Class> without doing Partial<Department>
            content = content.replace(/\bClass\b/g, 'Department');
            content = content.replace(/\bStudent\b/g, 'Member');
            content = content.replace(/\bExam\b/g, 'Meeting');
            content = content.replace(/\bExamSubject\b/g, 'MeetingSubject');
            // Revert incorrectly matched ones
            // Wait, we renamed 'View' type strings earlier, no need to touch that again.

            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed imports in', fullPath);
            }
        }
    }
}

fixImports('src');
