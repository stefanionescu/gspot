import { expect, test } from 'bun:test';
import { Linter } from 'eslint';

import plugin from '#eslint-plugin/plugin.ts';

test('the recommended preset reports the rules of its level, and the all preset adds the others', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const source =
        "'use client';\nfunction readKey() {\n    return process.env.SECRET_KEY;\n}\nexport const key = readKey();\n";
    const options = { filename: '/repo/app/page.js' };
    const recommended: object[] = [plugin.configs.recommended];
    expect(linter.verify(source, recommended, options).map(({ ruleId }) => ruleId)).toStrictEqual([
        'gspot/no-client-environment',
    ]);
    const all: object[] = [plugin.configs.all];
    expect(linter.verify(source, all, options).map(({ ruleId }) => ruleId)).toStrictEqual([
        'gspot/no-trivial-functions',
        'gspot/no-client-environment',
    ]);
});

test('a config that registers the plugin again lowers a limit of configs.all', () => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        plugin.configs.all,
        {
            plugins: { gspot: plugin },
            rules: { 'gspot/no-trivial-functions': ['error', { trivialFunctionStatements: 1 }] },
        },
    ];
    const messages = linter.verify('function work() {\n    first();\n    second();\n}\nwork();\n', config);
    expect(messages).toStrictEqual([]);
});
