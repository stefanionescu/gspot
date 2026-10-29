import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openWriter } from '#cli/write.ts';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { fakeCommand } from '#tests/setup/system/fakes.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildNpmToolInstall } from '#tests/setup/cli/tools.ts';
import { installNpmTools } from '#cli/installers/npm/project.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';

test('npm skips a recorded install, but installs changed locks and missing modules', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"npm@0.0.0-test"}',
        [`${GSPOT_FOLDER}/package-lock.json`]: '{"lockfileVersion":3}',
    });
    using writer = openWriter(sandbox.path);
    using _npm = fakeCommand('mise', async (command) => {
        if (command.at(-1) !== '--version')
            await createFileTree(sandbox.path, { [`${GSPOT_PATHS.nodeModules}/installed`]: 'ready' });
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '0.0.0-test\n' : '' });
    });
    const session = await openSession(sandbox.path);
    const first = await buildNpmToolInstall(session, writer);
    expect(await installNpmTools(first)).toContain('installed');
    const recordPath = join(sandbox.path, GSPOT_PATHS.installRecord);
    const saved = await readFile(recordPath, 'utf8');
    const second = await buildNpmToolInstall(session, writer);
    expect(await installNpmTools(second)).toBe('');
    expect(second.steps).toStrictEqual([]);
    expect(await readFile(recordPath, 'utf8')).toBe(saved);
    await writeFile(join(sandbox.path, GSPOT_FOLDER, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}');
    const changed = await buildNpmToolInstall(session, writer);
    expect(await installNpmTools(changed)).toContain('installed');
    expect(changed.steps).toHaveLength(1);
    expect(await readFile(recordPath, 'utf8')).not.toBe(saved);
    await rm(join(sandbox.path, GSPOT_PATHS.nodeModules), { recursive: true });
    const missing = await buildNpmToolInstall(session, writer);
    expect(await installNpmTools(missing)).toContain('installed');
    expect(missing.steps).toHaveLength(1);
});

test('Bun keeps installed modules while it runs the frozen install', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"packageManager":"bun@0.0.0-test"}',
        [`${GSPOT_PATHS.nodeModules}/installed`]: 'keep these bytes',
    });
    using writer = openWriter(sandbox.path);
    const installed = join(sandbox.path, GSPOT_PATHS.nodeModules, 'installed');
    using _bun = fakeCommand('mise', async (command) => {
        expect(await readFile(installed, 'utf8')).toBe('keep these bytes');
        return buildProcessResult({ stdout: command.at(-1) === '--version' ? '0.0.0-test\n' : '' });
    });
    const install = await buildNpmToolInstall(await openSession(sandbox.path), writer);
    expect(await installNpmTools(install)).toContain('installed');
    expect(install.steps).toHaveLength(1);
    expect(await readFile(installed, 'utf8')).toBe('keep these bytes');
});

test.each(['{broken', '{"npm":"invalid"}', '{"other":"field"}'])(
    'an invalid record %s runs npm and a failure preserves the record',
    async (record) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([]),
            'package.json': '{"private":true,"packageManager":"npm@0.0.0-test"}',
            [`${GSPOT_FOLDER}/package-lock.json`]: '{"lockfileVersion":3}',
            [GSPOT_PATHS.installRecord]: record,
        });
        using writer = openWriter(sandbox.path);
        using _npm = fakeCommand('mise', (command) =>
            Promise.resolve(
                buildProcessResult(
                    command.at(-1) === '--version' ? { stdout: '0.0.0-test\n' } : { code: 1, stderr: 'Install failed' },
                ),
            ),
        );
        const install = await buildNpmToolInstall(await openSession(sandbox.path), writer);
        const error = await captureRejection(installNpmTools(install));
        expect(error.message).toContain('Install failed');
        expect(install.steps).toHaveLength(1);
        expect(await readFile(join(sandbox.path, GSPOT_PATHS.installRecord), 'utf8')).toBe(record);
    },
);
