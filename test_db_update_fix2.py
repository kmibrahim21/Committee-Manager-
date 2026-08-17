with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "if (configErr) console.error('Config update error:', configErr);",
    "if (configErr) alert('Config update error: ' + configErr.message);"
)

with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
