import { join } from 'node:path';
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

test.each(['recommended', 'all'] as const)(
    '%s keeps scoped framework rules and syntax selectors inside their project',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                tables: '[[scope]]\npath = "app"\nconfigurations = ["react", "drizzle"]\n',
                level: level,
            }),
            'package.json': '{"private":true,"type":"module"}',
            'root.jsx': '',
            'app/client.jsx': '',
        });
        const eslint = await createEslint(sandbox.path);
        const outside = (await eslint.calculateConfigForFile(join(sandbox.path, 'root.jsx'))) as Linter.Config;
        const inside = (await eslint.calculateConfigForFile(join(sandbox.path, 'app/client.jsx'))) as Linter.Config;
        expect(outside.rules?.['react/jsx-key']).toBeUndefined();
        expect((inside.rules?.['react/jsx-key'] as unknown[])[0]).toBe(2);
        const raw = 'export const query = sql`select 1`;';
        const insideResults = await eslint.lintText(raw, { filePath: 'app/client.jsx' });
        const messages = insideResults.flatMap((file) => file.messages);
        expect(messages.some((finding) => finding.ruleId === 'no-restricted-syntax')).toBe(level === 'all');
        const outsideResults = await eslint.lintText(raw, { filePath: 'root.jsx' });
        expect(
            outsideResults
                .flatMap((file) => file.messages)
                .filter((finding) => finding.ruleId === 'no-restricted-syntax'),
        ).toStrictEqual([]);
    },
);

test('all retains the effective recommended rules for the same applicable React file', async () => {
    const rules: Record<string, Record<string, unknown>> = {};
    for (const level of ['recommended', 'all'] as const) {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['react'], { level: level }),
            'package.json': '{"private":true,"type":"module"}',
            'client.jsx': '',
        });
        const eslint = await createEslint(sandbox.path);
        const config = (await eslint.calculateConfigForFile('client.jsx')) as Linter.Config;
        rules[level] = config.rules!;
    }
    const active = Object.entries(rules['recommended']!).filter(([, value]) => Array.isArray(value) && value[0] !== 0);
    expect(active.map(([name]) => name)).toContain('react/jsx-key');
    for (const [name] of active) expect((rules['all']![name] as unknown[])[0], name).not.toBe(0);
});

test('all keeps native deferred-comment checks after prose stops treating todo as a promise', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'source.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const defect = await eslint.lintText('// TODO: finish the feature.\nexport const feature = 1;\n', {
        filePath: 'source.js',
    });
    expect(
        defect
            .flatMap(({ messages }) => messages)
            .flatMap(({ ruleId, line, severity }) =>
                ruleId === 'sonarjs/todo-tag' || ruleId === 'unicorn/expiring-todo-comments'
                    ? [{ ruleId, line, severity }]
                    : [],
            )
            .toSorted((left, right) => left.ruleId.localeCompare(right.ruleId)),
    ).toStrictEqual([
        { ruleId: 'sonarjs/todo-tag', line: 1, severity: 2 },
        { ruleId: 'unicorn/expiring-todo-comments', line: 1, severity: 2 },
    ]);
    const corrected = await eslint.lintText('// The feature lists tasks.\nexport const feature = 1;\n', {
        filePath: 'source.js',
    });
    expect(
        corrected
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ['sonarjs/todo-tag', 'unicorn/expiring-todo-comments'].includes(ruleId ?? '')),
    ).toStrictEqual([]);
});

test.each(['recommended', 'all'] as const)(
    '%s preserves generated script and test exclusions while applying native options',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], {
                level,
                tables: '[tools.eslint.rules]\n"n/no-process-exit" = []\n"jsdoc/require-description" = []\n"gspot/no-trivial-functions" = [{maxStatements = 4}]\n"gspot/instances-in-registry" = [{files = ["source.js"]}]\n',
            }),
            'package.json': '{"private":true,"type":"module"}',
            'source.js': 'export const source = new Client();',
            'another.js': 'export const source = new Client();',
            'scripts/run.js': '',
            'tests/example.test.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        const source = (await eslint.calculateConfigForFile('source.js')) as Linter.Config;
        const script = (await eslint.calculateConfigForFile('scripts/run.js')) as Linter.Config;
        const test = (await eslint.calculateConfigForFile('tests/example.test.js')) as Linter.Config;
        expect((source.rules!['n/no-process-exit'] as unknown[])[0]).toBe(level === 'all' ? 2 : 0);
        expect(source.rules!['gspot/instances-in-registry']).toStrictEqual(
            level === 'all' ? [2, { files: ['source.js'] }] : undefined,
        );
        expect((script.rules!['n/no-process-exit'] as unknown[])[0]).toBe(0);
        expect((test.rules!['jsdoc/require-description'] as unknown[])[0]).toBe(0);
        expect((source.rules!['gspot/no-trivial-functions'] as unknown[])[0]).toBe(level === 'all' ? 2 : 0);
        if (level === 'all')
            expect(source.rules!['gspot/no-trivial-functions']).toStrictEqual([2, { maxStatements: 4 }]);
        const results = await eslint.lintFiles(['source.js', 'another.js']);
        const findings = results
            .flatMap(({ messages }) => messages)
            .filter(({ ruleId }) => ruleId === 'gspot/instances-in-registry');
        expect(findings.map(({ messageId: diagnosticId }) => diagnosticId)).toStrictEqual(
            level === 'all' ? ['registry'] : [],
        );
    },
);
