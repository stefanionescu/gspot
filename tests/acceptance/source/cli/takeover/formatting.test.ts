// Takeover at init: adopted Prettier and EditorConfig settings format later files the way the originals did.
import prettier from 'prettier';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import type { ApplyPreviewJson } from '#cli/commands/apply/command.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { chmodSync, readFileSync, statSync, symlinkSync } from 'node:fs';

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
        expect(expected).toBe('const greeting = "hello"\r\nif (greeting) {\r\n        console.log(greeting)\r\n}\r\n');
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
        expect((JSON.parse(reapplied.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
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
        symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'));
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
