import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { toolFileFor, createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';

import {
    SCOPE_PLUGIN_FILES,
    SCOPE_PLUGIN_TABLES,
    SCOPE_PLUGIN_FINDINGS,
    CONFLICTING_LOCAL_PLUGIN_FILES,
    CONFLICTING_LOCAL_PLUGIN_TABLES,
} from '#tests/data/generation/eslint/local-plugins.ts';

test('a scope plugin reaches its scope, and an inherited root plugin writes one rule block', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...SCOPE_PLUGIN_FILES,
        'gspot.toml': buildSettingsText(['javascript'], { tables: SCOPE_PLUGIN_TABLES }),
    });
    commitAll(sandbox.path);
    const eslint = await createEslint(sandbox.path);
    expect(
        await collectLintFindings(
            eslint,
            sandbox.path,
            ['source.js', 'outside/source.js', 'app/source.js', 'app/nested/source.js'],
            ['local/no-forbidden', 'scoped/no-forbidden'],
        ),
    ).toStrictEqual(SCOPE_PLUGIN_FINDINGS);
    const session = await openSession(sandbox.path);
    const generated = await Bun.file(join(sandbox.path, toolFileFor(session, 'eslint'))).text();
    expect([...generated.matchAll(/"local\/no-forbidden"\s*:/gu)]).toHaveLength(1);
    expect([...generated.matchAll(/"scoped\/no-forbidden"\s*:/gu)]).toHaveLength(1);
});

test('one plugin name with two modules is a settings error that names both paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...CONFLICTING_LOCAL_PLUGIN_FILES,
        'gspot.toml': buildSettingsText(['javascript'], { tables: CONFLICTING_LOCAL_PLUGIN_TABLES }),
    });
    const session = await openSession(sandbox.path);
    expect(() => generate(session)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message:
                'tools.eslint.plugins: local names two modules, tools/lint/first.mjs and tools/lint/second.mjs. Give each its own prefix.',
        }),
    );
});
