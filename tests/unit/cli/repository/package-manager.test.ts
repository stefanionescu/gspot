import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { prepareCommand } from '#tests/setup/processes.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { matchSubstring, captureRejection } from '#tests/setup/matchers.ts';
import { selectPackageManager, readPackageManagerVersion } from '#cli/repository/package-manager.ts';

import {
    AUTHORED_VERSION_CASES,
    NON_EXACT_PNPM_VERSIONS,
    PACKAGE_MANAGER_DECLARATIONS,
} from '#tests/data/install/npm-tool-project.ts';

test('without a declaration or Bun on PATH, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await testdir();
    await using bin = await testdir();
    await createFileTree(bin.path, { npm: '#!/bin/sh\necho 10.9.0\n', 'npm.cmd': '@echo 10.9.0\r\n' });
    await chmod(join(bin.path, 'npm'), 0o755);
    using _environment = overrideEnvironment({ PATH: bin.path });
    const installer = await selectPackageManager(sandbox.path, []);
    expect(installer).toStrictEqual({ name: 'npm' });
    expect(readPackageManagerVersion(sandbox.path, installer, SETTING_DEFAULTS.tool_timeout_seconds)).toStrictEqual({
        name: 'npm',
        version: '10.9.0',
    });
});

test.each([...PACKAGE_MANAGER_DECLARATIONS])(
    '%s names the package manager and its version',
    async (_, files, expected) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, files);
        const { name, version } = await selectPackageManager(sandbox.path, []);
        expect([name, version]).toStrictEqual(expected.split('@'));
    },
);

test.each([...NON_EXACT_PNPM_VERSIONS])(
    'a pnpm version that is not exact is refused with the version to write: %s',
    async (manifest) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': manifest,
        });
        expect(await captureRejection(selectPackageManager(sandbox.path, []))).toContain('needs an exact pnpm version');
    },
);

test.each([...AUTHORED_VERSION_CASES])(
    '$source version data cannot skip the program version check before $operation',
    async ({ files }) => {
        await using repository = await testdir();
        await createFileTree(repository.path, { ...files, source: 'kept\n', 'gspot.toml': buildSettingsText([]) });
        await runRegisteredCommand(repository.path, ['apply']);
        const original = await readFile(join(repository.path, '.gspot/package.json'), 'utf8');
        const identity = await selectPackageManager(repository.path, []);
        const installer = readPackageManagerVersion(repository.path, identity, SETTING_DEFAULTS.tool_timeout_seconds);
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
        const failure = await runRegisteredCommand(repository.path, ['install']).catch((error: unknown) => error);
        expect(boundary).toHaveBeenCalledTimes(1);
        const version = await observed;
        expect(version?.code, version?.stderr).toBe(0);
        expect(version?.stdout.trim()).not.toBe('0.0.0');
        expect(failure).toMatchObject({
            name: 'GspotError',
            code: 'installation',
            message: matchSubstring('The tool project requires bun@0.x. Install that package manager version first.'),
        });
        for (const [path, content] of Object.entries(files))
            expect(await readFile(join(repository.path, path), 'utf8')).toBe(content);
        expect(await readFile(join(repository.path, 'source'), 'utf8')).toBe('kept\n');
        expect(await readFile(join(repository.path, '.gspot/package.json'), 'utf8')).toBe(original);
        expect(await isOnDisk(join(repository.path, '.gspot/bun.lock'))).toBe(false);
        expect(await isOnDisk(join(repository.path, '.gspot/node_modules'))).toBe(false);
    },
);
