import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { fakeTool } from '#tests/setup/fake-tool.ts';
import { rejection } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { installTools } from '#cli/install/install.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import type { InstallJson } from '#cli/types/install.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { git, commitAll, gitOutput } from '#tests/setup/git.ts';
import { environmentVariables } from '#cli/system/environment.ts';
import { preparePythonLockfile } from '#cli/tools/python/project.ts';
import { chmod, readFile, realpath, writeFile } from 'node:fs/promises';
import { virtualEnvironmentExecutable } from '#cli/system/executables.ts';
import { createPythonIndex, createPythonSandbox } from '#tests/setup/python.ts';
import { writeLockedInputs, expectRefusedInstall } from '#tests/setup/install.ts';
import { PYTHON_PROJECTS, PYTHON_INSTALL_STEPS } from '#tests/config/python/tool-project.ts';

test.each([...PYTHON_PROJECTS])(
    'Python tool project install keeps your own and generated files with %s',
    async (configuration) => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using registry = await createPythonIndex(artifacts.path);
        await using prepared = await createPythonSandbox(repository.path, {
            indexFile: configuration,
            indexUrl: registry.url,
        });
        const preparedInputs = await writeLockedInputs(repository.path);
        const { manifest, lockfilePath, lockfile } = preparedInputs;
        if (manifest === undefined) throw new Error('The Python project has no locked manifest.');
        if (lockfilePath === undefined) throw new Error('The Python project has no lockfile path.');
        if (lockfile === undefined) throw new Error('The Python project has no lockfile bytes.');
        const { rootProject, rootConfiguration } = prepared;
        expect(lockfile.toString('utf8')).not.toContain('synthetic-uv-password');
        const brokenUv = await fakeTool(artifacts.path, 'bin/uv', 'process.exitCode = 87;');
        const command = await spawnGspot(repository.path, ['install', '--json'], {
            PATH: [brokenUv, environmentVariables()['PATH'] ?? ''].join(delimiter),
            MISE_TRUSTED_CONFIG_PATHS: repository.path,
        });
        expect(command.code, command.stdout + command.stderr).toBe(0);
        const steps = (JSON.parse(command.stdout) as InstallJson).steps!;
        expect(
            steps.map((step) => (step[0] === 'mise' ? step : ['uv', ...step.slice(1, step.indexOf('--project'))])),
        ).toStrictEqual(PYTHON_INSTALL_STEPS.map((step) => [...step]));
        for (const step of steps.filter((entry) => entry[0] !== 'mise')) {
            expect(step[step.indexOf('--project') + 1]).toBe(join(repository.path, '.gspot'));
        }
        expect(await readFile(join(repository.path, 'pyproject.toml'))).toStrictEqual(rootProject);
        expect(await readFile(join(repository.path, '.venv/authored.txt'), 'utf8')).toBe(
            'keep the project environment',
        );
        expect(await readFile(join(repository.path, '.gspot/pyproject.toml'))).toStrictEqual(manifest);
        expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
        expect(await readFile(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
    },
);

test.each([...PYTHON_PROJECTS])(
    'fresh Python clones install the locked tools twice and run them from any folder with %s',
    async (configuration) => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using prepared = await createPythonSandbox(repository.path, {
            indexFile: configuration,
        });
        const preparedInputs = await writeLockedInputs(repository.path);
        const { manifest, lockfile } = preparedInputs;
        if (manifest === undefined || lockfile === undefined)
            throw new Error('The Python project has no locked inputs.');
        const { rootConfiguration } = prepared;
        const clone = join(artifacts.path, 'clone');
        commitAll(repository.path);
        gitOutput(repository.path, ['clone', '--quiet', '--no-local', repository.path, clone]);
        expect(await pathExists(join(clone, '.gspot/.venv'))).toBe(false);
        expect(await pathExists(join(clone, '.gspot/state/ownership.json'))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            {
                using log = openOwnershipLog(clone);
                const session = await openSession(clone);
                const installed = await installTools(session, log, emitAll(session));
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
        const prefix = await runCommand(
            [
                virtualEnvironmentExecutable(join(clone, '.gspot/.venv'), 'python'),
                '-c',
                'import sys; print(sys.prefix)',
            ],
            {
                cwd: clone,
            },
        );
        expect(prefix.code, prefix.stderr).toBe(0);
        expect(await realpath(prefix.stdout.trim())).toBe(await realpath(join(clone, '.gspot/.venv')));
    },
);

test('conflicted Python lockfiles survive offline apply and are repaired by install', async () => {
    const configuration = 'uv.toml';
    await using repository = await testdir();
    await using artifacts = await testdir();
    await using registry = await createPythonIndex(artifacts.path);
    await using prepared = await createPythonSandbox(repository.path, {
        indexFile: configuration,
        indexUrl: registry.url,
    });
    const preparedInputs = await writeLockedInputs(repository.path);
    const { lockfilePath, lockfile } = preparedInputs;
    if (lockfilePath === undefined || lockfile === undefined)
        throw new Error('The Python project has no locked inputs.');
    const { rootConfiguration } = prepared;
    {
        using log = openOwnershipLog(repository.path);
        const session = await openSession(repository.path);
        const installed = await installTools(session, log, emitAll(session));
        expect(installed.exitCode, installed.note).toBe(0);
    }
    await chmod(lockfilePath, 0o644);
    await writeFile(lockfilePath, '<<<<<<< interrupted lockfile\n');
    await expectRefusedInstall(repository.path, [], 'run: gspot install', registry);
    const repaired = await spawnGspot(repository.path, ['apply']);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    {
        using log = openOwnershipLog(repository.path);
        const session = await openSession(repository.path);
        const installed = await installTools(session, log, emitAll(session));
        expect(installed.exitCode, installed.note).toBe(0);
    }
    expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
    expect(await readFile(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
});

test('a uv that copies index credentials into the lockfile is refused and the installed tools keep working', async () => {
    await using repository = await testdir();
    await using artifacts = await testdir();
    await using registry = await createPythonIndex(artifacts.path);
    await using prepared = await createPythonSandbox(repository.path, {
        indexFile: 'uv.toml',
        indexUrl: registry.url,
    });
    const { root } = prepared;
    await writeLockedInputs(root);
    const lockfilePath = join(root, '.gspot/uv.lock');
    const lockfile = await readFile(lockfilePath);
    const bin = await fakeTool(
        artifacts.path,
        'bin/uv',
        String.raw`const fs = require('node:fs'); fs.writeFileSync('uv.lock', '# synthetic-uv-password\n');`,
    );
    let refused: string;
    {
        using log = openOwnershipLog(root);
        const session = await openSession(root);
        const manifest = emitAll(session).files.find((file) => file.path === '.gspot/pyproject.toml')!;
        refused = await rejection(
            preparePythonLockfile(
                manifest,
                { read: (path) => (path === '.gspot/uv.lock' ? undefined : log.files.read(path)) },
                {
                    root,
                    uvPath: join(bin, isWindows ? 'uv.cmd' : 'uv'),
                    cancelSignal: undefined,
                    timeoutSeconds: session.timeoutSeconds,
                },
                [],
            ),
        );
    }
    expect(refused).toContain('includes repository index credentials');
    expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
});
