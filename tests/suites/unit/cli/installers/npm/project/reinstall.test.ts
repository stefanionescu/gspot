import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildNpmToolInstall } from '#tests/setup/cli/tools.ts';
import { installNpmTools } from '#cli/installers/npm/project.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

test('Bun keeps installed modules while it runs the frozen install', async () => {
    await using sandbox = await testdir({
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
    expect(await installNpmTools(install)).toMatch(
        /^installed \d+ npm tools in \.gspot\/node_modules \(bun 0\.0\.0-test\)$/u,
    );
    expect(install.steps).toStrictEqual([expect.arrayContaining(['bun', 'install', '--frozen-lockfile']) as string[]]);
    expect(await readFile(installed, 'utf8')).toBe('keep these bytes');
});
