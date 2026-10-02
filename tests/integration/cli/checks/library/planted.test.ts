// The built-in library checks on a planted repository, run in-process: tRPC router boundaries and Drizzle relations.
import type { FindingCase } from '#tests/types/cli.ts';
import { LIBRARIES_CLEAN } from '#tests/samples/components.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { CONFIGURATION_ARRIVAL_PACKAGE } from '#tests/samples/typescript.ts';

const TABLES = `// A planted file.\n\nimport { uuid, pgTable } from 'drizzle-orm/pg-core';\n\n/** The teams. */\nexport const teams = pgTable('teams', { id: uuid('id').primaryKey() });\n\n/** The members. */\nexport const members = pgTable('members', { id: uuid('id').primaryKey(), teamId: uuid('team_id').references(() => teams.id) });\n`;

const CASES: FindingCase[] = [
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
    'the built-in library checks',
    {
        installs: false,
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
