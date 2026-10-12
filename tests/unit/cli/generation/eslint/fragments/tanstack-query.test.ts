import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';
import { QUERY_FIXED, QUERY_FILES, QUERY_SAMPLE } from '#tests/config/eslint/fragments.ts';

test('TanStack Query reports a void query function and the mutation callback order', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...QUERY_FILES,
        'gspot.toml': settingsText(['typescript', 'tanstack-query'], {
            level: level,
        }),
        'src/query.ts': QUERY_SAMPLE,
    });
    const eslint = await createEslint(sandbox.path);
    const rules = ['@tanstack/query/no-void-query-fn', '@tanstack/query/mutation-property-order'];
    const files = ['src/query.ts', 'src/neighbor.ts'];
    expect(await lintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: 'src/query.ts', rule: '@tanstack/query/no-void-query-fn', line: 2 },
        { file: 'src/query.ts', rule: '@tanstack/query/mutation-property-order', line: 3 },
    ]);
    await Bun.write(`${sandbox.path}/src/query.ts`, QUERY_FIXED);
    expect(await lintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});
