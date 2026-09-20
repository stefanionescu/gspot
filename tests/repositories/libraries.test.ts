import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
// Planted repository for the library presets: each ESLint addition fires on a small component, and the two file checks fire on theirs.
import { delimiter, join } from 'node:path';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const MODULES = join(import.meta.dir, '../../node_modules');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'typescript,zod,trpc,tanstack-query,zustand,react-hook-form,drizzle',
    '--without',
    'naming,spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
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
        id: 'trpc/router-boundaries',
        files: {
            'src/client/page.ts': head(
                "import { appRouter } from '../server/router.ts';\n\n/** The router, pulled into client code. */\nexport const leaked = appRouter;\n",
            ),
        },
        expected: 'is server code. Import its types with import type',
    },
    {
        id: 'drizzle/relations-complete',
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
            await using fixture = await createFixture({
                '.gitignore': 'node_modules\n',
                'package.json': PACKAGE,
                'tsconfig.json': '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "include": ["src"]\n}\n',
                'src/answer.ts': CLEAN,
            });
            symlinkSync(MODULES, join(fixture.path, 'node_modules'));
            commitAll(fixture.path);
            const environment = {
                PATH: `${join(MODULES, '.bin')}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}`,
            };
            await install(fixture.path, INIT, environment);
            const clean = run(fixture.path, ['check', 'typescript/eslint', '--no-cache'], environment);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            for (const [rule, path, text] of LINT) {
                const outcome = await runPlanted(
                    fixture.path,
                    { id: 'typescript/eslint', files: { [path]: text }, expected: rule },
                    environment,
                );
                expect(outcome.stdout, `${rule}: ${outcome.stdout}${outcome.stderr}`).toContain(rule);
            }
            for (const planted of CASES) {
                expect(run(fixture.path, ['check', planted.id, '--no-cache'], environment).code, planted.id).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            expect(run(fixture.path, ['check', 'drizzle/migrations-fresh', '--no-cache'], environment).code).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 8,
    );
});
