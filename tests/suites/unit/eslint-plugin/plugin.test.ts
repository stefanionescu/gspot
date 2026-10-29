import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };

test.each(['recommended', 'all'] as const)(
    '%s turns on no-client-env, and only all turns on no-renamed-exports',
    (level) => {
        const linter = new Linter({ configType: 'flat', cwd: '/repo' });
        const config: object[] = [{ ...plugin.configs[level], files: ['**/*.js'] }];
        const renamed = linter.verify('const source = 1;\nexport const publicName = source;', config, {
            filename: '/repo/example.js',
        });
        expect(
            renamed
                .filter(({ ruleId }) => ruleId === 'gspot/no-renamed-exports')
                .map(({ line, column, messageId }) => ({ line, column, messageId })),
        ).toStrictEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'renamed' }]);
        const findings = linter.verify("'use client';\nexport const value = process.env.SECRET;", config, {
            filename: '/repo/example.js',
        });
        expect(findings.filter(({ ruleId }) => ruleId === 'gspot/no-client-env')).toMatchObject([
            { line: 2, column: 22, messageId: 'private' },
        ]);
        const corrected = linter.verify("'use client';\nexport const value = 'public';", config, {
            filename: '/repo/example.js',
        });
        expect(corrected).toStrictEqual([]);
    },
);

test('configs.all lints beside a config that registers the plugin again', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        plugin.configs.all,
        {
            plugins: { gspot: plugin },
            rules: { 'gspot/no-trivial-functions': ['error', { trivialFunctionStatements: 1 }] },
        },
    ];
    const messages = linter.verify("export const value = 'public';", config);
    expect(messages).toStrictEqual([]);
});

test('plugin metadata matches the workspace package', () => {
    expect(plugin.meta).toStrictEqual({ name: pluginPackage.name, version: pluginPackage.version });
});
