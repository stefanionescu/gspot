import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { formatSources } from '#tests/support/cli/prettier.ts';
import { installPrivateTools } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import type { AuthoredState } from '#tests/types/acceptance/source/cli.ts';
import { statSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

import {
    YAML,
    AUTHORED,
    PRETTIER_FIX_ARGS,
    PRETTIER_CARRY_FILES,
    PRETTIER_CARRY_CONFIG,
    PRETTIER_CARRY_SOURCE,
    PRETTIER_NATIVE_FORMATS,
} from '#tests/config/acceptance/source/cli/cli.ts';

// What became of the authored file after init: its text and mode as they were, another text, or nothing.
function authoredState(path: string, text: string): AuthoredState {
    if (!existsSync(path)) return { state: 'removed' };
    return { state: readFileSync(path, 'utf8') === text ? 'kept' : 'rewritten', mode: statSync(path).mode & 0o777 };
}

// Each row says what init leaves of the authored file: a package manifest is kept, the JSON file is rewritten as a
// pointer, and every other native file is removed.
test.each([
    ['.prettierrc.json', JSON.stringify(PRETTIER_CARRY_CONFIG) + '\n', 'rewritten'],
    [
        'package.json',
        JSON.stringify({
            name: 'authored-project',
            private: true,
            scripts: { authored: 'echo keep' },
            prettier: PRETTIER_CARRY_CONFIG,
        }) + '\n',
        'kept',
    ],
    [
        'package.yaml',
        'name: authored-project\nprivate: true\nscripts:\n  authored: echo keep\nprettier:\n' +
            YAML.split('\n')
                .filter(Boolean)
                .map((line) => '  ' + line)
                .join('\n') +
            '\n',
        'kept',
    ],
    [
        '.prettierrc.json5',
        "{ // Keep formatter overrides.\n tabWidth: 2, singleQuote: false, overrides: [{ files: 'tests/**', options: { tabWidth: 8, singleQuote: true } }, { files: '**/*.js', excludeFiles: 'server/**', options: { semi: false } }], }\n",
        'removed',
    ],
    [
        'prettier.config.mjs',
        `const testDirectory = 'tests';\nconst config = ${JSON.stringify(PRETTIER_CARRY_CONFIG)};\nconfig.overrides[0].files = testDirectory + '/**';\nexport default config;\n`,
        'removed',
    ],
    ['prettier.config.cjs', `module.exports = ${JSON.stringify(PRETTIER_CARRY_CONFIG)};\n`, 'removed'],
    [
        'prettier.config.ts',
        `export default ${JSON.stringify(PRETTIER_CARRY_CONFIG)} satisfies import('prettier').Config;\n`,
        'removed',
    ],
    [
        'prettier.config.mts',
        `export default ${JSON.stringify(PRETTIER_CARRY_CONFIG)} satisfies import('prettier').Config;\n`,
        'removed',
    ],
    [
        'prettier.config.cts',
        `module.exports = ${JSON.stringify(PRETTIER_CARRY_CONFIG)} satisfies import('prettier').Config;\n`,
        'removed',
    ],
    ['.prettierrc.yaml', YAML, 'removed'],
] as const)(
    'init preserves native formatting and future selectors from %s',
    async (path, text, outcome) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            [path]: text,
            ...Object.fromEntries(PRETTIER_CARRY_FILES.map((file) => [file, PRETTIER_CARRY_SOURCE])),
        });
        chmodSync(join(repository.path, path), 0o640);
        const expected = await formatSources(
            repository.path,
            [...PRETTIER_CARRY_FILES, 'tests/future.js'],
            PRETTIER_CARRY_SOURCE,
            { editorconfig: true, useCache: false },
        );
        expect([...expected.keys()]).toStrictEqual([...PRETTIER_CARRY_FILES, 'tests/future.js']);
        for (const [file, formatting] of Object.entries(PRETTIER_NATIVE_FORMATS))
            expect(expected.get(file)).toBe(formatting);
        const initialized = await run(repository.path, initArgs(['formatting']));
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(initialized.stdout).toContain('selectors are represented in gspot configuration');
        expect(authoredState(join(repository.path, path), text)).toMatchObject(AUTHORED[outcome]);
        const options = {
            config: join(repository.path, '.gspot/config/prettier.json'),
            editorconfig: false,
            useCache: false,
        };
        const carried = await formatSources(repository.path, PRETTIER_CARRY_FILES, PRETTIER_CARRY_SOURCE, options);
        for (const file of PRETTIER_CARRY_FILES) {
            expect(carried.get(file), file).toBe(expected.get(file));
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(PRETTIER_CARRY_SOURCE);
        }
        await installPrivateTools(repository.path);
        const level = await run(repository.path, ['set', 'level', 'all']);
        expect(level.code, level.stdout + level.stderr).toBe(0);
        const corrected = await run(repository.path, [...PRETTIER_FIX_ARGS, ...PRETTIER_CARRY_FILES]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            {
                check: 'formatting/prettier',
                status: 'ok',
                files: PRETTIER_CARRY_FILES.length,
                findings: [],
            },
        ]);
        for (const file of PRETTIER_CARRY_FILES)
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(expected.get(file)!);
        writeFileSync(join(repository.path, 'tests/future.js'), PRETTIER_CARRY_SOURCE);
        const futureFormatting = await formatSources(
            repository.path,
            ['tests/future.js'],
            PRETTIER_CARRY_SOURCE,
            options,
        );
        expect(futureFormatting.get('tests/future.js')).toBe(expected.get('tests/future.js'));
        expect(authoredState(join(repository.path, path), text)).toMatchObject(AUTHORED[outcome]);
        const repeated = await run(repository.path, ['apply', '--dry-run', '--json']);
        expect(repeated.code, repeated.stdout + repeated.stderr).toBe(0);
        expect((JSON.parse(repeated.stdout) as ApplyPreviewJson).drift).toStrictEqual([]);
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
            ...Object.fromEntries(files.map((file) => [file, PRETTIER_CARRY_SOURCE])),
        });
        for (const path of Object.keys(configs)) chmodSync(join(repository.path, path), 0o640);
        const expected = await formatSources(repository.path, files, PRETTIER_CARRY_SOURCE, {
            editorconfig: true,
            useCache: false,
        });
        expect([...expected.keys()]).toStrictEqual(files);
        expect(new Set(expected.values()).size).toBe(3);
        const result = await run(repository.path, [...initArgs(['formatting']), '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const applied = await run(repository.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const carried = await formatSources(repository.path, files, PRETTIER_CARRY_SOURCE, {
            config: join(repository.path, '.gspot/config/prettier.json'),
            editorconfig: true,
            useCache: false,
        });
        for (const file of files) {
            expect(carried.get(file), file).toBe(expected.get(file));
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(PRETTIER_CARRY_SOURCE);
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
