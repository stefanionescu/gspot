import { ZOD_PACKAGE } from '#tests/config/samples/typescript.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { COMPONENT_SOURCE } from '#tests/config/samples/components.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const REPOSITORY: InstalledScenario = {
    configurations: ['typescript', 'zod', 'trpc', 'zustand', 'drizzle'],
    files: {
        'package.json': ZOD_PACKAGE,
        'tsconfig.json':
            '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": [\n        "src"\n    ]\n}' +
            '\n',
        'src/answer.ts': COMPONENT_SOURCE,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'javascript/eslint',
        files: {
            'src/purge.ts': `// A test file.\n\nimport { db, users } from './db.ts';\n\n/** Deletes every user. */\nexport const purged = db.delete(users);\n`,
        },
        expected: { file: 'src/purge.ts', rule: 'drizzle/enforce-delete-with-where', line: 6 },
        corrected: { files: { 'src/purge.ts': COMPONENT_SOURCE } },
    },
    {
        check: 'javascript/eslint',
        files: {
            'src/widget.ts': `// A test file.\n\nimport { create } from 'zustand';\n\n/** A store made outside a store file. */\nexport const useWidgetStore = create(() => ({ open: false }));\n`,
        },
        expected: {
            file: 'src/widget.ts',
            rule: 'no-restricted-imports',
            line: 3,
            message: 'Create the store inside a factory that a provider owns',
        },
        corrected: { files: { 'src/widget.ts': COMPONENT_SOURCE } },
    },
    {
        check: 'javascript/eslint',
        files: {
            'src/routers/users.ts': `// A test file.\n\nimport { publicProcedure } from './trpc.ts';\n\n/** A procedure with no input schema. */\nexport const list = publicProcedure.query(() => []);\n`,
        },
        expected: {
            file: 'src/routers/users.ts',
            rule: 'no-restricted-syntax',
            line: 6,
            message: 'Give the procedure an input schema before its resolver',
        },
        corrected: { files: { 'src/routers/users.ts': COMPONENT_SOURCE } },
    },
];
