import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';

test.each(['recommended', 'all'] as const)('%s applies its alias level and enforces private client access', (level) => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [{ ...plugin.configs[level], files: ['**/*.js'] }];
    const alias = linter.verify('const source = 1;\nexport const publicName = source;', config, {
        filename: '/repo/example.js',
    });
    expect(
        alias
            .filter(({ ruleId }) => ruleId === 'gspot/no-alias-exports')
            .map(({ line, column, messageId }) => ({ line, column, messageId: messageId })),
    ).toStrictEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'alias' }]);
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
});

test('all shares plugin identity with explicit rules', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        plugin.configs.all,
        { plugins: { gspot: plugin }, rules: { 'gspot/no-trivial-functions': ['error', { trivialStatements: 1 }] } },
    ];
    const messages = linter.verify("export const value = 'public';", config);
    expect(messages).toStrictEqual([]);
});

test('schema placement remains opt-in', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [plugin.configs.all];
    const messages = linter.verify('import { z } from "zod"; export const schema = z.string();', config, {
        filename: '/repo/src/parsers/name.js',
    });
    expect(messages).toStrictEqual([]);
});

test('schema placement resolves configured folders from the ESLint working directory', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        {
            plugins: { gspot: plugin },
            rules: { 'gspot/schema-location': ['error', { folders: ['src/schemas'] }] },
        },
    ];
    const source = 'import { z } from "zod"; export const schema = z.string();';
    expect(linter.verify(source, config, { filename: '/repo/src/schemas/name.js' })).toStrictEqual([]);
    const messages = linter.verify(source, config, { filename: '/repo/src/parsers/name.js' });
    expect(messages).toMatchObject([{ ruleId: 'gspot/schema-location', messageId: 'location' }]);
});
