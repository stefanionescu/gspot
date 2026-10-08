import { Linter } from 'eslint';
import plugin from '#plugin/plugin.ts';
import { test, expect, describe } from 'bun:test';
import { readAsset } from '#cli/platform/assets.ts';
import packageManifest from '#plugin-package' with { type: 'json' };
import { ENVIRONMENT_GLOBALS } from '#tests/config/plugin/environment.ts';
import { captureEslintPreset, eslintPresetsSchema } from '#cli/parsers/schema/eslint.ts';

test('the shipped recommended preset agrees with the plugin', () => {
    const presets = eslintPresetsSchema.parse(
        JSON.parse(readAsset('configurations/language/javascript/eslint-presets.json')),
    );
    expect(presets['gspot']).toStrictEqual(
        captureEslintPreset(packageManifest.name, packageManifest.version, 'configs.recommended', plugin),
    );
});

describe('the plugin', () => {
    test.each(['recommended', 'all'] as const)('%s applies its trivial-function rule', (level) => {
        const linter = new Linter({ configType: 'flat', cwd: '/repo' });
        const config: object = { ...plugin.configs[level], files: ['**/*.js'] };
        const messages = linter.verify('function forward(a, b) { return build(a, b); }\nforward(1, 2);\n', [config], {
            filename: '/repo/src/orders/forward.js',
        });
        const findings = messages.filter((entry) => entry.ruleId === 'gspot/no-trivial-functions');
        expect(
            findings.map((entry) => ({
                ruleId: entry.ruleId,
                messageId: entry.messageId,
                line: entry.line,
                column: entry.column,
            })),
        ).toStrictEqual(
            level === 'all' ? [{ ruleId: 'gspot/no-trivial-functions', messageId: 'trivial', line: 1, column: 1 }] : [],
        );
    });
});

test.each(['recommended', 'all'] as const)('%s applies its alias level and enforces private client access', (level) => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        { ...plugin.configs[level], files: ['**/*.js'], languageOptions: { globals: ENVIRONMENT_GLOBALS } },
    ];
    const alias = linter.verify('const source = 1;\nexport const publicName = source;', config, {
        filename: '/repo/example.js',
    });
    expect(
        alias
            .filter(({ ruleId }) => ruleId === 'gspot/no-alias-exports')
            .map(({ line, column, messageId: diagnosticId }) => ({ line, column, messageId: diagnosticId })),
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

test.each(['recommended', 'all'] as const)('%s shares plugin identity with explicit rules', (level) => {
    const linter = new Linter({ configType: 'flat', cwd: '/repo' });
    const config: object[] = [
        plugin.configs[level],
        { plugins: { gspot: plugin }, rules: { 'gspot/no-trivial-functions': ['error', { maxStatements: 1 }] } },
    ];
    const messages = linter.verify("export const value = 'public';", config);
    expect(messages).toStrictEqual([]);
});
