import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { openWriter } from '#cli/write.ts';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { PYTHON_VERSION } from '#cli/config/installers/pypi.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import type { PythonToolProject } from '#cli/types/installers/projects.ts';

import {
    installPythonTools,
    writePythonSettings,
    preparePythonLockfile,
    isPythonLockfileFresh,
} from '#cli/installers/pypi.ts';
import {
    UV_TOML,
    PYPROJECT_UV_INDEX,
    UV_LOCKFILE_ORIGINS,
    PYTHON_TOOL_PROJECT,
    INVALID_UV_SETTINGS,
    PYTHON_TOOL_LOCKFILE,
    UV_LOCKFILE_MISMATCHES,
    LOCKFILE_PASSWORD_ERROR,
} from '#tests/config/installers/pypi.ts';

const projectText = PYTHON_TOOL_PROJECT.replaceAll('{python-version}', () => PYTHON_VERSION);

const pythonProject = (parse(projectText) as { project: PythonToolProject }).project;
const lockfileText = PYTHON_TOOL_LOCKFILE.replaceAll('{python-version}', () => PYTHON_VERSION);

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
function buildPythonProjectFiles(): Record<string, string> {
    return {
        'gspot.toml': buildSandboxSettings([]),
        [GSPOT_PATHS.pythonProject]: projectText,
        [GSPOT_PATHS.uvLockfile]: lockfileText,
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
    const install = installPythonTools(buildToolInstall(await openSession(sandbox.path), writer), 'unavailable-uv');
    const installationError = await captureRejection(install);
    expect(installationError).toMatchObject({
        name: 'GspotError',
        code: 'install',
        message: `uv ${step} failed (exit 7).\nindex password [redacted] [redacted]\ninterpreter unavailable`,
    });
    expect(calls).toHaveLength(step === 'venv' ? 1 : 2);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.uvLockfile), 'utf8')).toBe(lockfileText);
    expect(await readFile(join(sandbox.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.pythonEnvironment))).toBe(false);
});

test('a successful uv run refuses a password in its new lockfile and keeps the tool project files', async () => {
    await using sandbox = await testdir(buildPythonProjectFiles());

    using boundary = fakeCommand('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${lockfileText}\n# test+password\n`);
        return buildProcessResult();
    });
    using writer = openWriter(sandbox.path);
    const session = await openSession(sandbox.path);
    const read = writer.read.bind(writer);
    using _read = spyOn(writer, 'read').mockImplementation((path) =>
        path === GSPOT_PATHS.uvLockfile ? undefined : read(path),
    );
    const lockfileError = await captureRejection(
        preparePythonLockfile(
            buildToolInstall(session, writer),
            { path: GSPOT_PATHS.pythonProject, content: projectText },
            'synthetic-uv',
        ),
    );
    expect(lockfileError).toMatchObject(LOCKFILE_PASSWORD_ERROR);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.uvLockfile), 'utf8')).toBe(lockfileText);
    expect(await readFile(join(sandbox.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.pythonEnvironment))).toBe(false);
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
    expect(isPythonLockfileFresh(pythonProject, lockfileText, {})).toBe(true);
    expect(isPythonLockfileFresh(pythonProject, 'not valid =', {})).toBe(false);
    const rangedProject = (parse(projectText.replace('==1.2.3', '>=1.2.3')) as { project: PythonToolProject }).project;
    const exists = isPythonLockfileFresh(rangedProject, lockfileText, {});
    expect(exists).toBe(false);
});
test.each([...UV_LOCKFILE_MISMATCHES])('a changed %s makes the uv lockfile stale', (_name, before, after) => {
    expect(
        isPythonLockfileFresh(
            pythonProject,
            lockfileText.replace(before, () => after),
            {},
        ),
    ).toBe(false);
});

test.each([...UV_LOCKFILE_ORIGINS])(
    'uv lockfile index %s and artifact %s have allowed origins: %s',
    (registry, url, expected, indexes) => {
        const lockfile = `${lockfileText}\n[[package]]\nname = "example-package"\nversion = "1.2.3"\nsource = { registry = "${registry}" }\nsdist = { url = "${url}" }\nwheels = [{ url = "${url}" }]\n`;
        expect(isPythonLockfileFresh(pythonProject, lockfile, indexes)).toBe(expected);
    },
);

test.each(INVALID_UV_SETTINGS)(
    'invalid $file $field settings name the file and field',
    async ({ file, field, text }) => {
        await using sandbox = await testdir({ [file]: text });
        await using scratch = await testdir();
        expect(() => writePythonSettings(sandbox.path, scratch.path, 7)).toThrow(
            new GspotError(
                'filesystem',
                `${file}: ${field}: Invalid input: expected array, received string. Fix the field.`,
            ),
        );
    },
);

test('uv.toml wins and local index paths are read relative to the repository', async () => {
    using _clock = spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T15:30:00.000Z'));
    await using sandbox = await testdir({ 'uv.toml': UV_TOML, 'pyproject.toml': PYPROJECT_UV_INDEX });
    await using scratch = await testdir();
    expect(writePythonSettings(sandbox.path, scratch.path, 7)).toStrictEqual(['test%2Bpassword', 'test+password']);
    const contents: unknown = parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'));
    expect(contents).toStrictEqual({
        'exclude-newer': '2026-10-17T15:30:00.000Z',
        'index-url': 'https://alex:test%2Bpassword@example.com/simple',
        'find-links': [join(sandbox.path, 'wheels'), 'https://example.com/wheels'],
        offline: true,
        index: [{ name: 'local', url: join(sandbox.path, 'packages') }],
    });
});

test('project index settings apply only without uv.toml, missing or empty files give none, and an invalid uv.toml is refused', async () => {
    using _clock = spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T15:30:00.000Z'));
    await using sandbox = await testdir({ 'pyproject.toml': PYPROJECT_UV_INDEX });
    await using scratch = await testdir();
    expect(writePythonSettings(sandbox.path, scratch.path, 7)).toStrictEqual([]);
    const contents: unknown = parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'));
    expect(contents).toStrictEqual({
        'exclude-newer': '2026-10-17T15:30:00.000Z',
        'index-url': 'https://example.com/simple',
        'find-links': [join(sandbox.path, 'wheels')],
    });
    await createFileTree(sandbox.path, { 'uv.toml': '' });
    expect(writePythonSettings(sandbox.path, scratch.path, 7)).toStrictEqual([]);
    const uvSettings: unknown = parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'));
    expect(uvSettings).toStrictEqual({
        'exclude-newer': '2026-10-17T15:30:00.000Z',
    });
    await rm(join(sandbox.path, 'uv.toml'));
    await rm(join(sandbox.path, 'pyproject.toml'));
    expect(writePythonSettings(sandbox.path, scratch.path, 7)).toStrictEqual([]);
    const keptSettings: unknown = parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'));
    expect(keptSettings).toStrictEqual({
        'exclude-newer': '2026-10-17T15:30:00.000Z',
    });
    await writeFile(join(sandbox.path, 'uv.toml'), 'find-links = [7]');
    expect(() => writePythonSettings(sandbox.path, scratch.path, 7)).toThrow(
        new GspotError(
            'filesystem',
            'uv.toml: find-links.0: Invalid input: expected string, received number. Fix the field.',
        ),
    );
});

test('Python resolution excludes releases newer than the configured hold', async () => {
    await using sandbox = await testdir();
    await using scratch = await testdir();
    using _clock = spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T15:30:00.000Z'));
    writePythonSettings(sandbox.path, scratch.path, 14);
    const contents: unknown = parse(readFileSync(join(scratch.path, 'uv.toml'), 'utf8'));
    expect(contents).toStrictEqual({
        'exclude-newer': '2026-10-10T15:30:00.000Z',
    });
});
