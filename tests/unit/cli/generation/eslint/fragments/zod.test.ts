import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test('Zod reports z.any() and keeps its schema rules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'level = "all"\nconfigurations = ["zod"]\n',
        'package.json': JSON.stringify({ private: true, dependencies: { zod: '4.6.2' } }),
        'source.js': 'import { z } from "zod";\nexport const schema = z.object({ value: z.any() });\n',
    });
    const eslint = await createEslint(sandbox.path);
    const computed = await readEslintConfiguration(eslint, 'source.js');
    expect(computed.rules['zod/no-any-schema']![0]).toBe(2);
    expect(computed.rules['zod/prefer-strict-object']![0]).toBe(2);
    expect(await lintFindings(eslint, sandbox.path, ['source.js'], ['zod/no-any-schema'])).toStrictEqual([
        { file: 'source.js', rule: 'zod/no-any-schema', line: 2 },
    ]);
});
