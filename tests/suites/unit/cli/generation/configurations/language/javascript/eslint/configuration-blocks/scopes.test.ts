import { join } from 'node:path';
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { createEslint } from '#tests/setup/eslint/lint.ts';
import type { EslintConfiguration } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findConfigFilePath } from '#tests/setup/cli/generated-files.ts';

import {
    BLOCK_SCOPE_CASES,
    MATCHING_SCOPE_FILES,
    MATCHING_SCOPE_SETTINGS,
} from '#tests/config/generation/configurations/language/javascript/eslint/configuration-blocks/scopes.ts';

test("a nested scope whose configuration blocks match its parent's gets no copy, and the parent block covers it", async () => {
    await using sandbox = await testdir({
        ...MATCHING_SCOPE_FILES,
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: MATCHING_SCOPE_SETTINGS }),
    });

    const eslint = await createEslint(sandbox.path);
    const session = await openSession(sandbox.path);
    const generated: unknown = await import(
        pathToFileURL(join(sandbox.path, findConfigFilePath(session, 'eslint'))).href
    );
    const { default: blocks } = generated as { default: Linter.Config[] };
    const tests = blocks.filter((block) => block.rules?.['@typescript-eslint/no-non-null-assertion'] === 'off');
    expect(tests).toHaveLength(2);
    const same = (await eslint.calculateConfigForFile('same/sample.test.ts')) as EslintConfiguration;
    const different = (await eslint.calculateConfigForFile('different/custom/sample.ts')) as EslintConfiguration;
    const code = (await eslint.calculateConfigForFile('different/src/sample.ts')) as EslintConfiguration;
    expect(same.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(different.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(code.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(2);
});

test.each([...BLOCK_SCOPE_CASES])('$configuration rules apply in each scope that selects it', async (row) => {
    await using sandbox = await testdir();
    const secondPath = join('second', row.file.replace('unit/', 'specs/'));
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: `[[scope]]\npath = "first"\nconfigurations = ["${row.configuration}"]\ntest_files = ["first/unit/**"]\n[[scope]]\npath = "second"\nconfigurations = ["${row.configuration}"]\ntest_files = ["second/specs/**"]\n`,
        }),
        'package.json': '{"private":true,"type":"module"}',
        'first/package.json': '{"private":true,"type":"module"}',
        'second/package.json': '{"private":true,"type":"module"}',
        'first/tsconfig.json': '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
        'second/tsconfig.json': '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
        [join('first', row.file)]: row.source,
        [secondPath]: row.source,
    });
    const eslint = await createEslint(sandbox.path);
    const first = (await eslint.calculateConfigForFile(join('first', row.file))) as EslintConfiguration;
    const second = (await eslint.calculateConfigForFile(secondPath)) as EslintConfiguration;
    expect(first.rules[row.rule]?.[0]).toBe(2);
    expect(second.rules[row.rule]?.[0]).toBe(2);
    const lint = await eslint.lintFiles([join('first', row.file), secondPath]);
    expect(lint.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === row.rule)).toHaveLength(2);
});
