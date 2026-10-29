import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { PYVENV_HOME } from '#tests/config/python.ts';
import { type RuffConfigFile } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { generateFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';

test('python.import_folders reach the basedpyright search paths', async () => {
    const config = JSON.parse(
        await generateFile(
            buildSandboxSettings(['python'], { tables: '[python]\nimport_folders = ["vendor/host"]\n' }),
            getManifestTarget('python', 'basedpyright.json'),
            { 'main.py': 'VALUE = 1\n' },
        ),
    ) as { extraPaths: string[] };
    expect(config.extraPaths).toStrictEqual(['../../../..', '../../../../vendor/host']);
});

test.each(['basic', 'all'] as const)(
    'basedpyright reports import cycles and implicit overrides at level all only (%s)',
    async (level) => {
        const config = JSON.parse(
            await generateFile(
                buildSandboxSettings(['python'], { level }),
                getManifestTarget('python', 'basedpyright.json'),
                { 'main.py': 'VALUE = 1\n' },
            ),
        ) as Record<string, unknown>;
        const expected = level === 'all' ? 'error' : 'none';
        expect(config['typeCheckingMode']).toBe(level === 'basic' ? 'recommended' : 'all');
        expect([config['reportImportCycles'], config['reportImplicitOverride']]).toStrictEqual([expected, expected]);
    },
);

test('basedpyright reads the uv environment of a project with a tracked uv.lock, whether .venv exists yet or not', async () => {
    const basedpyrightPath = getManifestTarget('python', 'basedpyright.json');
    const locked = JSON.parse(
        await generateFile(buildSandboxSettings(['python']), basedpyrightPath, {
            'example.py': 'value = 1\n',
            'uv.lock': 'version = 1\n',
        }),
    ) as { venv?: string; venvPath?: string };
    expect(locked.venv).toBe('.venv');
    expect(locked.venvPath).toBe('../../../..');
    const unlocked = JSON.parse(
        await generateFile(buildSandboxSettings(['python']), basedpyrightPath, {
            'example.py': 'value = 1\n',
            '.venv/pyvenv.cfg': PYVENV_HOME,
        }),
    ) as { venv?: string };
    expect(unlocked.venv).toBeUndefined();
});

test('Ruff selects the pytest and FastAPI families only when selected, and adds no per-file ignores', async () => {
    const defaults = parse(
        await generateFile(buildSandboxSettings(['python']), getManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfigFile;
    expect(defaults.lint.select.filter((code) => /^(?:AIR|DJ|FAST|NPY|PT)/u.test(code))).toStrictEqual([]);
    expect(defaults.lint['per-file-ignores']).toBeUndefined();
    const tested = parse(
        await generateFile(buildSandboxSettings(['python', 'pytest']), getManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfigFile;
    expect(tested.lint.select.filter((code) => !defaults.lint.select.includes(code))).toStrictEqual([
        'PT008',
        'PT009',
        'PT010',
        'PT011',
        'PT012',
        'PT013',
        'PT014',
        'PT015',
        'PT016',
        'PT017',
        'PT020',
        'PT021',
        'PT024',
        'PT025',
        'PT027',
        'PT028',
        'PT030',
        'PT031',
    ]);
    expect(tested.lint['per-file-ignores']).toBeUndefined();
    const served = parse(
        await generateFile(buildSandboxSettings(['python', 'fastapi']), getManifestTarget('python', 'ruff.toml'), {
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
            getManifestTarget('python', 'ruff.toml'),
            { 'example.py': 'value = 1\n' },
        ),
    ) as RuffConfigFile;
    expect(ignored.lint['per-file-ignores']?.['../../../../**/test_*.py']).toStrictEqual(['S101', 'D103']);
});

test('Ruff formats with double quotes unless format.quotes is written, while Prettier keeps single quotes', async () => {
    const files = { 'example.py': 'value = 1\n', 'entry.js': 'export const value = 1;\n' };
    const ruffPath = getManifestTarget('python', 'ruff.toml');
    const unset = parse(await generateFile(buildSandboxSettings(['python']), ruffPath, files)) as RuffConfigFile;
    expect(unset.format['quote-style']).toBe('double');
    const prettier = JSON.parse(
        await generateFile(
            buildSandboxSettings(['python', 'javascript']),
            getManifestTarget('format', 'prettier.json'),
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
        await generateFile(buildSandboxSettings(['python'], { tables }), getManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfigFile & { 'line-length': number };
    expect(ruff.format['quote-style']).toBe('single');
    expect(ruff['line-length']).toBe(88);
});

test('Ruff takes its pylint and mccabe limits from [limits.python]', async () => {
    const ruff = parse(
        await generateFile(
            buildSandboxSettings(['python'], {
                tables: '[limits.python]\nfunction_statements = 12\nfunction_parameters = 4\nfunction_branches = 6\nfunction_returns = 3\ncyclomatic_complexity = 7\n',
            }),
            getManifestTarget('python', 'ruff.toml'),
            { 'example.py': 'value = 1\n' },
        ),
    ) as RuffConfigFile;
    expect(ruff.lint.pylint).toStrictEqual({
        'max-statements': 12,
        'max-args': 4,
        'max-positional-args': 4,
        'max-branches': 6,
        'max-returns': 3,
    });
    expect(ruff.lint.mccabe).toStrictEqual({ 'max-complexity': 7 });
});
