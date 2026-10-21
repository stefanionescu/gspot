import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { SQL_CHECK } from '#tests/data/checks/sql.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { parseToolProject } from '#cli/install/npm/tool-project.ts';
import { runGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { assertPackageManager } from '#cli/repository/package-manager.ts';
import { PYPROJECT, PYDOCLINT_GOOGLE } from '#tests/data/checks/python/project.ts';
import { stat, chmod, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

import {
    INIT_FILES,
    REPLACED_TOOL_FILES,
    INACTIVE_CONFIGURATIONS,
    REPLACED_PYPROJECT_TABLES,
} from '#tests/data/commands/init.ts';

test.each(['', 'hooks', '.husky'])(
    'the init plan tells hook scripts in the source apart from the hooks folder Git uses (%s)',
    async (hooksPath) => {
        await using sandbox = await testdir({
            'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
            ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });

        readGitOutput(sandbox.path, ['init', '-q']);
        if (hooksPath !== '') readGitOutput(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown']),
            '--dry-run',
        ]);
        expect(result.code).toBe(0);
        for (const token of hooksPath === '' ? ['none'] : [`${hooksPath}/`, 'pre-commit'])
            expect(result.stdout).toContain(token);
        expect(await readFile(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toContain('useThing');
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
    },
);

test('the init plan deletes the replaced tool files and lists the lint folder', async () => {
    await using sandbox = await testdir(INIT_FILES);

    commitAll(sandbox.path);
    const preview = await runGspot(sandbox.path, [
        ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown']),
        '--dry-run',
        '--json',
    ]);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    for (const path of Object.keys(REPLACED_TOOL_FILES).filter((path) => path !== '.markdownlint.jsonc'))
        expect(plan.delete).toContainEqual({ path, note: matchSubstring('replaced by the generated') });
    expect(plan.delete.map(({ path }) => path)).not.toContain('.markdownlint.jsonc');
    expect(plan.write).toContainEqual({
        path: '.markdownlint.jsonc',
        note: 'replaces your file; read the old one with git show HEAD:.markdownlint.jsonc',
    });
    expect(plan.noLongerRuns).toContainEqual({ path: 'quality/', note: matchSubstring('lint scripts') });
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
    const initialized = await runGspot(sandbox.path, [
        ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown']),
        '--json',
    ]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    for (const path of Object.keys(REPLACED_TOOL_FILES).filter((path) => path !== '.markdownlint.jsonc'))
        expect(await isOnDisk(join(sandbox.path, path))).toBe(false);
    expect(await readFile(join(sandbox.path, '.markdownlint.jsonc'), 'utf8')).toContain(
        '{ "extends": "./.gspot/configurations/language/markdown/markdownlint.jsonc" }',
    );
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    for (const carried of ['udid', 'SC2086', 'MD013']) expect(settings).not.toContain(carried);
    expect(await readFile(join(sandbox.path, 'eslint.config.mjs'), 'utf8')).toContain(
        'export { default } from "./.gspot/configurations/language/javascript/eslint.mjs";\n',
    );
    expect(await isOnDisk(join(sandbox.path, 'quality/lint.sh'))).toBe(true);
});

test.each(['setup.cfg', 'tox.ini'])('init leaves a shared %s in place and names its SQLFluff section', async (path) => {
    await using sandbox = await testdir();
    const original = `[flake8]
ignore = E501

[sqlfluff]
exclude_rules = LT01, RF01
`;
    await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
    await chmod(join(sandbox.path, path), 0o640);
    const initialized = await runGspot(sandbox.path, buildInitArguments(['sql'], { json: true }));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.ignore).toStrictEqual([]);
    expect((JSON.parse(initialized.stdout) as InitJson).plan.delete.some((entry) => entry.path === path)).toBe(false);
    await assertRetainedFile(sandbox.path, path, original, JSON.parse(initialized.stdout) as InitJson);
});

test('init replaces an ignore file inside a scope, and the scope check runs', async () => {
    await using sandbox = await testdir({
        'README.md': '# test\n',
        'db/accounts.sql': 'SELECT 1;\n',
        'db/package.json': '{"private":true}',
        'db/.sqlfluffignore': '# Templates\ntemplates/\n',
    });

    commitAll(sandbox.path);
    const commandArguments = buildInitArguments([]);
    const initialized = await runGspot(sandbox.path, commandArguments);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(settings).not.toContain('templates');
    await writeFile(join(sandbox.path, 'gspot.toml'), settings + SQL_CHECK);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, 'db/.sqlfluffignore'))).toBe(false);
    const selected = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const dialect = await runGspot(sandbox.path, ['set', 'tools.sqlfluff.dialect', 'postgres', '--scope', 'db']);
    expect(dialect.code, dialect.stdout + dialect.stderr).toBe(0);
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'project/read-sql', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([
        { check: 'project/read-sql', scope: '', status: 'passed', fileCount: 1 },
    ]);
});

test.each([true, false])(
    'init keeps a linked shared file and its target bytes and mode (dry run: %s)',
    async (isDryRun) => {
        await using sandbox = await testdir();
        const original = `[flake8]
ignore = E501

[sqlfluff]
exclude_rules = LT01
`;
        await createFileTree(sandbox.path, { 'settings/shared.cfg': original, 'query.sql': 'SELECT 1;\n' });
        const target = join(sandbox.path, 'settings/shared.cfg');
        await chmod(target, 0o640);
        await symlink('settings/shared.cfg', join(sandbox.path, 'setup.cfg'));
        const initialized = await runGspot(sandbox.path, [
            ...buildInitArguments(['sql']),
            '--json',
            ...(isDryRun ? ['--dry-run'] : []),
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const plan = (JSON.parse(initialized.stdout) as InitJson).plan;
        expect(plan.retained).toContainEqual({
            path: 'setup.cfg',
            note: matchSubstring('Delete the section when ready'),
        });
        expect(plan.delete.some((entry) => entry.path === 'setup.cfg')).toBe(false);
        expect(await readlink(join(sandbox.path, 'setup.cfg'))).toBe(join('settings', 'shared.cfg'));
        expect(await readFile(target, 'utf8')).toBe(original);
        const attributes = await stat(target);
        expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(!isDryRun);
        expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/sql/sqlfluff.cfg'))).toBe(!isDryRun);
    },
);

test.each([...REPLACED_PYPROJECT_TABLES])(
    'init names the $table table it leaves in pyproject.toml',
    async ({ configuration, table, text, source, generated }) => {
        await using sandbox = await testdir();
        const path = 'pyproject.toml';
        const original =
            PYPROJECT +
            '\n' +
            PYDOCLINT_GOOGLE +
            `[tool.unrelated]
keep = true

` +
            text;
        await createFileTree(sandbox.path, {
            [path]: original,
            [source.file]: source.text,
        });
        await chmod(join(sandbox.path, path), 0o640);
        const commandArguments = buildInitArguments([configuration]);
        const preview = await runGspot(sandbox.path, [...commandArguments, '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as InitJson).plan.retained).toContainEqual({
            path,
            note: matchSubstring(table),
        });
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
        const initialized = await runGspot(sandbox.path, [...commandArguments, '--json']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        await assertRetainedFile(sandbox.path, path, original, JSON.parse(initialized.stdout) as InitJson);
        expect(await isOnDisk(join(sandbox.path, generated.folder, generated.file))).toBe(true);
    },
);

test('at level recommended, init keeps the tool files of checks that are off', async () => {
    await using sandbox = await testdir(INACTIVE_CONFIGURATIONS);

    commitAll(sandbox.path);
    const preview = await runGspot(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--no-configurations',
        '--level',
        'recommended',
        '--json',
    ]);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    expect(plan.delete).toStrictEqual([]);
    expect(plan.change.some((row) => row.path === 'package.json')).toBe(false);
    expect(plan.write.some((row) => /commitlint|syncpack/u.test(row.path))).toBe(false);
    const written = await runGspot(sandbox.path, ['init', '--yes', '--no-configurations', '--level', 'recommended']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    for (const [path, source] of Object.entries(INACTIVE_CONFIGURATIONS))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
    const session = await openSession(sandbox.path);
    const project = parseToolProject(
        await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8'),
        assertPackageManager(session.packageManager).name,
    );
    expect(project.dependencies).not.toHaveProperty('@commitlint/cli');
    expect(project.dependencies).not.toHaveProperty('syncpack');
});

async function assertRetainedFile(root: string, path: string, original: string, initialized: InitJson): Promise<void> {
    expect(initialized.plan.retained).toContainEqual({ path, note: matchSubstring('Delete the section when ready') });
    expect(await readFile(join(root, path), 'utf8')).toBe(original);
    const attributes = await stat(join(root, path));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
}
