import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { fakeCommand } from '#tests/harness/command.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { acquirePythonInstaller } from '#cli/tools/python/uv.ts';
import { pythonInstallerPin } from '#cli/configurations/pins.ts';
import { pythonToolProject } from '#cli/tools/python/project.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { installToolProject, prepareToolProjects } from '#cli/tools/project.ts';
import { AUTHORED_UV_INDEX, PRIVATE_PYTHON_PROJECT, PRIVATE_PYTHON_LOCKFILE } from '#tests/config/samples/python.ts';

test('one command acquires its pinned uv once and creates lockfiles through that executable', async () => {
    const uv = pythonInstallerPin();
    const pin = `${uv.name}@${uv.version}`;
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy(['python'], { tables: 'runner = "mise"\n[agent_rules]\nenabled = false\n' }),
        'main.py': 'print("authored")\n',
    });
    const session = await openSession(repository.path);
    const executable = join(repository.path, 'pinned-uv');
    const calls: string[][] = [];
    const run = processes.run;
    using _boundary = spyOn(processes, 'run').mockImplementation(async (command, options) => {
        if (command[0] !== 'mise' && command[0] !== executable) return run(command, options);
        calls.push([...command]);
        if (command[0] === executable) await writeFile(join(options.cwd, 'uv.lock'), PRIVATE_PYTHON_LOCKFILE);
        return {
            code: 0,
            missing: false,
            duration: 0,
            stdout: command[1] === 'which' ? executable : '',
            stderr: '',
        };
    });
    expect(await Promise.all([session.pythonInstaller(), session.pythonInstaller()])).toStrictEqual([
        executable,
        executable,
    ]);
    const files: GeneratedFile[] = [{ path: '.gspot/pyproject.toml', content: PRIVATE_PYTHON_PROJECT, kind: 'config' }];
    {
        using log = openOwnership(repository.path);
        await prepareToolProjects(session, files, log.files, { refreshLockfiles: false });
    }
    expect(calls.slice(0, 2)).toStrictEqual([
        ['mise', 'install', pin],
        ['mise', 'which', 'uv', '--tool', pin],
    ]);
    expect(calls).toHaveLength(3);
    expect(calls[2]).toContain('--no-python-downloads');
    expect(calls[2]!.slice(0, 2)).toStrictEqual([executable, 'lock']);
    expect(files[1]).toMatchObject({ path: '.gspot/uv.lock', content: PRIVATE_PYTHON_LOCKFILE, kind: 'lock' });
    expect(await pathExists(join(repository.path, '.gspot/uv.lock'))).toBe(false);
});

test('failed mise acquisition names the pinned uv repair and preserves repository files', async () => {
    const uv = pythonInstallerPin();
    const pin = `${uv.name}@${uv.version}`;
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': buildPolicy(['python'], { tables: 'runner = "mise"\n[agent_rules]\nenabled = false\n' }),
        'main.py': 'print("authored")\n',
    });
    const before = await readTree(repository.path);
    using boundary = fakeCommand('mise', () => {
        return Promise.resolve({
            code: 7,
            missing: false,
            duration: 0,
            stdout: 'download failed',
            stderr: 'registry unreachable',
        });
    });
    const failure: unknown = await acquirePythonInstaller(repository.path, 'mise', undefined).catch(
        (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(GspotError);
    expect(failure).toMatchObject({
        code: 'installation',
        message: `mise did not install ${pin}. Run mise install ${pin} and read its error.\ndownload failed\nregistry unreachable`,
    });
    expect(boundary).toHaveBeenCalledTimes(1);
    expect(boundary).toHaveBeenCalledWith(['mise', 'install', pin], expect.objectContaining({ cwd: repository.path }));
    expect(await readTree(repository.path)).toStrictEqual(before);
});

test.each(['venv', 'sync'])(
    'failed uv %s is repairable and preserves authored inputs with redacted output',
    async (step) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            '.gspot/pyproject.toml': PRIVATE_PYTHON_PROJECT,
            '.gspot/uv.lock': PRIVATE_PYTHON_LOCKFILE,
            'uv.toml': AUTHORED_UV_INDEX,
        });
        const calls: string[][] = [];
        using _boundary = fakeCommand('unavailable-uv', (command) => {
            calls.push([...command]);
            return Promise.resolve({
                code: command[1] === step ? 7 : 0,
                missing: false,
                duration: 0,
                stdout: 'index password test%2Bpassword test+password',
                stderr: 'interpreter unavailable',
            });
        });
        const { diagnosticError, staged } = await localPythonInstallation(repository.path, 'unavailable-uv');
        expect(staged).toStrictEqual([]);
        expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
        const diagnostic = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
        expect(diagnostic).toContain(`UV ${step} failed (exit 7)`);
        expect(diagnostic).toContain('Python 3.11 or newer');
        expect(diagnostic).toContain('interpreter unavailable');
        expect(diagnostic).toContain('run: gspot install');
        expect(diagnostic).not.toContain('test%2Bpassword');
        expect(diagnostic).not.toContain('test+password');
        expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
        expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(PRIVATE_PYTHON_LOCKFILE);
        expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(AUTHORED_UV_INDEX);
        expect(await pathExists(join(repository.path, '.gspot/.venv'))).toBe(false);
    },
);

test('a successful uv operation refuses a password in its temporary lockfile and preserves managed inputs', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        '.gspot/pyproject.toml': PRIVATE_PYTHON_PROJECT,
        '.gspot/uv.lock': PRIVATE_PYTHON_LOCKFILE,
        'uv.toml': AUTHORED_UV_INDEX,
    });
    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${PRIVATE_PYTHON_LOCKFILE}\n# test+password\n`);
        return { code: 0, missing: false, duration: 0, stdout: '', stderr: '' };
    });
    const { diagnosticError, staged } = await localPythonInstallation(repository.path, 'synthetic-uv');
    expect(staged).toStrictEqual([]);
    expect(diagnosticError).toMatchObject({ name: 'GspotError', code: 'installation' });
    expect(diagnosticError instanceof Error ? diagnosticError.message : '').toBe(
        'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
    );
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(PRIVATE_PYTHON_LOCKFILE);
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(AUTHORED_UV_INDEX);
    expect(await pathExists(join(repository.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});

async function localPythonInstallation(root: string, executable: string) {
    using log = openOwnership(root);
    const staged: string[] = [];
    const diagnosticError: unknown = await installToolProject(
        pythonToolProject,
        {
            read: log.files.read.bind(log.files),
            installTree: (_kind, directory) => {
                staged.push(directory);
            },
        },
        { root, executable },
    ).catch((error: unknown) => error);
    return { diagnosticError, staged };
}
