import type { RunReport } from '#cli/output/report-types.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import prettier from 'prettier';
import { createFileTree, testdir } from 'testdirs';

const SOURCE = 'const greeting="hello";if(greeting){console.log(greeting);}';
const FILES = [
    'source.js',
    'src/nested/source.js',
    'tests/[draft].js',
    'tests/café note.js',
    'server/source.js',
    'components/source.js',
];
const CONFIG = {
    tabWidth: 2,
    singleQuote: false,
    overrides: [
        { files: 'tests/**', options: { tabWidth: 8, singleQuote: true } },
        { files: '**/*.js', excludeFiles: 'server/**', options: { semi: false } },
    ],
};
const YAML =
    'tabWidth: 2\nsingleQuote: false\noverrides:\n  - files: "tests/**"\n    options:\n      tabWidth: 8\n      singleQuote: true\n  - files: "**/*.js"\n    excludeFiles: "server/**"\n    options:\n      semi: false\n';

test.each([
    ['.prettierrc.json', JSON.stringify(CONFIG) + '\n'],
    [
        'package.json',
        JSON.stringify({
            name: 'authored-project',
            private: true,
            scripts: { authored: 'echo keep' },
            prettier: CONFIG,
        }) + '\n',
    ],
    [
        'package.yaml',
        'name: authored-project\nprivate: true\nscripts:\n  authored: echo keep\nprettier:\n' +
            YAML.split('\n')
                .filter(Boolean)
                .map((line) => '  ' + line)
                .join('\n') +
            '\n',
    ],
    [
        '.prettierrc.json5',
        "{ // Keep formatter overrides.\n tabWidth: 2, singleQuote: false, overrides: [{ files: 'tests/**', options: { tabWidth: 8, singleQuote: true } }, { files: '**/*.js', excludeFiles: 'server/**', options: { semi: false } }], }\n",
    ],
    [
        'prettier.config.mjs',
        `const testDirectory = 'tests';\nconst config = ${JSON.stringify(CONFIG)};\nconfig.overrides[0].files = testDirectory + '/**';\nexport default config;\n`,
    ],
    ['prettier.config.cjs', `module.exports = ${JSON.stringify(CONFIG)};\n`],
    ['prettier.config.ts', `export default ${JSON.stringify(CONFIG)} satisfies import('prettier').Config;\n`],
    ['prettier.config.mts', `export default ${JSON.stringify(CONFIG)} satisfies import('prettier').Config;\n`],
    ['prettier.config.cts', `module.exports = ${JSON.stringify(CONFIG)} satisfies import('prettier').Config;\n`],
    ['.prettierrc.yaml', YAML],
])(
    'init preserves native formatting and future selectors from %s',
    async (path, text) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            [path]: text,
            ...Object.fromEntries(FILES.map((file) => [file, SOURCE])),
        });
        const original = join(repository.path, path);
        chmodSync(original, 0o640);
        const expected = new Map<string, string>();
        for (const file of [...FILES, 'tests/future.js']) {
            const filepath = join(repository.path, file);
            const options = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
            expected.set(file, await prettier.format(SOURCE, { ...options, filepath }));
        }
        expect(expected.get('tests/[draft].js')).toBe(
            "const greeting = 'hello'\nif (greeting) {\n        console.log(greeting)\n}\n",
        );
        expect(expected.get('server/source.js')).toBe(
            'const greeting = "hello";\nif (greeting) {\n  console.log(greeting);\n}\n',
        );
        const initialized = await run(repository.path, [
            'init',
            '--yes',
            '--presets',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(initialized.stdout).toContain('selectors are represented in gspot configuration');
        if (path.startsWith('package.')) {
            expect(readFileSync(original, 'utf8')).toBe(text);
            expect(statSync(original).mode & 0o777).toBe(0o640);
        } else if (path === '.prettierrc.json') {
            expect(readFileSync(original, 'utf8')).not.toBe(text);
        } else expect(existsSync(original)).toBe(false);
        for (const file of FILES) {
            const filepath = join(repository.path, file);
            const carried = await prettier.resolveConfig(filepath, {
                config: join(repository.path, '.gspot/prettier.json'),
                editorconfig: false,
                useCache: false,
            });
            expect(await prettier.format(SOURCE, { ...carried, filepath }), file).toBe(expected.get(file)!);
            expect(readFileSync(filepath, 'utf8')).toBe(SOURCE);
        }
        await installPrivateTools(repository.path);
        const level = await run(repository.path, ['set', 'level', 'all']);
        expect(level.code, level.stdout + level.stderr).toBe(0);
        const corrected = await run(repository.path, [
            'check',
            '--only',
            'formatting/prettier',
            '--fix',
            '--no-cache',
            '--json',
            '--',
            ...FILES,
        ]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const report = JSON.parse(corrected.stdout) as RunReport;
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]).toMatchObject({
            check: 'formatting/prettier',
            status: 'ok',
            files: FILES.length,
            findings: [],
        });
        for (const file of FILES) expect(readFileSync(join(repository.path, file), 'utf8')).toBe(expected.get(file)!);
        const future = join(repository.path, 'tests/future.js');
        writeFileSync(future, SOURCE);
        const options = await prettier.resolveConfig(future, {
            config: join(repository.path, '.gspot/prettier.json'),
            editorconfig: false,
            useCache: false,
        });
        expect(await prettier.format(SOURCE, { ...options, filepath: future })).toBe(expected.get('tests/future.js')!);
        if (path.startsWith('package.')) expect(readFileSync(original, 'utf8')).toBe(text);
        const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect(JSON.parse(repeated.stdout).drift).toEqual([]);
    },
    PLANTED_TIMEOUT_MS,
);

test.each([false, true])(
    'executable formatter logs preserve JSON; throws=%s',
    async (fails) => {
        await using repository = await testdir();
        const configuration =
            'console.log("formatter stdout"); console.error("formatter stderr");\n' +
            (fails ? 'throw new Error("authored formatter failure");\n' : 'export default { semi: false };\n');
        await createFileTree(repository.path, { 'prettier.config.mjs': configuration, 'source.js': SOURCE });
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(fails ? 2 : 0);
        expect(() => JSON.parse(result.stdout)).not.toThrow();
        expect(result.stdout).not.toContain('formatter stdout');
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(!fails);
        if (fails) expect(readFileSync(join(repository.path, 'prettier.config.mjs'), 'utf8')).toBe(configuration);
        else expect(existsSync(join(repository.path, 'prettier.config.mjs'))).toBe(false);
        if (fails) expect(result.stdout + result.stderr).toContain('authored formatter failure');
        else expect(JSON.parse(readFileSync(join(repository.path, '.gspot/prettier.json'), 'utf8')).semi).toBe(false);
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init preserves nested formatter precedence and restores every original configuration',
    async () => {
        await using repository = await testdir();
        const configs = {
            '.editorconfig': 'root = true\n[*]\nindent_size = 6\n',
            'prettier.config.mjs': 'export default { semi: false, singleQuote: true };\n',
            'src/.prettierrc.yaml': 'semi: true\nsingleQuote: false\n',
            'src/nested/package.json':
                JSON.stringify({ name: 'nested', private: true, prettier: { tabWidth: 8, semi: false } }) + '\n',
        };
        const files = ['source.js', 'src/source.js', 'src/nested/source.js'];
        await createFileTree(repository.path, {
            ...configs,
            ...Object.fromEntries(files.map((file) => [file, SOURCE])),
        });
        for (const path of Object.keys(configs)) chmodSync(join(repository.path, path), 0o640);
        const expected = new Map<string, string>();
        for (const file of files) {
            const filepath = join(repository.path, file);
            expected.set(
                file,
                await prettier.format(SOURCE, {
                    ...(await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false })),
                    filepath,
                }),
            );
        }
        expect(new Set(expected.values()).size).toBe(3);
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const applied = await run(repository.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        for (const file of files) {
            const filepath = join(repository.path, file);
            const options = await prettier.resolveConfig(filepath, {
                config: join(repository.path, '.gspot/prettier.json'),
                editorconfig: true,
                useCache: false,
            });
            expect(await prettier.format(SOURCE, { ...options, filepath }), `${file}: ${JSON.stringify(options)}`).toBe(
                expected.get(file)!,
            );
            expect(readFileSync(filepath, 'utf8')).toBe(SOURCE);
        }
        const restored = await run(repository.path, ['uninstall', '--yes']);
        expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        for (const [path, text] of Object.entries(configs)) {
            expect(readFileSync(join(repository.path, path), 'utf8')).toBe(text);
            expect(statSync(join(repository.path, path)).mode & 0o777).toBe(0o640);
        }
    },
    PLANTED_TIMEOUT_MS,
);

test(
    'init refuses publication when executable formatting changes a reviewed nested configuration',
    async () => {
        await using repository = await testdir();
        const authored =
            'import { writeFileSync } from "node:fs"; writeFileSync(new URL("./src/.prettierrc.json", import.meta.url), "{\\"semi\\":true}\\n"); export default { semi: false };\n';
        await createFileTree(repository.path, {
            'prettier.config.mjs': authored,
            'src/.prettierrc.json': '{"semi":false}\n',
            'source.js': SOURCE,
            'src/source.js': SOURCE,
        });
        const result = await run(repository.path, [
            'init',
            '--yes',
            '--json',
            '--presets',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(result.stdout + result.stderr).toContain(
            'Configuration changed after takeover was planned: src/.prettierrc.json',
        );
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        expect(readFileSync(join(repository.path, 'src/.prettierrc.json'), 'utf8')).toBe('{"semi":true}\n');
        expect(readFileSync(join(repository.path, 'prettier.config.mjs'), 'utf8')).toBe(authored);
    },
    PLANTED_TIMEOUT_MS,
);
