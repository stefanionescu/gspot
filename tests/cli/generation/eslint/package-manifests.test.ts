// ESLint reads every package.json through the package-json rules. A manifest under a test folder gets no code rule.
import { test, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { createEslint } from '#tests/harness/generated.ts';

test('every package.json gets the package-json rules and no code rule beside a test runner', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"\nconfigurations = ["typescript", "vitest"]\n[agent_rules]\nenabled = false\n`,
        'package.json':
            '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
        'tests/package.json':
            '{"name":"test-tests","version":"1.0.0","private":true,"dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
    });
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(['package.json', 'tests/package.json']);
    const found = results.flatMap((result) =>
        result.messages.map((entry) => ({
            file: toPosix(result.filePath).endsWith('tests/package.json') ? 'tests' : 'root',
            rule: entry.ruleId ?? entry.message,
        })),
    );
    expect(found.filter(({ rule }) => rule === 'package-json/sort-collections')).toStrictEqual([
        { file: 'root', rule: 'package-json/sort-collections' },
        { file: 'tests', rule: 'package-json/sort-collections' },
    ]);
    expect(found.filter((entry) => !entry.rule.startsWith('package-json/'))).toStrictEqual([]);
});
