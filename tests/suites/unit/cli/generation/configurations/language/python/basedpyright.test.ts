import { test, expect } from 'bun:test';
import { generateFile, findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

test('python.import_folders reach the basedpyright search paths', async () => {
    const config = JSON.parse(
        await generateFile(
            buildSandboxSettings(['python'], { tables: '[python]\nimport_folders = ["vendor/host"]\n' }),
            findManifestTarget('python', 'basedpyright.json'),
            { 'main.py': 'VALUE = 1\n' },
        ),
    ) as { extraPaths: string[] };
    expect(config.extraPaths).toStrictEqual(['../../../..', '../../../../vendor/host']);
});
test.each(['recommended', 'all'] as const)(
    'basedpyright reports import cycles and implicit overrides at level all only (%s)',
    async (level) => {
        const config = JSON.parse(
            await generateFile(
                buildSandboxSettings(['python'], { level }),
                findManifestTarget('python', 'basedpyright.json'),
                { 'main.py': 'VALUE = 1\n' },
            ),
        ) as Record<string, unknown>;
        const expected = level === 'all' ? 'error' : 'none';
        expect([config['reportImportCycles'], config['reportImplicitOverride']]).toStrictEqual([expected, expected]);
    },
);
test('basedpyright reads the uv environment of a project with a tracked uv.lock, whether .venv exists yet or not', async () => {
    const basedpyrightPath = findManifestTarget('python', 'basedpyright.json');
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
            '.venv/pyvenv.cfg': 'home = /usr/bin\n',
        }),
    ) as { venv?: string };
    expect(unlocked.venv).toBeUndefined();
});

test('the removed Python import path setting is refused', () => {
    expect(validateSettingsText('configurations = ["python"]\n[python]\nextra_paths = []\n')).toStrictEqual([
        'gspot.toml:3: python.extra_paths: `extra_paths` is not a gspot.toml setting. See generativespotting.com/reference/gspot-toml/ for every key.',
    ]);
});
