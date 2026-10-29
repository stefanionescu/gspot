import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import { ALL_RULES } from '#tests/config/eslint-plugin/plugin.ts';

test('presets enable every rule assigned to their level', () => {
    expect(plugin.configs.recommended.rules).toStrictEqual({ 'gspot/no-client-env': 'error' });
    expect(plugin.configs.all.rules).toStrictEqual(ALL_RULES);
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
