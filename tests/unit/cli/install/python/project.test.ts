import { join } from 'node:path';
import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { openWriter } from '#cli/ownership/writer.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { PYTHON_VERSION } from '#cli/config/generation/projects.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { toolPyprojectSchema } from '#cli/schemas/install/python/project.ts';
import { installPythonTools, preparePythonLockfile, isPythonLockfileCurrent } from '#cli/install/python/project.ts';

import {
    UV_TOML,
    PYTHON_TOOL_PROJECT,
    PYTHON_TOOL_LOCKFILE,
    UV_LOCKFILE_MISMATCHES,
    LOCKFILE_PASSWORD_ERROR,
} from '#tests/data/install/python.ts';

const projectText = PYTHON_TOOL_PROJECT.replaceAll('{python-version}', PYTHON_VERSION);

const pythonProject = toolPyprojectSchema.parse(parse(projectText));
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

test.each(['venv', 'sync'])('a failed uv %s keeps the tool project files and hides index passwords', async (step) => {
    await using sandbox = await testdir(buildPythonProjectFiles());

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
    using writer = openWriter(sandbox.path);
    const installationError = await installPythonTools(
        buildToolInstall(await openSession(sandbox.path), writer),
        'unavailable-uv',
    ).catch((error: unknown) => error);
    expect(installationError).toBeInstanceOf(Error);
    expect(installationError).toMatchObject({
        name: 'GspotError',
        code: 'install',
        message: `uv ${step} failed (exit 7).\nindex password [redacted] [redacted]\ninterpreter unavailable`,
    });
    expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
    expect(await readFile(join(sandbox.path, '.gspot/uv.lock'), 'utf8')).toBe(lockfileText);
    expect(await readFile(join(sandbox.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(sandbox.path, '.gspot/.venv'))).toBe(false);
});

test('a successful uv run refuses a password in its new lockfile and keeps the tool project files', async () => {
    await using sandbox = await testdir(buildPythonProjectFiles());

    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${lockfileText}\n# test+password\n`);
        return buildProcessResult();
    });
    using writer = openWriter(sandbox.path);
    const session = await openSession(sandbox.path);
    session.uvPath = 'synthetic-uv';
    const read = writer.files.read.bind(writer.files);
    using _read = spyOn(writer.files, 'read').mockImplementation((path) =>
        path === '.gspot/uv.lock' ? undefined : read(path),
    );
    const lockfileError: unknown = await preparePythonLockfile(buildToolInstall(session, writer), {
        path: '.gspot/pyproject.toml',
        content: projectText,
    }).catch((error: unknown) => error);
    expect(lockfileError).toBeInstanceOf(Error);
    expect(lockfileError).toMatchObject(LOCKFILE_PASSWORD_ERROR);
    expect(await readFile(join(sandbox.path, '.gspot/uv.lock'), 'utf8')).toBe(lockfileText);
    expect(await readFile(join(sandbox.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(sandbox.path, '.gspot/.venv'))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});

test('uv installs the tool project with its own Python, whatever UV_PYTHON and .python-version the repository sets', async () => {
    await using sandbox = await testdir({ ...buildPythonProjectFiles(), '.python-version': '3.12.13\n' });

    const runs: { command: string[]; env: Record<string, string | undefined> | undefined }[] = [];
    using _boundary = fakeCommand('pinned-uv', (command, options) => {
        runs.push({ command: [...command], env: options.env });
        return Promise.resolve(buildProcessResult());
    });
    using writer = openWriter(sandbox.path);
    await installPythonTools(buildToolInstall(await openSession(sandbox.path), writer), 'pinned-uv');
    expect(runs.map(({ command }) => command[1])).toStrictEqual(['venv', 'sync']);
    for (const { command, env } of runs) {
        const flag = command.indexOf('--python');
        expect(command.slice(flag, flag + 2)).toStrictEqual(['--python', PYTHON_VERSION]);
        expect(env).toHaveProperty('UV_PYTHON', undefined);
    }
});
test('the uv lockfile check ignores name spelling and requirement order and refuses invalid TOML and a range', () => {
    expect(isPythonLockfileCurrent(pythonProject, lockfileText)).toBe(true);
    expect(isPythonLockfileCurrent(pythonProject, 'not valid =')).toBe(false);
    expect(
        isPythonLockfileCurrent(
            toolPyprojectSchema.parse(parse(projectText.replace('==1.2.3', '>=1.2.3'))),
            lockfileText,
        ),
    ).toBe(false);
});
test.each([...UV_LOCKFILE_MISMATCHES])('a changed %s makes the uv lockfile stale', (_name, before, after) => {
    expect(isPythonLockfileCurrent(pythonProject, lockfileText.replace(before, after))).toBe(false);
});
