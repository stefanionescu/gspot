import { expect, test } from 'bun:test';

import {
    CONFLICTING_LOCAL_PLUGIN_FILES,
    CONFLICTING_LOCAL_PLUGIN_TABLES,
    DUPLICATE_PLUGIN_ERROR,
    LOCAL_PLUGIN,
    LOCAL_PLUGIN_TABLES,
    SCOPE_PLUGIN_FILES,
    SCOPE_PLUGIN_FINDINGS,
    SCOPE_PLUGIN_TABLES,
} from '#tests/config/configurations/javascript/plugins.ts';
import { buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

test('a scope plugin reaches its scope and an inherited root plugin reaches nested files', async () => {
    await using sandbox = await createGitSandbox({
        ...SCOPE_PLUGIN_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: SCOPE_PLUGIN_TABLES }),
    });

    commitAll(sandbox.path);
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['source.js', 'outside/source.js', 'app/source.js', 'app/nested/source.js'],
            ['local/no-forbidden', 'scoped/no-forbidden'],
        ),
    ).toStrictEqual(SCOPE_PLUGIN_FINDINGS);
});

test('a plugin package loads from .gspot/node_modules and reports with its rule prefix', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: LOCAL_PLUGIN_TABLES.replace(
                'path = "tools/lint/plugin.mjs"',
                'package = "eslint-plugin-acme"\nversion = "1.2.3"',
            ).replace('"local"', '"acme"'),
        }),
        '.gitignore': 'node_modules/\n',
        'package.json': '{"private":true,"type":"module"}\n',
        '.gspot/node_modules/eslint-plugin-acme/package.json':
            '{"name":"eslint-plugin-acme","version":"1.2.3","type":"module","main":"plugin.mjs"}\n',
        '.gspot/node_modules/eslint-plugin-acme/plugin.mjs': LOCAL_PLUGIN,
        'source.js': 'export const forbidden = 1;\n',
    });

    commitAll(sandbox.path);
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['acme/no-forbidden'])).toStrictEqual([
        { file: 'source.js', rule: 'acme/no-forbidden', line: 1 },
    ]);
});

test('one plugin name with two modules is a settings error that names both paths', async () => {
    const error = await captureRejection(
        buildGeneratedFile(
            buildSandboxSettings(['javascript'], { tables: CONFLICTING_LOCAL_PLUGIN_TABLES }),
            'eslint.config.mjs',
            CONFLICTING_LOCAL_PLUGIN_FILES,
        ),
    );
    expect(error).toMatchObject(DUPLICATE_PLUGIN_ERROR);
});

test('tools.eslint.plugins loads your plugin by its path', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: LOCAL_PLUGIN_TABLES }),
        '.gitignore': 'node_modules/\n',
        'package.json': '{"private":true,"type":"module"}\n',
        'tools/lint/plugin.mjs': LOCAL_PLUGIN,
        'source.js': 'export const forbidden = 1;\n',
    });

    commitAll(sandbox.path);
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['local/no-forbidden'])).toStrictEqual([
        { file: 'source.js', rule: 'local/no-forbidden', line: 1 },
    ]);
});
