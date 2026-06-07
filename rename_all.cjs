const fs = require('fs');
const path = require('path');

function replaceInDir(dir, replacements) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            replaceInDir(fullPath, replacements);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            let original = content;
            for (const [search, replace] of replacements) {
                // simple string replace all or basic regex
                content = content.split(search).join(replace);
            }
            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed', fullPath);
            }
        }
    }
}

const replacements = [
    ["pages/Classes", "pages/Departments"],
    ["madrasah_admin", "org_admin"],
    ["'teacher'", "'executive'"],
    ["=== 'teacher'", "=== 'executive'"],
    ["types' has no exported member 'Class'", ""], // this is an error string, I should rename the import
    ["import { Class }", "import { Department }"],
    ["import { Class,", "import { Department,"],
    ["import { Student }", "import { Member }"],
    ["import { Student,", "import { Member,"],
    ["import { Exam }", "import { Meeting }"],
    ["import { Exam,", "import { Meeting,"],
    ["import { ExamSubject }", "import { MeetingSubject }"], // if any
    ["allowed_classes", "allowed_departments"],
    ["can_manage_results", "can_manage_meetings"],
    ["can_manage_exams", "can_manage_meetings"],
    ["can_manage_students", "can_manage_members"],
    [": Class", ": Department"],
    ["<Class", "<Department"],
    [": Student", ": Member"],
    ["<Student", "<Member"],
    [": Exam", ": Meeting"],
    ["<Exam", "<Meeting"],
    ["'student-details'", "'member-details'"],
    ["'students'", "'members'"],
    ["'classes'", "'departments'"],
    ["'teachers'", "'executives'"],
    ["'exams'", "'meetings'"],
];

replaceInDir('src', replacements);
