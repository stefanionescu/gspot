import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { openSession } from '#cli/session.ts';
import { fakeTool } from '#tests/setup/fakes.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { listMisePins } from '#cli/configurations/tools.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { chmod, readFile, realpath, writeFile } from 'node:fs/promises';
import { PYTHON_VERSION } from '#cli/config/parsers/dependency-files.ts';
import { writeLockedInputs, captureInstallRefusal } from '#tests/setup/install.ts';
import { createPythonSandbox, createIndexedPythonSandbox } from '#tests/setup/python-index.ts';
import { PYTHON_PROJECTS, PYTHON_INSTALL_STEPS } from '#tests/data/tools/python-tool-project.ts';

test.each([...PYTHON_PROJECTS])(
    'Python tool project install keeps your own and generated files with %s',
    async (configuration) => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using prepared = await createIndexedPythonSandbox(repository.path, artifacts.path, configuration);
        const { inputs: preparedInputs } = prepared;
        const { manifest, lockfilePath, lockfile } = preparedInputs;
        if (manifest === undefined) throw new Error('The Python project has no locked manifest.');
        if (lockfilePath === undefined) throw new Error('The Python project has no lockfile path.');
        if (lockfile === undefined) throw new Error('The Python project has no lockfile bytes.');
        const { rootProject, rootConfiguration } = prepared;
        expect(lockfile.toString('utf8')).not.toContain('synthetic-uv-password');
        const brokenUv = await fakeTool(artifacts.path, 'bin/uv', 'process.exitCode = 87;');
        const command = await spawnGspot(repository.path, ['install', '--json'], {
            PATH: [brokenUv, readEnvironmentVariable('PATH') ?? ''].join(delimiter),
            MISE_TRUSTED_CONFIG_PATHS: repository.path,
        });
        expect(command.code, command.stdout + command.stderr).toBe(0);
        const steps = (JSON.parse(command.stdout) as { steps: string[][] }).steps;
        const session = await openSession(repository.path);
        const miseTools = listMisePins(session.neededToolManifests, session.reads).map(({ name }) => name);
        expect(
            steps.map((step) => (step[0] === 'mise' ? step : ['uv', ...step.slice(1, step.indexOf('--project'))])),
        ).toStrictEqual([
            ['mise', 'trust', '.gspot/mise.toml'],
            ['mise', 'install', ...miseTools],
            ['mise', 'bin-paths', ...miseTools],
            ...PYTHON_INSTALL_STEPS.map((step) =>
                step.map((argument) => argument.replaceAll('{python-version}', PYTHON_VERSION)),
            ),
        ]);
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
        readGitOutput(repository.path, ['clone', '--quiet', '--no-local', repository.path, clone]);
        expect(await isOnDisk(join(clone, '.gspot/.venv'))).toBe(false);
        expect(await isOnDisk(join(clone, '.gspot/state/ownership.json'))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            {
                const installed = await spawnGspot(clone, ['install']);
                expect(installed.code, installed.stdout + installed.stderr).toBe(0);
                expect(installed.stdout).toContain('installed 1 Python tool in .gspot/.venv');
            }
            const status = runGit(clone, ['status', '--porcelain']);
            expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
            expect({
                manifest: await readFile(join(clone, '.gspot/pyproject.toml')),
                lockfile: await readFile(join(clone, '.gspot/uv.lock')),
                configuration: await readFile(join(clone, configuration)),
            }).toStrictEqual({ manifest, lockfile, configuration: rootConfiguration });
        }
        const prefix = await runCommand(
            [buildVenvExecutablePath(join(clone, '.gspot/.venv'), 'python'), '-c', 'import sys; print(sys.prefix)'],
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
    await using prepared = await createIndexedPythonSandbox(repository.path, artifacts.path, configuration);
    const { registry, inputs: preparedInputs } = prepared;
    const { lockfilePath, lockfile } = preparedInputs;
    if (lockfilePath === undefined || lockfile === undefined)
        throw new Error('The Python project has no locked inputs.');
    const { rootConfiguration } = prepared;
    {
        const installed = await spawnGspot(repository.path, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    }
    await chmod(lockfilePath, 0o644);
    await writeFile(lockfilePath, '<<<<<<< interrupted lockfile\n');
    const refusal = await captureInstallRefusal(repository.path, [], registry);
    expect(refusal.message).toContain('run: gspot install');
    expect(refusal.requests).toBe(0);
    const repaired = await spawnGspot(repository.path, ['apply']);
    expect(repaired.code, repaired.stdout + repaired.stderr).toBe(0);
    {
        const installed = await spawnGspot(repository.path, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    }
    expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
    expect(await readFile(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
});
