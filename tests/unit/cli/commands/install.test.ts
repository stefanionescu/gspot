import which from 'which';
import { join, basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildInitOptions } from '#tests/setup/init.ts';
import { installCommand } from '#cli/commands/install.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { initCommand } from '#cli/commands/init/command.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { installedVersionResponse } from '#tests/setup/pins.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { MISE_FAILURES, UV_LOCK_FAILURE } from '#tests/config/tools.ts';

test('an unexpected error during install reaches the failure handler and changes nothing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = ["markdown"]
[rules]
enabled = false
`,
        'README.md': '# Example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const settings = await readFile(join(sandbox.path, 'gspot.toml'));
    const before = await readTree(sandbox.path);
    const run = processes.spawnProcess;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            if (command[0] !== 'npm') return run(command, options);
            return Promise.reject(new Error('Unexpected process failure.'));
        }),
    );
    const human = await runGspot(sandbox.path, ['install']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toContain('Unexpected process failure.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(failed.stderr).toBe('');
    expect(JSON.parse(failed.stdout)).toMatchObject({
        error: 'failure',
        message: textContaining('Unexpected process failure.'),
    });
    expect(await readFile(join(sandbox.path, 'gspot.toml'))).toStrictEqual(settings);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await pathExists(join(sandbox.path, '.gspot/package-lock.json'))).toBe(false);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...MISE_FAILURES])(
    'install after init names the remaining work when mise is $availability, keeps gspot.toml, and passes once mise works',
    async ({ availability, unavailable, exitCode, failsOn, retryMessage: retryDiagnostic }) => {
        using mockResources = new DisposableStack();
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': 'Authored project.\n' });
        commitAll(sandbox.path);
        let isRepaired = false;
        const paths = new Map(
            [...readManifests(createReadCache(process.cwd())).values()]
                .flatMap((manifest) => manifest.tools.map((tool) => tool.name))
                .map((name) => [name, which.sync(name, { nothrow: true })] as const),
        );
        paths.set('mise', which.sync('mise', { nothrow: true }));
        mockResources.use(
            spyOn(which, 'sync').mockImplementation(((name, options) => {
                const path = !isRepaired && new Set<string>(unavailable).has(name) ? null : (paths.get(name) ?? null);
                return options?.all === true && path !== null ? [path] : path;
            }) as typeof which.sync),
        );
        const native = processes.spawnProcess;
        const editorconfig = getToolDeclaration(
            readManifests(createReadCache(process.cwd())).values(),
            'editorconfig-checker',
        );
        mockResources.use(
            spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
                const version = installedVersionResponse(sandbox.path, command, editorconfig);
                if (version !== undefined) return Promise.resolve(version);
                if (command[0] !== 'mise') return native(command, options);
                const failed = !isRepaired && (failsOn === 'every call' || command[1] === failsOn);
                const code = failed ? exitCode : 0;
                return Promise.resolve({
                    code,
                    missing: code === 127,
                    duration: 0,
                    stdout: 'mise 2026.10.7',
                    stderr: '',
                });
            }),
        );
        const result = await initCommand(
            buildInitOptions(sandbox.path, {
                configurations: [],
            }),
        );
        expect(result.exitCode, result.text).toBe(0);
        const recordedVersion = await readFile(join(sandbox.path, '.gspot/version'), 'utf8');
        expect(recordedVersion.trim()).toBe(cliPackage.version);
        const session = await openSession(sandbox.path);
        expect(session.settingsFile.settings.configurations).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, 'README.md'), 'utf8')).toBe('Authored project.\n');
        const retry = await installCommand(sandbox.path);
        expect(retry.exitCode).toBe(availability === 'missing' ? 0 : 2);
        expect(retry.text).toContain(retryDiagnostic);
        const settings = await readFile(join(sandbox.path, 'gspot.toml'));
        isRepaired = true;
        const repaired = await installCommand(sandbox.path);
        expect(repaired.exitCode, repaired.text).toBe(0);
        expect(await readFile(join(sandbox.path, 'gspot.toml'))).toStrictEqual(settings);
    },
);

test('install after init refuses when uv cannot make the Python lockfile, and writes no .gspot/uv.lock', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir({ 'main.py': 'print("authored")\n' });
    const uvVersion = getToolDeclaration(readManifests(createReadCache(process.cwd())).values(), 'uv').version;
    const locks: string[][] = [];
    const run = processes.spawnProcess;
    mockResources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((command, options) => {
            if (command[0] === 'mise')
                return Promise.resolve({
                    code: 0,
                    missing: false,
                    duration: 0,
                    stdout: command[1] === 'bin-paths' ? join(sandbox.path, 'no-uv') : '',
                    stderr: '',
                });
            if (basename(command[0] ?? '', '.exe') === 'uv') {
                if (command[1] === '--version')
                    return Promise.resolve({
                        ...UV_LOCK_FAILURE,
                        code: 0,
                        stdout: `uv ${String(uvVersion)}`,
                        stderr: '',
                    });
                if (command[1] !== 'lock') throw new Error(`Unexpected uv operation: ${command.join(' ')}`);
                locks.push([...command]);
                return Promise.resolve(UV_LOCK_FAILURE);
            }
            return run(command, options);
        }),
    );
    const paths = new Map(
        [...readManifests(createReadCache(process.cwd())).values()]
            .flatMap((manifest) => manifest.tools.map((tool) => tool.name))
            .map((name) => [name, which.sync(name, { nothrow: true })] as const),
    );
    paths.set('mise', which.sync('mise', { nothrow: true }));
    mockResources.use(
        spyOn(which, 'sync').mockImplementation(((name, options) => {
            const path = name === 'uv' ? null : (paths.get(name) ?? null);
            return options?.all === true && path !== null ? [path] : path;
        }) as typeof which.sync),
    );

    const initialized = await initCommand(buildInitOptions(sandbox.path, { configurations: ['python'] }));
    expect(initialized.exitCode, initialized.text).toBe(0);
    const stale = await installCommand(sandbox.path);
    expect(stale.text).toContain('Run gspot apply first');
    expect(locks).toStrictEqual([]);
    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await installCommand(sandbox.path);
    expect(installed.exitCode, installed.text).toBe(2);
    expect(installed.text).toContain('UV lock failed (exit 1).');
    expect(installed.text).toContain(UV_LOCK_FAILURE.stderr);
    expect(locks).toHaveLength(1);
    expect(await readFile(join(sandbox.path, 'main.py'), 'utf8')).toBe('print("authored")\n');
    expect(await pathExists(join(sandbox.path, '.gspot/uv.lock'))).toBe(false);
});
