const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const allowLocal = process.argv.includes('--allow-local');
const errors = [];

for (const field of ['name', 'displayName', 'description', 'version', 'publisher', 'license', 'icon']) {
  if (!pkg[field]) errors.push(`missing package.json field: ${field}`);
}
if (!allowLocal && pkg.publisher === 'local') errors.push('replace publisher "local" with your Marketplace Publisher ID');
if (!pkg.icon?.endsWith('.png')) errors.push('Marketplace icon must be PNG');
if (pkg.icon && !fs.existsSync(path.join(root, pkg.icon))) errors.push(`missing icon: ${pkg.icon}`);
for (const file of ['README.md', 'CHANGELOG.md', 'LICENSE', 'PRIVACY.md', 'SECURITY.md', 'SUPPORT.md']) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);
}
if ((pkg.keywords || []).length > 30) errors.push('maximum 30 keywords');

if (errors.length) {
  console.error(errors.map(x => `ERROR: ${x}`).join('\n'));
  process.exit(1);
}
console.log(`OK: ${pkg.displayName} ${pkg.version}`);
