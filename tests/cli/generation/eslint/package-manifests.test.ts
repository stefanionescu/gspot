// ESLint reads every package.json through the package-json rules. A manifest under a test folder gets no code rule.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { toPosix } from '#cli/platform/contracts.ts';
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

test('package rule exceptions retain neighboring violations', async () => {
    await using sandbox = await testdir();
    const manifest = { name: 'example', version: '0.0.0', type: 'module' };
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"
configurations = ["typescript"]
[[ignore]]
check = "javascript/eslint"
rule = "package-json/require-exports"
paths = ["cli/package.json"]
reason = "The command package exposes no module API."
[agent_rules]
enabled = false
`,
        'package.json': JSON.stringify({ ...manifest, private: true }),
        'cli/package.json': JSON.stringify(manifest),
        'library/package.json': JSON.stringify(manifest),
    });
    const eslint = await createEslint(sandbox.path);
    const before = await eslint.lintFiles(['cli/package.json', 'library/package.json']);
    const violations = before.flatMap((result) =>
        result.messages
            .filter((diagnostic) => diagnostic.ruleId === 'package-json/require-exports')
            .map(() => result.filePath),
    );
    expect(violations).toStrictEqual([join(sandbox.path, 'library/package.json')]);
});
