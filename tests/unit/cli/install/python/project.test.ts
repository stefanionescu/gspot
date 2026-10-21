import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { fakeCommand } from '#tests/setup/fakes.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildInstallContext } from '#tests/setup/install.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { PYTHON_VERSION } from '#cli/config/parsers/dependencies.ts';
import { installPythonTools, preparePythonLockfile } from '#cli/install/python/project.ts';
import { UV_TOML, PYTHON_TOOL_PROJECT, PYTHON_TOOL_LOCKFILE } from '#tests/data/install/python-tool-project.ts';

/** The Python tool project files with the Python version filled in. */
function buildPythonProjectFiles(): Record<string, string> {
    return {
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/pyproject.toml': PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION),
        '.gspot/uv.lock': PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
        'uv.toml': UV_TOML,
    };
}

test.each(['venv', 'sync'])('a failed uv %s can be repaired and hides index passwords', async (step) => {
    await using repository = await testdir(buildPythonProjectFiles());

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
    using log = openWriter(repository.path);
    const installError: unknown = await installPythonTools(
        buildInstallContext(await openSession(repository.path), log),
        'unavailable-uv',
    ).catch((error: unknown) => error);
    expect(installError).toMatchObject({ name: 'GspotError', code: 'installation' });
    const message = installError instanceof Error ? installError.message : String(installError);
    expect(message).toContain(`UV ${step} failed (exit 7)`);
    expect(message).toContain('Check Python downloads and index settings, then run: gspot install.');
    expect(message).toContain('interpreter unavailable');
    expect(message).toContain('run: gspot install');
    expect(message).not.toContain('test%2Bpassword');
    expect(message).not.toContain('test+password');
    expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(
        PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
    );
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(repository.path, '.gspot/.venv'))).toBe(false);
});

test('a successful uv run refuses a password in its new lockfile and keeps the tool project files', async () => {
    await using repository = await testdir(buildPythonProjectFiles());

    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(
            join(options.cwd, 'uv.lock'),
            `${PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION)}\n# test+password\n`,
        );
        return { code: 0, missing: false, duration: 0, stdout: '', stderr: '' };
    });
    using log = openWriter(repository.path);
    const session = await openSession(repository.path);
    session.uvPath = 'synthetic-uv';
    const read = log.files.read.bind(log.files);
    using _read = spyOn(log.files, 'read').mockImplementation((path) =>
        path === '.gspot/uv.lock' ? undefined : read(path),
    );
    const lockfileError: unknown = await preparePythonLockfile(buildInstallContext(session, log), {
        path: '.gspot/pyproject.toml',
        content: PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION),
    }).catch((error: unknown) => error);
    expect(lockfileError).toMatchObject({ name: 'GspotError', code: 'installation' });
    expect(lockfileError instanceof Error ? lockfileError.message : '').toBe(
        'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
    );
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(
        PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION),
    );
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(repository.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});

test('uv installs the tool project with its own Python, whatever UV_PYTHON and .python-version the repository sets', async () => {
    await using repository = await testdir({ ...buildPythonProjectFiles(), '.python-version': '3.12.13\n' });

    const runs: { command: string[]; env: Record<string, string | undefined> | undefined }[] = [];
    using _boundary = fakeCommand('pinned-uv', (command, options) => {
        runs.push({ command: [...command], env: options.env });
        return Promise.resolve({ code: 0, missing: false, duration: 0, stdout: '', stderr: '' });
    });
    using log = openWriter(repository.path);
    await installPythonTools(buildInstallContext(await openSession(repository.path), log), 'pinned-uv');
    expect(runs.map(({ command }) => command[1])).toStrictEqual(['venv', 'sync']);
    for (const { command, env } of runs) {
        const flag = command.indexOf('--python');
        expect(command.slice(flag, flag + 2)).toStrictEqual(['--python', PYTHON_VERSION]);
        expect(env).toHaveProperty('UV_PYTHON', undefined);
    }
});
