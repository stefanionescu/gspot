import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { chmod, readFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/run-gspot.ts';
import * as processes from '#cli/system/processes.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { prepareCommand } from '#tests/setup/processes.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { SETTING_DECLARATIONS } from '#cli/config/settings/declarations.ts';
import { selectPackageManager, readPackageManagerVersion } from '#cli/repository/package-manager.ts';

import {
    AUTHORED_VERSION_CASES,
    NON_EXACT_PNPM_VERSIONS,
    PACKAGE_MANAGER_DECLARATIONS,
} from '#tests/data/install/npm-tool-project.ts';

test('without a declaration or Bun on PATH, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await testdir();
    await using bin = await testdir({ npm: '#!/bin/sh\necho 10.9.0\n', 'npm.cmd': '@echo 10.9.0\r\n' });

    await chmod(join(bin.path, 'npm'), 0o755);
    using _environment = overrideEnvironment({ PATH: bin.path });
    const installer = await selectPackageManager(sandbox.path, []);
    expect(installer).toStrictEqual({ name: 'npm' });
    expect(
        readPackageManagerVersion(
            sandbox.path,
            installer,
            SETTING_DECLARATIONS['tool_timeout_seconds'].default,
            createReadCache(sandbox.path),
        ),
    ).toStrictEqual({
        name: 'npm',
        version: '10.9.0',
    });
});

test.each([...PACKAGE_MANAGER_DECLARATIONS])(
    '%s names the package manager and its version',
    async (_, files, expected) => {
        await using sandbox = await testdir(files);

        const { name, version } = await selectPackageManager(sandbox.path, []);
        expect([name, version]).toStrictEqual(expected.split('@'));
    },
);

test.each([...NON_EXACT_PNPM_VERSIONS])(
    'a pnpm version that is not exact is refused with the version to write: %s',
    async (manifest, message) => {
        await using sandbox = await testdir({
            'package.json': manifest,
        });

        expect(selectPackageManager(sandbox.path, [])).rejects.toThrow(
            matchFields<GspotError>({ name: 'GspotError', code: 'installation', message }),
        );
    },
);

test.each([...AUTHORED_VERSION_CASES])(
    '$source version data cannot skip the program version check before $operation',
    async ({ files }) => {
        await using repository = await testdir({ ...files, source: 'kept\n', 'gspot.toml': buildSandboxSettings([]) });

        await runGspot(repository.path, ['apply']);
        const original = await readFile(join(repository.path, '.gspot/package.json'), 'utf8');
        const identity = await selectPackageManager(repository.path, []);
        const installer = readPackageManagerVersion(
            repository.path,
            identity,
            SETTING_DECLARATIONS['tool_timeout_seconds'].default,
            createReadCache(repository.path),
        );
        expect(installer).toStrictEqual({ name: 'bun', version: '0.0.0' });
        const run = processes.spawnProcess;
        let observed: ReturnType<typeof run> | undefined;
        using boundary = spyOn(processes, 'spawnProcess').mockImplementation((commandArguments, options) => {
            if (commandArguments[0] === 'bun' && commandArguments[1] !== '--version')
                throw new Error('Unexpected native package operation before version refusal.');
            const prepared = prepareCommand(commandArguments, options);
            observed = run(commandArguments, prepared.options);
            return observed;
        });
        const failure = await runGspot(repository.path, ['install']);
        expect(boundary).toHaveBeenCalledTimes(1);
        const version = await observed;
        expect(version?.code, version?.stderr).toBe(0);
        expect(version?.stdout.trim()).not.toBe('0.0.0');
        expect(failure.code).toBe(2);
        expect(failure.stderr).toBe(
            `The tool project requires bun@0.x, and found ${version?.stdout.trim() ?? ''}. Install that package manager version first.\nTool installation is incomplete. Run: gspot install\n`,
        );
        for (const [path, content] of Object.entries(files))
            expect(await readFile(join(repository.path, path), 'utf8')).toBe(content);
        expect(await readFile(join(repository.path, 'source'), 'utf8')).toBe('kept\n');
        expect(await readFile(join(repository.path, '.gspot/package.json'), 'utf8')).toBe(original);
        expect(await isOnDisk(join(repository.path, '.gspot/bun.lock'))).toBe(false);
        expect(await isOnDisk(join(repository.path, '.gspot/node_modules'))).toBe(false);
    },
);
