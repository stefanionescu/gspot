import { join } from 'node:path';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

import {
    detectPackageManager,
    readToolPackageManager,
    readPackageManagerVersion,
} from '#cli/repository/npm/package-manager.ts';
import {
    NON_EXACT_PNPM_VERSIONS,
    PACKAGE_MANAGER_PIN_CASES,
    UNSUPPORTED_PACKAGE_MANAGERS,
} from '#tests/config/repository/npm/package-manager.ts';

test('without a packageManager field or Bun on PATH, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await createGitSandbox({});
    await using bin = await testdir();
    await writeProgramCommand(bin.path, 'npm', 'fakes/tool', '--line', '10.9.0');
    using _environment = overrideEnvironment({ PATH: bin.path });
    const installer = detectPackageManager(sandbox.path, []);
    expect(installer).toStrictEqual({ name: 'npm' });
    expect(
        readPackageManagerVersion(
            sandbox.path,
            installer,
            SETTING_DEFINITIONS['tool_timeout_seconds'].default,
            createReadCache(sandbox.path),
        ),
    ).toStrictEqual({
        name: 'npm',
        version: '10.9.0',
    });
});

test.each([...PACKAGE_MANAGER_PIN_CASES])(
    '%s names the package manager and its version',
    async (_, files, expected) => {
        await using sandbox = await createGitSandbox(files);

        const { name, version } = detectPackageManager(sandbox.path, []);
        expect([name, version]).toStrictEqual(expected.split('@'));
    },
);

test.each([...NON_EXACT_PNPM_VERSIONS])(
    'a pnpm version that is not exact is refused with the version to write: %s',
    async (packageJson, message) => {
        await using sandbox = await createGitSandbox({
            'package.json': packageJson,
        });

        expect(await captureRejection(Promise.try(() => detectPackageManager(sandbox.path, [])))).toMatchObject({
            name: 'GspotError',
            code: 'install',
            message,
        });
    },
);

test('a refused pinned package manager keeps project files and gives no install loop', async () => {
    const files = { 'package.json': '{"packageManager":"bun@0.0.0"}\n' };
    await using sandbox = await createGitSandbox({
        ...files,
        source: 'kept\n',
        'gspot.toml': buildSandboxSettings([]),
    });
    await runGspot(sandbox.path, ['apply']);
    const previous = await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8');
    const run = processes.spawnProcess;
    using _boundary = spyOn(processes, 'spawnProcess').mockImplementation((command, options) =>
        command[0] === 'mise'
            ? Promise.resolve(buildProcessResult({ code: 1, stderr: 'The requested version is not available.' }))
            : run(command, options),
    );
    const failure = await runGspot(sandbox.path, ['install']);
    expect(failure.code).toBe(2);
    expect(failure.stderr).toBe(
        'The tool project requires bun@0.x, and `bun --version` exited with 1: The requested version is not available.. Install that package manager version first.\n',
    );
    for (const [path, content] of Object.entries(files))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept\n');
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(previous);
    expect(await isOnDisk(join(sandbox.path, `${GSPOT_FOLDER}/bun.lock`))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, GSPOT_PATHS.nodeModules))).toBe(false);
});

test.each([...UNSUPPORTED_PACKAGE_MANAGERS])(
    'unsupported $field values identify the package.json field',
    async ({ field, written, packageJson }) => {
        await using sandbox = await createGitSandbox({ 'package.json': JSON.stringify(packageJson) });
        expect(await captureRejection(Promise.try(() => detectPackageManager(sandbox.path, [])))).toMatchObject({
            code: 'install',
            message: `package.json: ${field} is "${written}"; gspot supports npm, bun, pnpm, yarn with an exact version, such as pnpm@9.0.0. Change the field.`,
        });
    },
);

test('a lockfile beside a later nested package selects its manager', async () => {
    await using sandbox = await testdir({
        'apps/admin/package.json': '{"private":true}',
        'web/package.json': '{"private":true}',
        'web/pnpm-lock.yaml': 'lockfileVersion: "9.0"\n',
    });
    expect(detectPackageManager(sandbox.path, ['web/package.json', 'apps/admin/package.json'])).toStrictEqual({
        name: 'pnpm',
    });
});

test('Yarn uses npm without querying Yarn', async () => {
    await using sandbox = await testdir();
    using run = spyOn(processes, 'spawnProcessBlocking').mockReturnValue(buildProcessResult({ stdout: '11.19.0\n' }));
    expect(
        readToolPackageManager(
            sandbox.path,
            { name: 'yarn', version: '0.0.0-test' },
            30,
            createReadCache(sandbox.path),
        ),
    ).toStrictEqual({ name: 'npm', version: '11.19.0' });
    expect(run.mock.calls.map(([command]) => command)).toStrictEqual([['npm', '--version']]);
});
