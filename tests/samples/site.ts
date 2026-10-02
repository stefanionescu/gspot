// The planted site build script whose output the site checks read.
export const SITE_BUILD = `import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const hadOutput = existsSync('dist/index.html');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
writeFileSync('dist/index.html', hadOutput ? 'second' : 'first');
`;
