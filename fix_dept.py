with open('src/pages/Departments.tsx', 'r') as f:
    content = f.read()

import re

# Insert parsedConfig at the top of component
if "const parsedConfig =" not in content:
    content = content.replace(
        "const Departments: React.FC<ClassesProps> = ({ onClassClick, lang, madrasah, dataVersion, triggerRefresh, readOnly, profile }) => {",
        "const Departments: React.FC<ClassesProps> = ({ onClassClick, lang, madrasah, dataVersion, triggerRefresh, readOnly, profile }) => {\n  const parsedConfig = typeof madrasah?.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah?.config_json || {});"
    )

# Replace complex parsings I just added
content = re.sub(
    r"\(typeof madrasah\?\.config_json === 'string' \? \(\(\)=>\{try\{return JSON\.parse\(madrasah\.config_json\)\}catch\(e\)\{return \{\}\}\}\)\(\) : \(madrasah\?\.config_json \|\| \{\}\)\)",
    r"parsedConfig",
    content
)

content = re.sub(
    r"typeof madrasah\.config_json === 'string' \? \(\(\)=>\{try\{return JSON\.parse\(madrasah\.config_json\)\}catch\(e\)\{return \{\}\}\}\)\(\) : \(madrasah\.config_json \|\| \{\}\)",
    r"parsedConfig",
    content
)

# And now replace any other madrasah?.config_json where it's used for departments_config
content = content.replace("madrasah?.config_json?.departments_config", "parsedConfig?.departments_config")

with open('src/pages/Departments.tsx', 'w') as f:
    f.write(content)
