import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { FRAGMENT_SCOPE_CASES } from '#tests/config/eslint/fragments.ts';
import { createEslint, readEslintConfiguration } from '#tests/setup/generate.ts';

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

test('generated TypeScript fragments keep their imports before their rule blocks', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['javascript', 'typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'source.ts': 'export const value = 1;\n',
    });
    const output = emitAll(await openSession(sandbox.path));
    const content = output.files.find((file) => file.path.endsWith('/eslint.config.mjs'))!.content;
    expect(content.match(/import tseslint from 'typescript-eslint';/gu)).toHaveLength(1);
    expect(content).toContain("import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';");
    expect(content.indexOf("import tseslint from 'typescript-eslint';")).toBeLessThan(
        content.indexOf('tseslint.plugin'),
    );
});
