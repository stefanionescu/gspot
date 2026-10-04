export const CLOUDFLARE_TYPES_GENERATOR = `import { readFileSync, writeFileSync } from 'node:fs';
const content = readFileSync('bindings.txt', 'utf8');
writeFileSync(process.argv[2], content);
writeFileSync('generated-note.txt', 'Generator output');
if (content === 'failure') { console.error('Types generation failed'); process.exitCode = 1; }
`;

export const CLOUDFLARE_TYPES_SCOPES = ['', 'workers/api'];
