import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { toPosix } from '#cli/system/paths.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { checkInput } from '#cli/execution/built-in.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { readStagedPaths } from '#cli/repository/revisions/changes.ts';

test('named-schema Drizzle tables need relations and comments do not satisfy the requirement', async () => {
    await using sandbox = await testdir();
    const schema =
        'const schema = pgSchema("teams");\nexport const members = schema.table("members", { teamId: uuid().references(() => teams.id) });\n// relations(members, () => ({}))\n';
    await createFileTree(sandbox.path, { 'schema.ts': schema });
    await Bun.write(join(sandbox.path, 'gspot.toml'), settingsText(['drizzle'], { level: 'all' }));

    expect(await checkFindings(sandbox.path, 'drizzle/relations', { paths: ['schema.ts'] })).toMatchObject([
        { file: 'schema.ts', line: 2, rule: 'relations' },
    ]);
    await Bun.write(
        join(sandbox.path, 'schema.ts'),
        `${schema}\nexport const memberRelations = relations(members, () => ({}));\n`,
    );

    expect(await checkFindings(sandbox.path, 'drizzle/relations', { paths: ['schema.ts'] })).toStrictEqual([]);
});

test.each(['', 'packages/db'])(
    'a staged table still sees the unstaged relations file of its scope in %s',
    async (scope) => {
        await using sandbox = await testdir();
        const source = join(scope, 'schema.ts');
        const declarations = join(scope, 'relations.ts');
        await createFileTree(sandbox.path, {
            'gspot.toml':
                settingsText(['drizzle'], { rules: true, level: 'all' }) +
                (scope === '' ? '' : `[[scope]]\npath = "${scope}"\nconfigurations = []\n`),
            [source]: 'export const members = pgTable("members", { teamId: integer().references(() => teams.id) });\n',
            [declarations]: 'export const declared = relations(members, () => ({}));\n',
        });
        commitAll(sandbox.path);
        await writeFile(
            join(sandbox.path, source),
            (await readFile(join(sandbox.path, source), 'utf8')) + '// Table change\n',
        );
        gitOutput(sandbox.path, ['add', source]);
        const { staged } = await readStagedPaths(sandbox.path);
        expect(staged).toStrictEqual([toPosix(source)]);
        const session = await openSession(sandbox.path);
        const planned = planRun(session, { stage: 'commit', staged, only: ['drizzle/relations'] });
        const selected = planned.find((entry) => entry.scope.scope.path === scope)!;
        expect(selected.files.map((file) => file.path)).toContain(toPosix(declarations));
        expect(CHECK_FUNCTIONS['drizzle/relations'](checkInput(session, selected))).toStrictEqual([]);
        await writeFile(join(sandbox.path, declarations), '// relations(members, () => ({}))\n');
        const missing = await openSession(sandbox.path);
        const active = planRun(missing, { stage: 'commit', staged, only: ['drizzle/relations'] }).find(
            (entry) => entry.scope.scope.path === scope,
        )!;
        expect(CHECK_FUNCTIONS['drizzle/relations'](checkInput(missing, active))).toMatchObject([
            { file: toPosix(source), rule: 'relations' },
        ]);
    },
);

test.each(['{ teams, members }', '{ teams, people: members }'])(
    'defineRelations covers every table it names (%s), and a child scope needs its own',
    async (tables) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                settingsText(['drizzle'], { rules: true, level: 'all' }) +
                '[[scope]]\npath = "child"\nconfigurations = []\n',
            'schema.ts':
                'export const members = pgTable("members", { teamId: integer().references(() => teams.id) });\n',
            'relations.ts': `export const declared = defineRelations(${tables});\n`,
            'child/schema.ts':
                'export const members = pgTable("members", { teamId: integer().references(() => teams.id) });\n',
            'child/relations.ts': '// defineRelations({ members })\nconst example = "defineRelations({ members })";\n',
        });
        const session = await openSession(sandbox.path);
        expect(await checkFindings(session.root, 'drizzle/relations')).toStrictEqual([]);
        expect(await checkFindings(session.root, 'drizzle/relations', { scope: 'child' })).toMatchObject([
            { file: 'child/schema.ts', rule: 'relations' },
        ]);
        await writeFile(
            join(sandbox.path, 'child/relations.ts'),
            `export const declared = defineRelations(${tables});\n`,
        );
        expect(await checkFindings(sandbox.path, 'drizzle/relations', { scope: 'child' })).toStrictEqual([]);
    },
);
