import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { environmentExecutable } from '#cli/platform/paths.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { pythonToolProject } from '#cli/tools/python/project.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { installToolProject, prepareToolProjects } from '#cli/tools/project.ts';
import { cpSync, chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { PYTHON_PROJECTS, PYTHON_INSTALL_STEPS } from '#tests/config/tools/lifecycle/python-project.ts';
import { createPythonRegistry, preparePythonInstallation } from '#tests/harness/python-installation.ts';

// Resolve the authored index's normal lockfile before testing immutable installation or a clean clone.
async function prepareLockfile(root: string) {
    using log = openOwnership(root);
    const session = await openSession(root);
    const generated = emitAll(session);
    await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    writeOutputs(session, log, undefined, generated);
    const lockfilePath = join(root, '.gspot/uv.lock');
    return {
        manifest: readFileSync(join(root, '.gspot/pyproject.toml')),
        lockfilePath,
        lockfile: readFileSync(lockfilePath),
    };
}

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
        const { manifest, lockfilePath, lockfile } = await prepareLockfile(repository.path);
        const { rootProject, rootConfiguration } = prepared;
        expect(lockfile.toString('utf8')).not.toContain('synthetic-uv-password');
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
        expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
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
        await using prepared = await preparePythonInstallation(repository.path, {
            indexFile: configuration,
            runner,
        });
        const { manifest, lockfile } = await prepareLockfile(repository.path);
        const { rootConfiguration } = prepared;
        const clone = join(artifacts.path, 'clone');
        commitAll(repository.path);
        gitOutput(repository.path, ['clone', '--quiet', '--no-local', repository.path, clone]);
        expect(existsSync(join(clone, '.gspot/.venv'))).toBe(false);
        expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            {
                using log = openOwnership(clone);
                const session = await openSession(clone);
                const installed = await installTools(session, log, emitAll(session), { refreshLockfiles: false });
                expect(installed.exitCode, installed.note).toBe(0);
                expect(installed.note).toContain('installed locked Python tools');
            }
            const status = await runTestCommand(['git', 'status', '--porcelain'], { cwd: clone });
            expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
            expect({
                manifest: readFileSync(join(clone, '.gspot/pyproject.toml')),
                lockfile: readFileSync(join(clone, '.gspot/uv.lock')),
                configuration: readFileSync(join(clone, configuration)),
            }).toStrictEqual({ manifest, lockfile, configuration: rootConfiguration });
        }
        const prefix = await runTestCommand(
            [environmentExecutable(join(clone, '.gspot/.venv'), 'python'), '-c', 'import sys; print(sys.prefix)'],
            {
                cwd: clone,
            },
        );
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(realpathSync(prefix.stdout.trim())).toBe(realpathSync(join(clone, '.gspot/.venv')));
        // A copied environment runs its console scripts from the copy.
        const copied = join(artifacts.path, 'relocated environment');
        cpSync(join(clone, '.gspot/.venv'), copied, { recursive: true, verbatimSymlinks: true });
        const relocated = await runTestCommand(
            [environmentExecutable(copied, 'python'), '-c', 'import sys; print(sys.prefix)'],
            {
                cwd: artifacts.path,
            },
        );
        expect(relocated.code, relocated.stderr).toBe(0);
        expect(realpathSync(relocated.stdout.trim())).toBe(realpathSync(copied));
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.skipIf(!isPosix)(
    'conflicted Python lockfiles survive offline apply and are repaired by install',
    async () => {
        const configuration = 'uv.toml';
        await using repository = await testdir();
        await using prepared = await preparePythonInstallation(repository.path, {
            indexFile: configuration,
            runner: 'none',
        });
        const { lockfilePath, lockfile } = await prepareLockfile(repository.path);
        const { rootConfiguration } = prepared;
        {
            using log = openOwnership(repository.path);
            const session = await openSession(repository.path);
            const installed = await installTools(session, log, emitAll(session), { refreshLockfiles: false });
            expect(installed.exitCode, installed.note).toBe(0);
        }
        chmodSync(lockfilePath, 0o644);
        writeFileSync(lockfilePath, '<<<<<<< interrupted lockfile\n');
        {
            using log = openOwnership(repository.path);
            const staged: string[] = [];
            expect(
                await rejection(
                    installToolProject(
                        pythonToolProject,
                        {
                            read: log.files.read.bind(log.files),
                            installTree: (_kind, directory) => {
                                staged.push(directory);
                            },
                        },
                        { root: repository.path, executable: 'uv' },
                    ),
                ),
            ).toContain('Run: gspot apply, then gspot install');
            expect(staged).toStrictEqual([]);
        }
        const repaired = await spawnGspot(repository.path, ['apply']);
        expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
        {
            using log = openOwnership(repository.path);
            const session = await openSession(repository.path);
            const installed = await installTools(session, log, emitAll(session), { refreshLockfiles: false });
            expect(installed.exitCode, installed.note).toBe(0);
        }
        expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
        expect(readFileSync(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.skipIf(!isPosix)(
    'an installer that copies index credentials into a lockfile preserves the working environment',
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
        const installed = await spawnGspot(root, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const markerPath = environmentExecutable(join(root, '.gspot/.venv'), 'gspot-relocation-marker');
        const marker = readFileSync(markerPath);
        const lockfilePath = join(root, '.gspot/uv.lock');
        const lockfile = readFileSync(lockfilePath);
        // The stand-in for uv copies the index password into the lockfile it leaves behind.
        await createFileTree(artifacts.path, {
            'bin/uv': "#!/bin/sh\nprintf '# synthetic-uv-password\\n' >> uv.lock\n",
        });
        chmodSync(join(artifacts.path, 'bin/uv'), 0o755);
        let refused: string;
        {
            using log = openOwnership(root);
            const staged: string[] = [];
            refused = await rejection(
                installToolProject(
                    pythonToolProject,
                    {
                        read: log.files.read.bind(log.files),
                        installTree: (_kind, directory) => {
                            staged.push(directory);
                        },
                    },
                    { root, executable: join(artifacts.path, 'bin/uv') },
                ),
            );
            expect(staged).toStrictEqual([]);
        }
        expect(refused).toContain('includes repository index credentials');
        expect(readFileSync(markerPath)).toStrictEqual(marker);
        const prefix = await runTestCommand([markerPath], { cwd: root });
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(realpathSync(prefix.stdout.trim())).toBe(realpathSync(join(root, '.gspot/.venv')));
        expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
    },
);
