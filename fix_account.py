with open('src/pages/Account.tsx', 'r') as f:
    content = f.read()

target = "{madrasah?.institution_type === 'association' && ({/* Association Management Card */}"
replace = "{/* Association Management Card */}\n        {madrasah?.institution_type === 'association' && ("

content = content.replace(target, replace)

with open('src/pages/Account.tsx', 'w') as f:
    f.write(content)
