import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { matchItems } from '#tests/setup/matchers.ts';
import { generateFile } from '#tests/setup/tool-files.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type RuffToolFile } from '#tests/types/generated-files.ts';

test('Ruff selects the pytest and FastAPI families only when selected, and adds no per-file ignores', async () => {
    const plain = parse(
        await generateFile(buildSettingsText(['python']), '.gspot/configurations/language/python/ruff.toml', {
            'example.py': 'value = 1\n',
        }),
    ) as RuffToolFile;
    expect(plain.lint.select.filter((code) => /^(?:AIR|DJ|FAST|NPY|PT)/u.test(code))).toStrictEqual([]);
    expect(plain.lint['per-file-ignores']).toBeUndefined();
    expect(plain.lint.pylint['max-statements']).toBe(30);
    const tested = parse(
        await generateFile(buildSettingsText(['python', 'pytest']), '.gspot/configurations/language/python/ruff.toml', {
            'example.py': 'value = 1\n',
        }),
    ) as RuffToolFile;
    expect(tested.lint.select).toStrictEqual(
        matchItems([
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
        ]),
    );
    expect(tested.lint['per-file-ignores']).toBeUndefined();
    const served = parse(
        await generateFile(
            buildSettingsText(['python', 'fastapi']),
            '.gspot/configurations/language/python/ruff.toml',
            {
                'example.py': 'value = 1\n',
            },
        ),
    ) as RuffToolFile;
    expect(served.lint.select).toContain('FAST003');
    expect(served.lint['per-file-ignores']).toBeUndefined();
});

test('ignores of one test path share one Ruff per-file-ignores list', async () => {
    const ignored = parse(
        await generateFile(
            buildSettingsText(['python', 'pytest'], {
                tables: '[[ignore]]\ncheck = "python/ruff"\nrule = "S101"\npaths = ["**/test_*.py"]\nreason = "The sandbox uses deliberate assertions."\n[[ignore]]\ncheck = "python/ruff"\nrule = "D103"\npaths = ["**/test_*.py"]\nreason = "Samples are documented by their names."\n',
            }),
            '.gspot/configurations/language/python/ruff.toml',
            { 'example.py': 'value = 1\n' },
        ),
    ) as RuffToolFile;
    expect(ignored.lint['per-file-ignores']?.['../../../../**/test_*.py']).toStrictEqual(['S101', 'D103']);
});

test('Ruff formats with double quotes unless format.quotes is written, while Prettier keeps single quotes', async () => {
    const files = { 'example.py': 'value = 1\n', 'entry.js': 'export const value = 1;\n' };
    const ruffPath = '.gspot/configurations/language/python/ruff.toml';
    const unset = parse(await generateFile(buildSettingsText(['python']), ruffPath, files)) as RuffToolFile;
    expect(unset.format['quote-style']).toBe('double');
    const prettier = JSON.parse(
        await generateFile(
            buildSettingsText(['python', 'javascript']),
            '.gspot/configurations/general/format/prettier.json',
            files,
        ),
    ) as Record<string, unknown>;
    expect(prettier['singleQuote']).toBe(true);
    const written = parse(
        await generateFile(buildSettingsText(['python'], { tables: '[format]\nquotes = "single"\n' }), ruffPath, files),
    ) as RuffToolFile;
    expect(written.format['quote-style']).toBe('single');
});

test('basedpyright reads the uv environment of a project with a tracked uv.lock, whether .venv exists yet or not', async () => {
    const basedpyrightPath = '.gspot/configurations/language/python/basedpyright.json';
    const locked = JSON.parse(
        await generateFile(buildSettingsText(['python']), basedpyrightPath, {
            'example.py': 'value = 1\n',
            'uv.lock': 'version = 1\n',
        }),
    ) as { venv?: string; venvPath?: string };
    expect(locked.venv).toBe('.venv');
    expect(locked.venvPath).toBeDefined();
    const unlocked = JSON.parse(
        await generateFile(buildSettingsText(['python']), basedpyrightPath, {
            'example.py': 'value = 1\n',
            '.venv/pyvenv.cfg': 'home = /usr/bin\n',
        }),
    ) as { venv?: string };
    expect(unlocked.venv).toBeUndefined();
});

test('Ruff takes its style from a format override that names every Python file', async () => {
    const tables =
        '[format]\nprint_width = 120\n[[format.override]]\npaths = ["**/*.py"]\nquotes = "single"\nprint_width = 88\n';
    const ruff = parse(
        await generateFile(
            buildSettingsText(['python'], { tables }),
            '.gspot/configurations/language/python/ruff.toml',
            {
                'example.py': 'value = 1\n',
            },
        ),
    ) as RuffToolFile & { 'line-length': number };
    expect(ruff.format['quote-style']).toBe('single');
    expect(ruff['line-length']).toBe(88);
});
