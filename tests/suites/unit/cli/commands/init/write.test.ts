import * as fs from 'node:fs';
import { join } from 'node:path';
import * as clack from '@clack/prompts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { InitJson } from '#cli/types/commands/init.ts';
import { TEST_VERSION } from '#tests/config/commands/samples.ts';
import { rm, stat, readFile, writeFile } from 'node:fs/promises';
import { EDITED_STYLELINT_PACKAGE } from '#tests/config/apply.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { STYLELINT_PACKAGE_JSON } from '#tests/config/checks/language/css.ts';
import { CSS_MANAGED_PLAN_CHANGES } from '#tests/config/commands/init/write.ts';
import { simulateInteractiveTerminal } from '#tests/setup/system/environment.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { INVALID_CSS, buildRetainedNote } from '#tests/config/commands/init/samples.ts';

test.each([
    [
        'changes',
        async (path: string) => {
            await writeFile(path, 'disable=SC2034\n');
        },
    ],
    ['vanishes', rm],
])('init refuses to delete a conflicting config file that %p after the plan', async (kind, change) => {
    using mockResources = new DisposableStack();
    await using sandbox = await createGitSandbox({ '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });

    commitAll(sandbox.path);

    const preview = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--configurations', 'bash', '--json']);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    expect(plan.delete).toStrictEqual([
        { path: '.shellcheckrc', note: 'replaced by the generated shellcheck config file' },
    ]);
    await using _terminal = await simulateInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await change(join(sandbox.path, '.shellcheckrc'));
            return true;
        }),
    );
    const refused = await runGspot(sandbox.path, ['init', '--configurations', 'bash']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('.shellcheckrc changed before removal. Run the command again.\n');
    if (kind === 'changes')
        expect(await readFile(join(sandbox.path, '.shellcheckrc'), 'utf8')).toBe('disable=SC2034\n');
    else expect(await isOnDisk(join(sandbox.path, '.shellcheckrc'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(
        (JSON.parse(preview.stdout) as InitJson).settings,
    );
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.versionPin))).toBe(true);
});

test('a failed init keeps the version pin it already wrote', async () => {
    await using sandbox = await testdir({ [GSPOT_PATHS.versionPin]: `${TEST_VERSION}\n` });

    commitAll(sandbox.path);
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, '.gitattributes')) throw new Error('Generated write denied');
        rename(source, target);
    });

    const refused = await runGspot(sandbox.path, ['init', '--yes', '--no-configurations']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        'gspot stopped because of an internal error: Generated write denied. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n',
    );
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.versionPin), 'utf8')).toBe(`${cliPackage.version}\n`);
});

test('init keeps the old config file when the generated one cannot be written', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored });
    commitAll(sandbox.path);
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, findManifestTarget('spelling', 'typos.toml')))
            throw new Error('Generated write denied');
        rename(source, target);
    });
    const refused = await runGspot(sandbox.path, ['init', '--yes', '--configurations', 'spelling']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        'gspot stopped because of an internal error: Generated write denied. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n',
    );
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    const isObserved = await isOnDisk(join(sandbox.path, findManifestTarget('spelling', 'typos.toml')));
    expect(isObserved).toBe(false);
});

test('init refuses to write package.json when one of its managed fields changed after the plan, and keeps its bytes and mode', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir({ 'package.json': STYLELINT_PACKAGE_JSON, 'source.css': INVALID_CSS });
    runGitStep(sandbox.path, ['init', '--quiet']);

    const preview = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--configurations', 'css', '--json']);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    expect(plan.change).toStrictEqual([...CSS_MANAGED_PLAN_CHANGES]);
    expect(plan.delete.map(({ path }) => path)).not.toContain('package.json');
    let mode = 0;
    await using _terminal = await simulateInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'package.json'), EDITED_STYLELINT_PACKAGE);
            const fileAttributes = await stat(join(sandbox.path, 'package.json'));
            mode = fileAttributes.mode;
            return true;
        }),
    );
    const refused = await runGspot(sandbox.path, ['init', '--configurations', 'css']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('package.json changed while gspot wrote it. Run the command again.\n');
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(EDITED_STYLELINT_PACKAGE);
    const after = await stat(join(sandbox.path, 'package.json'));
    expect(after.mode & 0o777).toBe(mode & 0o777);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(
        (JSON.parse(preview.stdout) as InitJson).settings,
    );
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.versionPin))).toBe(true);
});

test('init keeps a shared file that was edited after the plan', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await createGitSandbox({
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });

    const preview = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--configurations', 'sql', '--json']);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    expect(plan.retained).toStrictEqual([{ path: 'setup.cfg', note: buildRetainedNote('sqlfluff') }]);
    const edited = `[sqlfluff]
exclude_rules = LT01, RF01
[flake8]
ignore = E501
`;
    await using _terminal = await simulateInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'setup.cfg'), edited);
            return true;
        }),
    );
    const written = await runGspot(sandbox.path, ['init', '--configurations', 'sql']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    const isObserved = await isOnDisk(join(sandbox.path, findManifestTarget('sql', 'sqlfluff.cfg')));
    expect(isObserved).toBe(true);
});
test.each([true, false])('init writes gspot.toml only when you confirm the plan (answer %p)', async (answer) => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    await using _terminal = await simulateInteractiveTerminal();
    using confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(answer);
    expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: true });
});
test('init writes nothing and says Canceled. Nothing was written. when you cancel the confirmation', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    await using _terminal = await simulateInteractiveTerminal();
    using _confirmation = spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel'));
    const refused = await runGspot(sandbox.path, ['init']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('Canceled. Nothing was written.\n');
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
});
