import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

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
