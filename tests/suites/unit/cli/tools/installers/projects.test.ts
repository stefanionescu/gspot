import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { installNpmToolProject, isEveryEnvironmentReady, listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import { YARN_CLIENTS } from '#tests/config/setup/programs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildSandboxToolInstall, buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test.each([...YARN_CLIENTS])(
    'Yarn $packageManager.version plans an npm tool lockfile without Yarn settings',
    async ({ packageManager }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': JSON.stringify({ private: true, packageManager: `yarn@${packageManager.version}` }),
        });
        const session = await openSession(sandbox.path);
        const generated = buildGeneratedFiles(session);
        expect(generated.files.some(({ path }) => path === '.gspot/.yarnrc.yml')).toBe(false);
        const lockfiles = listStaleLockfiles(session, generated.files);
        expect(
            lockfiles.filter(({ path }) => path !== GSPOT_PATHS.uvLockfile && path !== GSPOT_PATHS.miseLockfile),
        ).toStrictEqual([{ path: '.gspot/package-lock.json', kind: 'absent' }]);
    },
);

test('tool lockfiles report missing and changed projects and omit current projects', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(sandbox.path);
    const generated = buildGeneratedFiles(session).files;
    const paths = [GSPOT_PATHS.miseLockfile, '.gspot/bun.lock', GSPOT_PATHS.uvLockfile];
    expect(listStaleLockfiles(session, generated)).toStrictEqual(paths.map((path) => ({ path, kind: 'absent' })));
    const lockfiles = buildToolLockfiles(session.toolConfigurations);
    await createFileTree(sandbox.path, lockfiles);
    expect(listStaleLockfiles(session, generated)).toStrictEqual([]);
    await createFileTree(sandbox.path, Object.fromEntries(paths.map((path) => [path, 'invalid ='])));
    expect(listStaleLockfiles(session, generated)).toStrictEqual(paths.map((path) => ({ path, kind: 'changed' })));
});

test('with no mise on PATH, the mise lockfile counts as current, because gspot install cannot write it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(sandbox.path);
    using _lookup = fakeExecutableLookup((name) => (name === 'mise' ? null : undefined));
    expect(listStaleLockfiles(session, buildGeneratedFiles(session).files)).toStrictEqual([
        { path: '.gspot/bun.lock', kind: 'absent' },
    ]);
});

test('a changed npm tool lockfile installs into an empty node_modules, and a current one keeps it', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@0.0.0-test"}',
        [`${GSPOT_PATHS.nodeModules}/dropped/package.json`]: '{}\n',
    });
    const session = await openSession(sandbox.path);
    const lockfile = buildToolLockfiles(session.toolConfigurations)['.gspot/bun.lock']!;
    using _bun = fakeCommands('mise', async (command, options) => {
        if (command.includes('--lockfile-only')) await writeFile(join(options.cwd, 'bun.lock'), lockfile);
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '0.0.0-test\n' : '' });
    });
    const install = await buildSandboxToolInstall(session, openFiles(sandbox.path));
    await installNpmToolProject(install);
    expect(existsSync(join(sandbox.path, GSPOT_PATHS.nodeModules, 'dropped'))).toBe(false);
    await createFileTree(sandbox.path, { [`${GSPOT_PATHS.nodeModules}/kept/package.json`]: '{}\n' });
    await installNpmToolProject(install);
    expect(existsSync(join(sandbox.path, GSPOT_PATHS.nodeModules, 'kept'))).toBe(true);
});

test.each([
    { name: 'an environment that uv sync --check accepts', venv: true, code: 0, synced: true },
    { name: 'an environment that differs from its lockfile', venv: true, code: 1, synced: false },
    { name: 'no environment', venv: false, code: 0, synced: false },
])('a uv-locked project counts as synced only with $name', async ({ venv, code, synced }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python']),
        'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\n',
        'uv.lock': 'version = 1\n',
        ...(venv && { '.venv/pyvenv.cfg': 'home = /usr/bin\n' }),
    });
    using _lookup = fakeExecutableLookup((name) => (name === 'uv' ? '/tools/uv' : undefined));
    using uv = fakeCommands('uv', () => Promise.resolve(buildProcessResult({ code })));
    const install = await buildSandboxToolInstall(await openSession(sandbox.path), openFiles(sandbox.path));
    expect(await isEveryEnvironmentReady(install, [])).toBe(synced);
    expect(uv.mock.calls.map(([command]) => command)).toStrictEqual(
        venv ? [['/tools/uv', 'sync', '--locked', '--inexact', '--check']] : [],
    );
});
