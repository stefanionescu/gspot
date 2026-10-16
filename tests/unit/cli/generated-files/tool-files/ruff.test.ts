import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { matchItems } from '#tests/setup/matchers.ts';
import { generateFile } from '#tests/setup/tool-files.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type RuffToolFile } from '#tests/types/generated-files.ts';

test('Ruff selects the pytest and FastAPI families only when selected, and adds no per-file ignores', async () => {
    const plain = parse(
        await generateFile(buildSettingsText(['python']), '.gspot/config/ruff.toml', { 'example.py': 'value = 1\n' }),
    ) as RuffToolFile;
    expect(plain.lint.select.filter((code) => /^(?:AIR|DJ|FAST|NPY|PT)/u.test(code))).toStrictEqual([]);
    expect(plain.lint['per-file-ignores']).toBeUndefined();
    expect(plain.lint.pylint['max-statements']).toBe(30);
    const tested = parse(
        await generateFile(buildSettingsText(['python', 'pytest']), '.gspot/config/ruff.toml', {
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
        await generateFile(buildSettingsText(['python', 'fastapi']), '.gspot/config/ruff.toml', {
            'example.py': 'value = 1\n',
        }),
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
            '.gspot/config/ruff.toml',
            { 'example.py': 'value = 1\n' },
        ),
    ) as RuffToolFile;
    expect(ignored.lint['per-file-ignores']?.['../../**/test_*.py']).toStrictEqual(['S101', 'D103']);
});
