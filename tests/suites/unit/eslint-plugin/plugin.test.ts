import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';

test('the recommended preset reports the rules of its level, and the all preset adds the others', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const source = "'use client';\nexport function readKey() {\n    return process.env.SECRET_KEY;\n}\n";
    const options = { filename: '/repo/app/page.js' };
    const recommended: object[] = [plugin.configs.recommended];
    expect(linter.verify(source, recommended, options).map(({ ruleId }) => ruleId)).toStrictEqual([
        'gspot/no-client-env',
    ]);
    const all: object[] = [plugin.configs.all];
    expect(linter.verify(source, all, options).map(({ ruleId }) => ruleId)).toStrictEqual([
        'gspot/no-trivial-functions',
        'gspot/no-client-env',
    ]);
});

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
