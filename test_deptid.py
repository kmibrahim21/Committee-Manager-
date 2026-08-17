with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "if (newDept) deptId = newDept.id;",
    "if (newDept) deptId = newDept.id; else alert('newDept is null after insert');"
)

with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
