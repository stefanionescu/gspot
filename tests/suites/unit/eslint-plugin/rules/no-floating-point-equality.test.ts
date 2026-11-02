import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-floating-point-equality', plugin.rules['no-floating-point-equality'], {
    valid: [
        'expect(total).not.toEqual(0.3);',
        'assert.strictEqual(total, 0.3);',
        'if (total === 0.5) pay();',
        'if (total === 4 / 2) pay();',
        'if (total === 1e3) pay();',
        'if (total === 1 / 4) pay();',
        'if (total / 3 === 1) pay();',
        'if (total < 0.1) pay();',
        'expect(total).toBe(0.5);',
        'if (total === 0.5 / 2) pay();',
        'let limit = 0.1; if (total === limit) pay();',
        'for (const limit of limits) if (total === limit) pay();',
        'if (order.total === 0) pay();',
        'expect(total).toContain(0.3);',
        'matcher.equal(total, 0.3);',
        'check(total).toBe(0.3);',
        'const rate = total ?? 0.1;',
        'if (total <= 0.1 && ready) pay();',
        'switch (total) { case 1: pay(); break; default: stop(); }',
    ],
    invalid: [
        { code: 'if (total === 0.1) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (0.1 + 0.2 === total) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total !== 1 / 3) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total === -1 / 3) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total === (2 * 5) / 3) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'const LIMIT = 0.3; if (total == LIMIT) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total <= 0.1 && total >= 0.1) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'switch (total) { case 0.1: pay(); }', errors: [{ messageId: 'equality' }] },
        { code: 'if (total === -1e-3) pay();', errors: [{ messageId: 'equality' }] },
    ],
});
