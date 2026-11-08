import { existsSync } from 'node:fs';
import { chmod, readFile, readlink, stat, symlink, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { LINT_FOLDER_MESSAGE } from '#cli/config/generation.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { initOutputSchema } from '#cli/schemas/commands.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import * as installers from '#cli/tools/installers/install.ts';
import {
    HOOK_NAMED_SOURCE,
    HOOKS_PATH_CASES,
    INACTIVE_CONFIGURATIONS,
    INVALID_CSS,
    LINKED_SETUP_CONFIG,
    REPLACED_CONFIG_DELETIONS,
    REPLACED_PYPROJECT_TABLES,
    SHARED_SETUP_CONFIG,
    SQL_PACKAGE_FILES,
    STYLELINT_REPLACEMENT_CASES,
    SYNCPACK_FILE,
} from '#tests/config/generation/plan.ts';
import { EMPTY_DEFAULT_SOURCE, GOOGLE_PYPROJECT } from '#tests/config/setup/languages.ts';
import {
    EMPTY_TOOL_INSTALL,
    INIT_FILES,
    SQL_COMMAND_CHECK,
    SQL_SEARCH_ARGUMENTS,
    SYNCPACK_PACKAGE_FILES,
} from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test.each([...HOOKS_PATH_CASES])(
    'the init plan tells hook scripts in the source apart from the hooks folder Git uses ($hooksPath)',
    async ({ hooksPath, line }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        await using sandbox = await createGitSandbox({
            'hooks/use-thing.ts': HOOK_NAMED_SOURCE,
            ...(hooksPath !== '' && { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });

        if (hooksPath !== '') runGitStep(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        const result = await runGspot(sandbox.path, ['init', '--configurations', 'bash,javascript,spelling,markdown']);
        expect(result.code).toBe(0);
        expect(result.stdout.split('\n').filter((printed) => printed.startsWith('existing hooks '))).toStrictEqual([
            line,
        ]);
        expect(await readFile(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toBe(HOOK_NAMED_SOURCE);
    },
);

test('the init plan deletes the conflicting config files and lists the lint folder', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir(INIT_FILES);

    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, [
        'init',
        '--configurations',
        'bash,javascript,spelling,markdown',
        '--json',
    ]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const plan = initOutputSchema.parse(JSON.parse(initialized.stdout)).plan;
    expect(plan.deleted.map(({ path }) => path)).toStrictEqual(REPLACED_CONFIG_DELETIONS.map(({ path }) => path));
    expect(plan.lintFolders).toStrictEqual([{ path: 'quality/', note: LINT_FOLDER_MESSAGE }]);
    for (const { path } of REPLACED_CONFIG_DELETIONS) expect(existsSync(join(sandbox.path, path))).toBe(false);
    expect(existsSync(join(sandbox.path, 'quality/lint.sh'))).toBe(true);
});

test.each(['setup.cfg'])('init leaves a shared %p in place and names its SQLFluff section', async (path) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, { [path]: SHARED_SETUP_CONFIG, 'query.sql': 'SELECT 1;\n' });
    await chmod(join(sandbox.path, path), 0o640);
    const initialized = await runGspot(sandbox.path, ['init', '--configurations', 'sql', '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const plan = initOutputSchema.parse(JSON.parse(initialized.stdout)).plan;
    expect(plan.keep).toStrictEqual([{ path, note: expect.stringContaining('sqlfluff') as string }]);
    await assertFileKept(sandbox.path, path, SHARED_SETUP_CONFIG);
});

async function assertFileKept(root: string, path: string, previous: string): Promise<void> {
    expect(await readFile(join(root, path), 'utf8')).toBe(previous);
    const attributes = await stat(join(root, path));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
}

test('init deletes the .sqlfluffignore of the db package, and project/read-sql then checks db/accounts.sql', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir(SQL_PACKAGE_FILES);

    commitAll(sandbox.path);
    const commandArguments = ['init'];
    const initialized = await runGspot(sandbox.path, commandArguments);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    const sqlCheck = { ...SQL_COMMAND_CHECK, command: buildProgramCommand('checks/search', ...SQL_SEARCH_ARGUMENTS) };
    await writeFile(join(sandbox.path, 'gspot.toml'), settings + stringify({ command_check: [sqlCheck] }));
    await applyGeneratedFiles(sandbox.path);
    expect(existsSync(join(sandbox.path, 'db/.sqlfluffignore'))).toBe(false);
    const levelSet = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(levelSet.code, levelSet.stdout + levelSet.stderr).toBe(0);
    const dialect = await runGspot(sandbox.path, ['set', 'sql.dialect', 'postgres', '--scope', 'db']);
    expect(dialect.code, dialect.stdout + dialect.stderr).toBe(0);
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'project/read-sql', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([
        { check: 'project/read-sql', scope: '', status: 'passed', fileCount: 1 },
    ]);
});

test('init keeps a linked shared file and the bytes and mode of the file it links to', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({});
    await createFileTree(sandbox.path, { 'settings/shared.cfg': LINKED_SETUP_CONFIG, 'query.sql': 'SELECT 1;\n' });
    const target = join(sandbox.path, 'settings/shared.cfg');
    await chmod(target, 0o640);
    await symlink('settings/shared.cfg', join(sandbox.path, 'setup.cfg'));
    const initialized = await runGspot(sandbox.path, ['init', '--configurations', 'sql', '--json']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const plan = initOutputSchema.parse(JSON.parse(initialized.stdout)).plan;
    expect(plan.keep).toStrictEqual([{ path: 'setup.cfg', note: expect.stringContaining('sqlfluff') as string }]);
    expect(plan.deleted.map(({ path }) => path)).not.toContain('setup.cfg');
    expect(await readlink(join(sandbox.path, 'setup.cfg'))).toBe(join('settings', 'shared.cfg'));
    expect(await readFile(target, 'utf8')).toBe(LINKED_SETUP_CONFIG);
    const attributes = await stat(target);
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o640 }));
    const generated = join(sandbox.path, getManifestTarget('sql', 'sqlfluff.cfg'));
    expect(existsSync(generated)).toBe(true);
});

test.each([...REPLACED_PYPROJECT_TABLES])(
    'init names the $table table it leaves in pyproject.toml',
    async ({ configuration, table, text, source, generated }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        await using sandbox = await createGitSandbox({});
        const path = 'pyproject.toml';
        const previous = `${GOOGLE_PYPROJECT}[tool.unrelated]\nkeep = true\n\n${text}`;
        await createFileTree(sandbox.path, {
            [path]: previous,
            [source.file]: source.text,
        });
        await chmod(join(sandbox.path, path), 0o640);
        const commandArguments = ['init', '--configurations', configuration];
        const initialized = await runGspot(sandbox.path, [...commandArguments, '--json']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(initOutputSchema.parse(JSON.parse(initialized.stdout)).plan.keep).toStrictEqual([
            { path, note: expect.stringContaining(table) as string },
        ]);
        await assertFileKept(sandbox.path, path, previous);
        expect(existsSync(join(sandbox.path, generated))).toBe(true);
    },
);

test('at level basic, init keeps the config files of checks that are off', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await testdir(INACTIVE_CONFIGURATIONS);

    commitAll(sandbox.path);
    const written = await runGspot(sandbox.path, ['init', '--configurations', 'gspot', '--level', 'basic', '--json']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const plan = initOutputSchema.parse(JSON.parse(written.stdout)).plan;
    expect(plan.deleted).toStrictEqual([]);
    expect(plan.change.map(({ path }) => path)).toStrictEqual(['package.json']);
    expect(plan.write.map(({ path }) => path).filter((path) => /commitlint|syncpack/u.test(path))).toStrictEqual([]);
    for (const [path, source] of Object.entries(INACTIVE_CONFIGURATIONS)) {
        const text = await readFile(join(sandbox.path, path), 'utf8');
        if (path === 'package.json') expect(JSON.parse(text)).toMatchObject(JSON.parse(source) as object);
        else expect(text).toBe(source);
    }
});

test.each([...STYLELINT_REPLACEMENT_CASES])(
    'init replaces your .stylelintrc.mjs so that Stylelint still finds its settings: $name',
    async ({ scope, packageText, command: initCommand, changed, unchangedFiles }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        const packagePath = posix.join(scope, 'package.json');
        const stylesheet = posix.join(scope, 'source.css');
        const authoredConfiguration = posix.join(scope, '.stylelintrc.mjs');
        await using sandbox = await testdir({
            '.gitignore': `${GSPOT_FOLDER}/\n`,
            [packagePath]: packageText,
            [stylesheet]: INVALID_CSS,
            [authoredConfiguration]: 'export default { rules: { "property-no-unknown": null } };\n',
        });
        commitAll(sandbox.path);
        await linkInstalledModules(join(sandbox.path, GSPOT_PATHS.nodeModules));
        const command = buildProgramCommand('checks/stylelint', stylesheet);
        const before = await runCommand(command, { cwd: sandbox.path });
        expect(before, before.stderr).toMatchObject({ code: 0, stdout: '[]' });
        const written = await runGspot(sandbox.path, [...initCommand, '--json']);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        const plan = initOutputSchema.parse(JSON.parse(written.stdout)).plan;
        expect(plan.deleted).toContainEqual({
            path: authoredConfiguration,
            note: expect.stringContaining('stylelint') as string,
        });
        expect(
            plan.change
                .filter(({ path, note }) => path === packagePath && note.includes('stylelint'))
                .map(({ path }) => path),
        ).toStrictEqual([...changed]);
        expect(existsSync(join(sandbox.path, authoredConfiguration))).toBe(false);
        for (const { path, text } of unchangedFiles) {
            const saved = await readFile(join(sandbox.path, path), 'utf8');
            expect(JSON.parse(saved)).toMatchObject(JSON.parse(text) as object);
        }
        const invalid = await runCommand(command, { cwd: sandbox.path });
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(0);
        expect(invalid.stdout).toBe('[{"rule":"property-no-unknown","line":2,"column":5,"severity":"error"}]');
        await writeFile(join(sandbox.path, stylesheet), 'a {\n    opacity: 1;\n}\n');
        const corrected = await runCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe('[]');
    },
);

test('init replaces an authored Syncpack file and keeps syncpack.config.cts and .mts', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        ...SYNCPACK_PACKAGE_FILES,
        [SYNCPACK_FILE.file]: SYNCPACK_FILE.source,
        'syncpack.config.cts': 'module.exports = {};\n',
        'syncpack.config.mts': EMPTY_DEFAULT_SOURCE,
    });
    commitAll(sandbox.path);
    const initialized = await runGspot(sandbox.path, ['init', '--configurations', 'gspot', '--level', 'all']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, SYNCPACK_FILE.file))).toBe(false);
    expect(await readFile(join(sandbox.path, 'syncpack.config.cts'), 'utf8')).toBe('module.exports = {};\n');
    expect(await readFile(join(sandbox.path, 'syncpack.config.mts'), 'utf8')).toBe(EMPTY_DEFAULT_SOURCE);
});
