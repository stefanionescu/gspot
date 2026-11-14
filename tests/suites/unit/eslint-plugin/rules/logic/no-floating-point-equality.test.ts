import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noFloatingPointEquality } from '#eslint-plugin/rules/logic/no-floating-point-equality.ts';

buildRuleTester().run('no-floating-point-equality', noFloatingPointEquality, {
    valid: [
        'if (total === 0.5) pay();',
        'if (total === 4 / 2) pay();',
        'if (total === 1 / 4) pay();',
        'if (total / 3 === 1) pay();',
        'if (total < 0.1) pay();',
        'if (total === 0.5 / 2) pay();',
        'if (total === 9e15 / 0.5) pay();',
        'let limit = 0.1; if (total === limit) pay();',
        'for (const limit of limits) if (total === limit) pay();',
        'if (order.total === 0) pay();',
        'if (total <= 0.1 && ready) pay();',
        'switch (total) { case 1: pay(); break; default: stop(); }',
    ],
    invalid: [
        { code: 'if (total === 0.1) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (0.1 + 0.2 === total) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total !== 1 / 3) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total === -1 / 3) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total === 1e20 / 3e10) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'const LIMIT = 0.3; if (total == LIMIT) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'if (total <= 0.1 && total >= 0.1) pay();', errors: [{ messageId: 'equality' }] },
        { code: 'switch (total) { case 0.1: pay(); }', errors: [{ messageId: 'equality' }] },
        { code: 'if (total === -1e-3) pay();', errors: [{ messageId: 'equality' }] },
    ],
});
