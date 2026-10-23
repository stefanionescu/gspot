import { JSON_INDENT } from '#cli/config/text.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

export const LOOSE_ZOD_SCHEMA = `// A test file.

import { z } from 'zod';

/** Accepts anything. */
export const loose = z.object({ value: z.any() });
`;

/** The package.json of the Zod sample, which selects the zod configuration. */
const ZOD_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "description": "A test package for the tests.",
    "private": true,
    "type": "module",
    "dependencies": {
        "zod": "${testsPackage.devDependencies.zod}"
    }
}
`;

export const ZOD_PROJECT_FILES = {
    '.gitignore': 'node_modules\n',
    'package.json': ZOD_PACKAGE,
    'tsconfig.json':
        JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['*.ts'] }, null, JSON_INDENT) + '\n',
    'schema.ts': LOOSE_ZOD_SCHEMA,
    node_modules: {},
} as const;
