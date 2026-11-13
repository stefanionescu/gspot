import { expect, test } from 'bun:test';

import {
    CONFLICTING_LOCAL_PLUGIN_TABLES,
    LOCAL_PLUGIN,
    SCOPE_PLUGIN_TABLES,
} from '#tests/config/configurations/javascript/plugins.ts';
import { LOCAL_PLUGIN_TABLES } from '#tests/config/setup/configurations.ts';
import { buildGeneratedFile } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

const SCOPE_PLUGIN_FILES = {
    '.gitignore': 'node_modules/\n',
    'package.json': '{"private":true,"type":"module"}\n',
    'tools/lint/plugin.mjs': LOCAL_PLUGIN,
    'source.js': 'export const forbidden = 1;\n',
    'outside/source.js': 'export const forbidden = 1;\n',
    'app/package.json': '{"private":true,"type":"module"}\n',
    'app/tools/lint/plugin.mjs': LOCAL_PLUGIN,
    'app/source.js': 'export const forbidden = 1;\n',
    'app/nested/package.json': '{"private":true,"type":"module"}\n',
    'app/nested/source.js': 'export const forbidden = 1;\n',
};

const SCOPE_PLUGIN_FINDINGS = [
    { file: 'app/nested/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'app/nested/source.js', rule: 'scoped/no-forbidden', line: 1 },
    { file: 'app/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'app/source.js', rule: 'scoped/no-forbidden', line: 1 },
    { file: 'outside/source.js', rule: 'local/no-forbidden', line: 1 },
    { file: 'source.js', rule: 'local/no-forbidden', line: 1 },
];

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

const CONFLICTING_LOCAL_PLUGIN_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'first/package.json': '{"private":true,"type":"module"}\n',
    'second/package.json': '{"private":true,"type":"module"}\n',
    'first/tools/lint/first.mjs': LOCAL_PLUGIN,
    'second/tools/lint/second.mjs': LOCAL_PLUGIN,
};

test('one plugin name with two modules is a settings error that names both paths', async () => {
    const error = await captureRejection(
        buildGeneratedFile(
            buildSandboxSettings(['javascript'], { tables: CONFLICTING_LOCAL_PLUGIN_TABLES }),
            'eslint.config.mjs',
            CONFLICTING_LOCAL_PLUGIN_FILES,
        ),
    );
    expect(error).toMatchObject({ code: 'settings' });
    for (const path of ['first/tools/lint/first.mjs', 'second/tools/lint/second.mjs'])
        expect(error.message).toContain(path);
});
