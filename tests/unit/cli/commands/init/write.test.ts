import * as fs from 'node:fs';
import { join } from 'node:path';
import * as clack from '@clack/prompts';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildInitOptions } from '#tests/setup/init.ts';
import * as environment from '#cli/system/environment.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { rm, stat, readFile, writeFile } from 'node:fs/promises';
import { rejection, textContaining } from '#tests/setup/matchers.ts';
import { INVALID_CSS, STYLELINT_PACKAGE_JSON } from '#tests/config/stylelint.ts';

test.each([
    [
        'changes',
        async (path: string) => {
            await writeFile(path, 'disable=SC2034\n');
        },
    ],
    ['vanishes', rm],
])('init refuses to delete a replaced file that %s after the plan', async (kind, change) => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(sandbox.path);
    const options = buildInitOptions(sandbox.path, {
        configurations: ['bash'],
    });
    const preview = await initCommand({ ...options, isDryRun: true });
    const plan = preview.json.plan!;
    expect(plan.delete.map((entry) => entry.path)).toContain('.shellcheckrc');
    mockResources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await change(join(sandbox.path, '.shellcheckrc'));
            return true;
        }),
    );
    expect(await rejection(initCommand({ ...options, yes: false }))).toBe(
        '.shellcheckrc changed before removal. Run the command again.',
    );
    if (kind === 'changes')
        expect(await readFile(join(sandbox.path, '.shellcheckrc'), 'utf8')).toBe('disable=SC2034\n');
    else expect(await pathExists(join(sandbox.path, '.shellcheckrc'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(preview.json.settings!);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(true);
});

test('a failed init keeps the previous version pin', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.gspot/version': '0.0.1\n' });
    commitAll(directory.path);
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(directory.path, '.gitattributes')) throw new Error('Generated write denied');
        rename(source, target);
    });
    const options = buildInitOptions(directory.path, { configurations: [] });
    expect(await rejection(initCommand(options))).toContain('Generated write denied');
    expect(await readFile(join(directory.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
});

test('init keeps the old tool file when the generated one cannot be written', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored });
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, '.gspot/config/typos.toml'))
            throw new Error('Generated write denied');
        rename(source, target);
    });
    expect(
        await rejection(
            initCommand(
                buildInitOptions(sandbox.path, {
                    configurations: ['spelling'],
                }),
            ),
        ),
    ).toContain('Generated write denied');
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(await pathExists(join(sandbox.path, '.gspot/config/typos.toml'))).toBe(false);
});

test('init refuses to write a shared package.json field edited after the plan', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': STYLELINT_PACKAGE_JSON, 'source.css': INVALID_CSS });
    const options = buildInitOptions(sandbox.path, { configurations: ['css'] });
    const preview = await initCommand({ ...options, isDryRun: true });
    const plan = preview.json.plan!;
    expect(plan.change).toContainEqual({
        path: 'package.json',
        note: 'managed stylelint fields; other content stays',
    });
    expect(plan.delete.some((entry) => entry.path === 'package.json')).toBe(false);
    expect(plan.retained.some((entry) => entry.path === 'package.json' && entry.note.includes('stylelint'))).toBe(
        false,
    );
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(STYLELINT_PACKAGE_JSON);
    const before = await stat(join(sandbox.path, 'package.json'));
    const edited = STYLELINT_PACKAGE_JSON.replace('native-project', 'edited-project');
    mockResources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'package.json'), edited);
            return true;
        }),
    );
    expect(await rejection(initCommand({ ...options, yes: false }))).toContain(
        'Destination changed during the operation: package.json',
    );
    expect(await Bun.file(join(sandbox.path, 'package.json')).text()).toBe(edited);
    const after = await stat(join(sandbox.path, 'package.json'));
    expect(after.mode & 0o777).toBe(before.mode & 0o777);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(preview.json.settings!);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});

test('init does not overwrite a shared file created after the plan', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'bun.lock': '{"lockfileVersion":1,"workspaces":{},"packages":{}}' });
    const options = buildInitOptions(sandbox.path, { configurations: ['dependencies'] });
    const preview = await initCommand({ ...options, isDryRun: true });
    const plan = preview.json.plan!;
    expect(plan.change).toContainEqual({
        path: 'bunfig.toml',
        note: 'managed install.minimumReleaseAge fields; other content stays',
    });
    const authored = '[install]\nexact = true\n';
    let mode = 0;
    mockResources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'bunfig.toml'), authored);
            const awaitedAttributes = await stat(join(sandbox.path, 'bunfig.toml'));
            mode = awaitedAttributes.mode;
            return true;
        }),
    );
    expect(await rejection(initCommand({ ...options, yes: false }))).toContain(
        'Destination changed during the operation: bunfig.toml',
    );
    expect(await Bun.file(join(sandbox.path, 'bunfig.toml')).text()).toBe(authored);
    const after = await stat(join(sandbox.path, 'bunfig.toml'));
    expect(after.mode & 0o777).toBe(mode & 0o777);
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(preview.json.settings!);
    expect(await pathExists(join(sandbox.path, '.gspot/version'))).toBe(false);
});

test('init keeps a shared file that was edited after the plan', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });
    const options = buildInitOptions(sandbox.path, {
        configurations: ['sql'],
    });
    const preview = await initCommand({ ...options, isDryRun: true });
    const plan = preview.json.plan!;
    expect(plan.retained).toContainEqual({
        path: 'setup.cfg',
        note: textContaining('Delete the section when ready'),
    });
    const edited = `[sqlfluff]
exclude_rules = LT01, RF01
[flake8]
ignore = E501
`;
    mockResources.use(spyOn(environment, 'isInteractive').mockReturnValue(true));
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'setup.cfg'), edited);
            return true;
        }),
    );
    const written = await initCommand({ ...options, yes: false });
    expect(written.exitCode, written.text).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    expect(await pathExists(join(sandbox.path, '.gspot/config/sqlfluff.cfg'))).toBe(true);
});
