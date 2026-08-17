with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

# Fix the config_json parsing in handleSaveClass
import re

content = re.sub(
    r"const currentConfig = madrasah\.config_json \|\| \{\};",
    r"const currentConfig = typeof madrasah.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah.config_json || {});",
    content
)

# Fix the config_json parsing in the UI (edit button)
content = re.sub(
    r"setNewAssociationType\(madrasah\?\.config_json\?\.departments_config\?\.\[cls\.id\]\?\.association_type \|\| ''\);",
    r"setNewAssociationType((typeof madrasah?.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah?.config_json || {}))?.departments_config?.[cls.id]?.association_type || '');",
    content
)

# Fix the config_json parsing in the UI (badge render if any - wait, there is no badge, but just in case)
content = re.sub(
    r"madrasah\?\.config_json\?\.departments_config",
    r"(typeof madrasah?.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah?.config_json || {}))?.departments_config",
    content
)

with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
