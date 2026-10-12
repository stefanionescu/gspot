import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { rm, readFile } from 'node:fs/promises';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { sandboxPath } from '#tests/setup/install.ts';
import { containing } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { LOCKFILES, SYNCPACK_FILES } from '#tests/config/dependencies.ts';

test.each([...LOCKFILES])(
    'dependencies/stale-lockfile reports a stale $lockfileName from $name and changes no file',
    async ({ command: [client, ...commandArguments], lockfileName, manifestPath, manifest, changed, files }) => {
        await using directory = await testdir({
            'gspot.toml': settingsText(['dependencies']),
            [manifestPath]: manifest,
            ...files,
        });
        const executable = client === 'bun' ? process.execPath : client;
        const installed = await runCommand([executable, ...commandArguments], { cwd: directory.path });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        await rm(join(directory.path, 'node_modules'), { recursive: true, force: true });
        const lockfile = await readFile(join(directory.path, lockfileName));
        await Bun.write(join(directory.path, manifestPath), changed);
        const failed = await spawnGspot(directory.path, ['check', '--only', 'dependencies/stale-lockfile', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toContainEqual(
            containing({ rule: 'stale' }),
        );
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await readFile(join(directory.path, manifestPath), 'utf8')).toBe(changed);
        await Bun.write(join(directory.path, manifestPath), manifest);
        const corrected = await spawnGspot(directory.path, [
            'check',
            '--only',
            'dependencies/stale-lockfile',
            '--json',
        ]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual(
            [],
        );
        expect(await readFile(join(directory.path, lockfileName))).toStrictEqual(lockfile);
        expect(await pathExists(join(directory.path, 'node_modules'))).toBe(false);
    },
);

test.each([...SYNCPACK_FILES])(
    'init replaces your Syncpack file $file and keeps syncpack.config.cts and .mts',
    async ({ file, source }) => {
        await using sandbox = await testdir();
        const rootPackage = '{"name":"root","private":true,"dependencies":{"fixture":"1.0.0"}}\n';
        await createFileTree(sandbox.path, {
            [file]: source,
            'gspot.template.toml': settingsText([], { level: 'all' }),
            'package.json': rootPackage,
            'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"fixture":"2.0.0"}}\n',
            'syncpack.config.cts': 'module.exports = {};\n',
            'syncpack.config.mts': 'export default {};\n',
        });
        commitAll(sandbox.path);
        const execution = { cwd: sandbox.path, env: { PATH: sandboxPath() } };
        const before = await runCommand(['syncpack', 'lint', '--no-ansi'], execution);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const initialized = await spawnGspot(
            sandbox.path,
            [...buildInitArguments(['none']), '--from', 'gspot.template.toml'],
            execution.env,
        );
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.cts')).text()).toBe('module.exports = {};\n');
        expect(await Bun.file(join(sandbox.path, 'syncpack.config.mts')).text()).toBe('export default {};\n');
        const command = ['syncpack', 'lint', '--config', '.gspot/config/syncpack.json', '--no-ansi'];
        const after = await runCommand(command, execution);
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(after.stderr).toContain('fixture');
        expect(after.stderr).toContain('SameRangeMismatch');
        await Bun.write(join(sandbox.path, 'packages/app/package.json'), rootPackage.replace('"root"', '"app"'));
        const corrected = await runCommand(command, execution);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
