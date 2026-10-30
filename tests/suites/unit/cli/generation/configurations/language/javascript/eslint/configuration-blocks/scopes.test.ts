import { join } from 'node:path';
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { createEslint } from '#tests/setup/eslint/lint.ts';
import type { EslintConfiguration } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';

import {
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
        pathToFileURL(join(sandbox.path, getConfigFilePath(session, 'eslint'))).href
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

test('nestjs rules apply in each scope that selects it', async () => {
    await using sandbox = await testdir();
    const rule = '@darraghor/nestjs-typed/injectable-should-be-provided';
    const source =
        "import { Injectable } from '@nestjs/common';\n@Injectable()\nexport class CounterService { count = 1; }\n";
    const paths = ['first/src/service.ts', 'second/src/service.ts'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[[scope]]\npath = "first"\nconfigurations = ["nestjs"]\n[[scope]]\npath = "second"\nconfigurations = ["nestjs"]\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'first/package.json': '{"private":true,"type":"module"}',
        'second/package.json': '{"private":true,"type":"module"}',
        'first/tsconfig.json': '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
        'second/tsconfig.json': '{"compilerOptions":{"strict":true,"experimentalDecorators":true},"include":["src"]}',
        [paths[0]!]: source,
        [paths[1]!]: source,
    });
    const eslint = await createEslint(sandbox.path);
    const lint = await eslint.lintFiles(paths);
    expect(lint.flatMap(({ messages }) => messages).filter(({ ruleId }) => ruleId === rule)).toHaveLength(2);
});
