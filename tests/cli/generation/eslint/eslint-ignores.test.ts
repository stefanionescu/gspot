// The ESLint configuration gspot generates, loaded directly: explicit ignores apply after rule settings, and overrides
// keep their order, their scope bounds, and their reach to files added later.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { ESLINT_OVERRIDE_POLICY } from '#tests/config/samples/javascript.ts';

test('generated ESLint applies explicit ignores after native rule options', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['javascript'], {
        level: 'all',
        tables: '[agent_rules]\nenabled = false\n[tools.eslint.rules]\n"no-console" = [{allow = ["warn"]}]\n',
    });
    await createFileTree(directory.path, {
        'gspot.toml': policy,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': 'console.log("example");\n',
    });
    for (const ignored of [false, true]) {
        await writeFile(
            join(directory.path, 'gspot.toml'),
            policy +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "This fixture accepts the native console finding."\n'
                    : ''),
        );
        const eslint = await createEslint(directory.path);
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
    for (const ignored of [false, true]) {
        await writeFile(
            join(directory.path, 'gspot.toml'),
            ESLINT_OVERRIDE_POLICY +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "eqeqeq"\npaths = ["tests"]\nreason = "These authored tests intentionally exercise native equality."\n'
                    : ''),
        );
        const eslint = await createEslint(directory.path);
        await writeFile(join(directory.path, 'tests/future.js'), source);
        const results = await eslint.lintFiles(['source.js', 'tests', 'apps']);
        await unlink(join(directory.path, 'tests/future.js'));
        const output = results.flatMap(({ filePath, messages }) =>
            messages
                .filter(({ ruleId }) => ruleId === 'eqeqeq')
                .map(({ severity, line, column }) => ({
                    file: filePath.slice(directory.path.length + 1).replaceAll('\\', '/'),
                    severity,
                    line,
                    column,
                })),
        );
        const expected: typeof output = [
            { file: 'apps/web/admin/page.js', severity: 2, line: 1, column: 41 },
            { file: 'apps/web/exempt.js', severity: 2, line: 1, column: 41 },
        ];
        if (!ignored)
            expected.push(
                { file: 'tests/future.js', severity: 2, line: 1, column: 41 },
                { file: 'tests/unit.js', severity: 2, line: 1, column: 41 },
            );
        expect(output.toSorted((a, b) => a.file.localeCompare(b.file))).toStrictEqual(expected);
    }
});
