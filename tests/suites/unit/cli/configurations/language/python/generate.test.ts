import { parse } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { buildGeneratedFile, getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { RuffConfig } from '#tests/types/configurations.ts';

test('python.import_folders reach the basedpyright search paths', async () => {
    const config = JSON.parse(
        await buildGeneratedFile(
            buildSandboxSettings(['python'], { tables: '[python]\nimport_folders = ["vendor/host"]\n' }),
            getManifestTarget('python', 'basedpyright.json'),
            { 'main.py': 'VALUE = 1\n' },
        ),
    ) as { extraPaths: string[] };
    expect(config.extraPaths).toStrictEqual(['../../..', '../../../vendor/host']);
});

test('basedpyright takes the lowest Python of requires-python, and leaves a nested scope out', async () => {
    const config = JSON.parse(
        await buildGeneratedFile(
            buildSandboxSettings(['python'], { scopes: [{ path: 'docs/source', configurations: ['python'] }] }),
            getManifestTarget('python', 'basedpyright.json'),
            {
                'pyproject.toml': '[project]\nname = "app"\nversion = "1.0.0"\nrequires-python = ">=3.8,<4"\n',
                'main.py': 'VALUE = 1\n',
                'docs/source/conf.py': 'project = "app"\n',
            },
        ),
    ) as { pythonVersion?: string; exclude: string[] };
    expect(config.pythonVersion).toBe('3.8');
    expect(config.exclude).toContain('../../../docs/source');
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
    expect(ignored.lint['per-file-ignores']?.['../../../**/test_*.py']).toStrictEqual(['S101', 'D102', 'D103']);
});

async function buildRuffIgnore(tables: string): Promise<string[]> {
    const ruff = parse(
        await buildGeneratedFile(
            buildSandboxSettings(['python'], { tables }),
            getManifestTarget('python', 'ruff.toml'),
            { 'example.py': 'value = 1\n' },
        ),
    ) as { lint: { ignore: string[] } };
    return ruff.lint.ignore;
}

test('tools.ruff.rules turns on a rule that gspot leaves off, and an ignore of it still wins', async () => {
    expect(await buildRuffIgnore('[tools.ruff]\nrules = ["D100"]\n')).not.toContain('D100');
    expect(await buildRuffIgnore('')).toContain('D100');
    expect(
        await buildRuffIgnore(
            '[tools.ruff]\nrules = ["D100"]\n[[ignore]]\ncheck = "python/ruff"\nrule = "D100"\nreason = "Modules need no docstring here."\n',
        ),
    ).toContain('D100');
});

test('Ruff accepts print in a module that pyproject.toml names as a console script', async () => {
    const ruff = parse(
        await buildGeneratedFile(buildSandboxSettings(['python']), getManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
            'pyproject.toml': '[project]\nname = "sample"\n[project.scripts]\nsample = "sample.cli:main"\n',
        }),
    ) as RuffConfig;
    expect(ruff.lint['per-file-ignores']?.['../../../**/sample/cli.py']).toStrictEqual(['T20']);
});

test.each([
    { configurations: ['python', 'fastapi'], files: { 'example.py': 'value = 1\n' } },
    {
        configurations: ['python'],
        files: { 'pyproject.toml': '[project]\nname = "shop"\ndependencies = ["pydantic>=2"]\n' },
    },
])(
    'Ruff keeps the runtime imports that Pydantic and FastAPI read: $configurations',
    async ({ configurations, files }) => {
        const ruff = parse(
            await buildGeneratedFile(
                buildSandboxSettings(configurations),
                getManifestTarget('python', 'ruff.toml'),
                files,
            ),
        ) as { lint: Record<string, Record<string, string[]>> };
        expect(ruff.lint['flake8-type-checking']?.['runtime-evaluated-base-classes']).toContain('pydantic.BaseModel');
    },
);

test('Ruff keeps no runtime imports without Pydantic or FastAPI', async () => {
    const ruff = parse(
        await buildGeneratedFile(buildSandboxSettings(['python']), getManifestTarget('python', 'ruff.toml'), {
            'example.py': 'value = 1\n',
        }),
    ) as RuffConfig;
    expect(ruff.lint).not.toHaveProperty('flake8-type-checking');
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
