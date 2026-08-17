with open('src/pages/AssociationManagement.tsx', 'r') as f:
    content = f.read()

import re

# Add parsedConfig at the beginning of the component
content = re.sub(
    r"const AssociationManagement: React.FC<Props> = \(\{([^}]+)\}\) => \{",
    r"const AssociationManagement: React.FC<Props> = ({\1}) => {\n  const parsedConfig = typeof madrasah?.config_json === 'string' ? (()=>{try{return JSON.parse(madrasah.config_json)}catch(e){return {}}})() : (madrasah?.config_json || {});",
    content
)

with open('src/pages/AssociationManagement.tsx', 'w') as f:
    f.write(content)
