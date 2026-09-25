import * as fs from 'node:fs';
import { join } from 'node:path';
import { rejects } from 'node:assert/strict';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { run } from '#tests/support/cli/command.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };
import { initCommand } from '#cli/commands/init/command.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { existsSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs';

const { version: GSPOT_VERSION } = packageManifest;

test('init plans scoped spelling settings and uninstall restores the original nested configuration', async () => {
    await using directory = await testdir();
    const original = '[default]\nlocale = "en-gb"\n[default.extend-words]\nteh = "teh"\n';
    await createFileTree(directory.path, { 'nested/typos.toml': original, 'nested/sample.txt': 'colour teh\n' });
    const options = {
        cwd: directory.path,
        yes: true,
        isDryRun: true,
        json: true,
        configurations: ['spelling'],
        isListExact: true,
        hooks: 'none',
        runner: 'none',
        ci: 'none',
        rules: 'no',
        install: false,
        allowDirty: false,
    } as const;
    const preview = await initCommand({ ...options, configurations: [...options.configurations] });
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
    const installed = await initCommand({ ...options, configurations: [...options.configurations], isDryRun: false });
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
        configurations: ['none'],
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
                configurations: ['none'],
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
        configurations: ['none'],
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
        await rejects(initCommand({ ...options, configurations: [...options.configurations] }), {
            message: /Cannot read the Git index/u,
        });
        expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
    } finally {
        failed.mockRestore();
    }
    const corrected = await initCommand({ ...options, configurations: [...options.configurations] });
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
            configurations: ['none'],
            scopes: [`${scope}=`],
            hooks: 'none',
            runner: 'none',
            ci: 'none',
            rules: 'no',
            install: false,
            allowDirty: false,
        } as const;
        await rejects(
            initCommand({ ...options, configurations: [...options.configurations], scopes: [...options.scopes] }),
            {
                message: /Unsafe lifecycle|Scope directory does not exist/u,
            },
        );
        expect(existsSync(join(root, 'gspot.toml'))).toBe(false);
        expect(existsSync(join(root, '.gspot'))).toBe(false);
        expect(readFileSync(join(directory.path, 'outside/nested/keep.txt'), 'utf8')).toBe('original\n');
        unlinkSync(join(root, 'linked'));
        await createFileTree(root, { 'src/keep.txt': 'inside\n' });
        const corrected = await initCommand({
            ...options,
            configurations: [...options.configurations],
            scopes: ['src='],
        });
        expect(corrected.exitCode).toBe(0);
        expect(readFileSync(join(root, 'gspot.toml'), 'utf8')).toContain('path = "src"');
    },
);

test('initialization refuses the removed selection flag without writing files', async () => {
    await using directory = await testdir();
    const rejected = await run(directory.path, ['init', '--presets', 'typescript', '--dry-run', '--json']);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(2);
    expect(rejected.stdout + rejected.stderr).toContain("unknown option '--presets'");
    expect(existsSync(join(directory.path, 'gspot.toml'))).toBe(false);
});

test('uv is an installer rather than a task runner, and Python initialization preserves its project', async () => {
    await using sandbox = await testdir();
    const project = '[project]\nname = "sample"\nversion = "1.0.0"\ndependencies = []\n';
    await createFileTree(sandbox.path, { 'pyproject.toml': project, 'source.py': 'print("ready")\n' });
    const rejected = await run(sandbox.path, ['init', '--yes', '--runner', 'uv']);
    expect(rejected.code).toBe(2);
    for (const runner of ['mise', 'npm', 'bun', 'pnpm', 'yarn']) expect(rejected.stderr).toContain(runner);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(readFileSync(join(sandbox.path, 'pyproject.toml'), 'utf8')).toBe(project);
    const accepted = await run(sandbox.path, [
        'init',
        '--yes',
        '--dry-run',
        '--configurations',
        'python',
        '--no-runner',
        '--no-install',
        '--no-ci',
        '--no-hooks',
        '--no-rules',
    ]);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
    expect(readFileSync(join(sandbox.path, 'pyproject.toml'), 'utf8')).toBe(project);
});
