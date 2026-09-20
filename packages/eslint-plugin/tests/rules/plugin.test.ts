import { Linter } from 'eslint';
import plugin from '#plugin/plugin.ts';
import { describe, expect, test } from 'bun:test';

describe('the plugin', () => {
    test.each(['recommended', 'all'] as const)('%s applies its forwarding-function preference', (level) => {
        const linter = new Linter({ configType: 'flat', cwd: '/repo' });
        const config: object = { ...plugin.configs[level], files: ['**/*.js'] };
        const messages = linter.verify('function forward(a, b) { return build(a, b); }\nforward(1, 2);\n', [config], {
            filename: '/repo/src/orders/forward.js',
        });
        const findings = messages.filter((entry) => entry.ruleId === 'gspot/no-call-through');
        if (level === 'recommended') expect(findings).toEqual([]);
        else
            expect(
                findings.map((entry) => ({
                    ruleId: entry.ruleId,
                    messageId: entry.messageId,
                    line: entry.line,
                    column: entry.column,
                })),
            ).toEqual([{ ruleId: 'gspot/no-call-through', messageId: 'callThrough', line: 1, column: 1 }]);
    });

    test('recommended reports private environment access in a client module', () => {
        const linter = new Linter({ configType: 'flat', cwd: '/repo' });
        const config: object = { ...plugin.configs.recommended, files: ['**/*.js'] };
        const messages = linter.verify("'use client';\nconst key = process.env.SECRET;\n", [config], {
            filename: '/repo/src/orders/client.js',
        });
        expect(
            messages
                .filter((entry) => entry.ruleId === 'gspot/no-client-environment')
                .map((entry) => ({
                    ruleId: entry.ruleId,
                    messageId: entry.messageId,
                    line: entry.line,
                    column: entry.column,
                })),
        ).toEqual([{ ruleId: 'gspot/no-client-environment', messageId: 'private', line: 2, column: 13 }]);
    });
});
