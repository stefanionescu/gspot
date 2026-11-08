import { readFileSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { UV_LOCKFILE_CREDENTIAL_MESSAGE } from '#cli/config/tools/installers.ts';
import { openSession } from '#cli/engine/session.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import {
    installPythonProjects,
    installPythonTools,
    isPythonLockfileFresh,
    planPythonLockfile,
    readPythonSettings,
} from '#cli/tools/installers/pypi.ts';
import type { PythonToolProject } from '#cli/types/tools.ts';
import {
    INVALID_UV_SETTINGS,
    PYPROJECT_UV_INDEX,
    PYTHON_INSTALL_FILES,
    PYTHON_TOOL_LOCKFILE,
    PYTHON_TOOL_PROJECT,
    UV_LOCKFILE_MISMATCHES,
    UV_LOCKFILE_ORIGINS,
    UV_TOML,
} from '#tests/config/tools/installers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { captureRejection, matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

const pythonProject = (parse(PYTHON_TOOL_PROJECT) as { project: PythonToolProject }).project;

test('a failed uv sync hides index passwords', async () => {
    await using sandbox = await createGitSandbox(PYTHON_INSTALL_FILES);

    using _boundary = fakeCommands('unavailable-uv', () => {
        return Promise.resolve(
            buildProcessResult({
                code: 7,
                stdout: 'index password test%2Bpassword test+password',
                stderr: 'interpreter unavailable',
            }),
        );
    });
    const writer = openFiles(sandbox.path);
    const install = installPythonTools(
        await buildSandboxToolInstall(await openSession(sandbox.path), writer),
        'unavailable-uv',
    );
    const installationError = await captureRejection(install);
    expect(installationError).toMatchObject({ name: 'GspotError', code: 'install' });
    for (const secret of ['test%2Bpassword', 'test+password']) expect(installationError.message).not.toContain(secret);
    expect(installationError.message).toContain('interpreter unavailable');
});

test('a successful uv run refuses a password in its new lockfile and the saved one stays', async () => {
    await using sandbox = await createGitSandbox(PYTHON_INSTALL_FILES);

    using _boundary = fakeCommands('synthetic-uv', async (_command, options) => {
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
            await buildSandboxToolInstall(session, writer),
            { path: GSPOT_PATHS.pythonProject, content: PYTHON_TOOL_PROJECT },
            'synthetic-uv',
        ),
    );
    expect(lockfileError).toMatchObject({ code: 'install', message: UV_LOCKFILE_CREDENTIAL_MESSAGE });
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.uvLockfile), 'utf8')).toBe(PYTHON_TOOL_LOCKFILE);
});

test('the uv lockfile check ignores name spelling and requirement order and refuses invalid TOML and a range', () => {
    expect(isPythonLockfileFresh(pythonProject, PYTHON_TOOL_LOCKFILE, {})).toBe(true);
    expect(isPythonLockfileFresh(pythonProject, 'not valid =', {})).toBe(false);
    const rangedProject = (parse(PYTHON_TOOL_PROJECT.replace('==1.2.3', '>=1.2.3')) as { project: PythonToolProject })
        .project;
    expect(isPythonLockfileFresh(rangedProject, PYTHON_TOOL_LOCKFILE, {})).toBe(false);
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
                message: expect.stringContaining(`${file}: ${field}`) as string,
            }),
        );
    },
);

async function readInstalledSettings(root: string, releaseAgeDays: number): Promise<unknown> {
    const settings: unknown[] = [];
    using _boundary = fakeCommands('settings-uv', (command) => {
        const file = command[command.indexOf('--config-file') + 1];
        if (file === undefined) throw new Error('The uv command received no settings file.');
        settings.push(parse(readFileSync(file, 'utf8')));
        return Promise.resolve(buildProcessResult());
    });
    const writer = openFiles(root);
    await installPythonTools(
        { ...(await buildSandboxToolInstall(await openSession(root), writer)), releaseAgeDays },
        'settings-uv',
    );
    expect(settings).toHaveLength(1);
    return settings[0];
}

test('uv.toml wins and local index paths are read relative to the repository', async () => {
    await using sandbox = await createGitSandbox({
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
    await using sandbox = await createGitSandbox({
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
});

test('Python resolution excludes releases newer than the minimum release age', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    expect(await readInstalledSettings(sandbox.path, 14)).toStrictEqual({
        'exclude-newer': '14 days',
    });
    const saved = `${PYTHON_TOOL_LOCKFILE}\n[options]\nexclude-newer-span = "P7D"\n`;
    expect(isPythonLockfileFresh(pythonProject, saved, {}, 7)).toBe(true);
    expect(isPythonLockfileFresh(pythonProject, saved, {}, 14)).toBe(false);
});

test('install syncs each project that has a uv lockfile, and only those', async () => {
    await using sandbox = await createGitSandbox({
        ...PYTHON_INSTALL_FILES,
        'pyproject.toml': '[project]\nname = "root"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
    });
    using _boundary = fakeCommands('project-uv', () => Promise.resolve(buildProcessResult()));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    const lines = await installPythonProjects(install, 'project-uv');
    expect(install.steps).toStrictEqual([['project-uv', 'sync', '--locked', '--inexact']]);
    expect(lines).toStrictEqual(['installed the Python environment of the repository root']);
});
