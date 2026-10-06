// Native coverage fixtures span every language extension, detected scripts, and a child scope.
export const REQUIRED_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}\n',
    'source.js': 'export const value = 1;\n',
    'source.mjs': 'export const value = 1;\n',
    'source.cjs': 'export const value = 1;\n',
    'source.jsx': 'export const value = 1;\n',
    'source.ts': 'export const value = 1;\n',
    'source.tsx': 'export const value = 1;\n',
    'source.mts': 'export const value = 1;\n',
    'source.cts': 'export const value = 1;\n',
    'scripts/run': '#!/usr/bin/env node\nexport const value = 1;\n',
    'scripts/run.task': '#!/usr/bin/env node\nexport const value = 1;\n',
    'scripts/shell': '#!/bin/bash\nprintf "value\\n"\n',
    'README.md': '# Fixture\n',
    'child/source.js': 'export const child = 1;\n',
};

export const REQUIRED_RULE_OVERRIDE = `import base from './base.mjs';
export default [...base,
    { files: ['**/*'], rules: { eqeqeq: 'off', 'import-x/exports-last': 'off' } },
    { files: ['**/*.{ts,tsx,mts,cts}'], rules: { '@typescript-eslint/no-floating-promises': 'off' } },
];\n`;

export const REQUIRED_RULE_MESSAGES = {
    eqeqeq: 'Enable eqeqeq for 10 files (scripts/run, scripts/run.task, source.cjs, and 7 more). The javascript configuration requires this rule.',
    typed: 'Enable @typescript-eslint/no-floating-promises for 4 files (source.cts, source.mts, source.ts, and 1 more). The typescript configuration requires this rule.',
    declarations:
        'Enable import-x/exports-last for 10 files (scripts/run, scripts/run.task, source.cjs, and 7 more). The javascript configuration requires this rule.',
};

export const FRAMEWORK_RULE_OVERRIDE = `import base from './base.mjs';
export default [...base, { files: ['**/*.{jsx,tsx}'], rules: {
    eqeqeq: 'off', 'react-hooks/rules-of-hooks': 'off',
} }];\n`;
