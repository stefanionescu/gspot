import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { typescriptImports } from '#cli/generation/fragments.ts';
import { createEslint, readEslintConfiguration } from '#tests/setup/generate.ts';
import { FRAGMENT_SCOPE_CASES, IMPORT_FRAGMENT_SOURCE } from '#tests/config/eslint/fragments.ts';

test.each([...FRAGMENT_SCOPE_CASES])('$configuration fragment appears once in each selected scope', async (row) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
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
    const first = await readEslintConfiguration(eslint, join('first', row.file));
    const second = await readEslintConfiguration(eslint, join('second', row.file.replace('unit/', 'specs/')));
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

test('fragment imports keep comments, side effects, and type and named imports', () => {
    const parsed = typescriptImports(IMPORT_FRAGMENT_SOURCE);
    expect(parsed.imports).toStrictEqual([
        "// Keep this side-effect explanation.\nimport 'native-side-effect'; // Native trailing explanation.",
        "import type { NativeType } from 'native-types';",
        "import { type OtherType, nativeValue as renamed } from 'native-names';",
    ]);
    expect(parsed.body).toBe(
        `const text = "import shadow from 'a string';";\n// import shadow from 'a comment';\n[{ files: ['**/*.js'], rules: { native: 'error' } }],\n`,
    );
});
