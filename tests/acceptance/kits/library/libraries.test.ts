// Planted repository for the library kits: each ESLint addition fires on a small component, and the two file checks fire on theirs.
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
const TABLES = `// A planted file.\n\nimport { uuid, pgTable } from 'drizzle-orm/pg-core';\n\n/** The teams. */\nexport const teams = pgTable('teams', { id: uuid('id').primaryKey() });\n\n/** The members. */\nexport const members = pgTable('members', { id: uuid('id').primaryKey(), teamId: uuid('team_id').references(() => teams.id) });\n`;

const CASES: FindingCase[] = [
    ...LINT.map(([rule, path, text]) => ({
        check: 'typescript/eslint',
        files: { [path]: text },
        expected: { file: path, rule, line: rule === 'no-restricted-imports' ? 3 : 6 },
    })),
    {
        check: 'trpc/router-boundaries',
        files: {
            'src/server/router.ts': 'export const appRouter = {};\n',
            'src/client/page.ts': `// A planted file.\n\nimport { appRouter } from '../server/router.ts';\n\n/** The router, pulled into client code. */\nexport const leaked = appRouter;\n`,
        },
        expected: { file: 'src/client/page.ts', rule: 'server-import', line: 3 },
        corrected: {
            files: {
                'src/server/router.ts': 'export const appRouter = {};\n',
                'src/client/page.ts':
                    'import type { appRouter } from "../server/router.ts";\nexport type Router = typeof appRouter;\n',
            },
        },
    },
    {
        check: 'drizzle/relations-complete',
        files: { 'src/tables.ts': TABLES },
        expected: { file: 'src/tables.ts', rule: 'relations', line: 9 },
        corrected: {
            files: {
                'src/tables.ts': `${TABLES}\nimport { relations } from "drizzle-orm";\nexport const memberRelations = relations(members, ({one}) => ({ team: one(teams, {fields: [members.teamId], references: [teams.id]}) }));\n`,
            },
        },
    },
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
