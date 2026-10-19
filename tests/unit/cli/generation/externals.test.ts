import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { createEslint, generateFile, collectLintFindings } from '#tests/setup/tool-files.ts';
import { HOST_MODULE, LOCAL_PLUGIN, LOCAL_PLUGIN_TABLES } from '#tests/data/generation/externals.ts';

test('javascript.externals reach the import boundaries rule and the Knip unresolved imports', async () => {
    const settings = buildSettingsText(['javascript'], {
        level: 'all',
        tables: `[javascript]\nexternals = ["${HOST_MODULE}"]\n`,
    });
    const files = { 'package.json': '{"private":true,"type":"module"}\n', 'web/src/a.js': '' };
    const knip = JSON.parse(
        await generateFile(settings, '.gspot/configurations/language/javascript/knip.json', files),
    ) as {
        ignoreUnresolved?: string[];
    };
    expect(knip.ignoreUnresolved).toStrictEqual([HOST_MODULE]);
    const eslint = await generateFile(settings, '.gspot/configurations/language/javascript/eslint.mjs', files);
    expect(eslint.replaceAll(/\s+/gu, '')).toContain(`"externals":["${HOST_MODULE}"]`);
});

test('python.extra_paths reach the basedpyright search paths', async () => {
    const config = JSON.parse(
        await generateFile(
            buildSettingsText(['python'], { tables: '[python]\nextra_paths = ["vendor/host"]\n' }),
            '.gspot/configurations/language/python/basedpyright.json',
            { 'main.py': 'VALUE = 1\n' },
        ),
    ) as { extraPaths: string[] };
    expect(config.extraPaths.at(-1)?.endsWith('vendor/host')).toBe(true);
});

test('tools.eslint.plugins loads your plugin by its path and turns its rules on as errors', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], { tables: LOCAL_PLUGIN_TABLES }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tools/lint/plugin.mjs': LOCAL_PLUGIN,
        'source.js': 'export const forbidden = 1;\n',
    });
    commitAll(sandbox.path);
    const eslint = await createEslint(sandbox.path);
    expect(await collectLintFindings(eslint, sandbox.path, ['source.js'], ['local/no-forbidden'])).toStrictEqual([
        { file: 'source.js', rule: 'local/no-forbidden', line: 1 },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildSettingsText(['javascript'], { tables: LOCAL_PLUGIN_TABLES.replace('"local"', '"gspot"') }),
    );
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stdout + refused.stderr).toContain(
        'tools.eslint.plugins: gspot is the rule prefix of a plugin that gspot loads. Choose another name.',
    );
});

test.each(['recommended', 'all'] as const)(
    'basedpyright reports import cycles and implicit overrides at level all only (%s)',
    async (level) => {
        const config = JSON.parse(
            await generateFile(
                buildSettingsText(['python'], { level }),
                '.gspot/configurations/language/python/basedpyright.json',
                { 'main.py': 'VALUE = 1\n' },
            ),
        ) as Record<string, unknown>;
        const expected = level === 'all' ? 'error' : 'none';
        expect([config['reportImportCycles'], config['reportImplicitOverride']]).toStrictEqual([expected, expected]);
    },
);
