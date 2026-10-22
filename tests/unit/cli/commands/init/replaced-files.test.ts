import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { INVALID_CSS } from '#tests/data/checks/css.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { type ToolPackageJson } from '#cli/types/install/npm.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { SQL_COMMAND_CHECK_TABLES } from '#tests/data/runs/command.ts';
import { GOOGLE_PYPROJECT } from '#tests/data/checks/python/project.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { stat, chmod, symlink, readFile, readlink, writeFile } from 'node:fs/promises';
import { runGspot, parseCheckReport, buildInitArguments } from '#tests/setup/cli/commands.ts';

import {
    VALID_CSS,
    INIT_FILES,
    SQL_PACKAGE_FILES,
    SHARED_SETUP_CONFIG,
    LINKED_SETUP_CONFIG,
    REPLACED_TOOL_FILES,
    STYLELINT_LOOKUP_SCRIPT,
    INACTIVE_CONFIGURATIONS,
    REPLACED_PYPROJECT_TABLES,
    STYLELINT_REPLACEMENT_CASES,
} from '#tests/data/commands/init/replaced-files.ts';

test.each([
    { hooksPath: '', line: 'hooks                none' },
    { hooksPath: 'hooks', line: 'hooks                hooks/  pre-commit, use-thing.ts (your own)' },
    { hooksPath: '.husky', line: 'hooks                .husky/  pre-commit (husky)' },
])(
    'the init plan tells hook scripts in the source apart from the hooks folder Git uses ($hooksPath)',
    async ({ hooksPath, line }) => {
        await using sandbox = await testdir({
            'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
            ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });

        runGitStep(sandbox.path, ['init', '-q']);
        if (hooksPath !== '') runGitStep(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown']),
            '--dry-run',
        ]);
        expect(result.code).toBe(0);
        expect(result.stdout.split('\n').filter((printed) => printed.startsWith('hooks '))).toStrictEqual([line]);
        expect(await readFile(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toBe(
            'export function useThing() { return true; }\n',
        );
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
        expect(plan.delete).toContainEqual({
            path,
            note: expect.stringContaining('replaced by the generated') as string,
        });
    expect(plan.delete.map(({ path }) => path)).not.toContain('.markdownlint.jsonc');
    expect(plan.write).toContainEqual({
        path: '.markdownlint.jsonc',
        note: 'replaces your file; read the old one with git show HEAD:.markdownlint.jsonc',
    });
    expect(plan.noLongerRuns).toContainEqual({
        path: 'quality/',
        note: expect.stringContaining('lint scripts') as string,
    });
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
    const original = SHARED_SETUP_CONFIG;
    await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
    await chmod(join(sandbox.path, path), 0o640);
    const initialized = await runGspot(sandbox.path, buildInitArguments(['sql'], { json: true }));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(readSettings(sandbox.path).settings.ignore).toStrictEqual([]);
    expect((JSON.parse(initialized.stdout) as InitJson).plan.delete.some((entry) => entry.path === path)).toBe(false);
    await assertRetainedFile(sandbox.path, path, original, JSON.parse(initialized.stdout) as InitJson);
});
async function assertRetainedFile(root: string, path: string, original: string, initialized: InitJson): Promise<void> {
    expect(initialized.plan.retained).toContainEqual({
        path,
        note: expect.stringContaining('Delete the section; the generated tool file replaces it.') as string,
    });
    expect(await readFile(join(root, path), 'utf8')).toBe(original);
    const attributes = await stat(join(root, path));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
}
test('init deletes the .sqlfluffignore of the db package, and project/read-sql then checks db/accounts.sql', async () => {
    await using sandbox = await testdir(SQL_PACKAGE_FILES);

    commitAll(sandbox.path);
    const commandArguments = buildInitArguments([]);
    const initialized = await runGspot(sandbox.path, commandArguments);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    await writeFile(join(sandbox.path, 'gspot.toml'), settings + SQL_COMMAND_CHECK_TABLES);
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
    'init keeps a linked shared file and the bytes and mode of the file it links to (dry run: %s)',
    async (isDryRun) => {
        await using sandbox = await testdir();
        const original = LINKED_SETUP_CONFIG;
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
            note: expect.stringContaining('Delete the section; the generated tool file replaces it.') as string,
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
            GOOGLE_PYPROJECT +
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
            note: expect.stringContaining(table) as string,
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
    const dependencies = Object.keys(
        (JSON.parse(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')) as ToolPackageJson)
            .devDependencies,
    );
    expect(dependencies).not.toContain('@commitlint/cli');
    expect(dependencies).not.toContain('syncpack');
});
test.each([...STYLELINT_REPLACEMENT_CASES])(
    'init replaces your .stylelintrc.mjs so that Stylelint still finds its settings at both levels: $name',
    async ({ scope, packageText, command: initCommand, changed, unchangedFiles }) => {
        const packagePath = posix.join(scope, 'package.json');
        const stylesheet = posix.join(scope, 'source.css');
        const authoredConfiguration = posix.join(scope, '.stylelintrc.mjs');
        await using sandbox = await testdir({
            '.gitignore': '.gspot/\n',
            [packagePath]: packageText,
            [stylesheet]: INVALID_CSS,
            [authoredConfiguration]: 'export default { rules: { "property-no-unknown": null } };\n',
        });
        commitAll(sandbox.path);
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const command = [process.execPath, '-e', STYLELINT_LOOKUP_SCRIPT, stylesheet];
        const before = await runCommand(command, { cwd: sandbox.path });
        expect(before.code, before.stdout + before.stderr).toBe(0);
        expect(before.stdout).toBe('[]');
        const preview = await runGspot(sandbox.path, [...initCommand, '--dry-run', '--json']);
        const plan = (JSON.parse(preview.stdout) as InitJson).plan;
        expect(plan.delete).toContainEqual({
            path: authoredConfiguration,
            note: 'replaced by the generated stylelint tool file',
        });
        expect(plan.change.filter(({ path }) => path === packagePath)).toStrictEqual(
            changed.map((path) => ({ path, note: 'managed stylelint fields; other content stays' })),
        );
        const written = await runGspot(sandbox.path, initCommand);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, authoredConfiguration))).toBe(false);
        for (const { path, text } of unchangedFiles)
            expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(text);
        for (const level of LEVELS) {
            const selected = await runGspot(sandbox.path, ['set', 'level', level]);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            await writeFile(join(sandbox.path, stylesheet), INVALID_CSS);
            const invalid = await runCommand(command, { cwd: sandbox.path });
            expect(invalid.code, invalid.stdout + invalid.stderr).toBe(0);
            expect(invalid.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
            await writeFile(join(sandbox.path, stylesheet), VALID_CSS);
            const corrected = await runCommand(command, { cwd: sandbox.path });
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(corrected.stdout).toBe('[]');
        }
    },
);
