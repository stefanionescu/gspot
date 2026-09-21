import { fileURLToPath } from 'node:url';
import { startRegistry } from '#tests/harness/registry/lifecycle.ts';
import { run as runProcess } from '#cli/platform/spawn.ts';
// Takeover at init: owned configuration files are replaced, their exception lists carried into gspot.toml with a reason, and the lint folder listed for deletion.
import { join } from 'node:path';
import prettier from 'prettier';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { treeContents } from '#tests/harness/contents.ts';
import { git, PLANTED_TIMEOUT_MS, run, script, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'bash',
    'javascript',
    'spelling',
    'markdown',
    '--no-runner',
    '--no-ci',
    '--no-rules',
    '--no-install',
];

describe('takeover', () => {
    test.each(['', 'hooks', '.husky'])(
        'dry-run distinguishes source hooks from configured hooks at %s',
        async (hooksPath) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
                ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
            });
            expect(runBlocking(['git', 'init', '-q'], { cwd: sandbox.path }).code).toBe(0);
            if (hooksPath !== '')
                expect(runBlocking(['git', 'config', 'core.hooksPath', hooksPath], { cwd: sandbox.path }).code).toBe(0);
            const result = await run(sandbox.path, [...INIT, '--dry-run']);
            expect(result.code).toBe(0);
            const hooks = result.stdout.split('\n').find((line) => /^hooks\s/.test(line));
            if (hooksPath === '') expect(hooks).toMatch(/^hooks\s+none$/);
            else {
                expect(hooks).toContain(`${hooksPath}/`);
                expect(hooks).toContain('pre-commit');
                expect(hooks?.split('(hand-written)')).toHaveLength(2);
            }
            expect(readFileSync(join(sandbox.path, 'hooks/use-thing.ts'), 'utf8')).toContain('useThing');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'a configuration edited at confirmation is preserved before init publishes policy',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.prettierrc.json': '{"semi":false}\n',
                'source.js': 'const greeting = "hello";\n',
            });
            const command = join(import.meta.dir, '../../../packages/cli/src/lifecycle/init/command.ts');
            const child = `
            import { mock } from 'bun:test';
            import { writeFileSync } from 'node:fs';
            Object.defineProperty(process.stdin, 'isTTY', { value: true });
            Object.defineProperty(process.stdout, 'isTTY', { value: true });
            delete process.env.CI;
            mock.module(${JSON.stringify(Bun.resolveSync('@clack/prompts', command))}, () => ({
                confirm: async () => { writeFileSync('.prettierrc.json', '{"semi":true}\\n'); return true; },
                select: async () => { throw new Error('Unexpected selection'); },
                multiselect: async () => { throw new Error('Unexpected selection'); },
            }));
            const { initCommand } = await import(${JSON.stringify(command)});
            try {
                await initCommand({ cwd: process.cwd(), presets: ['formatting'], yes: false, json: false, isDryRun: false, install: false, allowDirty: true, hooks: 'none', ci: 'none', runner: 'none', rules: 'no', format: 'keep' });
            } catch (error) { console.error(error.message); process.exitCode = 2; }
        `;
            const result = runBlocking([process.execPath, '--eval', child], { cwd: sandbox.path });
            expect(result.code, result.stdout + result.stderr).toBe(2);
            expect(result.stderr).toContain('changed after takeover was planned');
            expect(readFileSync(join(sandbox.path, '.prettierrc.json'), 'utf8')).toBe('{"semi":true}\n');
            expect(existsSync(join(sandbox.path, 'gspot.toml'))).toBe(false);
            expect(existsSync(join(sandbox.path, '.gspot-version'))).toBe(false);
            expect(readFileSync(join(sandbox.path, 'source.js'), 'utf8')).toBe('const greeting = "hello";\n');
        },
        PLANTED_TIMEOUT_MS,
    );

    test.each([
        ['typos.toml', '[default\n'],
        ['.prettierrc.json', '{"overrides":false}\n'],
        ['.prettierrc.json', '{"plugins":["prettier-plugin-example"],"semi":false}\n'],
        ['.prettierrc.toml', 'semi = "no"\n'],
        ['.prettierrc.json', '{ "semi": false, broken }\n'],
        ['.markdownlint.jsonc', '{ "MD013": false, broken }\n'],
    ])(
        'unreadable or unsupported %s preserves every original file and mode',
        async (path, text) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                [path]: text,
                'notes.md': '# Notes\n',
            });
            const before = treeContents(sandbox.path);
            const preview = await run(sandbox.path, [...INIT, '--no-hooks', '--dry-run']);
            expect(preview.code, preview.stdout + preview.stderr).toBe(0);
            expect(preview.stdout).toContain('not read and not deleted');
            expect(treeContents(sandbox.path)).toEqual(before);
            const result = await run(sandbox.path, [...INIT, '--no-hooks']);
            expect(result.code, result.stdout + result.stderr).toBe(2);
            expect(result.stdout).toContain('Cannot apply takeover');
            expect(treeContents(sandbox.path)).toEqual(before);
        },
        PLANTED_TIMEOUT_MS,
    );

    test.each([
        [
            '.prettierrc.json',
            JSON.stringify({
                tabWidth: 8,
                printWidth: 90,
                trailingComma: 'none',
                endOfLine: 'crlf',
                semi: false,
                singleQuote: false,
                useTabs: false,
                arrowParens: 'always',
                embeddedLanguageFormatting: 'off',
            }),
        ],
        [
            '.prettierrc.yaml',
            'tabWidth: 8\nprintWidth: 90\ntrailingComma: none\nendOfLine: crlf\nsemi: false\nsingleQuote: false\nuseTabs: false\narrowParens: always\nembeddedLanguageFormatting: off\n',
        ],
        [
            '.prettierrc.toml',
            'tabWidth = 8\nprintWidth = 90\ntrailingComma = "none"\nendOfLine = "crlf"\nsemi = false\nsingleQuote = false\nuseTabs = false\narrowParens = "always"\nembeddedLanguageFormatting = "off"\n',
        ],
        [
            '.prettierrc',
            'tabWidth: 8\nprintWidth: 90\ntrailingComma: none\nendOfLine: crlf\nsemi: false\nsingleQuote: false\nuseTabs: false\narrowParens: always\nembeddedLanguageFormatting: off\n',
        ],
    ])(
        'keeps supported formatting behavior from %s through init and apply',
        async (path, text) => {
            await using sandbox = await testdir();
            const source = 'const greeting="hello";if(greeting){console.log(greeting);}';
            await createFileTree(sandbox.path, { [path]: text, 'source.js': source });
            const filepath = join(sandbox.path, 'source.js');
            const previous = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
            const expected = await prettier.format(source, { ...previous, filepath });
            expect(expected).toBe(
                'const greeting = "hello"\r\nif (greeting) {\r\n        console.log(greeting)\r\n}\r\n',
            );
            const result = await run(sandbox.path, [
                'init',
                '--yes',
                '--presets',
                'formatting',
                '--no-hooks',
                '--no-runner',
                '--no-ci',
                '--no-rules',
                '--no-install',
            ]);
            expect(result.code, result.stdout + result.stderr).toBe(0);
            const current = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
            expect(await prettier.format(source, { ...current, filepath })).toBe(expected);
            expect(readFileSync(filepath, 'utf8')).toBe(source);
            const reapplied = await run(sandbox.path, ['apply', '--dry-run', '--json']);
            expect(reapplied.code, reapplied.stdout + reapplied.stderr).toBe(0);
            expect(JSON.parse(reapplied.stdout).drift).toEqual([]);
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'keeps native Prettier defaults and embedded formatting for every governed source path',
        async () => {
            await using sandbox = await testdir();
            const source = 'const greeting="hello";if(greeting){console.log(greeting);}';
            const files = [
                'source.js',
                'src/nested/source.js',
                'tests/source.js',
                'server/source.js',
                'components/source.js',
            ];
            const authored = {
                ...Object.fromEntries(files.map((file) => [file, source])),
                'guide.md': '# Example\n\n```js\n' + source + '\n```\n',
            };
            await createFileTree(sandbox.path, { '.prettierrc.json': '{"semi":false}\n', ...authored });
            symlinkSync(join(import.meta.dir, '../../../node_modules'), join(sandbox.path, 'node_modules'));
            const expected = new Map<string, string>();
            for (const [file, text] of Object.entries(authored)) {
                const filepath = join(sandbox.path, file);
                const options = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
                expected.set(file, await prettier.format(text, { ...options, filepath }));
            }
            expect(expected.get('source.js')).toBe(
                'const greeting = "hello"\nif (greeting) {\n  console.log(greeting)\n}\n',
            );
            const result = await run(sandbox.path, [
                'init',
                '--yes',
                '--presets',
                'formatting',
                '--no-hooks',
                '--no-runner',
                '--no-ci',
                '--no-rules',
                '--no-install',
            ]);
            expect(result.code, result.stdout + result.stderr).toBe(0);
            for (const [file, text] of Object.entries(authored)) {
                const filepath = join(sandbox.path, file);
                const options = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
                expect(await prettier.format(text, { ...options, filepath }), file).toBe(expected.get(file)!);
                expect(readFileSync(filepath, 'utf8')).toBe(text);
            }
        },
        PLANTED_TIMEOUT_MS,
    );

    test(
        'replaces owned files, carries their exception lists with a reason, and lists the lint folder',
        async () => {
            const registry = await startRegistry();
            try {
                const published = await runProcess(
                    [
                        'npm',
                        'publish',
                        fileURLToPath(new URL('../../../packages/eslint-plugin', import.meta.url)),
                        '--registry',
                        registry.url,
                        '--userconfig',
                        registry.npmrc,
                        '--ignore-scripts',
                    ],
                    { cwd: registry.work, timeoutMs: 30000 },
                );
                expect(published.code, published.stdout + published.stderr).toBe(0);
                await using sandbox = await testdir();
                await createFileTree(sandbox.path, {
                    '.npmrc': `registry=https://registry.npmjs.org/\n@gspot:registry=${registry.url}\n`,
                    'scripts/a.sh': script,
                    'src/a.js': 'export const a = 1;\n',
                    'README.md': '# planted\n',
                    'typos.toml':
                        '[default.extend-words]\n# The device identifier API name.\nudid = "udid"\ncertifi = "certifi"\n',
                    '.shellcheckrc': 'disable=SC2086,SC2034\n',
                    '.markdownlint.jsonc': '// Keep long prose lines.\n{ "MD013": false, "MD033": true, }\n',
                    'quality/lint.sh': script,
                });
                git(sandbox.path, ['init', '-q']);
                git(sandbox.path, ['add', '-A']);
                git(sandbox.path, ['commit', '-qm', 'init']);
                const init = await run(sandbox.path, INIT, { PATH: toolsPath(['ast-grep']) });
                expect(init.code, init.stdout + init.stderr).toBe(0);
                expect(init.stdout).toContain('carried into gspot.toml');
                expect(init.stdout).toContain('quality/');
                const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
                expect(policy).toContain('The device identifier API name.');
                expect(policy).toContain('carried from typos.toml at init');
                // The old file named no locale, which accepts every English dialect, so the repository keeps that.
                expect(policy).toContain('locale = "en"');
                expect(readFileSync(join(sandbox.path, '.gspot/typos.toml'), 'utf8')).toContain('locale = "en"');
                expect(policy).toContain('SC2086');
                expect(policy).toContain('carried from .shellcheckrc at init');
                expect(policy).toContain('MD013');
                expect(policy).not.toContain('MD033');
                for (const stub of ['typos.toml', '.shellcheckrc', '.markdownlint-cli2.jsonc'])
                    expect(readFileSync(join(sandbox.path, stub), 'utf8')).toContain('gspot');
                const eslintStub = ['eslint.config.js', 'eslint.config.mjs'].find((name) =>
                    existsSync(join(sandbox.path, name)),
                );
                expect(eslintStub).toBeDefined();
                expect(readFileSync(join(sandbox.path, eslintStub ?? ''), 'utf8')).toContain('gspot');
                expect(existsSync(join(sandbox.path, '.markdownlint.jsonc'))).toBe(false);
                expect(existsSync(join(sandbox.path, 'quality', 'lint.sh'))).toBe(true);
                const applied = await run(sandbox.path, ['apply', '--dry-run', '--json']);
                expect((JSON.parse(applied.stdout) as { drift: unknown[] }).drift).toEqual([]);
                expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            } finally {
                await registry.stop();
            }
        },
        PLANTED_TIMEOUT_MS,
    );
});
