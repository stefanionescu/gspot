import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall } from '#tests/setup/cli/tools.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { UV_LOCKFILE_CREDENTIAL_MESSAGE } from '#cli/config/tools/installers.ts';
import { PYTHON_TOOL_PROJECT, PYTHON_INSTALL_FILES, PYTHON_TOOL_LOCKFILE } from '#tests/config/tools.ts';
import { installPythonTools, planPythonLockfile, installPythonProjects } from '#cli/tools/installers/python/project.ts';

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
    const install = installPythonTools(
        await buildSandboxToolInstall(await openSession(sandbox.path)),
        'unavailable-uv',
    );
    const installationError = await captureRejection(install);
    expect(installationError).toMatchObject({ name: 'GspotError', code: 'install' });
    for (const secret of ['test%2Bpassword', 'test+password']) expect(installationError.message).not.toContain(secret);
    expect(installationError.message).toContain('interpreter unavailable');
});

test('a successful uv run refuses a password in its new lockfile and the saved one stays', async () => {
    const stale = PYTHON_TOOL_LOCKFILE.replace('==4.0.0', '==5.0.0');
    await using sandbox = await createGitSandbox({ ...PYTHON_INSTALL_FILES, [GSPOT_PATHS.uvLockfile]: stale });

    using _boundary = fakeCommands('synthetic-uv', async (_command, options) => {
        await writeFile(join(options.cwd, 'uv.lock'), `${PYTHON_TOOL_LOCKFILE}\n# test+password\n`);
        return buildProcessResult();
    });
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    const lockfileError = await captureRejection(
        planPythonLockfile(install, { path: GSPOT_PATHS.pythonProject, content: PYTHON_TOOL_PROJECT }, 'synthetic-uv'),
    );
    expect(lockfileError).toMatchObject({ code: 'install', message: UV_LOCKFILE_CREDENTIAL_MESSAGE });
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.uvLockfile), 'utf8')).toBe(stale);
});

test('install syncs each project that has a uv lockfile, and only those', async () => {
    await using sandbox = await createGitSandbox({
        ...PYTHON_INSTALL_FILES,
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'api' }] }),
        'pyproject.toml': '[project]\nname = "root"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
        'api/pyproject.toml': '[project]\nname = "api"\nversion = "1.0.0"\n',
    });
    using _boundary = fakeCommands('project-uv', () => Promise.resolve(buildProcessResult()));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    const lines = await installPythonProjects(install, 'project-uv');
    expect(install.steps).toStrictEqual([['project-uv', 'sync', '--locked', '--inexact']]);
    expect(lines).toStrictEqual(['installed the Python environment of the repository root']);
});

test.each([
    {
        name: 'a stale uv.lock',
        stderr: 'error: The lockfile at `uv.lock` needs to be updated, but `--locked` was provided.',
        advice: 'Run uv lock in the repository root to update uv.lock, then run gspot install again.',
    },
    {
        name: 'another uv sync failure',
        stderr: 'error: Failed to fetch: `https://pypi.org/simple/requests/`',
        advice: 'Check the network or proxy, then run again.',
    },
])('$name ends the install error with the advice: $advice', async ({ stderr, advice }) => {
    await using sandbox = await createGitSandbox({
        ...PYTHON_INSTALL_FILES,
        'pyproject.toml': '[project]\nname = "root"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
    });
    using _boundary = fakeCommands('project-uv', () => Promise.resolve(buildProcessResult({ code: 1, stderr })));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path));
    const installationError = await captureRejection(installPythonProjects(install, 'project-uv'));
    expect(installationError).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(installationError.message.split('\n').at(-1)).toBe(advice);
});

test.each([
    { name: 'a mise config of the repository pins', source: 'mise.toml', flags: ['--python', '/pins/python'] },
    { name: 'only a mise config outside the repository names', source: '../mise.toml', flags: [] },
])('install builds a new project environment on the Python that $name: $flags', async ({ source, flags }) => {
    await using sandbox = await createGitSandbox({
        ...PYTHON_INSTALL_FILES,
        'pyproject.toml': '[project]\nname = "root"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
    });
    const session = await openSession(sandbox.path);
    const listed = JSON.stringify([
        { version: '3.12.0', source: { type: 'mise.toml', path: join(session.root, source) } },
    ]);
    using _boundary = fakeCommands(
        ([program]) => program === 'project-uv' || program === 'project-mise',
        ([program, action]) => {
            if (program !== 'project-mise') return Promise.resolve(buildProcessResult());
            return Promise.resolve(buildProcessResult({ stdout: action === 'ls' ? listed : '/pins/python\n' }));
        },
    );
    const install = await buildSandboxToolInstall(session);
    await installPythonProjects({ ...install, misePath: 'project-mise' }, 'project-uv');
    expect(install.steps).toStrictEqual([['project-uv', 'sync', '--locked', '--inexact', ...flags]]);
});

test('a uv sync held by the release age names the PyPI release and its age', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['python']) });
    const session = await openSession(sandbox.path);
    const install = await buildSandboxToolInstall(session);
    const [pin] = listPackagePins(session.toolConfigurations).python as [string];
    const [name, version] = pin.split('==') as [string, string];
    using _boundary = fakeCommands('age-uv', () =>
        Promise.resolve(buildProcessResult({ code: 1, stderr: `No solution found for ${pin}` })),
    );
    using registry = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(() => Promise.resolve(Response.json({ urls: [{ upload_time_iso_8601: new Date() }] })), {
            preconnect: fetch.preconnect,
        }),
    );
    const error = await captureRejection(installPythonTools(install, 'age-uv'));
    expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
    expect(error.message).toStartWith(`${pin} came out less than ${String(install.releaseAgeDays)} days ago`);
    expect(registry.mock.calls.map(([url]) => url)).toStrictEqual([`https://pypi.org/pypi/${name}/${version}/json`]);
});
