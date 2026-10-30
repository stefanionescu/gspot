import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildToolInstall } from '#tests/setup/cli/tools.ts';
import { PYTHON_VERSION } from '#cli/config/installers/pypi.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { type PythonToolProject } from '#cli/types/installers/pypi.ts';
import { matchFields, captureRejection } from '#tests/setup/matchers.ts';

import {
    installPythonTools,
    readPythonSettings,
    planPythonLockfile,
    isPythonLockfileFresh,
} from '#cli/installers/pypi.ts';
import {
    UV_TOML,
    PYPROJECT_UV_INDEX,
    UV_LOCKFILE_ORIGINS,
    PYTHON_TOOL_PROJECT,
    INVALID_UV_SETTINGS,
    PYTHON_INSTALL_FILES,
    PYTHON_TOOL_LOCKFILE,
    UV_LOCKFILE_MISMATCHES,
    LOCKFILE_PASSWORD_ERROR,
} from '#tests/config/installers/pypi.ts';

const pythonProject = (parse(PYTHON_TOOL_PROJECT) as { project: PythonToolProject }).project;

test.each(['venv', 'sync'])('a failed uv %s keeps the tool project files and hides index passwords', async (step) => {
    await using sandbox = await testdir(PYTHON_INSTALL_FILES);

    using _boundary = fakeCommands('unavailable-uv', (command) => {
        return Promise.resolve(
            buildProcessResult({
                code: command[1] === step ? 7 : 0,
                stdout: 'index password test%2Bpassword test+password',
                stderr: 'interpreter unavailable',
            }),
        );
    });
    const writer = openFiles(sandbox.path);
    const install = installPythonTools(buildToolInstall(await openSession(sandbox.path), writer), 'unavailable-uv');
    const installationError = await captureRejection(install);
    expect(installationError).toMatchObject({
        name: 'GspotError',
        code: 'install',
        message: `uv ${step} failed (exit 7).\nindex password [redacted] [redacted]\ninterpreter unavailable`,
    });
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.uvLockfile), 'utf8')).toBe(PYTHON_TOOL_LOCKFILE);
    expect(await readFile(join(sandbox.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.pythonEnvironment))).toBe(false);
});

test('a successful uv run refuses a password in its new lockfile and keeps the tool project files', async () => {
    await using sandbox = await testdir(PYTHON_INSTALL_FILES);

    using boundary = fakeCommands('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${PYTHON_TOOL_LOCKFILE}\n# test+password\n`);
        return buildProcessResult();
    });
    const writer = openFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const read = writer.read.bind(writer);
    using _read = spyOn(writer, 'read').mockImplementation((path) =>
        path === GSPOT_PATHS.uvLockfile ? undefined : read(path),
    );
    const lockfileError = await captureRejection(
        planPythonLockfile(
            buildToolInstall(session, writer),
            { path: GSPOT_PATHS.pythonProject, content: PYTHON_TOOL_PROJECT },
            'synthetic-uv',
        ),
    );
    expect(lockfileError).toMatchObject(LOCKFILE_PASSWORD_ERROR);
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.uvLockfile), 'utf8')).toBe(PYTHON_TOOL_LOCKFILE);
    expect(await readFile(join(sandbox.path, 'uv.toml'), 'utf8')).toBe(UV_TOML);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.pythonEnvironment))).toBe(false);
    expect(boundary).toHaveBeenCalledTimes(1);
});

test('uv installs the tool project with its own Python, whatever UV_PYTHON and .python-version the repository sets', async () => {
    await using sandbox = await testdir({
        ...PYTHON_INSTALL_FILES,
        '.python-version': '3.12.13\n',
    });

    const runs: { command: string[]; env: Record<string, string | undefined> | undefined }[] = [];
    using _boundary = fakeCommands('pinned-uv', (command, options) => {
        runs.push({ command: [...command], env: options.env });
        return Promise.resolve(buildProcessResult());
    });
    const writer = openFiles(sandbox.path);
    await installPythonTools(buildToolInstall(await openSession(sandbox.path), writer), 'pinned-uv');
    expect(runs.map(({ command }) => command[1])).toStrictEqual(['venv', 'sync']);
    for (const { command, env } of runs) {
        const flag = command.indexOf('--python');
        expect(command.slice(flag, flag + 2)).toStrictEqual(['--python', PYTHON_VERSION]);
        expect(env).toHaveProperty('UV_PYTHON', undefined);
    }
});

test('the uv lockfile check ignores name spelling and requirement order and refuses invalid TOML and a range', () => {
    expect(isPythonLockfileFresh(pythonProject, PYTHON_TOOL_LOCKFILE, {})).toBe(true);
    expect(isPythonLockfileFresh(pythonProject, 'not valid =', {})).toBe(false);
    const rangedProject = (parse(PYTHON_TOOL_PROJECT.replace('==1.2.3', '>=1.2.3')) as { project: PythonToolProject })
        .project;
    const exists = isPythonLockfileFresh(rangedProject, PYTHON_TOOL_LOCKFILE, {});
    expect(exists).toBe(false);
});

test.each([...UV_LOCKFILE_MISMATCHES])('a changed %s makes the uv lockfile stale', (_name, before, after) => {
    expect(
        isPythonLockfileFresh(
            pythonProject,
            PYTHON_TOOL_LOCKFILE.replace(before, () => after),
            {},
        ),
    ).toBe(false);
});

test.each([...UV_LOCKFILE_ORIGINS])(
    'uv lockfile index %s and artifact %s with the settings %j have allowed origins: %p',
    (registry, url, expected, indexes) => {
        const lockfile = `${PYTHON_TOOL_LOCKFILE}\n[[package]]\nname = "example-package"\nversion = "1.2.3"\nsource = { registry = "${registry}" }\nsdist = { url = "${url}" }\nwheels = [{ url = "${url}" }]\n`;
        expect(isPythonLockfileFresh(pythonProject, lockfile, indexes)).toBe(expected);
    },
);

test.each(INVALID_UV_SETTINGS)(
    'invalid $file $field settings name the file and field',
    async ({ file, field, text }) => {
        await using sandbox = await testdir({ [file]: text });
        expect(() => readPythonSettings(sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'parse',
                message: `${file}: ${field}: Invalid input: expected array, received string. Fix the field.`,
            }),
        );
    },
);

async function readInstalledSettings(root: string, releaseAgeDays: number): Promise<unknown> {
    const settings: unknown[] = [];
    using boundary = fakeCommands('settings-uv', (command) => {
        const file = command[command.indexOf('--config-file') + 1];
        if (file === undefined) throw new Error('The uv command received no settings file.');
        settings.push(parse(readFileSync(file, 'utf8')));
        return Promise.resolve(buildProcessResult());
    });
    const writer = openFiles(root);
    await installPythonTools({ ...buildToolInstall(await openSession(root), writer), releaseAgeDays }, 'settings-uv');
    expect(boundary).toHaveBeenCalledTimes(2);
    expect(settings[0]).toStrictEqual(settings[1]);
    return settings[0];
}

test('uv.toml wins and local index paths are read relative to the repository', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'uv.toml': UV_TOML,
        'pyproject.toml': PYPROJECT_UV_INDEX,
    });
    expect(readPythonSettings(sandbox.path).credentials).toStrictEqual(['test%2Bpassword', 'test+password']);
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
        'index-url': 'https://alex:test%2Bpassword@example.com/simple',
        'find-links': [join(sandbox.path, 'wheels'), 'https://example.com/wheels'],
        offline: true,
        index: [{ name: 'local', url: join(sandbox.path, 'packages') }],
    });
});

test('project index settings apply only without uv.toml, and missing or empty files give none', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'pyproject.toml': PYPROJECT_UV_INDEX,
    });
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
        'index-url': 'https://example.com/simple',
        'find-links': [join(sandbox.path, 'wheels')],
    });
    await createFileTree(sandbox.path, { 'uv.toml': '' });
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
    });
    await rm(join(sandbox.path, 'uv.toml'));
    await rm(join(sandbox.path, 'pyproject.toml'));
    expect(await readInstalledSettings(sandbox.path, 7)).toStrictEqual({
        'exclude-newer': '7 days',
    });
    await writeFile(join(sandbox.path, 'uv.toml'), 'find-links = [7]');
    expect(() => readPythonSettings(sandbox.path)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: 'uv.toml: find-links.0: Invalid input: expected string, received number. Fix the field.',
        }),
    );
});

test('Python resolution excludes releases newer than the minimum release age', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]) });
    expect(await readInstalledSettings(sandbox.path, 14)).toStrictEqual({
        'exclude-newer': '14 days',
    });
    const saved = `${PYTHON_TOOL_LOCKFILE}\n[options]\nexclude-newer-span = "P7D"\n`;
    expect(isPythonLockfileFresh(pythonProject, saved, {}, 7)).toBe(true);
    expect(isPythonLockfileFresh(pythonProject, saved, {}, 14)).toBe(false);
});
