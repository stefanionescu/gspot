import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { chmod, readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { openSafeFolder } from '#cli/system/files/open.ts';
import { prepareCommand } from '#tests/setup/processes.ts';
import { installNpmTools } from '#cli/tools/npm/project.ts';
import { useEnvironment } from '#tests/setup/environment.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { selectNpmClient, readNpmClientVersion } from '#cli/tools/npm/client.ts';
import { VERSION_SOURCES, NON_EXACT_PNPM_VERSIONS, NPM_CLIENT_DECLARATIONS } from '#tests/config/npm.ts';

test('without a declaration or Bun on PATH, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await testdir();
    await using bin = await testdir();
    await createFileTree(bin.path, { npm: '#!/bin/sh\necho 10.9.0\n', 'npm.cmd': '@echo 10.9.0\r\n' });
    await chmod(join(bin.path, 'npm'), 0o755);
    using _environment = useEnvironment({ PATH: bin.path });
    const installer = await selectNpmClient(sandbox.path, []);
    expect(installer).toStrictEqual({ name: 'npm' });
    expect(
        readNpmClientVersion(sandbox.path, installer, rootSettingSchemas.tool_timeout_seconds.parse(undefined)),
    ).toStrictEqual({ name: 'npm', version: '10.9.0' });
});

test.each([...NPM_CLIENT_DECLARATIONS])('%s names the npm client and its version', async (_, files, expected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, files);
    const { name, version } = await selectNpmClient(sandbox.path, []);
    expect([name, version]).toStrictEqual(expected.split('@'));
});

test.each([...NON_EXACT_PNPM_VERSIONS])(
    'a pnpm version that is not exact is refused with the version to write: %s',
    async (manifest) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': manifest,
        });
        expect(await rejection(selectNpmClient(sandbox.path, []))).toContain('needs an exact pnpm version');
    },
);

test.each([...VERSION_SOURCES])(
    '$source version data cannot skip the program version check before $operation',
    async ({ files }) => {
        await using repository = await testdir();
        await createFileTree(repository.path, { ...files, source: 'kept\n' });
        const project = '{"private":true,"devDependencies":{"prettier":"3.8.1"}}\n';
        const original = project;
        const lockfile = JSON.stringify({
            workspaces: { '': { devDependencies: { prettier: '3.8.1' } } },
        });
        await createFileTree(repository.path, { '.gspot/package.json': original, '.gspot/bun.lock': lockfile });
        await createFileTree(repository.path, { 'gspot.toml': settingsText([]) });
        const session = await openSession(repository.path);
        using owner = openSafeFolder(repository.path);
        const identity = await selectNpmClient(repository.path, []);
        const installer = readNpmClientVersion(
            repository.path,
            identity,
            rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        );
        expect(installer).toStrictEqual({ name: 'bun', version: '0.0.0' });
        const run = processes.run;
        let observed: ReturnType<typeof run> | undefined;
        using boundary = spyOn(processes, 'run').mockImplementation((argv, options, output) => {
            if (argv[0] === 'bun' && argv[1] !== '--version')
                throw new Error('Unexpected native package operation before version refusal.');
            const prepared = prepareCommand(argv, options);
            observed = run(argv, prepared.options, output);
            return observed;
        });
        const failure = await installNpmTools(session, owner, [], []).catch((error: unknown) => error);
        expect(boundary).toHaveBeenCalledTimes(1);
        const version = await observed;
        expect(version?.code, version?.stderr).toBe(0);
        expect(version?.stdout.trim()).not.toBe('0.0.0');
        expect(failure).toMatchObject({
            name: 'GspotError',
            code: 'tool',
            message: 'The tool project requires bun@0.x. Install that package manager version first.',
        });
        for (const [path, content] of Object.entries(files))
            expect(await readFile(join(repository.path, path), 'utf8')).toBe(content);
        expect(await readFile(join(repository.path, 'source'), 'utf8')).toBe('kept\n');
        expect(await readFile(join(repository.path, '.gspot/package.json'), 'utf8')).toBe(original);
        expect(await readFile(join(repository.path, '.gspot/bun.lock'), 'utf8')).toBe(lockfile);
        expect(await pathExists(join(repository.path, '.gspot/node_modules'))).toBe(false);
    },
);
