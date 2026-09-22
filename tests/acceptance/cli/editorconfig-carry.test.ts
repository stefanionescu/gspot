import { join } from 'node:path';
import { chmodSync, existsSync, readFileSync, statSync, symlinkSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import prettier from 'prettier';
import { run, PLANTED_TIMEOUT_MS } from '#tests/harness/planted.ts';

const SOURCE = 'const greeting="hello";if(greeting){console.log(greeting);}';
const EDITORCONFIG =
    'root = true\n[*]\nindent_style = space\nindent_size = 2\nmax_line_length = 90\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\n[tests/**.js]\nindent_size = 4\n';
const FILES = [
    'source.js',
    'src/nested/source.js',
    'src/[draft].js',
    'tests/source.js',
    'server/source.js',
    'components/source.js',
];

test.each([false, true])(
    'unsupported EditorConfig adoption leaves formatting and original bytes intact, with Prettier config=%s',
    async (hasPrettier) => {
        await using repository = await testdir();
        const originals = {
            '.editorconfig': EDITORCONFIG,
            'src/.editorconfig': '[*.js]\nindent_size = 8\n',
            ...(hasPrettier ? { '.prettierrc.yaml': 'semi: false\n' } : {}),
        };
        await createFileTree(repository.path, {
            ...originals,
            ...Object.fromEntries(FILES.map((file) => [file, SOURCE])),
        });
        for (const file of Object.keys(originals)) chmodSync(join(repository.path, file), 0o640);
        symlinkSync(join(import.meta.dir, '../../../node_modules'), join(repository.path, 'node_modules'));
        const expected = new Map<string, string>();
        for (const file of FILES) {
            const filepath = join(repository.path, file);
            const options = await prettier.resolveConfig(filepath, { editorconfig: true, useCache: false });
            expected.set(file, await prettier.format(SOURCE, { ...options, filepath }));
        }
        expect(expected.get('src/[draft].js')).toContain('\n        console.log');
        expect(expected.get('tests/source.js')).toContain('\n    console.log');
        expect(expected.get('source.js')).toContain('\n  console.log');
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
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(2);
        expect(initialized.stdout).toContain('Formatting conversion does not support .editorconfig');
        expect(existsSync(join(repository.path, 'gspot.toml'))).toBe(false);
        for (const [file, text] of Object.entries(originals)) {
            expect(readFileSync(join(repository.path, file), 'utf8')).toBe(text);
            expect(statSync(join(repository.path, file)).mode & 0o777).toBe(0o640);
        }
        for (const file of FILES) expect(readFileSync(join(repository.path, file), 'utf8')).toBe(SOURCE);
    },
    PLANTED_TIMEOUT_MS,
);
