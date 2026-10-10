// Replace at init: the plan names hand-written hooks, the files of the selected tools, and the lint folder, and keeps
// a shared file that holds other tools' sections.
import * as fs from 'node:fs';
import { join, posix } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { readPolicy } from '#cli/policy/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { TYPO } from '#tests/config/samples/spelling.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { PYPROJECT } from '#tests/config/samples/python.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeSetup } from '#cli/commands/init/contracts.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { prepare, initCommand } from '#cli/commands/init/public.ts';
import { buildInitOptions, buildInitArguments } from '#tests/harness/init.ts';
import { INIT_FILES, INIT_ORIGINALS } from '#tests/config/samples/commands.ts';
import { PYPROJECT_TAKEOVERS } from '#tests/config/cli/commands/init/replace.ts';
import { rejection, containingAll, textContaining } from '#tests/harness/expectations.ts';
import { rm, stat, chmod, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

test.each(['', 'hooks', '.husky'])(
    'dry-run distinguishes source hooks from configured hooks at %s',
    async (hooksPath) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
            ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
        });
        gitOutput(sandbox.path, ['init', '-q']);
        if (hooksPath !== '') gitOutput(sandbox.path, ['config', 'core.hooksPath', hooksPath]);
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown'], { hooks: true }),
            '--dry-run',
        ]);
        expect(result.code).toBe(0);
        for (const token of hooksPath === '' ? ['none'] : [`${hooksPath}/`, 'pre-commit'])
            expect(result.stdout).toContain(token);
        expect(await readFile(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toContain('useThing');
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    },
);

test('the init plan replaces the files of the selected tools and lists the lint folder', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, INIT_FILES);
    commitAll(sandbox.path);
    const preview = await runGspot(sandbox.path, [
        ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown'], { hooks: true }),
        '--dry-run',
        '--json',
    ]);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan!;
    for (const path of Object.keys(INIT_ORIGINALS))
        expect(plan.remove).toContainEqual({ path, note: textContaining('replaced by the generated') });
    expect(plan.noLongerRuns).toContainEqual({ path: 'quality/', note: textContaining('lint scripts') });
    expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(false);
    const initialized = await runGspot(sandbox.path, [
        ...buildInitArguments(['bash', 'javascript', 'spelling', 'markdown'], { hooks: true }),
        '--json',
    ]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    for (const path of Object.keys(INIT_ORIGINALS)) expect(await pathExists(join(sandbox.path, path))).toBe(false);
    const policy = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    for (const carried of ['udid', 'SC2086', 'MD013']) expect(policy).not.toContain(carried);
    expect(await readFile(join(sandbox.path, 'eslint.config.mjs'), 'utf8')).toContain(
        'export { default } from "./.gspot/config/eslint.config.mjs";\n',
    );
    expect(await pathExists(join(sandbox.path, 'quality/lint.sh'))).toBe(true);
});

test.each(['setup.cfg', 'tox.ini'])(
    'init leaves shared %s in place and names the SQLFluff section for the developer',
    async (path) => {
        await using sandbox = await testdir();
        const original = '[flake8]\nignore = E501\n\n[sqlfluff]\nexclude_rules = LT01, RF01\n';
        await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
        await chmod(join(sandbox.path, path), 0o640);
        const initialized = await runGspot(sandbox.path, buildInitArguments(['sql'], { json: true }));
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(readPolicy(sandbox.path).policy.ignore).toStrictEqual([]);
        expect((JSON.parse(initialized.stdout) as InitJson).plan!.remove.some((entry) => entry.path === path)).toBe(
            false,
        );
        expect((JSON.parse(initialized.stdout) as InitJson).plan!.retained).toContainEqual({
            path,
            note: textContaining('Delete the section when ready'),
        });
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(original);
        const attributes = await stat(join(sandbox.path, path));
        expect(attributes.mode & 0o777).toBe(getKeptMode(0o640));
    },
);

test('an ignore file inside a scope is replaced at init, and the scoped check runs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# test\n',
        'db/accounts.sql': 'SELECT 1;\n',
        'db/.sqlfluffignore': '# Templates\ntemplates/\n',
    });
    commitAll(sandbox.path);
    const argv = [...buildInitArguments([]), '--scope-configurations', 'db=sql'];
    const initialized = await runGspot(sandbox.path, argv);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    expect(policy).not.toContain('templates');
    expect(await pathExists(join(sandbox.path, 'db/.sqlfluffignore'))).toBe(false);
    const selected = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const dialect = await runGspot(sandbox.path, ['set', 'tools.sqlfluff.dialect', 'postgres', '--scope', 'db']);
    expect(dialect.code, dialect.stdout + dialect.stderr).toBe(0);
    const checked = await checkReport(sandbox.path, ['check', '--only', 'sql/trivial-functions', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toMatchObject([
        { check: 'sql/trivial-functions', scope: 'db', status: 'passed', fileCount: 1 },
    ]);
});

test.each([
    [
        'changes',
        async (path: string) => {
            await writeFile(path, 'disable=SC2034\n');
        },
    ],
    ['vanishes', rm],
])('initialization refuses removal of a replaced file that %s after preview', async (kind, change) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(sandbox.path);
    const options = buildInitOptions(sandbox.path, {
        configurations: ['bash'],
    });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.removed.map((entry) => entry.path)).toContain('.shellcheckrc');
    await change(join(sandbox.path, '.shellcheckrc'));
    expect(await rejection(writeSetup(sandbox.path, options, prepared))).toBe(
        '.shellcheckrc changed after gspot read it. Run the command again.',
    );
    if (kind === 'changes')
        expect(await readFile(join(sandbox.path, '.shellcheckrc'), 'utf8')).toBe('disable=SC2034\n');
    else expect(await pathExists(join(sandbox.path, '.shellcheckrc'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(prepared.policyText);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(true);
});

test.each([true, false])(
    'initialization retains a shared authored link and its target bytes and mode (dry run: %s)',
    async (isDryRun) => {
        await using sandbox = await testdir();
        const original = '[flake8]\nignore = E501\n\n[sqlfluff]\nexclude_rules = LT01\n';
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
        expect(plan.remove.some((entry) => entry.path === 'setup.cfg')).toBe(false);
        expect(await readlink(join(sandbox.path, 'setup.cfg'))).toBe(join('settings', 'shared.cfg'));
        expect(await readFile(target, 'utf8')).toBe(original);
        const attributes = await stat(target);
        expect(attributes.mode & 0o777).toBe(getKeptMode(0o640));
        expect(await pathExists(join(sandbox.path, 'gspot.toml'))).toBe(!isDryRun);
        expect(await pathExists(join(sandbox.path, '.gspot/config/sqlfluff.cfg'))).toBe(!isDryRun);
    },
);

test.each(PYPROJECT_TAKEOVERS.flatMap((row) => ['', 'app'].map((scope) => ({ ...row, scope }))))(
    'initialization identifies retained $table settings in Python project scope "$scope"',
    async ({ configuration, table, text, source, generated, scope }) => {
        await using sandbox = await testdir();
        const path = posix.join(scope, 'pyproject.toml');
        const original = PYPROJECT + '[tool.unrelated]\nkeep = true\n\n' + text;
        await createFileTree(sandbox.path, {
            [path]: original,
            [join(scope, source.file)]: source.text,
        });
        await chmod(join(sandbox.path, path), 0o640);
        const args =
            scope === ''
                ? buildInitArguments([configuration])
                : [...buildInitArguments(['none']), '--scope-configurations', `${scope}=${configuration}`];
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
        expect(attributes.mode & 0o777).toBe(getKeptMode(0o640));
        expect(await pathExists(join(sandbox.path, generated.folder, scope, generated.file))).toBe(true);
    },
);

test('init replaces a nested spelling configuration and deletes the original', async () => {
    await using directory = await testdir();
    const original = `[default]\nlocale = "en-gb"\n[default.extend-words]\n${TYPO.the} = "${TYPO.the}"\n`;
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
            remove: containingAll([{ path: 'nested/typos.toml', note: 'replaced by the generated typos tool file' }]),
        },
    });
    expect(await readFile(join(directory.path, 'nested/typos.toml'), 'utf8')).toBe(original);
    expect(await pathExists(join(directory.path, 'gspot.toml'))).toBe(false);
    const installed = await initCommand({ ...options, isDryRun: false });
    expect(installed.exitCode).toBe(0);
    expect(await pathExists(join(directory.path, '.gitignore'))).toBe(false);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).not.toContain('en-gb');
    expect(await pathExists(join(directory.path, 'nested/typos.toml'))).toBe(false);
});

test('init reports each submodule once without reading its contents', async () => {
    await using directory = await testdir();
    await using outside = await testdir();
    await createFileTree(directory.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    commitAll(directory.path);
    const commitId = gitOutput(directory.path, ['rev-parse', 'HEAD']);
    gitOutput(directory.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},external project`]);
    await symlink(outside.path, join(directory.path, 'external project'), 'dir');
    const result = await initCommand(
        buildInitOptions(directory.path, {
            isDryRun: true,
            configurations: ['none'],
        }),
    );
    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({
        plan: { retained: [{ path: 'external project', note: 'submodule; contents are not read' }] },
    });
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
    expect(await pathExists(join(directory.path, 'gspot.toml'))).toBe(false);
});

test('failed initialization preserves the previous pin when generated publication fails', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.gspot/version': '0.0.1\n' });
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(directory.path, '.gitattributes')) throw new Error('Generated write denied');
        rename(source, target);
    });
    const options = buildInitOptions(directory.path, { configurations: ['none'] });
    expect(await rejection(initCommand(options))).toContain('Generated write denied');
    expect(await readFile(join(directory.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
});

test('init retains old configuration when a conflicting replacement cannot be published', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    const conflict = '# Maintained independently.\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored, '.gspot/config/typos.toml': conflict });
    expect(
        await rejection(
            initCommand(
                buildInitOptions(sandbox.path, {
                    configurations: ['spelling'],
                }),
            ),
        ),
    ).toContain('These files were not overwritten by gspot: .gspot/config/typos.toml.');
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(await readFile(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toBe(conflict);
});
