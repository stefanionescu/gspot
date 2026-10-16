import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { TYPO } from '#tests/config/spelling.ts';
import { SQL_CHECK } from '#tests/config/sql.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/commands/session.ts';
import { parseTemplate } from '#cli/settings/templates.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { parseToolProject } from '#cli/tools/npm/tool-project.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { INIT_FILES, REPLACED_TOOL_FILES } from '#tests/config/init.ts';
import { containingAll, textContaining } from '#tests/setup/matchers.ts';
import { buildInitOptions, buildInitArguments } from '#tests/setup/init.ts';
import { stat, chmod, symlink, readFile, readlink } from 'node:fs/promises';
import { PYPROJECT, PYDOCLINT_GOOGLE } from '#tests/config/python/project.ts';
import { INACTIVE_CONFIGURATIONS, REPLACED_PYPROJECT_TABLES } from '#tests/config/replace.ts';

test.each(['', 'hooks', '.husky'])(
    'the init plan tells hook scripts in the source apart from the hooks folder Git uses (%s)',
    async (hooksPath) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
            ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });
        gitOutput(sandbox.path, ['init', '-q']);
        if (hooksPath !== '') gitOutput(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown']),
            '--dry-run',
        ]);
        expect(result.code).toBe(0);
        for (const token of hooksPath === '' ? ['none'] : [`${hooksPath}/`, 'pre-commit'])
            expect(result.stdout).toContain(token);
        expect(await readFile(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toContain('useThing');
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    },
);

test('the init plan deletes the replaced tool files and lists the lint folder', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, INIT_FILES);
    commitAll(sandbox.path);
    const preview = await runGspot(sandbox.path, [
        ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown']),
        '--dry-run',
        '--json',
    ]);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan!;
    for (const path of Object.keys(REPLACED_TOOL_FILES))
        expect(plan.delete).toContainEqual({ path, note: textContaining('replaced by the generated') });
    expect(plan.noLongerRuns).toContainEqual({ path: 'quality/', note: textContaining('lint scripts') });
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    const initialized = await runGspot(sandbox.path, [
        ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown']),
        '--json',
    ]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    for (const path of Object.keys(REPLACED_TOOL_FILES)) expect(await pathExists(join(sandbox.path, path))).toBe(false);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    for (const carried of ['udid', 'SC2086', 'MD013']) expect(settings).not.toContain(carried);
    expect(await readFile(join(sandbox.path, 'eslint.config.mjs'), 'utf8')).toContain(
        'export { default } from "./.gspot/config/eslint.config.mjs";\n',
    );
    expect(await pathExists(join(sandbox.path, 'quality/lint.sh'))).toBe(true);
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
    expect((JSON.parse(initialized.stdout) as InitJson).plan!.delete.some((entry) => entry.path === path)).toBe(false);
    expect((JSON.parse(initialized.stdout) as InitJson).plan!.retained).toContainEqual({
        path,
        note: textContaining('Delete the section when ready'),
    });
    expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
    const attributes = await stat(join(sandbox.path, path));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
});

test('init replaces an ignore file inside a scope, and the scope check runs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# test\n',
        'db/accounts.sql': 'SELECT 1;\n',
        'db/package.json': '{"private":true}',
        'db/.sqlfluffignore': '# Templates\ntemplates/\n',
    });
    await Bun.write(join(sandbox.path, 'template.toml'), 'configurations = []\n' + SQL_CHECK);
    commitAll(sandbox.path);
    const argv = [...buildInitArguments([]), '--from', 'template.toml'];
    const initialized = await runGspot(sandbox.path, argv);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const settings = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    expect(settings).not.toContain('templates');
    expect(await pathExists(join(sandbox.path, 'db/.sqlfluffignore'))).toBe(false);
    const selected = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const dialect = await runGspot(sandbox.path, ['set', 'tools.sqlfluff.dialect', 'postgres', '--scope', 'db']);
    expect(dialect.code, dialect.stdout + dialect.stderr).toBe(0);
    const checked = await checkReport(sandbox.path, ['check', '--only', 'project/read-sql', '--json']);
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
        const plan = (JSON.parse(initialized.stdout) as InitJson).plan!;
        expect(plan.retained).toContainEqual({
            path: 'setup.cfg',
            note: textContaining('Delete the section when ready'),
        });
        expect(plan.delete.some((entry) => entry.path === 'setup.cfg')).toBe(false);
        expect(await readlink(join(sandbox.path, 'setup.cfg'))).toBe(join('settings', 'shared.cfg'));
        expect(await readFile(target, 'utf8')).toBe(original);
        const attributes = await stat(target);
        expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(!isDryRun);
        expect(await pathExists(join(sandbox.path, '.gspot/config/sqlfluff.cfg'))).toBe(!isDryRun);
    },
);

test.each(REPLACED_PYPROJECT_TABLES.map((row) => ({ ...row, scope: '' })))(
    'init names the $table table it leaves in pyproject.toml',
    async ({ configuration, table, text, source, generated, scope }) => {
        await using sandbox = await testdir();
        const path = posix.join(scope, 'pyproject.toml');
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
            [join(scope, source.file)]: source.text,
        });
        await chmod(join(sandbox.path, path), 0o640);
        const args = buildInitArguments([configuration]);
        const preview = await runGspot(sandbox.path, [...args, '--dry-run', '--json']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect((JSON.parse(preview.stdout) as InitJson).plan!.retained).toContainEqual({
            path,
            note: textContaining(table),
        });
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
        const initialized = await runGspot(sandbox.path, [...args, '--json']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect((JSON.parse(initialized.stdout) as InitJson).plan!.retained).toContainEqual({
            path,
            note: textContaining('Delete the section when ready'),
        });
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
        const attributes = await stat(join(sandbox.path, path));
        expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
        expect(await pathExists(join(sandbox.path, generated.folder, scope, generated.file))).toBe(true);
    },
);

test('init replaces a nested spelling configuration and deletes the original', async () => {
    await using directory = await testdir();
    const original = `[default]
locale = "en-gb"
[default.extend-words]
${TYPO.the} = "${TYPO.the}"
`;
    await createFileTree(directory.path, {
        'nested/typos.toml': original,
        'nested/sample.txt': `${TYPO.color} ${TYPO.the}\n`,
    });
    const options = buildInitOptions(directory.path, {
        isDryRun: true,
        configurations: ['spelling'],
    });
    const preview = await initCommand(options);
    expect(preview.exitCode).toBe(0);
    expect(preview.json).toMatchObject({
        plan: {
            delete: containingAll([{ path: 'nested/typos.toml', note: 'replaced by the generated typos tool file' }]),
        },
    });
    expect(await readFile(join(directory.path, 'nested/typos.toml'), 'utf8')).toBe(original);
    expect(await pathExists(join(directory.path, 'gspot.toml'))).toBe(false);
    const installed = await initCommand({ ...options, isDryRun: false });
    expect(installed.exitCode).toBe(0);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).not.toContain('en-gb');
    expect(await pathExists(join(directory.path, 'nested/typos.toml'))).toBe(false);
});

test('at level recommended, init keeps the tool files of checks that are off', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, INACTIVE_CONFIGURATIONS);
    commitAll(sandbox.path);
    const options = buildInitOptions(sandbox.path, {
        configurations: [],
        template: parseTemplate('level = "recommended"\n', 'coverage.template.toml'),
    });
    const preview = await initCommand({ ...options, isDryRun: true });
    const plan = preview.json.plan!;
    expect(plan.delete).toStrictEqual([]);
    expect(plan.change.some((row) => row.path === 'package.json')).toBe(false);
    expect(plan.write.some((row) => /commitlint|syncpack/u.test(row.path))).toBe(false);
    const written = await initCommand(options);
    expect(written.exitCode, written.text).toBe(0);
    for (const [path, source] of Object.entries(INACTIVE_CONFIGURATIONS))
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(source);
    const awaitedSession = await openSession(sandbox.path);
    const project = parseToolProject(
        await Bun.file(join(sandbox.path, '.gspot/package.json')).text(),
        awaitedSession.requirePackageManager().name,
    );
    expect(project.dependencies).not.toHaveProperty('@commitlint/cli');
    expect(project.dependencies).not.toHaveProperty('syncpack');
});
