import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { prepareToolProjects } from '#cli/tools/public.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { installToolProject } from '#cli/tools/contracts.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { installTools } from '#cli/lifecycle/install/public.ts';
import { pythonToolProject } from '#cli/tools/python/public.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { environmentExecutable } from '#cli/platform/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { cp, chmod, readFile, realpath, writeFile } from 'node:fs/promises';
import { PYTHON_PROJECTS, PYTHON_INSTALL_STEPS } from '#tests/config/tools/lifecycle/python-project.ts';
import { createPythonRegistry, preparePythonInstallation } from '#tests/harness/python-installation.ts';

// Resolve the authored index's normal lockfile before testing immutable installation or a clean clone.
async function prepareLockfile(root: string) {
    using log = openOwnership(root);
    const session = await openSession(root);
    const generated = emitAll(session);
    await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    writeGeneratedFiles(session, generated, log);
    const lockfilePath = join(root, '.gspot/uv.lock');
    return {
        manifest: await readFile(join(root, '.gspot/pyproject.toml')),
        lockfilePath,
        lockfile: await readFile(lockfilePath),
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
            await chmod(join(artifacts.path, 'bin/uv'), 0o755);
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
            steps:
                runner === 'mise'
                    ? [
                          ['mise', 'install', `uv@${toolPin(configurationManifests().values(), 'uv').version!}`],
                          ...PYTHON_INSTALL_STEPS[runner],
                      ]
                    : PYTHON_INSTALL_STEPS[runner],
        });
        expect(await readFile(join(repository.path, 'pyproject.toml'))).toStrictEqual(rootProject);
        expect(await readFile(join(repository.path, '.venv/authored.txt'), 'utf8')).toBe(
            'keep the project environment',
        );
        expect(await readFile(join(repository.path, '.gspot/pyproject.toml'))).toStrictEqual(manifest);
        expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
        expect(await readFile(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
    },
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
        expect(await pathExists(join(clone, '.gspot/.venv'))).toBe(false);
        expect(await pathExists(join(clone, '.gspot/state/ownership.json'))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            {
                using log = openOwnership(clone);
                const session = await openSession(clone);
                const installed = await installTools(session, log, emitAll(session), { refreshLockfiles: false });
                expect(installed.exitCode, installed.note).toBe(0);
                expect(installed.note).toContain('installed locked Python tools');
            }
            const status = git(clone, ['status', '--porcelain']);
            expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
            expect({
                manifest: await readFile(join(clone, '.gspot/pyproject.toml')),
                lockfile: await readFile(join(clone, '.gspot/uv.lock')),
                configuration: await readFile(join(clone, configuration)),
            }).toStrictEqual({ manifest, lockfile, configuration: rootConfiguration });
        }
        const prefix = await runTestCommand(
            [environmentExecutable(join(clone, '.gspot/.venv'), 'python'), '-c', 'import sys; print(sys.prefix)'],
            {
                cwd: clone,
            },
        );
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(await realpath(prefix.stdout.trim())).toBe(await realpath(join(clone, '.gspot/.venv')));
        // A copied environment runs its console scripts from the copy.
        const copied = join(artifacts.path, 'relocated environment');
        await cp(join(clone, '.gspot/.venv'), copied, { recursive: true, verbatimSymlinks: true });
        const relocated = await runTestCommand(
            [environmentExecutable(copied, 'python'), '-c', 'import sys; print(sys.prefix)'],
            {
                cwd: artifacts.path,
            },
        );
        expect(relocated.code, relocated.stderr).toBe(0);
        expect(await realpath(relocated.stdout.trim())).toBe(await realpath(copied));
    },
);

test.skipIf(!isPosix)('conflicted Python lockfiles survive offline apply and are repaired by install', async () => {
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
    await chmod(lockfilePath, 0o644);
    await writeFile(lockfilePath, '<<<<<<< interrupted lockfile\n');
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
    expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
    expect(await readFile(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
});

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
        const marker = await readFile(markerPath);
        const lockfilePath = join(root, '.gspot/uv.lock');
        const lockfile = await readFile(lockfilePath);
        // The stand-in for uv copies the index password into the lockfile it leaves behind.
        await createFileTree(artifacts.path, {
            'bin/uv': "#!/bin/sh\nprintf '# synthetic-uv-password\\n' >> uv.lock\n",
        });
        await chmod(join(artifacts.path, 'bin/uv'), 0o755);
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
        expect(await readFile(markerPath)).toStrictEqual(marker);
        const prefix = await runTestCommand([markerPath], { cwd: root });
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(await realpath(prefix.stdout.trim())).toBe(await realpath(join(root, '.gspot/.venv')));
        expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
    },
);
