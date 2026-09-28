import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { existsSync, symlinkSync, readFileSync } from 'node:fs';
import { treeContents } from '#tests/support/cli/preservation.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { runPublication, preparePublication } from '#tests/support/release/arguments.ts';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
describe('build script arguments', () => {
    test('rejects malformed targets before writes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'packages/cli/scripts/command.ts': readFileSync(join(ROOT, 'packages/cli/scripts/command.ts'), 'utf8'),
            'packages/cli/package.json': readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8'),
            'packages/cli/scripts/publish.ts': readFileSync(join(ROOT, 'packages/cli/scripts/publish.ts'), 'utf8'),
            'packages/npm/targets.json': readFileSync(join(ROOT, 'packages/npm/targets.json'), 'utf8'),
            ...Object.fromEntries(
                [
                    'LICENSE.md',
                    'packages/cli/scripts/notices.ts',
                    'packages/cli/scripts/assets.ts',
                    'packages/cli/scripts/compile.ts',
                    'packages/cli/scripts/targets.ts',
                    'packages/cli/src/platform/assets.ts',
                    'packages/cli/src/platform/paths.ts',
                    'packages/cli/src/platform/environment.ts',
                    'packages/cli/src/repository/hooks.ts',
                    'packages/cli/src/types/platform.ts',
                    'packages/cli/src/config/platform.ts',
                    'packages/cli/src/config/repository/repository.ts',
                    'packages/cli/scripts/inputs.ts',
                ].map((path) => [path, readFileSync(join(ROOT, path), 'utf8')]),
            ),
            'packages/cli/.build/entry.ts': '// existing entry\n',
            'packages/cli/kits/fixture.txt': 'asset fixture\n',
            'dist/gspot-linux-arm64': 'existing binary',
        });
        symlinkSync(join(ROOT, 'packages/cli/.build/swift.wasm'), join(sandbox.path, 'packages/cli/.build/swift.wasm'));
        for (const path of ['node_modules', 'packages/cli/node_modules'])
            symlinkSync(join(ROOT, path), join(sandbox.path, path), 'dir');
        const outputs = ['packages/cli/.build', 'dist'];
        const before = outputs.map((path) => treeContents(join(sandbox.path, path)));
        for (const args of [
            ['--target'],
            ['--targets', 'bun-linux-arm64'],
            ['--target', 'unknown'],
            ['--all', '--target', 'bun-linux-arm64'],
            ['--target', 'bun-linux-arm64', 'unknown'],
            ['--out'],
            ['--out', '--target', 'bun-linux-arm64'],
            ['--out', ''],
            ['unexpected'],
        ]) {
            const result = Bun.spawnSync(
                [process.execPath, join(sandbox.path, 'packages/cli/scripts/command.ts'), ...args],
                {
                    cwd: sandbox.path,
                    stdout: 'pipe',
                    stderr: 'pipe',
                    timeout: 10_000,
                    env: environmentVariables(),
                },
            );
            expect(result.exitCode, result.stderr.toString()).toBe(2);
            expect(outputs.map((path) => treeContents(join(sandbox.path, path)))).toStrictEqual(before);
        }
    });
});

test.each(['1.2.3', '1.2.3-beta.1+build.2'])(
    'publish arguments reject malformed input for %s before writes or publication',
    async (version) => {
        const tag = `v${version}`;
        const registry = 'http://127.0.0.1:4873';
        await using sandbox = await testdir();
        await preparePublication(sandbox.path, version, registry);
        const before = treeContents(join(sandbox.path, 'dist'));

        for (const args of [
            [],
            ['--tag'],
            ['--tag', `${tag}.!`],
            ['--tag', 'v0.0.0'],
            ['--tag', `v${tag}`],
            ['--tag', `v ${version}`],
            ['--tag', '--registry', registry],
            ['--tag', tag, '--registry'],
            ['--tag', tag, '--registry', 'ftp://127.0.0.1'],
            ['--tag', tag, '--dry-runs'],
            ['--tag', tag, '--dry-run=true'],
            ['--tag', tag, 'unexpected'],
        ]) {
            const result = runPublication(sandbox.path, args);
            expect(result.exitCode, result.stderr.toString()).toBe(2);
            expect(treeContents(join(sandbox.path, 'dist'))).toStrictEqual(before);
            expect(existsSync(join(sandbox.path, 'publisher.jsonl'))).toBe(false);
        }
    },
);

test.each(['1.2.3', '1.2.3-beta.1+build.2'])(
    'publish arguments preserve registry and dry-run options for %s',
    async (version) => {
        const tag = `v${version}`;
        const registry = 'http://127.0.0.1:4873';
        await using sandbox = await testdir();
        await preparePublication(sandbox.path, version, registry);

        const result = runPublication(sandbox.path, ['--tag', tag, '--registry', registry, '--dry-run']);
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        const commands = readFileSync(join(sandbox.path, 'publisher.jsonl'), 'utf8')
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as string[]);
        expect(commands.length).toBeGreaterThan(0);
        for (const command of commands) {
            expect(command).toContain('--dry-run');
            expect(command).toContain(registry);
            expect(command).not.toContain('--provenance');
        }
    },
);

describe('plugin build arguments', () => {
    test('preserves existing output after invalid arguments and information requests', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'packages/eslint-plugin/build.ts': readFileSync(join(ROOT, 'packages/eslint-plugin/build.ts'), 'utf8'),
            'packages/eslint-plugin/package.json': readFileSync(
                join(ROOT, 'packages/eslint-plugin/package.json'),
                'utf8',
            ),
            'packages/eslint-plugin/dist/plugin.js': '// existing plugin\n',
        });
        const before = treeContents(sandbox.path);
        for (const args of [
            ['--checks'],
            ['unexpected'],
            ['--help=true'],
            ['--version=true'],
            ['--help', 'unexpected'],
        ]) {
            const result = Bun.spawnSync(
                [process.execPath, join(sandbox.path, 'packages/eslint-plugin/build.ts'), ...args],
                {
                    cwd: sandbox.path,
                    stdout: 'pipe',
                    stderr: 'pipe',
                    timeout: 10_000,
                },
            );
            expect(result.exitCode, result.stderr.toString()).toBe(2);
            expect(treeContents(sandbox.path)).toStrictEqual(before);
        }
        for (const flag of ['--help', '--version']) {
            const result = Bun.spawnSync(
                [process.execPath, join(sandbox.path, 'packages/eslint-plugin/build.ts'), flag],
                {
                    cwd: sandbox.path,
                    stdout: 'pipe',
                    stderr: 'pipe',
                    timeout: 10_000,
                },
            );
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            expect(result.stdout.toString().trim().length).toBeGreaterThan(0);
            expect(treeContents(sandbox.path)).toStrictEqual(before);
        }
    });
});
