import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noBitwiseInCondition } from '#eslint-plugin/rules/logic/no-bitwise-in-condition.ts';

buildRuleTester().run('no-bitwise-in-condition', noBitwiseInCondition, {
    valid: [
        'const both = isReady & hasData;',
        'if (isReady | hasData) run(); const shifted = flags << 1;',
        'if (flags & 4) run();',
        'const value = isReady ? (isReady & hasData) : 1;',
    ],
    invalid: [{ code: 'if (isReady & hasData) run();', errors: [{ messageId: 'bitwise', data: { operator: '&' } }] }],
});

buildTypedRuleTester().run('no-bitwise-in-condition with types', noBitwiseInCondition, {
    valid: ['declare const flags: number, mask: number; if (flags & mask) run();'],
    invalid: [
        {
            code: 'declare const isReady: boolean, hasData: boolean; if (isReady & hasData) run();',
            errors: [{ messageId: 'bitwise' }],
        },
    ],
});
