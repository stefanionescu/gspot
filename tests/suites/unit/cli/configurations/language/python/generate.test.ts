import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { PYVENV_HOME } from '#tests/config/setup/languages.ts';
import type { RuffConfig } from '#tests/types/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget, buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';

test('python.import_folders reach the basedpyright search paths', async () => {
    const config = JSON.parse(
        await buildGeneratedFile(
            buildSandboxSettings(['python'], { tables: '[python]\nimport_folders = ["vendor/host"]\n' }),
            getManifestTarget('python', 'basedpyright.json'),
            { 'main.py': 'VALUE = 1\n' },
        ),
    ) as { extraPaths: string[] };
    expect(config.extraPaths).toStrictEqual(['../../../..', '../../../../vendor/host']);
});

test('basedpyright reads the uv environment of a project with a tracked uv.lock, whether .venv exists yet or not', async () => {
    const basedpyrightPath = getManifestTarget('python', 'basedpyright.json');
    const locked = JSON.parse(
        await buildGeneratedFile(buildSandboxSettings(['python']), basedpyrightPath, {
            'example.py': 'value = 1\n',
            'uv.lock': 'version = 1\n',
        }),
    ) as { venv?: string; venvPath?: string };
    expect(locked.venv).toBe('.venv');
    expect(locked.venvPath).toBe('../../../..');
    const unlocked = JSON.parse(
        await buildGeneratedFile(buildSandboxSettings(['python']), basedpyrightPath, {
            'example.py': 'value = 1\n',
            '.venv/pyvenv.cfg': PYVENV_HOME,
        }),
    ) as { venv?: string };
    expect(unlocked.venv).toBeUndefined();
});

test('ignores of one test path share one Ruff per-file-ignores list', async () => {
    const ignored = parse(
        await buildGeneratedFile(
            buildSandboxSettings(['python', 'pytest'], {
                tables: '[[ignore]]\ncheck = "python/ruff"\nrule = "D102"\npaths = ["**/test_*.py"]\nreason = "Samples are documented by their names."\n[[ignore]]\ncheck = "python/ruff"\nrule = "D103"\npaths = ["**/test_*.py"]\nreason = "Samples are documented by their names."\n',
            }),
            getManifestTarget('python', 'ruff.toml'),
            { 'example.py': 'value = 1\n' },
        ),
    ) as RuffConfig;
    expect(ignored.lint['per-file-ignores']?.['../../../../**/test_*.py']).toStrictEqual(['S101', 'D102', 'D103']);
});

test('Ruff accepts an assert in the Python test paths and no other file', async () => {
    const ruff = parse(
        await buildGeneratedFile(buildSandboxSettings(['python']), getManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfig;
    expect(ruff.lint['per-file-ignores']).toStrictEqual({
        '../../../../**/test_*.py': ['S101'],
        '../../../../**/*_test.py': ['S101'],
        '../../../../**/tests/**': ['S101'],
        '../../../../**/conftest.py': ['S101'],
        '../../../../**/__main__.py': ['T20'],
    });
});

test('Ruff accepts print in a module that pyproject.toml names as a console script', async () => {
    const ruff = parse(
        await buildGeneratedFile(buildSandboxSettings(['python']), getManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
            'pyproject.toml': '[project]\nname = "sample"\n[project.scripts]\nsample = "sample.cli:main"\n',
        }),
    ) as RuffConfig;
    expect(ruff.lint['per-file-ignores']?.['../../../../**/sample/cli.py']).toStrictEqual(['T20']);
});

test('Ruff takes its style from a format override that names every Python file', async () => {
    const tables =
        '[format]\nprint_width = 120\n[[format.override]]\npaths = ["**/*.py"]\nquotes = "single"\nprint_width = 88\n';
    const ruff = parse(
        await buildGeneratedFile(
            buildSandboxSettings(['python'], { tables }),
            getManifestTarget('python', 'ruff.toml'),
            {
                'example.py': 'value = 1\n',
            },
        ),
    ) as RuffConfig & { 'line-length': number };
    expect(ruff.format['quote-style']).toBe('single');
    expect(ruff['line-length']).toBe(88);
});
