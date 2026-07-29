import fs from 'fs';

const filePath = 'src/app/api/analyze/route.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove imports and constants
content = content.replace(
  /import \{\n  type MediaAuthenticityItem,\n  type MediaAuthenticityResult,\n  type MediaAuthenticityStatus,\n\} from '@\/lib\/types';\n\nconst SIGHTENGINE_API_URL = 'https:\/\/api\.sightengine\.com\/1\.0\/check\.json';\nconst SIGHTENGINE_API_USER = process\.env\.SIGHTENGINE_API_USER;\nconst SIGHTENGINE_API_SECRET = process\.env\.SIGHTENGINE_API_SECRET;\n/,
  ''
);

// 2. Remove function call
content = content.replace(
  /      const mediaAuthenticity = await buildMediaAuthenticity\(fetchedFiles\);\n/,
  ''
);

// 3. Remove details injection
content = content.replace(
  /      result\.details = \{\n        \.\.\.\(result\.details \|\| \{\}\),\n        media_authenticity: mediaAuthenticity,\n      \};\n/,
  ''
);

// 4. Remove all sightengine functions
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.startsWith('function normalizeProbability('));
const endIdx = lines.findIndex(l => l.startsWith('export async function POST('));

if (startIdx !== -1 && endIdx !== -1) {
  lines.splice(startIdx, endIdx - startIdx);
  content = lines.join('\n');
}

fs.writeFileSync(filePath, content);
console.log('Successfully removed Sightengine functionality.');
