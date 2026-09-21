import { symlinkSync } from 'node:fs';
// Planted repository for the library presets: each ESLint addition fires on a small component, and the two file checks fire on theirs.
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
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

const CASES: PlantedCase[] = [
    {
        check: 'trpc/router-boundaries',
        files: {
            'src/client/page.ts': head(
                "import { appRouter } from '../server/router.ts';\n\n/** The router, pulled into client code. */\nexport const leaked = appRouter;\n",
            ),
        },
        expected: 'is server code. Import its types with import type',
    },
    {
        check: 'drizzle/relations-complete',
        files: {
            'src/tables.ts': head(
                "import { pgTable, uuid } from 'drizzle-orm/pg-core';\n\n/** The teams. */\nexport const teams = pgTable('teams', { id: uuid('id').primaryKey() });\n\n/** The members. */\nexport const members = pgTable('members', { id: uuid('id').primaryKey(), teamId: uuid('team_id').references(() => teams.id) });\n",
            ),
        },
        expected: 'members references another table and has no relations entry',
    },
];

describe('the library presets', () => {
    test(
        'each ESLint addition and each file check fires on its planted defect',
        async () => {
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
            const clean = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const [rule, path, text] of LINT) {
                const outcome = await runPlanted(
                    sandbox.path,
                    { check: 'typescript/eslint', files: { [path]: text } },
                    environment,
                );
                expect(outcome.stdout, `${rule}: ${outcome.stdout}${outcome.stderr}`).toContain(rule);
            }
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, planted.check).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            const migrations = await run(
                sandbox.path,
                ['check', '--only', 'drizzle/migrations-fresh', '--no-cache'],
                environment,
            );
            expect(migrations.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 8,
    );
});
