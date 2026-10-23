import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import type { RuffConfigFile } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { generateFile, findManifestTarget } from '#tests/setup/cli/generated-files.ts';

test('Ruff selects the pytest and FastAPI families only when selected, and adds no per-file ignores', async () => {
    const defaults = parse(
        await generateFile(buildSandboxSettings(['python']), findManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfigFile;
    expect(defaults.lint.select.filter((code) => /^(?:AIR|DJ|FAST|NPY|PT)/u.test(code))).toStrictEqual([]);
    expect(defaults.lint['per-file-ignores']).toBeUndefined();
    expect(defaults.lint.pylint['max-statements']).toBe(30);
    const tested = parse(
        await generateFile(buildSandboxSettings(['python', 'pytest']), findManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfigFile;
    expect(tested.lint.select.filter((code) => !defaults.lint.select.includes(code))).toStrictEqual(
        readConfigurations().get('pytest')!.ruff.recommended,
    );
    expect(tested.lint['per-file-ignores']).toBeUndefined();
    const served = parse(
        await generateFile(buildSandboxSettings(['python', 'fastapi']), findManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfigFile;
    expect(served.lint.select).toContain('FAST003');
    expect(served.lint['per-file-ignores']).toBeUndefined();
});
test('ignores of one test path share one Ruff per-file-ignores list', async () => {
    const ignored = parse(
        await generateFile(
            buildSandboxSettings(['python', 'pytest'], {
                tables: '[[ignore]]\ncheck = "python/ruff"\nrule = "S101"\npaths = ["**/test_*.py"]\nreason = "The sandbox uses deliberate assertions."\n[[ignore]]\ncheck = "python/ruff"\nrule = "D103"\npaths = ["**/test_*.py"]\nreason = "Samples are documented by their names."\n',
            }),
            findManifestTarget('python', 'ruff.toml'),
            { 'example.py': 'value = 1\n' },
        ),
    ) as RuffConfigFile;
    expect(ignored.lint['per-file-ignores']?.['../../../../**/test_*.py']).toStrictEqual(['S101', 'D103']);
});
test('Ruff formats with double quotes unless format.quotes is written, while Prettier keeps single quotes', async () => {
    const files = { 'example.py': 'value = 1\n', 'entry.js': 'export const value = 1;\n' };
    const ruffPath = findManifestTarget('python', 'ruff.toml');
    const unset = parse(await generateFile(buildSandboxSettings(['python']), ruffPath, files)) as RuffConfigFile;
    expect(unset.format['quote-style']).toBe('double');
    const prettier = JSON.parse(
        await generateFile(
            buildSandboxSettings(['python', 'javascript']),
            findManifestTarget('format', 'prettier.json'),
            files,
        ),
    ) as Record<string, unknown>;
    expect(prettier['singleQuote']).toBe(true);
    const written = parse(
        await generateFile(
            buildSandboxSettings(['python'], { tables: '[format]\nquotes = "single"\n' }),
            ruffPath,
            files,
        ),
    ) as RuffConfigFile;
    expect(written.format['quote-style']).toBe('single');
});
test('Ruff takes its style from a format override that names every Python file', async () => {
    const tables =
        '[format]\nprint_width = 120\n[[format.override]]\npaths = ["**/*.py"]\nquotes = "single"\nprint_width = 88\n';
    const ruff = parse(
        await generateFile(buildSandboxSettings(['python'], { tables }), findManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfigFile & { 'line-length': number };
    expect(ruff.format['quote-style']).toBe('single');
    expect(ruff['line-length']).toBe(88);
});
