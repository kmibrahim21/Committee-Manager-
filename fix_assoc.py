with open('src/pages/AssociationManagement.tsx', 'r') as f:
    content = f.read()

# Insert parsedConfig
if "const parsedConfig =" not in content:
    content = content.replace(
        "const AssociationManagement: React.FC<Props> = ({ madrasah, lang, onBack }) => {",
        "const AssociationManagement: React.FC<Props> = ({ madrasah, lang, onBack }) => {\n  const parsedConfig = typeof madrasah?.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah?.config_json || {});"
    )

content = content.replace("madrasah?.config_json?.departments_config", "parsedConfig?.departments_config")
content = content.replace("const currentConfig = madrasah.config_json || {};", "const currentConfig = parsedConfig;")

with open('src/pages/AssociationManagement.tsx', 'w') as f:
    f.write(content)
