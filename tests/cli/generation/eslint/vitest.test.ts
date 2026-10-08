import { test, expect } from 'bun:test';
import type { ESLint, Linter } from 'eslint';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { APP_JEST } from '#tests/config/cli/generation/eslint/jest.ts';
import { VITEST_FILES } from '#tests/config/cli/generation/eslint/vitest.ts';

async function ruleReports(eslint: ESLint, file: string, rule: string): Promise<Pick<Linter.LintMessage, 'message'>[]> {
    const results = await eslint.lintFiles([file]);
    return results
        .flatMap((result) => result.messages)
        .filter(({ ruleId, fatal }) => ruleId === rule || fatal)
        .map(({ message: text }) => ({ message: text }));
}

test.each(['jest', 'vitest'])('%s closes test support to runtime code in its scope', async (configuration) => {
    const prefix = configuration === 'jest' ? 'app/' : '';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...Object.fromEntries(
            Object.entries(VITEST_FILES).map(([path, content]) => [
                path === 'package.json' ? path : prefix + path,
                content,
            ]),
        ),
        'gspot.toml':
            configuration === 'jest'
                ? APP_JEST
                : buildPolicy(['vitest'], {
                      tables: '[agent_rules]\nenabled = false\n[architecture.roles]\nruntime = ["src/**"]\ntest_harness = "tests/fixtures"\n',
                      level: 'all',
                  }),
    });
    const eslint = await createEslint(sandbox.path);
    expect(await ruleReports(eslint, `${prefix}src/runtime.js`, 'gspot/import-direction')).toMatchObject([
        { message: textContaining('Runtime code imports test code') },
    ]);
});

test('Vitest rules apply without a harness role', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...VITEST_FILES,
        'gspot.toml': buildPolicy(['vitest'], { tables: '[agent_rules]\nenabled = false\n', level: 'all' }),
    });
    const eslint = await createEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('tests/unit/example.test.js')) as Linter.Config;
    expect((config.rules!['vitest/no-focused-tests'] as unknown[])[0]).toBe(2);
});
