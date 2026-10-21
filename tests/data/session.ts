import { buildSandboxSettings } from '#tests/setup/settings.ts';

export const SESSION_FILES = {
    'gspot.toml': buildSandboxSettings(['javascript', 'naming'], { rules: true }),
    'package.json': '{"private":true,"packageManager":"bun@1.2.3"}\n',
    'entry.js': 'export const target = 1;\n',
    '.gspot/.keep': '',
};

export const MISE_LOOKUP_SCRIPT = String.raw`import { appendFileSync } from 'node:fs';
appendFileSync('../mise-calls.log', process.argv.slice(2).join(' ') + '\n');
`;

export const MISE_SESSION_FILES = {
    ...SESSION_FILES,
    'gspot.toml': buildSandboxSettings(['bash', 'naming'], { rules: true }),
};
