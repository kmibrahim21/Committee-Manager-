with open('src/pages/Account.tsx', 'r') as f:
    content = f.read()

import re
content = re.sub(
    r"\{madrasah\?\.institution_type === 'association' && \(\s*\{/\* Association Management Card \*/\}",
    r"{madrasah?.institution_type === 'association' && (",
    content
)

with open('src/pages/Account.tsx', 'w') as f:
    f.write(content)
