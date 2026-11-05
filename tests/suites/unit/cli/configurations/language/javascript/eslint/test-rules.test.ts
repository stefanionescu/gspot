import { expect, test } from 'bun:test';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the test rules read a focused test as no skip, and an assertion in a suite as no hook', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module","devDependencies":{"vitest":"4.0.0"}}',
        'cart.test.js': 'describe("cart", () => {\n    expect(total).toBe(1);\n    it.only("adds", run);\n});\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['gspot/no-unexplained-test-skips', 'gspot/test-hooks-first'];
    expect(await listLintFindings(eslint, sandbox.path, ['cart.test.js'], rules)).toStrictEqual([]);
});

test('a test file may hold template text, and a function named for its action returns a boolean', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'steps.test.js': 'export const step = "run: echo ${{ github.sha }}";\n',
        'steps.js':
            'export const step = "run: echo ${{ github.sha }}";\nexport function kill() { return true; }\nexport const ready = true;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['no-template-curly-in-string', 'unicorn/consistent-boolean-name'];
    expect(await listLintFindings(eslint, sandbox.path, ['steps.test.js', 'steps.js'], rules)).toStrictEqual([
        { file: 'steps.js', rule: 'no-template-curly-in-string', line: 1 },
        { file: 'steps.js', rule: 'unicorn/consistent-boolean-name', line: 3 },
    ]);
});
