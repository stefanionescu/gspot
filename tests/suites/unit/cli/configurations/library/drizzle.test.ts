import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { DRIZZLE_SCOPE_SETTINGS } from '#tests/config/configurations/javascript/blocks.ts';

test('Drizzle reports delete and update without where only for its client names', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['drizzle'], DRIZZLE_SCOPE_SETTINGS),
        'source.js':
            'db.delete(table);\nother.delete(table);\nnew Map().delete(key);\nnew Set().delete(key);\nnew Headers().delete("header");\nnew URLSearchParams().delete("query");\n',
        'app/source.js': 'connection.update(table).set({ value: 1 });\nother.update(table).set({ value: 1 });\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const rules = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'];
    expect(await listLintFindings(eslint, sandbox.path, ['source.js', 'app/source.js'], rules)).toStrictEqual([
        { file: 'app/source.js', rule: 'drizzle/enforce-update-with-where', line: 1 },
        { file: 'source.js', rule: 'drizzle/enforce-delete-with-where', line: 1 },
    ]);
});
