import { rejects } from 'node:assert/strict';
import { join } from 'node:path';
import { existsSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import * as fs from 'node:fs';
import { applyCommand } from '#cli/emit/apply-command.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { initCommand } from '#cli/lifecycle/init/command.ts';
import { uninstallCommand } from '#cli/lifecycle/uninstall-command.ts';

test('init plans scoped spelling settings and uninstall restores the original nested configuration', async () => {
    await using directory = await testdir();
    const original = '[default]\nlocale = "en-gb"\n[default.extend-words]\nteh = "teh"\n';
    await createFileTree(directory.path, { 'nested/typos.toml': original, 'nested/sample.txt': 'colour teh\n' });
    const options = {
        cwd: directory.path,
        yes: true,
        isDryRun: true,
        json: true,
        presets: ['spelling'],
        isListExact: true,
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    } as const;
    const preview = await initCommand({ ...options, presets: [...options.presets] });
    expect(preview.exitCode).toBe(0);
    expect(preview.json).toMatchObject({
        plan: {
            carried: expect.arrayContaining([
                { from: 'nested: typos locale', count: 1, into: '[[scope]] nested: tools.typos.locale' },
            ]),
        },
    });
    expect(readFileSync(join(directory.path, 'nested/typos.toml'), 'utf8')).toBe(original);
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
    const installed = await initCommand({ ...options, presets: [...options.presets], isDryRun: false });
    expect(installed.exitCode).toBe(0);
    expect(existsSync(join(directory.path, '.gitignore'))).toBe(false);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toContain('en-gb');
    expect(readFileSync(join(directory.path, 'nested/typos.toml'), 'utf8')).not.toBe(original);
    await uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false });
    expect(readFileSync(join(directory.path, 'nested/typos.toml'), 'utf8')).toBe(original);
});

test('init reports each submodule once without reading its contents', async () => {
    await using directory = await testdir();
    await using outside = await testdir();
    await createFileTree(directory.path, { 'README.md': 'Repository\n' });
    await createFileTree(outside.path, { 'package.json': '{' });
    const execute = (args: string[]) => {
        const result = processes.runBlocking(['git', ...args], { cwd: directory.path });
        expect(result.code, result.stderr).toBe(0);
        return result.stdout.trim();
    };
    execute(['init']);
    execute(['add', '.']);
    execute(['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-qm', 'Source']);
    const object = execute(['rev-parse', 'HEAD']);
    execute(['update-index', '--add', '--cacheinfo', `160000,${object},external project`]);
    symlinkSync(outside.path, join(directory.path, 'external project'), 'dir');
    const result = await initCommand({
        cwd: directory.path,
        yes: true,
        isDryRun: true,
        json: true,
        presets: ['none'],
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    });
    expect(result.exitCode).toBe(0);
    expect(result.json).toMatchObject({
        plan: { retained: [{ path: 'external project', note: 'submodule; contents are not read' }] },
    });
    expect(readFileSync(join(outside.path, 'package.json'), 'utf8')).toBe('{');
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
});

test('failed initialization retains the previous pin until generated publication recovers', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.gspot/version': '0.0.1\n' });
    const rename = fs.renameSync;
    const failed = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(directory.path, '.gitattributes')) throw new Error('Generated write denied');
        rename(source, target);
    });
    try {
        await expect(
            initCommand({
                cwd: directory.path,
                yes: true,
                isDryRun: false,
                json: true,
                presets: ['none'],
                hooks: 'none',
                runner: 'none',
                ci: 'none',
                rules: 'no',
                install: false,
                allowDirty: false,
            }),
        ).rejects.toThrow('Generated write denied');
        expect(readFileSync(join(directory.path, '.gspot/version'), 'utf8')).toBe('0.0.1\n');
    } finally {
        failed.mockRestore();
    }
    expect((await applyCommand({ cwd: directory.path, isDryRun: false })).exitCode).toBe(0);
    expect(readFileSync(join(directory.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
});

test('init refuses a failed Git status before writing and succeeds after the failure is corrected', async () => {
    await using directory = await testdir();
    expect(processes.runBlocking(['git', 'init'], { cwd: directory.path }).code).toBe(0);
    const options = {
        cwd: directory.path,
        yes: true,
        isDryRun: false,
        json: true,
        presets: ['none'],
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    } as const;
    const execute = processes.runBlocking;
    const failed = spyOn(processes, 'runBlocking').mockImplementation((command, settings) =>
        command[1] === 'status'
            ? { code: 128, stdout: '', stderr: 'Cannot read the Git index.', missing: false, duration: 0 }
            : execute(command, settings),
    );
    try {
        await rejects(initCommand({ ...options, presets: [...options.presets] }), {
            message: /Cannot read the Git index/u,
        });
        expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
    } finally {
        failed.mockRestore();
    }
    const corrected = await initCommand({ ...options, presets: [...options.presets] });
    expect(corrected.exitCode).toBe(0);
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(true);
});

test.each(['../outside', 'linked', 'linked/nested', 'missing', 'README.md'])(
    'init refuses unsafe or absent scope %s before publication',
    async (scope) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'project/README.md': 'project\n',
            'outside/nested/keep.txt': 'original\n',
        });
        const root = join(directory.path, 'project');
        symlinkSync('../outside', join(root, 'linked'));
        const options = {
            cwd: root,
            yes: true,
            isDryRun: false,
            json: true,
            presets: ['none'],
            scopes: [`${scope}=`],
            hooks: 'none',
            runner: 'none',
            ci: 'none',
            rules: 'no',
            install: false,
            allowDirty: false,
        } as const;
        await rejects(initCommand({ ...options, presets: [...options.presets], scopes: [...options.scopes] }), {
            message: /Unsafe lifecycle|Scope directory does not exist/u,
        });
        expect(existsSync(join(root, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(root, '.gspot'))).toBe(false);
        expect(readFileSync(join(directory.path, 'outside/nested/keep.txt'), 'utf8')).toBe('original\n');
        unlinkSync(join(root, 'linked'));
        await createFileTree(root, { 'src/keep.txt': 'inside\n' });
        const corrected = await initCommand({ ...options, presets: [...options.presets], scopes: ['src='] });
        expect(corrected.exitCode).toBe(0);
        expect(readFileSync(join(root, 'gspot.toml'), 'utf8')).toContain('path = "src"');
    },
);
