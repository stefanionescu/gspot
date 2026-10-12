import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

test('Drizzle reports delete and update without where only for its client names', async () => {
    const level = 'all';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "${level}"\nconfigurations = ["drizzle"]\n[[scope]]\npath = "app"\nconfigurations = ["drizzle"]\n[scope.drizzle]\nclient_names = ["connection"]\n`,
        'source.js':
            'db.delete(table);\nother.delete(table);\nnew Map().delete(key);\nnew Set().delete(key);\nnew Headers().delete("header");\nnew URLSearchParams().delete("query");\n',
        'app/source.js': 'connection.update(table).set({ value: 1 });\nother.update(table).set({ value: 1 });\n',
    });
    const eslint = await createEslint(sandbox.path);
    const rules = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'];
    expect(await lintFindings(eslint, sandbox.path, ['source.js', 'app/source.js'], rules)).toStrictEqual([
        { file: 'app/source.js', rule: 'drizzle/enforce-update-with-where', line: 1 },
        { file: 'source.js', rule: 'drizzle/enforce-delete-with-where', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        'app/source.js': 'connection.update(table).set({ value: 1 }).where(condition);\n',
    });
    expect(await lintFindings(eslint, sandbox.path, ['app/source.js'], rules)).toStrictEqual([]);
});
