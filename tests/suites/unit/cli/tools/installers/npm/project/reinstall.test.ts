import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildNpmToolInstall } from '#tests/setup/cli/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { installNpmTools } from '#cli/tools/installers/npm/project.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('Bun keeps installed modules while it runs the frozen install', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@0.0.0-test"}',
        [`${GSPOT_PATHS.nodeModules}/installed`]: 'keep these bytes',
    });
    const writer = openFiles(sandbox.path);
    const installed = join(sandbox.path, GSPOT_PATHS.nodeModules, 'installed');
    using _bun = fakeCommands('mise', async (command) => {
        expect(await readFile(installed, 'utf8')).toBe('keep these bytes');
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '0.0.0-test\n' : '' });
    });
    const session = await openSession(sandbox.path);
    const install = await buildNpmToolInstall(session, writer);
    await installNpmTools(install);
    expect(await readFile(installed, 'utf8')).toBe('keep these bytes');
});

test('Bun installs the tools without running install scripts', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@0.0.0-test"}',
    });
    const writer = openFiles(sandbox.path);
    using _bun = fakeCommands('mise', () => Promise.resolve(buildProcessResult({ stdout: '0.0.0-test\n' })));
    const session = await openSession(sandbox.path);
    const install = await buildNpmToolInstall(session, writer);
    await installNpmTools(install);
    expect(install.steps.flat()).toContain('--ignore-scripts');
});

test.each(['.npmrc', '.yarnrc.yml', 'pnpm-workspace.yaml', 'bunfig.toml'])(
    'a %s in the tool project stops the install before the package manager runs',
    async (name) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': '{"private":true,"packageManager":"bun@0.0.0-test"}',
            [`.gspot/${name}`]: 'registry=https://registry.example.com/\n',
        });
        const writer = openFiles(sandbox.path);
        using _bun = fakeCommands('mise', () => Promise.resolve(buildProcessResult({ stdout: '0.0.0-test\n' })));
        const session = await openSession(sandbox.path);
        const install = await buildNpmToolInstall(session, writer);
        const error = await captureRejection(installNpmTools(install));
        expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
        expect(error.message).toContain(`.gspot/${name}`);
        expect(install.steps).toStrictEqual([]);
    },
);
