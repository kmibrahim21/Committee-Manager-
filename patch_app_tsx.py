import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add import
import_stmt = "import AssociationManagement from './pages/AssociationManagement';\n"
content = content.replace("import Account from 'pages/Account';", "import Account from 'pages/Account';\n" + import_stmt)

# Add case
case_stmt = """      case 'management':
        return <AssociationManagement lang={lang} madrasah={madrasah} onBack={() => setView('account')} role={role} profile={profile} />;
"""
content = content.replace("      case 'account':", case_stmt + "      case 'account':")

with open('src/App.tsx', 'w') as f:
    f.write(content)

