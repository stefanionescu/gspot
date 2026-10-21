import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { fakeCommand } from '#tests/setup/fakes.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildToolInstall } from '#tests/setup/install.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { PYTHON_VERSION } from '#cli/config/generation/projects.ts';
import { installPythonTools, preparePythonLockfile } from '#cli/install/python/project.ts';
import { UV_TOML, PYTHON_TOOL_PROJECT, PYTHON_TOOL_LOCKFILE } from '#tests/data/install/python-tool-project.ts';

const projectText = PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION);
const lockfileText = PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', PYTHON_VERSION);

/** The Python tool project files with the Python version filled in. */
function buildPythonProjectFiles(): Record<string, string> {
    return {
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/pyproject.toml': projectText,
        '.gspot/uv.lock': lockfileText,
        'uv.toml': UV_TOML,
    };
}

test.each(['venv', 'sync'])('a failed uv %s can be repaired and hides index passwords', async (step) => {
    await using repository = await testdir(buildPythonProjectFiles());

    const calls: string[][] = [];
    using _boundary = fakeCommand('unavailable-uv', (command) => {
        calls.push([...command]);
        return Promise.resolve(
            buildProcessResult({
                code: command[1] === step ? 7 : 0,
                stdout: 'index password test%2Bpassword test+password',
                stderr: 'interpreter unavailable',
            }),
        );
    });
    using log = openWriter(repository.path);
    const installationError = await installPythonTools(
        buildToolInstall(await openSession(repository.path), log),
        'unavailable-uv',
    ).catch((error: unknown) => error);
    expect(installationError).toBeInstanceOf(Error);
    expect(installationError).toMatchObject({
        name: 'GspotError',
        code: 'install',
        message: `UV ${step} failed (exit 7). Check Python downloads and index settings, then run: gspot install.\nindex password [redacted] [redacted]\ninterpreter unavailable`,
    });
    expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(lockfileText);
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(repository.path, '.gspot/.venv'))).toBe(false);
});

test('a successful uv run refuses a password in its new lockfile and keeps the tool project files', async () => {
    await using repository = await testdir(buildPythonProjectFiles());

    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${lockfileText}\n# test+password\n`);
        return buildProcessResult();
    });
    using log = openWriter(repository.path);
    const session = await openSession(repository.path);
    session.uvPath = 'synthetic-uv';
    const read = log.files.read.bind(log.files);
    using _read = spyOn(log.files, 'read').mockImplementation((path) =>
        path === '.gspot/uv.lock' ? undefined : read(path),
    );
    const lockfileError: unknown = await preparePythonLockfile(buildToolInstall(session, log), {
        path: '.gspot/pyproject.toml',
        content: projectText,
    }).catch((error: unknown) => error);
    expect(lockfileError).toBeInstanceOf(Error);
    expect(lockfileError).toMatchObject({
        name: 'GspotError',
        code: 'install',
        message:
            'The uv lockfile includes repository index credentials. Existing files were preserved. Remove credentials from the index URL and run: gspot install',
    });
    expect(await readFile(join(repository.path, '.gspot/uv.lock'), 'utf8')).toBe(lockfileText);
    expect(await readFile(join(repository.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(repository.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});

test('uv installs the tool project with its own Python, whatever UV_PYTHON and .python-version the repository sets', async () => {
    await using repository = await testdir({ ...buildPythonProjectFiles(), '.python-version': '3.12.13\n' });

    const runs: { command: string[]; env: Record<string, string | undefined> | undefined }[] = [];
    using _boundary = fakeCommand('pinned-uv', (command, options) => {
        runs.push({ command: [...command], env: options.env });
        return Promise.resolve(buildProcessResult());
    });
    using log = openWriter(repository.path);
    await installPythonTools(buildToolInstall(await openSession(repository.path), log), 'pinned-uv');
    expect(runs.map(({ command }) => command[1])).toStrictEqual(['venv', 'sync']);
    for (const { command, env } of runs) {
        const flag = command.indexOf('--python');
        expect(command.slice(flag, flag + 2)).toStrictEqual(['--python', PYTHON_VERSION]);
        expect(env).toHaveProperty('UV_PYTHON', undefined);
    }
});
