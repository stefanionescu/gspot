import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { treeContents } from '#tests/harness/contents.ts';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ENTRIES = ['packages/cli/schemas.ts', 'docs/reference-pages.ts'];
const LINKS = [
    'node_modules',
    'docs/node_modules',
    'packages/cli/node_modules',
    'packages/cli/src',
    'packages/cli/config',
];
const SOURCES = [...ENTRIES, 'packages/cli/package.json', 'docs/package.json'];

const OUTPUTS = ['schema', 'docs/public/schema', 'docs/src/content/docs/reference'];

const INVALID = [['--checks'], ['unexpected'], ['--check', 'unexpected'], ['--check=true']];

describe('read-only script arguments', () => {
    test.each(ENTRIES)('%s rejects malformed invocations before changing files', async (entry) => {
        const sources = Object.fromEntries(SOURCES.map((path) => [path, readFileSync(join(ROOT, path), 'utf8')]));
        await using fixture = await createFixture({
            ...sources,
            'schema/gspot.schema.json': '{"sentinel": true}\n',
            'schema/run-record.schema.json': '{"sentinel": true}\n',
            'docs/public/schema/gspot.schema.json': '{"sentinel": true}\n',
            'docs/public/schema/run-record.schema.json': '{"sentinel": true}\n',
            'docs/src/content/docs/reference/sentinel.md': '# Authored reference\n',
        });
        for (const path of LINKS) symlinkSync(join(ROOT, path), join(fixture.path, path), 'dir');
        const before = OUTPUTS.map((path) => treeContents(join(fixture.path, path)));
        for (const args of INVALID) {
            const result = Bun.spawnSync([process.execPath, join(fixture.path, entry), ...args], {
                cwd: fixture.path,
                env: { ...environmentVariables(), NO_COLOR: '1' },
                stdout: 'pipe',
                stderr: 'pipe',
                timeout: 10_000,
            });
            expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(2);
            expect(result.stderr.toString()).toMatch(/unknown option|too many arguments/u);
            expect(OUTPUTS.map((path) => treeContents(join(fixture.path, path)))).toEqual(before);
        }
        for (const flag of ['--help', '--version']) {
            const result = Bun.spawnSync([process.execPath, join(fixture.path, entry), flag], {
                cwd: fixture.path,
                stdout: 'pipe',
                stderr: 'pipe',
                timeout: 10_000,
            });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            expect(result.stdout.toString().trim().length).toBeGreaterThan(0);
            expect(OUTPUTS.map((path) => treeContents(join(fixture.path, path)))).toEqual(before);
        }
    });
});

describe('build script arguments', () => {
    test('rejects malformed targets before writes and forwards valid repeated targets', async () => {
        await using fixture = await createFixture({
            'packages/cli/build.ts': readFileSync(join(ROOT, 'packages/cli/build.ts'), 'utf8'),
            'packages/cli/package.json': readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8'),
            'packages/cli/config/grammars.ts': readFileSync(join(ROOT, 'packages/cli/config/grammars.ts'), 'utf8'),
            'packages/cli/grammars/swift.wasm': 'vendored grammar sentinel',
            'packages/cli/build/entry.ts': '// existing entry\n',
            'dist/gspot-linux-arm64': 'existing binary',
            'compiler.ts': String.raw`import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
Bun.spawnSync = (argv) => {
    appendFileSync(join(import.meta.dir, 'compiler.jsonl'), JSON.stringify(argv) + '\n');
    return { exitCode: 0 };
};
`,
        });
        for (const path of ['node_modules', 'packages/cli/node_modules'])
            symlinkSync(join(ROOT, path), join(fixture.path, path), 'dir');
        const outputs = ['packages/cli/grammars', 'packages/cli/build', 'dist'];
        const before = outputs.map((path) => treeContents(join(fixture.path, path)));
        const execute = (args: string[]) =>
            Bun.spawnSync(
                [
                    process.execPath,
                    '--preload',
                    join(fixture.path, 'compiler.ts'),
                    join(fixture.path, 'packages/cli/build.ts'),
                    ...args,
                ],
                { cwd: fixture.path, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 },
            );
        for (const args of [
            ['--target'],
            ['--targets', 'bun-linux-arm64'],
            ['--target', 'unknown'],
            ['--target', 'bun-linux-arm64', '--target', 'unknown'],
            ['--out'],
            ['--out', '--target', 'bun-linux-arm64'],
            ['--out', ''],
            ['unexpected'],
        ]) {
            const result = execute(args);
            expect(result.exitCode, result.stderr.toString()).toBe(2);
            expect(outputs.map((path) => treeContents(join(fixture.path, path)))).toEqual(before);
            expect(existsSync(join(fixture.path, 'compiler.jsonl'))).toBe(false);
        }
        const result = execute(['--target', 'bun-linux-arm64', '--target', 'bun-linux-x64']);
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        const commands = readFileSync(join(fixture.path, 'compiler.jsonl'), 'utf8')
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as string[]);
        expect(commands.map((command) => command.find((argument) => argument.startsWith('--target=')))).toEqual([
            '--target=bun-linux-arm64',
            '--target=bun-linux-x64',
        ]);
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
            await using fixture = await createFixture({
                'packages/cli/publish.ts': readFileSync(join(ROOT, 'packages/cli/publish.ts'), 'utf8'),
                'packages/cli/package.json': manifest,
                ...Object.fromEntries(
                    [
                        'packages/npm/platform/README.md',
                        'packages/npm/gspot/README.md',
                        'packages/npm/gspot/package.json',
                        'packages/npm/gspot/gspot.js',
                    ].map((path) => [path, readFileSync(join(ROOT, path), 'utf8')]),
                ),
                ...Object.fromEntries(
                    [
                        'gspot-darwin-arm64',
                        'gspot-darwin-x64',
                        'gspot-linux-x64',
                        'gspot-linux-arm64',
                        'gspot-windows-x64.exe',
                    ].map((binary) => [`dist/${binary}`, 'binary sentinel']),
                ),
                'dist/checksums.txt': 'existing checksums\n',
                'publisher.ts': String.raw`import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
Bun.spawnSync = (argv) => {
    if (!argv.includes('${registry}')) throw new Error('Only the fixture registry is allowed.');
    appendFileSync(join(import.meta.dir, 'publisher.jsonl'), JSON.stringify(argv) + '\n');
    return { exitCode: 0 };
};
`,
            });
            for (const path of ['node_modules', 'packages/cli/node_modules'])
                symlinkSync(join(ROOT, path), join(fixture.path, path), 'dir');
            const before = treeContents(join(fixture.path, 'dist'));
            const execute = (args: string[]) =>
                Bun.spawnSync(
                    [
                        process.execPath,
                        '--preload',
                        join(fixture.path, 'publisher.ts'),
                        join(fixture.path, 'packages/cli/publish.ts'),
                        ...args,
                    ],
                    { cwd: fixture.path, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 },
                );
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
                expect(treeContents(join(fixture.path, 'dist'))).toEqual(before);
                expect(existsSync(join(fixture.path, 'publisher.jsonl'))).toBe(false);
            }
            const result = execute(['--tag', tag, '--registry', registry, '--dry-run']);
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            const commands = readFileSync(join(fixture.path, 'publisher.jsonl'), 'utf8')
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
