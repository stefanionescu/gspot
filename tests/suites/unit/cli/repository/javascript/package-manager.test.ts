import { join } from 'node:path';
import { testdir } from 'testdirs';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { createRunCache } from '#cli/system/cache.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    NON_EXACT_PNPM_VERSIONS,
    PACKAGE_MANAGER_PIN_CASES,
    UNSUPPORTED_PACKAGE_MANAGERS,
} from '#tests/config/repository/detect.ts';
import {
    detectPackageManager,
    readToolPackageManager,
    readPackageManagerVersion,
} from '#cli/repository/javascript/package-manager.ts';

test('without a packageManager field or Bun on PATH, the tool project uses npm at the version it prints', async () => {
    await using sandbox = await createGitSandbox({});
    await using bin = await testdir();
    await writeProgramCommand(bin.path, 'npm', 'fakes/tool', '--line', '10.9.0');
    using _environment = overrideEnvironment({ PATH: bin.path });
    const installer = detectPackageManager(sandbox.path, []);
    expect(installer).toStrictEqual({ name: 'npm' });
    expect(
        await readPackageManagerVersion(
            sandbox.path,
            installer,
            rootSettingSchemas.tool_timeout_seconds.parse(undefined),
            createRunCache(sandbox.path),
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
    'a pnpm version that is not exact is refused with the written value and its field: %s',
    async (packageJson, written, field) => {
        await using sandbox = await createGitSandbox({
            'package.json': packageJson,
        });

        const error = await captureRejection(Promise.try(() => detectPackageManager(sandbox.path, [])));
        expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
        expect(error.message).toContain(`"${written}"`);
        expect(error.message).toContain(field);
    },
);

test('a refused pinned package manager keeps project files and gives no install loop', async () => {
    const files = { 'package.json': '{"packageManager":"bun@0.0.0"}\n' };
    await using sandbox = await createGitSandbox({
        ...files,
        source: 'kept\n',
        'gspot.toml': buildSandboxSettings([]),
    });
    await applyGeneratedFiles(sandbox.path);
    const previous = await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8');
    const run = processes.runProcess;
    using _boundary = spyOn(processes, 'runProcess').mockImplementation((command, options) =>
        command[0] === 'mise'
            ? Promise.resolve(buildProcessResult({ code: 1, stderr: 'The requested version is not available.' }))
            : run(command, options),
    );
    const failure = await runGspot(sandbox.path, ['install', '--json']);
    expect(failure.code).toBe(2);
    expect(JSON.parse(failure.stdout)).toMatchObject({ error: 'tool' });
    for (const [path, content] of Object.entries(files))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(content);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept\n');
    expect(await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8')).toBe(previous);
    expect(existsSync(join(sandbox.path, `${GSPOT_FOLDER}/bun.lock`))).toBe(false);
    expect(existsSync(join(sandbox.path, GSPOT_PATHS.nodeModules))).toBe(false);
});

test.each([...UNSUPPORTED_PACKAGE_MANAGERS])(
    'unsupported $field value $written names the package.json field',
    async ({ field, written, packageJson }) => {
        await using sandbox = await createGitSandbox({ 'package.json': JSON.stringify(packageJson) });
        const error = await captureRejection(Promise.try(() => detectPackageManager(sandbox.path, [])));
        expect(error).toMatchObject({ name: 'GspotError', code: 'install' });
        expect(error.message).toContain(field);
        expect(error.message).toContain(`"${written}"`);
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
    using run = spyOn(processes, 'runProcess').mockResolvedValue(buildProcessResult({ stdout: '11.19.0\n' }));
    expect(
        await readToolPackageManager(
            sandbox.path,
            { name: 'yarn', version: '0.0.0-test' },
            30,
            createRunCache(sandbox.path),
        ),
    ).toStrictEqual({ name: 'npm', version: '11.19.0' });
    expect(run.mock.calls.map(([command]) => command)).toStrictEqual([['npm', '--version']]);
});
