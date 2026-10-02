// The ESLint configuration gspot generates, loaded directly: explicit ignores apply after rule settings, and overrides
// keep their order, their scope bounds, and their reach to files added later.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { generatedEslint } from '#tests/harness/cli/generated.ts';
import { ESLINT_OVERRIDE_POLICY } from '#tests/samples/javascript.ts';

test('generated ESLint applies explicit ignores after enabled rule settings', async () => {
    await using directory = await testdir();
    const policy = policyOf(
        ['javascript'],
        '[guides]\ninstall = false\n[tools.eslint.rules]\n"no-console" = "error"\n',
    );
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': 'console.log("example");\n',
    });
    for (const ignored of [false, true, false]) {
        writeFileSync(
            join(directory.path, 'gspot.toml'),
            policy + (ignored ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\n' : ''),
        );
        const eslint = await generatedEslint(directory.path);
        const results = await eslint.lintFiles(['source.js']);
        expect(
            results
                .flatMap(({ messages }) => messages)
                .filter(({ ruleId }) => ruleId === 'no-console')
                .map(({ ruleId, line, column }) => ({ ruleId, line, column })),
        ).toStrictEqual(ignored ? [] : [{ ruleId: 'no-console', line: 1, column: 1 }]);
    }
});

test('ESLint overrides preserve order, nested scope bounds, future files, and path-specific ignores', async () => {
    await using directory = await testdir();
    const source = 'export const matches = (value) => value == null;\n';
    await createFileTree(directory.path, {
        'gspot.toml': ESLINT_OVERRIDE_POLICY,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': source,
        'tests/unit.js': source,
        'tests/exempt.js': source,
        'apps/web/page.js': source,
        'apps/web/exempt.js': source,
        'apps/web/admin/page.js': source,
    });
    await generatedEslint(directory.path);
    writeFileSync(join(directory.path, 'tests/future.js'), source);
    for (const ignored of [false, true]) {
        writeFileSync(
            join(directory.path, 'gspot.toml'),
            ESLINT_OVERRIDE_POLICY +
                (ignored ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "eqeqeq"\npaths = ["tests"]\n' : ''),
        );
        const eslint = await generatedEslint(directory.path);
        const results = await eslint.lintFiles(['source.js', 'tests', 'apps']);
        const actual = results.flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId }) => ruleId === 'eqeqeq')
                .map(({ severity, line, column }) => ({
                    file: filePath.slice(directory.path.length + 1).replaceAll('\\', '/'),
                    severity,
                    line,
                    column,
                })),
        );
        const expected: typeof actual = [
            { file: 'apps/web/admin/page.js', severity: 2, line: 1, column: 41 },
            { file: 'apps/web/exempt.js', severity: 1, line: 1, column: 41 },
        ];
        if (!ignored)
            expected.push(
                { file: 'tests/future.js', severity: 2, line: 1, column: 41 },
                { file: 'tests/unit.js', severity: 2, line: 1, column: 41 },
            );
        expect(actual.toSorted((a, b) => a.file.localeCompare(b.file))).toStrictEqual(expected);
    }
});
