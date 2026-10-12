import { ANSWER_MODULE } from '#tests/config/components.ts';
import { ZOD_PACKAGE, STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';

export const LIBRARY_SANDBOX = {
    configurations: ['typescript'],
    tsconfig: { compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] },
    files: {
        'package.json': ZOD_PACKAGE,
        'src/answer.ts': ANSWER_MODULE,
    },
} as const;

export const DRIZZLE_CASE = {
    check: 'javascript/eslint',
    files: {
        'src/purge.ts': `// A test file.\n\nimport { db, users } from './db.ts';\n\n/** Deletes every user. */\nexport const purged = db.delete(users);\n`,
    },
    expected: { file: 'src/purge.ts', rule: 'drizzle/enforce-delete-with-where', line: 6 },
    corrected: { files: { 'src/purge.ts': ANSWER_MODULE } },
} as const;

export const ZUSTAND_CASE = {
    check: 'javascript/eslint',
    files: {
        'src/widget.ts': `// A test file.\n\nimport { create } from 'zustand';\n\n/** A store made outside a store file. */\nexport const useWidgetStore = create(() => ({ open: false }));\n`,
    },
    expected: {
        file: 'src/widget.ts',
        rule: 'no-restricted-imports',
        line: 3,
        message:
            "'create' import from 'zustand' is restricted. Create the store inside a factory that a provider owns, not as a module-level store.",
    },
    corrected: { files: { 'src/widget.ts': ANSWER_MODULE } },
} as const;

export const TRPC_CASE = {
    check: 'javascript/eslint',
    files: {
        'src/routers/users.ts': `// A test file.\n\nimport { publicProcedure } from './trpc.ts';\n\n/** A procedure with no input schema. */\nexport const list = publicProcedure.query(() => []);\n`,
    },
    expected: {
        file: 'src/routers/users.ts',
        rule: 'no-restricted-syntax',
        line: 6,
        message: 'Give the procedure an input schema before its resolver, even when the input is nothing.',
    },
    corrected: { files: { 'src/routers/users.ts': ANSWER_MODULE } },
} as const;

export const LOOSE_ZOD_SCHEMA = `// A test file.

import { z } from 'zod';

/** Accepts anything. */
export const loose = z.object({ value: z.any() });
`;

export const ZOD_PROJECT_FILES = {
    '.gitignore': 'node_modules\n',
    'package.json': ZOD_PACKAGE,
    'tsconfig.json': JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['*.ts'] }, null, 4) + '\n',
    'schema.ts': LOOSE_ZOD_SCHEMA,
    node_modules: {},
} as const;
