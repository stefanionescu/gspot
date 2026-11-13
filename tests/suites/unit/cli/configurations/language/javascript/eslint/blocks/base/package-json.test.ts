import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { EslintConfiguration } from '#tests/types/setup.ts';

test('the pin rule pins every range of a private package and only the dev dependencies of a published one', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': `${JSON.stringify(
            { name: 'app', private: true, type: 'module', dependencies: { 'left-pad': '^1.3.0' } },
            null,
            4,
        )}\n`,
        'packages/lib/package.json': `${JSON.stringify(
            {
                name: 'lib',
                version: '1.0.0',
                type: 'module',
                dependencies: { 'left-pad': '^1.3.0' },
                devDependencies: { 'right-pad': '^1.0.0' },
            },
            null,
            4,
        )}\n`,
        'source.js': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const findings = await listLintFindings(
        eslint,
        sandbox.path,
        ['package.json', 'packages/lib/package.json'],
        ['package-json/restrict-dependency-ranges'],
    );
    expect(findings).toStrictEqual([
        { file: 'package.json', rule: 'package-json/restrict-dependency-ranges', line: 6 },
        { file: 'packages/lib/package.json', rule: 'package-json/restrict-dependency-ranges', line: 9 },
    ]);
});

test('every package.json gets the package-json rules and no code rules, and only the root names its package manager', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'vitest'], { level: 'all' }),
        'package.json':
            '{"name":"example","version":"1.0.0","private":true,"type":"module","dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
        'tests/package.json':
            '{"name":"test-tests","version":"1.0.0","private":true,"dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const files = ['package.json', 'tests/package.json'];
    const configuration = await Promise.all(
        files.map(async (file) => (await eslint.calculateConfigForFile(file)) as EslintConfiguration),
    );
    const rules = [...new Set(configuration.flatMap((config) => Object.keys(config.rules)))];
    const findings = await listLintFindings(eslint, sandbox.path, files, rules);
    expect(findings.filter(({ rule }) => rule === 'package-json/sort-collections')).toStrictEqual([
        { file: 'package.json', rule: 'package-json/sort-collections', line: 1 },
        { file: 'tests/package.json', rule: 'package-json/sort-collections', line: 1 },
    ]);
    expect(findings.filter(({ rule }) => rule === 'package-json/require-packageManager')).toStrictEqual([
        { file: 'package.json', rule: 'package-json/require-packageManager', line: 1 },
    ]);
    expect(findings.filter(({ rule }) => rule?.startsWith('package-json/') !== true)).toStrictEqual([]);
});

test('a package.json that does not parse leaves the ESLint config whole', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"name":"app","private":true,"type":"module","dependencies":{"left-pad":"^1.3.0"}}\n',
        'packages/x/package.json': '{"name": \n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['package.json'], ['package-json/restrict-dependency-ranges']),
    ).toStrictEqual([{ file: 'package.json', rule: 'package-json/restrict-dependency-ranges', line: 1 }]);
});
