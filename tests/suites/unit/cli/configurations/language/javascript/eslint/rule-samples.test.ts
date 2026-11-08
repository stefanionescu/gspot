import { expect, test } from 'bun:test';

import { LEVELS } from '#cli/config/manifests.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([...LEVELS])('%s lints a JavaScript class, which the default parser gives no decorators', async (level) => {
    const rules = ['gspot/no-trivial-functions', 'gspot/no-vue-class-components'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module"}',
        'clock.js': 'export class Clock {\n    read() {\n        return 1;\n    }\n}\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['clock.js'], rules)).toStrictEqual(
        level === 'all' ? [{ file: 'clock.js', rule: 'gspot/no-trivial-functions', line: 2 }] : [],
    );
});

test.each(ESLINT_LEVEL_CASES)('%s reports label targets and while-loop candidates in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`label.${extension}`]: 'outer: { run(); }',
        [`loop.${extension}`]: 'for (; ready; ) run();',
        [`allowed.${extension}`]:
            'outer: while (ready) run(); doLoop: do { run(); } while (ready); forLoop: for (let i = 0; ready; i++) run(); inLoop: for (const key in value) run(); ofLoop: for (const item of values) run(); switchLabel: switch (value) { case 1: run(); } for (;;) break; for (let i = 0; ready;) run(); for (;ready;i++) run();',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['label', 'loop', 'allowed'].map((name) => `${name}.${extension}`);
    const rules = ['gspot/restricted-syntax'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `label.${extension}`, rule: 'gspot/restricted-syntax', line: 1 },
        ...(level === 'all' ? [{ file: `loop.${extension}`, rule: 'gspot/restricted-syntax', line: 1 }] : []),
    ]);
});

test('level all keeps an if-else helper, whose ternary form gspot/no-trivial-functions reports', async () => {
    const rules = ['gspot/no-trivial-functions', 'unicorn/prefer-ternary'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'branch.js':
            "function countLabel(count) {\n    if (count === 1) return 'one item';\n    else return 'many items';\n}\nexport const label = countLabel(2);\n",
        'ternary.js':
            "function countLabel(count) {\n    return count === 1 ? 'one item' : 'many items';\n}\nexport const label = countLabel(2);\n",
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['branch.js', 'ternary.js'], rules)).toStrictEqual([
        { file: 'ternary.js', rule: 'gspot/no-trivial-functions', line: 1 },
    ]);
});
