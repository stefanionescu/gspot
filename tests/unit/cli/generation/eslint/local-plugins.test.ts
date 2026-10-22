import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { GspotError } from '#cli/system/errors.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { generateFile, findConfigFilePath } from '#tests/setup/cli/config-files.ts';

import {
    LOCAL_PLUGIN,
    SCOPE_PLUGIN_FILES,
    LOCAL_PLUGIN_TABLES,
    SCOPE_PLUGIN_TABLES,
    SCOPE_PLUGIN_FINDINGS,
    DUPLICATE_PLUGIN_ERROR,
    CONFLICTING_LOCAL_PLUGIN_FILES,
    CONFLICTING_LOCAL_PLUGIN_TABLES,
} from '#tests/data/generation/eslint/local-plugins.ts';

test('a scope plugin reaches its scope, and an inherited root plugin writes one rule block', async () => {
    await using sandbox = await testdir({
        ...SCOPE_PLUGIN_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: SCOPE_PLUGIN_TABLES }),
    });

    commitAll(sandbox.path);
    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['source.js', 'outside/source.js', 'app/source.js', 'app/nested/source.js'],
            ['local/no-forbidden', 'scoped/no-forbidden'],
        ),
    ).toStrictEqual(SCOPE_PLUGIN_FINDINGS);
    const session = await openSession(sandbox.path);
    const generated = await readFile(join(sandbox.path, findConfigFilePath(session, 'eslint')), 'utf8');
    expect([...generated.matchAll(/"local\/no-forbidden"\s*:/gu)]).toHaveLength(1);
    expect([...generated.matchAll(/"scoped\/no-forbidden"\s*:/gu)]).toHaveLength(1);
});

test('one plugin name with two modules is a settings error that names both paths', () => {
    expect(
        generateFile(
            buildSandboxSettings(['javascript'], { tables: CONFLICTING_LOCAL_PLUGIN_TABLES }),
            'eslint.config.mjs',
            CONFLICTING_LOCAL_PLUGIN_FILES,
        ),
    ).rejects.toThrow(matchFields<GspotError>(DUPLICATE_PLUGIN_ERROR));
});
test('tools.eslint.plugins loads your plugin by its path and turns its rules on as errors', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: LOCAL_PLUGIN_TABLES }),
        '.gitignore': 'node_modules/\n',
        'package.json': '{"private":true,"type":"module"}\n',
        'tools/lint/plugin.mjs': LOCAL_PLUGIN,
        'source.js': 'export const forbidden = 1;\n',
    });

    commitAll(sandbox.path);
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['local/no-forbidden'])).toStrictEqual([
        { file: 'source.js', rule: 'local/no-forbidden', line: 1 },
    ]);
    await writeFile(
        `${sandbox.path}/gspot.toml`,
        buildSandboxSettings(['javascript'], { tables: LOCAL_PLUGIN_TABLES.replace('"local"', '"gspot"') }),
    );
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stdout + refused.stderr).toContain(
        'tools.eslint.plugins: gspot is the rule prefix of a plugin that gspot loads. Choose another name.',
    );
});
