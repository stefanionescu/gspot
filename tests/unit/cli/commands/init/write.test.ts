import * as fs from 'node:fs';
import { join } from 'node:path';
import * as clack from '@clack/prompts';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import type { InitJson } from '#cli/types/commands/init.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { SHARED_FILE_RACES } from '#tests/data/commands/init.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { rm, stat, readFile, writeFile } from 'node:fs/promises';
import { simulateInteractiveTerminal } from '#tests/setup/environment.ts';
import { matchSubstring, captureRejection } from '#tests/setup/matchers.ts';

test.each([
    [
        'changes',
        async (path: string) => {
            await writeFile(path, 'disable=SC2034\n');
        },
    ],
    ['vanishes', rm],
])('init refuses to delete a replaced file that %s after the plan', async (kind, change) => {
    using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

    using mockResources = new DisposableStack();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(sandbox.path);

    const preview = await runRegisteredCommand(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--configurations',
        'bash',
    ]);
    const plan = (preview.json as InitJson).plan!;
    expect(plan.delete.map((entry) => entry.path)).toContain('.shellcheckrc');
    await using _terminal = await simulateInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await change(join(sandbox.path, '.shellcheckrc'));
            return true;
        }),
    );
    expect(await captureRejection(runRegisteredCommand(sandbox.path, ['init', '--configurations', 'bash']))).toBe(
        '.shellcheckrc changed before removal. Run the command again.',
    );
    if (kind === 'changes')
        expect(await readFile(join(sandbox.path, '.shellcheckrc'), 'utf8')).toBe('disable=SC2034\n');
    else expect(await isOnDisk(join(sandbox.path, '.shellcheckrc'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe((preview.json as InitJson).settings!);
    expect(await isOnDisk(join(sandbox.path, '.gspot/version'))).toBe(true);
});

test('a failed init keeps the ordinary generated files already written', async () => {
    using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

    await using folder = await testdir();
    await createFileTree(folder.path, { '.gspot/version': '0.0.1\n' });
    commitAll(folder.path);
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(folder.path, '.gitattributes')) throw new Error('Generated write denied');
        rename(source, target);
    });

    expect(
        await captureRejection(runRegisteredCommand(folder.path, ['init', '--yes', '--no-configurations'])),
    ).toContain('Generated write denied');
    expect(await readFile(join(folder.path, '.gspot/version'), 'utf8')).toBe(`${packageManifest.version}\n`);
});

test('init keeps the old tool file when the generated one cannot be written', async () => {
    using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored });
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, '.gspot/configurations/general/spelling/typos.toml'))
            throw new Error('Generated write denied');
        rename(source, target);
    });
    expect(
        await captureRejection(runRegisteredCommand(sandbox.path, ['init', '--yes', '--configurations', 'spelling'])),
    ).toContain('Generated write denied');
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/general/spelling/typos.toml'))).toBe(false);
});

test.each([...SHARED_FILE_RACES])(
    'init refuses to write $path when $name, and keeps its bytes and mode',
    async ({ files, configuration, path, note, edited }) => {
        using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

        using mockResources = new DisposableStack();
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, files);

        const preview = await runRegisteredCommand(sandbox.path, [
            'init',
            '--yes',
            '--dry-run',
            '--configurations',
            configuration,
        ]);
        const plan = (preview.json as InitJson).plan!;
        expect(plan.change).toContainEqual({ path, note });
        expect(plan.delete.some((entry) => entry.path === path)).toBe(false);
        let mode = 0;
        await using _terminal = await simulateInteractiveTerminal();
        mockResources.use(
            spyOn(clack, 'confirm').mockImplementation(async () => {
                await writeFile(join(sandbox.path, path), edited);
                const fileAttributes = await stat(join(sandbox.path, path));
                mode = fileAttributes.mode;
                return true;
            }),
        );
        expect(
            await captureRejection(runRegisteredCommand(sandbox.path, ['init', '--configurations', configuration])),
        ).toContain(`Destination changed during the operation: ${path}`);
        expect(await Bun.file(join(sandbox.path, path)).text()).toBe(edited);
        const after = await stat(join(sandbox.path, path));
        expect(after.mode & 0o777).toBe(mode & 0o777);
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe((preview.json as InitJson).settings!);
        expect(await isOnDisk(join(sandbox.path, '.gspot/version'))).toBe(true);
    },
);

test('init keeps a shared file that was edited after the plan', async () => {
    using _output = spyOn(process.stdout, 'write').mockReturnValue(true);

    using mockResources = new DisposableStack();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });

    const preview = await runRegisteredCommand(sandbox.path, ['init', '--yes', '--dry-run', '--configurations', 'sql']);
    const plan = (preview.json as InitJson).plan!;
    expect(plan.retained).toContainEqual({
        path: 'setup.cfg',
        note: matchSubstring('Delete the section when ready'),
    });
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
    const written = await runRegisteredCommand(sandbox.path, ['init', '--configurations', 'sql']);
    expect(written.exitCode, written.text).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/sql/sqlfluff.cfg'))).toBe(true);
});
