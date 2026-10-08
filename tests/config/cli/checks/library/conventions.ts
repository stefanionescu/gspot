import { ZOD_PACKAGE } from '#tests/config/samples/typescript.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { COMPONENT_SOURCE } from '#tests/config/samples/components.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const TABLES = `// A test file.\n\nimport { uuid, pgTable } from 'drizzle-orm/pg-core';\n\n/** The teams. */\nexport const teams = pgTable('teams', { id: uuid('id').primaryKey() });\n\n/** The members. */\nexport const members = pgTable('members', { id: uuid('id').primaryKey(), teamId: uuid('team_id').references(() => teams.id) });\n`;

export const CASES: FindingCase[] = [
    {
        check: 'drizzle/relations',
        files: { 'src/tables.ts': TABLES },
        expected: { file: 'src/tables.ts', rule: 'relations', line: 9 },
        corrected: {
            files: {
                'src/tables.ts': `${TABLES}\nimport { relations } from "drizzle-orm";\nexport const memberRelations = relations(members, ({one}) => ({ team: one(teams, {fields: [members.teamId], references: [teams.id]}) }));\n`,
            },
        },
    },
];

export const REPOSITORY: RepositoryScenario = {
    installs: false,
    configurations: ['typescript', 'zod', 'trpc', 'tanstack-query', 'zustand', 'react-hook-form', 'drizzle'],
    files: {
        'package.json': ZOD_PACKAGE,
        'tsconfig.json':
            '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": [\n        "src"\n    ]\n}' +
            '\n',
        'src/answer.ts': COMPONENT_SOURCE,
    },
};
