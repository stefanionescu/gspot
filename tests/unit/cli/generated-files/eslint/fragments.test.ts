import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createEslint } from '#tests/setup/tool-files.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { FRAGMENT_SCOPE_CASES } from '#tests/data/generated-files/eslint/fragments.ts';

test.each([...FRAGMENT_SCOPE_CASES])('$configuration fragment appears once in each selected scope', async (row) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            level: 'all',
            tables: `[[scope]]\npath = "first"\nconfigurations = ["${row.configuration}"]\ntest_files = ["first/unit/**"]\n[[scope]]\npath = "second"\nconfigurations = ["${row.configuration}"]\ntest_files = ["second/specs/**"]\n`,
        }),
        'package.json': '{"private":true,"type":"module"}',
        'first/package.json': '{"private":true,"type":"module"}',
        'second/package.json': '{"private":true,"type":"module"}',
        'first/tsconfig.json': '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
        'second/tsconfig.json': '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
        [join('first', row.file)]: row.source,
        [join('second', row.file.replace('unit/', 'specs/'))]: row.source,
    });
    const eslint = await createEslint(sandbox.path);
    const first = (await eslint.calculateConfigForFile(join('first', row.file))) as EslintConfiguration;
    const second = (await eslint.calculateConfigForFile(
        join('second', row.file.replace('unit/', 'specs/')),
    )) as EslintConfiguration;
    expect(first.rules[row.rule]?.[0]).toBe(2);
    expect(second.rules[row.rule]?.[0]).toBe(2);
    {
        const lint = await eslint.lintFiles([
            join('first', row.file),
            join('second', row.file.replace('unit/', 'specs/')),
        ]);
        expect(lint.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === row.rule)).toHaveLength(2);
    }
});
