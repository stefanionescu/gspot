import prettier from 'prettier';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { reportSchema } from '#cli/output/schema.ts';
import { parseJsonc } from '#cli/repository/jsonc.ts';
import { script } from '#tests/support/cli/planted.ts';
import { readPolicy } from '#cli/policy/read-policy.ts';
import { commitAll, git } from '#tests/support/cli/git.ts';
import { treeContents } from '#tests/support/cli/contents.ts';
import { PLANTED_TIMEOUT_MS, run, runProcess } from '#tests/support/cli/command.ts';
// Takeover at init: owned configuration files are replaced, their exception lists carried into gspot.toml with a reason, and the lint folder listed for deletion.
import { installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';
import { chmodSync, existsSync, readFileSync, statSync, symlinkSync } from 'node:fs';

const INIT = [
    'init',
    '--yes',
    '--configurations',
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
    test.each(['', 'guide[1]', 'native-defaults'])(
        'Markdown adoption retains native defaults through checks, fixes, and uninstall (scope %s)',
        async (scope) => {
            await using sandbox = await testdir();
            const prefix = scope === '' ? '' : `${scope}/`;
            const configuration = `${prefix}.markdownlint.jsonc`;
            const original =
                scope === 'native-defaults'
                    ? '{"MD009":true,"MD041":false}\n'
                    : scope === ''
                      ? '{"default":false,"MD033":true,"MD009":true}\n'
                      : '{"extends":"./config/base.jsonc","MD033":true,"MD009":true}\n';
            const inherited = '{"default":false,"MD033":false}\n';
            const parent = `${prefix}config/base.jsonc`;
            await createFileTree(sandbox.path, {
                [configuration]: original,
                [parent]: inherited,
                [`${prefix}sample.md`]: 'A paragraph.   \n\n<span>Content</span>\n',
            });
            chmodSync(join(sandbox.path, configuration), 0o640);
            chmodSync(join(sandbox.path, parent), 0o640);
            commitAll(sandbox.path);
            const initialized = await run(sandbox.path, [
                'init',
                '--yes',
                '--configurations',
                'markdown',
                '--without',
                'docs',
                'spelling',
                '--no-runner',
                '--no-hooks',
                '--no-ci',
                '--no-rules',
                '--no-install',
            ]);
            expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
            expect(readFileSync(join(sandbox.path, parent), 'utf8')).toBe(inherited);
            expect(statSync(join(sandbox.path, parent)).mode & 0o777).toBe(0o640);
            const selected = await run(sandbox.path, ['set', 'level', 'all']);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            await installPrivateTools(sandbox.path);
            const literalFiles = [
                'sample.md',
                '#notes.md',
                '[notes].md',
                '-notes.md',
                ...(process.platform === 'win32' ? [] : ['name:5.md', 'line\nbreak.md']),
            ];
            await createFileTree(sandbox.path, {
                [`${prefix}nested/.markdownlint.jsonc`]: '{"default":false,"MD033":false,"MD009":false}\n',
                [`${prefix}nested/.markdownlint-cli2.mjs`]:
                    'import { writeFileSync } from "node:fs"; writeFileSync("discovered.txt", "executed"); export default {};\n',
                ...Object.fromEntries(
                    literalFiles.map((name) => [
                        `${prefix}nested/${name}`,
                        'A paragraph.   \n\n<span>Content</span>\n',
                    ]),
                ),
            });
            const command = ['check', '--only', 'markdown/markdownlint', '--no-cache'];
            const structured = await run(sandbox.path, [...command, '--json']);
            expect(structured.code, structured.stdout + structured.stderr).toBe(1);
            const findings = reportSchema
                .parse(JSON.parse(structured.stdout))
                .checks.flatMap((check) => check.findings);
            for (const name of literalFiles) {
                expect(findings).toContainEqual(
                    expect.objectContaining({
                        file: `${prefix}nested/${name}`,
                        rule: 'MD033',
                        line: 3,
                        column: 1,
                        fixable: false,
                    }),
                );
                expect(findings).toContainEqual(
                    expect.objectContaining({ file: `${prefix}nested/${name}`, rule: 'MD009', line: 1, fixable: true }),
                );
            }
            const failed = await run(sandbox.path, [...command, '--fix']);
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            expect(failed.stdout).toContain('MD033');
            expect(failed.stdout).not.toContain('MD041');
            expect(existsSync(join(sandbox.path, 'discovered.txt'))).toBe(false);
            expect(readFileSync(join(sandbox.path, scope, 'sample.md'), 'utf8')).toBe(
                'A paragraph.\n\n<span>Content</span>\n',
            );
            for (const name of literalFiles) {
                if (!name.includes('\n')) expect(failed.stdout).toContain(`nested/${name}`);
                expect(readFileSync(join(sandbox.path, scope, 'nested', name), 'utf8')).toBe(
                    'A paragraph.\n\n<span>Content</span>\n',
                );
                await Bun.write(join(sandbox.path, scope, 'nested', name), 'A paragraph.\n\nContent\n');
            }
            await Bun.write(join(sandbox.path, scope, 'sample.md'), 'A paragraph.\n\nContent\n');
            const corrected = await run(sandbox.path, command);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const native = await runProcess(
                [join(sandbox.path, '.gspot/node_modules/.bin/markdownlint-cli2'), '--no-globs', 'sample.md'],
                {
                    cwd: join(sandbox.path, scope),
                },
            );
            expect(native.code, native.stderr.toString()).toBe(0);
            commitAll(sandbox.path);
            await Bun.write(join(sandbox.path, scope, 'nested/sample.md'), '<span>Staged content</span>\n');
            expect(git(sandbox.path, ['add', '--', `${prefix}nested/sample.md`]).code).toBe(0);
            await Bun.write(join(sandbox.path, scope, 'nested/sample.md'), 'Working content\n');
            const staged = await run(sandbox.path, [...command, '--staged']);
            expect(staged.code, staged.stdout + staged.stderr).toBe(1);
            expect(staged.stdout).toContain('MD033');
            expect(readFileSync(join(sandbox.path, scope, 'nested/sample.md'), 'utf8')).toBe('Working content\n');
            expect(existsSync(join(sandbox.path, 'discovered.txt'))).toBe(false);
            const removed = await run(sandbox.path, ['uninstall', '--yes']);
            expect(removed.code, removed.stdout + removed.stderr).toBe(0);
            expect(readFileSync(join(sandbox.path, configuration), 'utf8')).toBe(original);
            expect(statSync(join(sandbox.path, configuration)).mode & 0o777).toBe(0o640);
            expect(readFileSync(join(sandbox.path, parent), 'utf8')).toBe(inherited);
            expect(statSync(join(sandbox.path, parent)).mode & 0o777).toBe(0o640);
        },
        PLANTED_TIMEOUT_MS * 5,
    );

    test(
        'EditorConfig adoption preserves native selectors and restores original bytes and mode',
        async () => {
            await using sandbox = await testdir();
            const editorconfig =
                '# Authored sections\nroot = true\n[*]\nindent_style = space\nindent_size = 2\n[*.json]\nindent_size = 4\n[deep/**]\nindent_style = tab\nindent_size = tab\ntab_width = 8\n';
            const formatter = 'export default { semi: false, singleQuote: true };\n';
            await createFileTree(sandbox.path, { '.editorconfig': editorconfig, 'prettier.config.mjs': formatter });
            chmodSync(join(sandbox.path, '.editorconfig'), 0o640);
            const sources = {
                'future.js': 'function value(){return {first:"one",second:"two"}}',
                'nested/future.json': '{"first":{"second":true}}',
                'deep/future.js': 'function value(){return {first:"one",second:"two"}}',
            };
            const expected = new Map<string, string>();
            for (const [path, source] of Object.entries(sources)) {
                const filepath = join(sandbox.path, path);
                const options = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
                expected.set(path, await prettier.format(source, { ...options, filepath }));
            }
            const initialized = await run(sandbox.path, [
                'init',
                '--yes',
                '--configurations',
                'formatting',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ]);
            expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
            for (const [path, source] of Object.entries(sources)) {
                const filepath = join(sandbox.path, path);
                const options = await prettier.resolveConfig(filepath, {
                    config: join(sandbox.path, '.gspot/config/prettier.json'),
                    editorconfig: true,
                    useCache: false,
                });
                expect(await prettier.format(source, { ...options, filepath }), path).toBe(expected.get(path)!);
            }
            const removed = await run(sandbox.path, ['uninstall', '--yes']);
            expect(removed.code, removed.stdout + removed.stderr).toBe(0);
            expect(readFileSync(join(sandbox.path, '.editorconfig'), 'utf8')).toBe(editorconfig);
            expect(statSync(join(sandbox.path, '.editorconfig')).mode & 0o777).toBe(0o640);
            expect(readFileSync(join(sandbox.path, 'prettier.config.mjs'), 'utf8')).toBe(formatter);
        },
        PLANTED_TIMEOUT_MS,
    );
    test.each(['', 'hooks', '.husky'])(
        'dry-run distinguishes source hooks from configured hooks at %s',
        async (hooksPath) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'hooks/use-thing.ts': 'export function useThing() { return true; }\n',
                ...(hooksPath === '' ? {} : { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' }),
            });
            expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
            if (hooksPath !== '') expect(git(sandbox.path, ['config', 'core.hooksPath', hooksPath]).code).toBe(0);
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
            expect(treeContents(sandbox.path)).toStrictEqual(before);
            const result = await run(sandbox.path, [...INIT, '--no-hooks']);
            expect(result.code, result.stdout + result.stderr).toBe(2);
            expect(result.stdout).toContain('Cannot apply takeover');
            expect(treeContents(sandbox.path)).toStrictEqual(before);
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
            '.prettierrc.json5',
            "{ // Authored JSON5\n tabWidth: 8, printWidth: 90, trailingComma: 'none', endOfLine: 'crlf', semi: false, singleQuote: false, useTabs: false, arrowParens: 'always', embeddedLanguageFormatting: 'off', }\n",
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
                '--configurations',
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
            expect(JSON.parse(reapplied.stdout).drift).toStrictEqual([]);
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
            symlinkSync(join(import.meta.dir, '../../../../node_modules'), join(sandbox.path, 'node_modules'));
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
                '--configurations',
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
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
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
            expect(readFileSync(join(sandbox.path, '.gspot/config/typos.toml'), 'utf8')).toContain('locale = "en"');
            expect(policy).toContain('SC2086');
            expect(policy).toContain('carried from .shellcheckrc at init');
            expect(policy).toContain('MD013');
            expect(policy).toContain('MD033 = true');
            const markdown = parseJsonc(readFileSync(join(sandbox.path, '.gspot/config/markdownlint.jsonc'), 'utf8'));
            expect(markdown).toMatchObject({ MD013: false, MD033: true });
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
            expect((JSON.parse(applied.stdout) as { drift: unknown[] }).drift).toStrictEqual([]);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});

test.each(['setup.cfg', 'tox.ini'])(
    'init carries SQLFluff settings without retiring shared %s',
    async (path) => {
        await using sandbox = await testdir();
        const original = '[flake8]\nignore = E501\n\n[sqlfluff]\nexclude_rules = LT01, RF01\n';
        await createFileTree(sandbox.path, { [path]: original, 'query.sql': 'SELECT 1;\n' });
        chmodSync(join(sandbox.path, path), 0o640);
        const initialized = await run(sandbox.path, [
            'init',
            '--yes',
            '--json',
            '--configurations',
            'sql',
            '--without',
            'naming',
            'spelling',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const policy = readPolicy(sandbox.path).policy;
        expect(
            policy.ignores.filter((entry) => entry.check === 'sql/sqlfluff').map((entry) => entry.rule),
        ).toStrictEqual(['LT01', 'RF01']);
        expect(JSON.parse(initialized.stdout).plan.remove.some((entry: { path: string }) => entry.path === path)).toBe(
            false,
        );
        expect(JSON.parse(initialized.stdout).plan.retained).toContainEqual({
            path,
            note: expect.stringContaining('remove that section manually'),
        });
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
        expect(statSync(join(sandbox.path, path)).mode & 0o777).toBe(0o640);
        const removed = await run(sandbox.path, ['uninstall', '--yes']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(original);
        expect(statSync(join(sandbox.path, path)).mode & 0o777).toBe(0o640);
    },
    PLANTED_TIMEOUT_MS,
);
