import { Linter } from 'eslint';
import plugin from '#plugin/plugin.ts';
import { describe, expect, test } from 'bun:test';

// ESLint types a plugin more loosely than the typed rule modules; the configuration is what a person writes.
function recommendedFor(files: string[]): Linter.Config {
    const config: object = { ...plugin.configs.recommended, files };
    return config;
}

describe('the plugin', () => {
    test('ships twenty-six rules, each with summary, why and fix in its docs', () => {
        const names = Object.keys(plugin.rules);
        expect(names).toHaveLength(26);
        for (const [name, rule] of Object.entries(plugin.rules)) {
            const docs = rule.meta.docs as { summary?: string; why?: string; fix?: string; description?: string };
            expect(docs.summary, name).toBeTruthy();
            expect(docs.why, name).toBeTruthy();
            expect(docs.fix, name).toBeTruthy();
            expect(docs.description).toBe(docs.summary);
        }
    });

    test('configs.recommended turns every rule on except the index-only set, in one line of configuration', () => {
        const { rules } = plugin.configs.recommended;
        expect(Object.keys(rules)).toHaveLength(23);
        expect(rules['gspot/no-reexports']).toBe('error');
        expect(rules['gspot/max-barrel-reexports']).toBeUndefined();
        const linter = new Linter({ configType: 'flat', cwd: '/repo' });
        const messages = linter.verify(
            'function forward(a, b) { return build(a, b); }\nforward(1, 2);\n',
            [recommendedFor(['**/*.js'])],
            { filename: '/repo/src/orders/forward.js' },
        );
        expect(messages.map((entry) => entry.ruleId)).toContain('gspot/no-call-through');
    });
});
