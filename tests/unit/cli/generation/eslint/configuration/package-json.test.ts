import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test('every package.json gets the package-json rules and no code rules, also beside a test runner', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"\nconfigurations = ["typescript", "vitest"]\n[rules]\nenabled = false\n`,
        'package.json':
            '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
        'tests/package.json':
            '{"name":"test-tests","version":"1.0.0","private":true,"dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
    });
    const eslint = await createEslint(sandbox.path);
    const files = ['package.json', 'tests/package.json'];
    const awaitedConfiguration = await Promise.all(files.map((file) => readEslintConfiguration(eslint, file)));
    const rules = [...new Set(awaitedConfiguration.flatMap((config) => Object.keys(config.rules)))];
    const findings = await lintFindings(eslint, sandbox.path, files, rules);
    expect(findings.filter(({ rule }) => rule === 'package-json/sort-collections')).toStrictEqual([
        { file: 'package.json', rule: 'package-json/sort-collections', line: 1 },
        { file: 'tests/package.json', rule: 'package-json/sort-collections', line: 1 },
    ]);
    expect(findings.filter(({ rule }) => rule?.startsWith('package-json/') !== true)).toStrictEqual([]);
});

test('an ignore of a package-json rule for one file keeps the finding in other files', async () => {
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
[rules]
enabled = false
`,
        'package.json': JSON.stringify({ ...manifest, private: true }),
        'cli/package.json': JSON.stringify(manifest),
        'library/package.json': JSON.stringify(manifest),
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await lintFindings(
            eslint,
            sandbox.path,
            ['cli/package.json', 'library/package.json'],
            ['package-json/require-exports'],
        ),
    ).toStrictEqual([{ file: 'library/package.json', rule: 'package-json/require-exports', line: 1 }]);
});
