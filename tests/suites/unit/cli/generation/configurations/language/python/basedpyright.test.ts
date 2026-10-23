import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { generateFile, findFileTarget } from '#tests/setup/cli/config-files.ts';

test('python.extra_paths reach the basedpyright search paths', async () => {
    const config = JSON.parse(
        await generateFile(
            buildSandboxSettings(['python'], { tables: '[python]\nextra_paths = ["vendor/host"]\n' }),
            findFileTarget('python', 'basedpyright.json'),
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
                findFileTarget('python', 'basedpyright.json'),
                { 'main.py': 'VALUE = 1\n' },
            ),
        ) as Record<string, unknown>;
        const expected = level === 'all' ? 'error' : 'none';
        expect([config['reportImportCycles'], config['reportImplicitOverride']]).toStrictEqual([expected, expected]);
    },
);
test('basedpyright reads the uv environment of a project with a tracked uv.lock, whether .venv exists yet or not', async () => {
    const basedpyrightPath = findFileTarget('python', 'basedpyright.json');
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
