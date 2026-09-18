import plugin from '#plugin/plugin.ts';
import { describe, expect, test } from 'bun:test';

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
});
