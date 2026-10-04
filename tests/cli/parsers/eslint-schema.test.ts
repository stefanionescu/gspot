import { test, expect } from 'bun:test';
import { captureEslintPreset } from '#cli/parsers/schema/eslint.ts';

test('preset capture retains ordered options, file intersections, ignores, and the exact public export', () => {
    const preset = captureEslintPreset('example-plugin', '1.2.3', 'configs.flat/recommended', {
        configs: {
            'flat/recommended': [
                {
                    languageOptions: { parser: {} },
                    plugins: { example: {} },
                    files: [['src/**', '**/*.ts']],
                    ignores: ['src/generated/**'],
                    basePath: 'app',
                    rules: { 'example/required': ['warn', { mode: 'strict', maximum: 8 }] },
                },
                { rules: { 'example/required': ['error', { mode: 'strict', maximum: 5 }] } },
            ],
        },
    });
    expect(preset).toStrictEqual({
        package: 'example-plugin',
        version: '1.2.3',
        source: 'configs.flat/recommended',
        blocks: [
            {
                parser: true,
                files: [['src/**', '**/*.ts']],
                ignores: ['src/generated/**'],
                basePath: 'app',
                rules: { 'example/required': ['warn', { mode: 'strict', maximum: 8 }] },
            },
            { parser: false, rules: { 'example/required': ['error', { mode: 'strict', maximum: 5 }] } },
        ],
    });
});

test('preset capture refuses a missing public export and non-configuration blocks', () => {
    expect(() => captureEslintPreset('example-plugin', '1.2.3', 'configs.missing', {})).toThrow(
        'example-plugin has no preset export configs.missing',
    );
    expect(() =>
        captureEslintPreset('example-plugin', '1.2.3', 'configs.recommended', { configs: { recommended: [false] } }),
    ).toThrow('example-plugin preset configs.recommended must contain configuration objects');
});
