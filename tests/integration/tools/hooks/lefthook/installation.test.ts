import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import { prepareLefthook } from '#tests/support/cli/hooks/lefthook.ts';
import { readHookStatus, installHookTool } from '#tests/support/cli/hooks/projects.ts';
import { existsSync, renameSync, unlinkSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

test.each(['custom', 'native'])(
    'Lefthook refuses malformed settings before installation and installs offline after correction with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { location, original } = await prepareLefthook(root, existing);
        writeFileSync(join(root, 'hook-settings.yml'), 'pre-commit: [invalid yaml\n');
        expect(await rejection(installHookTool(root))).toContain('Cannot load Lefthook configuration');
        expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init.sh\n');
        const offline = await run(
            [
                process.execPath,
                '-e',
                `import { installNativeHooks } from ${JSON.stringify(join(import.meta.dir, '../../../../../packages/cli/src/lifecycle/hooks/managers.ts'))}; import { openSession } from ${JSON.stringify(join(import.meta.dir, '../../../../../packages/cli/src/execution/session.ts'))}; const session = await openSession(${JSON.stringify(root)}); await installNativeHooks({ policy: session.policyFiles.policy, repository: session.repository, tools: session });`,
            ],
            {
                cwd: root,
                timeoutMs: 10_000,
                env: { HTTPS_PROXY: 'http://127.0.0.1:1', HTTP_PROXY: 'http://127.0.0.1:1', NO_PROXY: '' },
            },
        );
        expect(offline.code, offline.stdout + offline.stderr).toBe(0);
        const dispatcher = readFileSync(join(location.absolute, 'pre-commit'));
        writeFileSync(join(root, 'hook-init-updated.sh'), 'printf updated > rc-ran\n');
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init-updated.sh\n');
        await installHookTool(root);
        expect(readFileSync(join(location.absolute, 'pre-commit'))).toStrictEqual(dispatcher);
        expect(await readHookStatus(root)).toMatchObject({ ready: true });
    },
    60_000,
);

test('Lefthook refuses edited native helpers and accepts restored executable helpers', async () => {
    await using repository = await testdir();
    const root = join(repository.path, "repository's tools");
    const { scriptPath, originalScript } = await prepareLefthook(root, 'native');
    await installHookTool(root);
    const repaired = readFileSync(scriptPath);
    expect(repaired).not.toStrictEqual(originalScript);
    writeFileSync(scriptPath, '#!/bin/sh\nexit 0\n');
    expect(await readHookStatus(root)).toMatchObject({ ready: false });
    expect(await rejection(installHookTool(root))).toContain('Retained edited hook');
    expect(readFileSync(scriptPath, 'utf8')).toBe('#!/bin/sh\nexit 0\n');
    writeFileSync(scriptPath, repaired);
    unlinkSync(scriptPath);
    expect(await readHookStatus(root)).toMatchObject({ ready: false });
    writeFileSync(scriptPath, repaired, { mode: 0o755 });
    expect(await readHookStatus(root)).toMatchObject({ ready: true });
}, 60_000);

test.each(['custom', 'native'])(
    'Lefthook reports malformed configuration and missing executables then accepts their correction with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { options } = await prepareLefthook(root, existing);
        await installHookTool(root);
        writeFileSync(join(root, 'gspot-runs'), 'x');
        writeFileSync(join(root, 'hook-settings.yml'), 'pre-commit: [invalid yaml\n');
        const malformed = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toContain('gspot install');
        expect(readFileSync(join(root, 'gspot-runs'), 'utf8')).toBe('x');
        writeFileSync(join(root, 'hook-settings.yml'), 'rc: ./hook-init.sh\n');
        const executable = join(root, 'node_modules/.bin/lefthook');
        // Windows installs a command file beside the script; every spelling steps aside.
        const spellings = ['', '.cmd', '.exe', '.ps1']
            .map((suffix) => executable + suffix)
            .filter((path) => existsSync(path));
        for (const path of spellings) renameSync(path, `${path}.retained`);
        try {
            const unavailable = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
            expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
            expect(unavailable.stderr).toContain('gspot install');
        } finally {
            for (const path of spellings) renameSync(`${path}.retained`, path);
        }
        const corrected = await run(['git', 'hook', 'run', 'pre-commit'], { ...options, stdin: '' });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(readdirSync(join(root, 'scratch'))).toStrictEqual(['.keep']);
    },
    60_000,
);

test.each(['custom', 'native'])(
    'Lefthook uninstall restores original hooks and native helpers with %s hooks',
    async (existing) => {
        await using repository = await testdir();
        const root = join(repository.path, "repository's tools");
        const { location, original, scriptPath, originalScript } = await prepareLefthook(root, existing);
        await installHookTool(root);
        const dispatcher = readFileSync(join(location.absolute, 'pre-commit'));
        expect(readFileSync(join(location.absolute, 'pre-commit'))).toStrictEqual(dispatcher);
        const hooksPath = await run(['git', 'config', '--get', 'core.hooksPath'], { cwd: root });
        expect(hooksPath.code).toBe(1);
        const uninstalled = await uninstallCommand({ cwd: root, yes: true, isDryRun: false });
        expect(uninstalled.exitCode).toBe(0);
        expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
        expect(existsSync(join(location.absolute, 'pre-commit.gspot-manager'))).toBe(false);
        // Uninstall puts the native helper back and removes the one gspot created.
        expect(existsSync(scriptPath) ? readFileSync(scriptPath) : undefined).toStrictEqual(originalScript);
    },
    60_000,
);

test('Lefthook versions without the supported installation controls retain existing hooks', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': policyOf([], '[guides]\ninstall = false\n[hooks]\ntool = "lefthook"\n'),
        'package.json': '{"private":true,"devDependencies":{"lefthook":"1.11.13"}}\n',
    });
    for (const command of [
        ['git', 'init', '--quiet'],
        ['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund'],
    ]) {
        const result = await run(command, { cwd: repository.path, timeoutMs: 60_000 });
        expect(result.code, result.stderr).toBe(0);
    }
    const location = hookLocation(repository.path);
    const original = '#!/bin/sh\necho authored\n';
    writeFileSync(join(location.absolute, 'pre-commit'), original, { mode: 0o755 });
    const applied = await applyCommand({ cwd: repository.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(await rejection(installHookTool(repository.path))).toContain('Install Lefthook 2.0.13 or newer');
    expect(readFileSync(join(location.absolute, 'pre-commit'), 'utf8')).toBe(original);
    expect(existsSync(join(location.absolute, 'pre-commit.gspot-manager'))).toBe(false);
}, 60_000);
