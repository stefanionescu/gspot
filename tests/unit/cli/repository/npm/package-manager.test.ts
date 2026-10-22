import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { chmod, readFile } from 'node:fs/promises';
import * as processes from '#cli/system/processes.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { limitToTestDeadline } from '#tests/setup/system/processes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { detectPackageManager, readPackageManagerVersion } from '#cli/repository/npm/package-manager.ts';

import {
    NON_EXACT_PNPM_VERSIONS,
    OUTDATED_BUN_PACKAGE_JSON,
    PACKAGE_MANAGER_PIN_CASES,
} from '#tests/data/repository/npm/package-manager.ts';

test('without a packageManager field or Bun on PATH, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await testdir();
    await using bin = await testdir({ npm: '#!/bin/sh\necho 10.9.0\n', 'npm.cmd': '@echo 10.9.0\r\n' });

    await chmod(join(bin.path, 'npm'), 0o755);
    using _environment = overrideEnvironment({ PATH: bin.path });
    const installer = await detectPackageManager(sandbox.path, []);
    expect(installer).toStrictEqual({ name: 'npm' });
    expect(
        readPackageManagerVersion(
            sandbox.path,
            installer,
            SETTING_FACTS['tool_timeout_seconds'].default,
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
        await using sandbox = await testdir(files);

        const { name, version } = await detectPackageManager(sandbox.path, []);
        expect([name, version]).toStrictEqual(expected.split('@'));
    },
);

test.each([...NON_EXACT_PNPM_VERSIONS])(
    'a pnpm version that is not exact is refused with the version to write: %s',
    async (packageJson, message) => {
        await using sandbox = await testdir({
            'package.json': packageJson,
        });

        expect(detectPackageManager(sandbox.path, [])).rejects.toThrow(
            matchFields<GspotError>({ name: 'GspotError', code: 'install', message }),
        );
    },
);

test('install runs the real bun version check when package.json declares bun@0.0.0', async () => {
    const files = { 'package.json': OUTDATED_BUN_PACKAGE_JSON };
    await using sandbox = await testdir({ ...files, source: 'kept\n', 'gspot.toml': buildSandboxSettings([]) });

    await runGspot(sandbox.path, ['apply']);
    const original = await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8');
    const identity = await detectPackageManager(sandbox.path, []);
    const installer = readPackageManagerVersion(
        sandbox.path,
        identity,
        SETTING_FACTS['tool_timeout_seconds'].default,
        createReadCache(sandbox.path),
    );
    expect(installer).toStrictEqual({ name: 'bun', version: '0.0.0' });
    const run = processes.spawnProcess;
    let observed: ReturnType<typeof run> | undefined;
    using boundary = spyOn(processes, 'spawnProcess').mockImplementation((commandArguments, options) => {
        if (commandArguments[0] === 'bun' && commandArguments[1] !== '--version')
            throw new Error('Unexpected native package operation before version refusal.');
        const prepared = limitToTestDeadline(commandArguments, options);
        observed = run(commandArguments, prepared.options);
        return observed;
    });
    const failure = await runGspot(sandbox.path, ['install']);
    expect(boundary).toHaveBeenCalledTimes(1);
    const version = await observed;
    expect(version?.code, version?.stderr).toBe(0);
    expect(version?.stdout.trim()).not.toBe('0.0.0');
    expect(failure.code).toBe(2);
    expect(failure.stderr).toBe(
        `The tool project requires bun@0.x, and found ${version?.stdout.trim() ?? ''}. Install that package manager version first.\nTool installation is incomplete. Run gspot install.\n`,
    );
    for (const [path, content] of Object.entries(files))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept\n');
    expect(await readFile(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe(original);
    expect(await isOnDisk(join(sandbox.path, '.gspot/bun.lock'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
});
