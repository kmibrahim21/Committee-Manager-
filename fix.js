const fs = require('fs');
const content = fs.readFileSync('src/components/Layout.tsx', 'utf-8');
const split = content.split('export default Layout;');
if (split.length > 1) {
  fs.writeFileSync('src/components/Layout.tsx', split[0] + 'export default Layout;\n');
  console.log('Fixed duplicate Layout.tsx');
}
