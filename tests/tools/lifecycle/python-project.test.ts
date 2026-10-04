import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/execution/session.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import { createPythonRegistry } from '#registry/python.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { environmentExecutable } from '#cli/platform/paths.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import type { InstalledOutput } from '#cli/types/tools/install.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { installPythonProject } from '#cli/tools/python/project.ts';
import { preparePythonInstallation } from '#tests/harness/python-installation.ts';
import { cpSync, chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { PYTHON_PROJECTS, PYTHON_INSTALL_STEPS } from '#tests/config/tools/lifecycle/python-project.ts';

test.skipIf(!isPosix).each(PYTHON_PROJECTS)(
    'private Python CLI installation preserves authored and generated inputs with %s and %s',
    async (configuration, runner) => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using registry = await createPythonRegistry(artifacts.path, runTestCommand);
        await using prepared = await preparePythonInstallation(repository.path, {
            indexFile: configuration,
            runner,
            indexUrl: registry.url,
        });
        const { rootProject, rootConfiguration } = prepared;
        const manifest = readFileSync(join(repository.path, '.gspot/pyproject.toml'));
        const lockPath = join(repository.path, '.gspot/uv.lock');
        const lock = readFileSync(lockPath);
        expect(lock.toString('utf8')).not.toContain('synthetic-uv-password');
        if (runner === 'mise') {
            // A broken uv on PATH cannot replace the pinned mise installer.
            await createFileTree(artifacts.path, { 'bin/uv': '#!/bin/sh\nexit 87\n' });
            chmodSync(join(artifacts.path, 'bin/uv'), 0o755);
        }
        const command = await spawnGspot(repository.path, ['install', '--json'], {
            ...(runner === 'mise'
                ? { PATH: `${join(artifacts.path, 'bin')}:${environmentVariables()['PATH'] ?? ''}` }
                : {}),
            MISE_TRUSTED_CONFIG_PATHS: repository.path,
            MISE_STATE_DIR: join(artifacts.path, 'mise-state'),
            MISE_CACHE_DIR: join(artifacts.path, 'mise-cache'),
            MISE_CONFIG_DIR: join(artifacts.path, 'mise-config'),
        });
        expect(command.code, command.stdout + command.stderr).toBe(0);
        expect(JSON.parse(command.stdout) as InstallJson).toMatchObject({
            installed: true,
            steps: PYTHON_INSTALL_STEPS[runner],
        });
        expect(readFileSync(join(repository.path, 'pyproject.toml'))).toStrictEqual(rootProject);
        expect(readFileSync(join(repository.path, '.venv/authored.txt'), 'utf8')).toBe('keep the project environment');
        expect(readFileSync(join(repository.path, '.gspot/pyproject.toml'))).toStrictEqual(manifest);
        expect(readFileSync(lockPath)).toStrictEqual(lock);
        expect(readFileSync(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.skipIf(!isPosix).each([
    ['uv.toml', 'none'],
    ['pyproject.toml', 'none'],
] as const)(
    'fresh Python clones install immutable inputs twice and run their tools from any location with %s and %s',
    async (configuration, runner) => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using registry = await createPythonRegistry(artifacts.path, runTestCommand);
        await using prepared = await preparePythonInstallation(repository.path, {
            indexFile: configuration,
            runner,
            indexUrl: registry.url,
        });
        const { rootConfiguration } = prepared;
        const manifest = readFileSync(join(repository.path, '.gspot/pyproject.toml'));
        const lockPath = join(repository.path, '.gspot/uv.lock');
        const lock = readFileSync(lockPath);
        const clone = join(artifacts.path, 'clone');
        commitAll(repository.path);
        gitOutput(repository.path, ['clone', '--quiet', '--no-local', repository.path, clone]);
        expect(existsSync(join(clone, '.gspot/.venv'))).toBe(false);
        expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            {
                using log = openOwnership(clone);
                const installed = await installTools(await openSession(clone), log, { refreshLocks: false });
                expect(installed.exitCode, installed.note).toBe(0);
                expect(installed.note).toContain('installed locked Python tools');
            }
            const status = await runTestCommand(['git', 'status', '--porcelain'], { cwd: clone });
            expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
            expect({
                manifest: readFileSync(join(clone, '.gspot/pyproject.toml')),
                lock: readFileSync(join(clone, '.gspot/uv.lock')),
                configuration: readFileSync(join(clone, configuration)),
            }).toStrictEqual({ manifest, lock, configuration: rootConfiguration });
        }
        const prefix = await runTestCommand(
            [environmentExecutable(join(clone, '.gspot/.venv'), 'gspot-relocation-marker')],
            {
                cwd: clone,
            },
        );
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(realpathSync(prefix.stdout.trim())).toBe(realpathSync(join(clone, '.gspot/.venv')));
        // A copied environment runs its console scripts from the copy.
        const copied = join(artifacts.path, 'relocated environment');
        cpSync(join(clone, '.gspot/.venv'), copied, { recursive: true, verbatimSymlinks: true });
        const relocated = await runTestCommand([environmentExecutable(copied, 'gspot-relocation-marker')], {
            cwd: artifacts.path,
        });
        expect(relocated.code, relocated.stderr).toBe(0);
        expect(realpathSync(relocated.stdout.trim())).toBe(realpathSync(copied));
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.skipIf(!isPosix)(
    'conflicted Python locks survive offline apply and are repaired by install',
    async () => {
        const configuration = 'uv.toml';
        const runner = 'none';
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using registry = await createPythonRegistry(artifacts.path, runTestCommand);
        await using prepared = await preparePythonInstallation(repository.path, {
            indexFile: configuration,
            runner,
            indexUrl: registry.url,
        });
        const { rootConfiguration } = prepared;
        const lockPath = join(repository.path, '.gspot/uv.lock');
        const lock = readFileSync(lockPath);
        {
            using log = openOwnership(repository.path);
            const installed = await installTools(await openSession(repository.path), log, { refreshLocks: false });
            expect(installed.exitCode, installed.note).toBe(0);
        }
        chmodSync(lockPath, 0o644);
        writeFileSync(lockPath, '<<<<<<< interrupted lock\n');
        {
            using log = openOwnership(repository.path);
            const staged: InstalledOutput[][] = [];
            expect(
                await rejection(
                    installPythonProject(
                        repository.path,
                        {
                            read: log.files.read.bind(log.files),
                            installTree: (_kind, outputs) => {
                                staged.push(outputs);
                            },
                        },
                        'uv',
                    ),
                ),
            ).toContain('Run: gspot apply, then gspot install');
            expect(staged).toStrictEqual([]);
        }
        const repaired = await spawnGspot(repository.path, ['apply']);
        expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
        {
            using log = openOwnership(repository.path);
            const installed = await installTools(await openSession(repository.path), log, { refreshLocks: false });
            expect(installed.exitCode, installed.note).toBe(0);
        }
        expect(readFileSync(lockPath)).toStrictEqual(lock);
        expect(readFileSync(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.skipIf(!isPosix)(
    'an installer that copies index credentials into a lock preserves the working environment',
    async () => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using registry = await createPythonRegistry(artifacts.path, runTestCommand);
        await using prepared = await preparePythonInstallation(repository.path, {
            indexFile: 'uv.toml',
            runner: 'none',
            indexUrl: registry.url,
        });
        const { root } = prepared;
        const markerPath = environmentExecutable(join(root, '.gspot/.venv'), 'gspot-relocation-marker');
        const marker = readFileSync(markerPath);
        const lockPath = join(root, '.gspot/uv.lock');
        const lock = readFileSync(lockPath);
        // The stand-in for uv copies the index password into the lock it leaves behind.
        await createFileTree(artifacts.path, {
            'bin/uv': "#!/bin/sh\nprintf '# synthetic-uv-password\\n' >> uv.lock\n",
        });
        chmodSync(join(artifacts.path, 'bin/uv'), 0o755);
        let refused: string;
        {
            using log = openOwnership(root);
            const staged: InstalledOutput[][] = [];
            refused = await rejection(
                installPythonProject(
                    root,
                    {
                        read: log.files.read.bind(log.files),
                        installTree: (_kind, outputs) => {
                            staged.push(outputs);
                        },
                    },
                    join(artifacts.path, 'bin/uv'),
                ),
            );
            expect(staged).toStrictEqual([]);
        }
        expect(refused).toContain('includes repository index credentials');
        expect(readFileSync(markerPath)).toStrictEqual(marker);
        const prefix = await runTestCommand([markerPath], { cwd: root });
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(realpathSync(prefix.stdout.trim())).toBe(realpathSync(join(root, '.gspot/.venv')));
        expect(readFileSync(lockPath)).toStrictEqual(lock);
    },
);
