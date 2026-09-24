import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { treeContents } from '#tests/support/cli/contents.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { chmodSync, existsSync, readFileSync, symlinkSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
describe('build script arguments', () => {
    test('rejects malformed targets before writes', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'packages/cli/release/build.ts': readFileSync(join(ROOT, 'packages/cli/release/build.ts'), 'utf8'),
            'packages/cli/package.json': readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8'),
            'packages/cli/src/platform/release-targets.ts': readFileSync(
                join(ROOT, 'packages/cli/src/platform/release-targets.ts'),
                'utf8',
            ),
            'packages/npm/gspot/targets.json': readFileSync(join(ROOT, 'packages/npm/gspot/targets.json'), 'utf8'),
            ...Object.fromEntries(
                [
                    'LICENSE.md',
                    'packages/cli/release/notices.ts',
                    'packages/cli/release/notices.json',
                    'packages/cli/src/platform/assets.ts',
                    'packages/cli/src/platform/paths.ts',
                    'packages/cli/src/platform/environment.ts',
                    'packages/cli/src/repository/hooks.ts',
                    'packages/cli/release/grammar.ts',
                ].map((path) => [path, readFileSync(join(ROOT, path), 'utf8')]),
            ),
            'packages/cli/build/entry.ts': '// existing entry\n',
            'packages/cli/configurations/fixture.txt': 'asset fixture\n',
            'dist/gspot-linux-arm64': 'existing binary',
        });
        symlinkSync(join(ROOT, 'packages/cli/build/swift.wasm'), join(sandbox.path, 'packages/cli/build/swift.wasm'));
        for (const path of ['node_modules', 'packages/cli/node_modules'])
            symlinkSync(join(ROOT, path), join(sandbox.path, path), 'dir');
        const outputs = ['packages/cli/build', 'dist'];
        const before = outputs.map((path) => treeContents(join(sandbox.path, path)));
        const execute = (args: string[]) =>
            Bun.spawnSync([process.execPath, join(sandbox.path, 'packages/cli/release/build.ts'), ...args], {
                cwd: sandbox.path,
                stdout: 'pipe',
                stderr: 'pipe',
                timeout: 10_000,
                env: environmentVariables(),
            });
        for (const args of [
            ['--target'],
            ['--targets', 'bun-linux-arm64'],
            ['--target', 'unknown'],
            ['--target', 'bun-linux-arm64', 'unknown'],
            ['--out'],
            ['--out', '--target', 'bun-linux-arm64'],
            ['--out', ''],
            ['unexpected'],
        ]) {
            const result = execute(args);
            expect(result.exitCode, result.stderr.toString()).toBe(2);
            expect(outputs.map((path) => treeContents(join(sandbox.path, path)))).toStrictEqual(before);
        }
    });
});

describe('publish script arguments', () => {
    test.each(['1.2.3', '1.2.3-beta.1+build.2'])(
        'validates %s before writes or publication and preserves dry-run options',
        async (version) => {
            const sourceManifest = JSON.parse(readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8')) as Record<
                string,
                unknown
            >;
            const manifest = JSON.stringify({ ...sourceManifest, version });
            const tag = `v${version}`;
            const registry = 'http://127.0.0.1:4873';
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'packages/cli/release/publish.ts': readFileSync(join(ROOT, 'packages/cli/release/publish.ts'), 'utf8'),
                'packages/cli/package.json': manifest,
                ...Object.fromEntries(
                    [
                        'packages/npm/gspot/README.md',
                        'packages/npm/gspot/package.json',
                        'packages/npm/gspot/gspot.js',
                        'packages/npm/gspot/targets.json',
                        'packages/cli/src/platform/release-targets.ts',
                    ].map((path) => [path, readFileSync(join(ROOT, path), 'utf8')]),
                ),
                ...Object.fromEntries(
                    [
                        'gspot-darwin-arm64',
                        'gspot-darwin-x64',
                        'gspot-linux-x64',
                        'gspot-linux-arm64',
                        'gspot-linux-x64-musl',
                        'gspot-linux-arm64-musl',
                        'gspot-windows-x64.exe',
                    ].map((binary) => [`dist/${binary}`, 'binary sentinel']),
                ),
                'dist/checksums.txt': 'existing checksums\n',
                'dist/LICENSE.md': 'Release license\n',
                'dist/NOTICE.md': 'Dependency notices\n',
                'bin/npm':
                    `#!${process.execPath}\n` +
                    String.raw`import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2);
    if (!argv.includes('${registry}')) throw new Error('Only the sandbox registry is allowed.');
    appendFileSync(join(import.meta.dir, '..', 'publisher.jsonl'), JSON.stringify(argv) + '\n');
`,
            });
            for (const path of ['node_modules', 'packages/cli/node_modules'])
                symlinkSync(join(ROOT, path), join(sandbox.path, path), 'dir');
            chmodSync(join(sandbox.path, 'bin/npm'), 0o755);
            const before = treeContents(join(sandbox.path, 'dist'));
            const execute = (args: string[]) =>
                Bun.spawnSync([process.execPath, join(sandbox.path, 'packages/cli/release/publish.ts'), ...args], {
                    cwd: sandbox.path,
                    stdout: 'pipe',
                    stderr: 'pipe',
                    timeout: 10_000,
                    env: {
                        ...environmentVariables(),
                        PATH: `${join(sandbox.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
                    },
                });
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
                const result = execute(args);
                expect(result.exitCode, result.stderr.toString()).toBe(2);
                expect(treeContents(join(sandbox.path, 'dist'))).toStrictEqual(before);
                expect(existsSync(join(sandbox.path, 'publisher.jsonl'))).toBe(false);
            }
            const result = execute(['--tag', tag, '--registry', registry, '--dry-run']);
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
});

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
        const execute = (args: string[]) =>
            Bun.spawnSync([process.execPath, join(sandbox.path, 'packages/eslint-plugin/build.ts'), ...args], {
                cwd: sandbox.path,
                stdout: 'pipe',
                stderr: 'pipe',
                timeout: 10_000,
            });
        for (const args of [
            ['--checks'],
            ['unexpected'],
            ['--help=true'],
            ['--version=true'],
            ['--help', 'unexpected'],
        ]) {
            const result = execute(args);
            expect(result.exitCode, result.stderr.toString()).toBe(2);
            expect(treeContents(sandbox.path)).toStrictEqual(before);
        }
        for (const flag of ['--help', '--version']) {
            const result = execute([flag]);
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            expect(result.stdout.toString().trim().length).toBeGreaterThan(0);
            expect(treeContents(sandbox.path)).toStrictEqual(before);
        }
    });
});
