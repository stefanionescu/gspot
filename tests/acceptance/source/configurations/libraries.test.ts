import { symlinkSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the library configurations: each ESLint addition fires on a small component, and the two file checks fire on theirs.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const MODULES = join(import.meta.dir, '../../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--configurations',
    'typescript',
    'zod',
    'trpc',
    'tanstack-query',
    'zustand',
    'react-hook-form',
    'drizzle',
    '--without',
    'naming',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const PACKAGE = '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module"\n}\n';
const CLEAN = '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';
const head = (text: string): string => `// A planted file.\n\n${text}`;

const LINT: [string, string, string][] = [
    [
        'zod/no-any-schema',
        'src/schema.ts',
        head("import { z } from 'zod';\n\n/** Accepts anything. */\nexport const loose = z.any();\n"),
    ],
    [
        'drizzle/enforce-delete-with-where',
        'src/purge.ts',
        head(
            "import { db, users } from './db.ts';\n\n/** Deletes every user. */\nexport const purged = db.delete(users);\n",
        ),
    ],
    [
        'no-restricted-imports',
        'src/widget.ts',
        head(
            "import { create } from 'zustand';\n\n/** A store made outside a store file. */\nexport const useWidgetStore = create(() => ({ open: false }));\n",
        ),
    ],
    [
        'no-restricted-syntax',
        'src/routers/users.ts',
        head(
            "import { publicProcedure } from './trpc.ts';\n\n/** A procedure with no input schema. */\nexport const list = publicProcedure.query(() => []);\n",
        ),
    ],
];

const CASES: FindingCase[] = [
    {
        check: 'trpc/router-boundaries',
        files: {
            'src/server/router.ts': 'export const appRouter = {};\n',
            'src/client/page.ts': head(
                "import { appRouter } from '../server/router.ts';\n\n/** The router, pulled into client code. */\nexport const leaked = appRouter;\n",
            ),
        },
        expected: { file: 'src/client/page.ts', rule: 'server-import', line: 3 },
    },
    {
        check: 'drizzle/relations-complete',
        files: {
            'src/tables.ts': head(
                "import { pgTable, uuid } from 'drizzle-orm/pg-core';\n\n/** The teams. */\nexport const teams = pgTable('teams', { id: uuid('id').primaryKey() });\n\n/** The members. */\nexport const members = pgTable('members', { id: uuid('id').primaryKey(), teamId: uuid('team_id').references(() => teams.id) });\n",
            ),
        },
        expected: { file: 'src/tables.ts', rule: 'relations', line: 9 },
    },
];

describe('the library configurations', () => {
    test.each<FindingCase>([
        ...LINT.map(([rule, path, text]) => ({
            check: 'typescript/eslint',
            files: { [path]: text },
            expected: { file: path, rule, line: rule === 'no-restricted-imports' ? 3 : 6 },
        })),
        ...CASES,
    ])(
        '$check reports $expected.rule in $expected.file and accepts corrected source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n',
                'src/answer.ts': CLEAN,
            });
            symlinkSync(MODULES, join(sandbox.path, 'node_modules'));
            commitAll(sandbox.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
            if (planted.check === 'trpc/router-boundaries') {
                await createFileTree(sandbox.path, {
                    ...planted.files,
                    'src/client/page.ts':
                        'import type { appRouter } from "../server/router.ts";\nexport type Router = typeof appRouter;\n',
                });
            } else if (planted.check === 'drizzle/relations-complete') {
                await createFileTree(sandbox.path, {
                    'src/tables.ts':
                        planted.files['src/tables.ts'] +
                        '\nimport { relations } from "drizzle-orm";\nexport const memberRelations = relations(members, ({one}) => ({ team: one(teams, {fields: [members.teamId], references: [teams.id]}) }));\n',
                });
            } else {
                await createFileTree(sandbox.path, { [planted.expected.file]: CLEAN });
            }
            const corrected = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 8,
    );
});
