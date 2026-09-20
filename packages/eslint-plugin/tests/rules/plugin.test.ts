import { Linter } from 'eslint';
import plugin from '#plugin/plugin.ts';
import { describe, expect, test } from 'bun:test';

// ESLint types a plugin more loosely than the typed rule modules; the configuration is what a person writes.
function recommendedFor(files: string[]): Linter.Config {
    const config: object = { ...plugin.configs.recommended, files };
    return config;
}

describe('the plugin', () => {
    test('the recommended configuration reports a forwarding function', () => {
        const linter = new Linter({ configType: 'flat', cwd: '/repo' });
        const messages = linter.verify(
            'function forward(a, b) { return build(a, b); }\nforward(1, 2);\n',
            [recommendedFor(['**/*.js'])],
            { filename: '/repo/src/orders/forward.js' },
        );
        expect(messages.map((entry) => entry.ruleId)).toContain('gspot/no-call-through');
    });
});
