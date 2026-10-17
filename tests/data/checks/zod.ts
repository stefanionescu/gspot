import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

const LOOSE_ZOD_SCHEMA = `// A test file.

import { z } from 'zod';

/** Accepts anything. */
export const loose = z.object({ value: z.any() });
`;

// The package.json files of test TypeScript repositories.

const ZOD_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "description": "A test package for the tests.",
    "private": true,
    "type": "module",
    "dependencies": {
        "zod": "4.6.2"
    }
}
`;

const JSON_INDENT_WIDTH = 4;

const ZOD_PROJECT_FILES = {
    '.gitignore': 'node_modules\n',
    'package.json': ZOD_PACKAGE,
    'tsconfig.json':
        JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['*.ts'] }, null, JSON_INDENT_WIDTH) + '\n',
    'schema.ts': LOOSE_ZOD_SCHEMA,
    node_modules: {},
} as const;

export { LOOSE_ZOD_SCHEMA, ZOD_PROJECT_FILES };
