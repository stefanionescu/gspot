// Planted repository for the library kits: each ESLint addition fires on a small component.
import type { FindingCase } from '#tests/types/cli.ts';
import { LIBRARIES_CLEAN } from '#tests/samples/components.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { CONFIGURATION_ARRIVAL_PACKAGE } from '#tests/samples/typescript.ts';

const LINT: [string, string, string][] = [
    [
        'zod/no-any-schema',
        'src/schema.ts',
        `// A planted file.\n\nimport { z } from 'zod';\n\n/** Accepts anything. */\nexport const loose = z.any();\n`,
    ],
    [
        'drizzle/enforce-delete-with-where',
        'src/purge.ts',
        `// A planted file.\n\nimport { db, users } from './db.ts';\n\n/** Deletes every user. */\nexport const purged = db.delete(users);\n`,
    ],
    [
        'no-restricted-imports',
        'src/widget.ts',
        `// A planted file.\n\nimport { create } from 'zustand';\n\n/** A store made outside a store file. */\nexport const useWidgetStore = create(() => ({ open: false }));\n`,
    ],
    [
        'no-restricted-syntax',
        'src/routers/users.ts',
        `// A planted file.\n\nimport { publicProcedure } from './trpc.ts';\n\n/** A procedure with no input schema. */\nexport const list = publicProcedure.query(() => []);\n`,
    ],
];

const CASES: FindingCase[] = [
    ...LINT.map(([rule, path, text]) => ({
        check: 'javascript/eslint',
        files: { [path]: text },
        expected: { file: path, rule, line: rule === 'no-restricted-imports' ? 3 : 6 },
    })),
];

plantedCases(
    'the library kits',
    {
        kits: ['typescript', 'zod', 'trpc', 'tanstack-query', 'zustand', 'react-hook-form', 'drizzle'],
        files: {
            'package.json': CONFIGURATION_ARRIVAL_PACKAGE,
            'tsconfig.json':
                '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n',
            'src/answer.ts': LIBRARIES_CLEAN,
        },
        corrected: (planted) => ({
            files: Object.fromEntries(Object.keys(planted.files).map((path) => [path, LIBRARIES_CLEAN])),
        }),
    },
    CASES,
);
