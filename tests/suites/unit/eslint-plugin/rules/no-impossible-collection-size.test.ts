import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-impossible-collection-size', plugin.rules['no-impossible-collection-size'], {
    valid: [
        'items.length === 0;',
        'items.count < 0;',
        'items.length < 1;',
        'items["length"] < 0;',
        'items.length < zero;',
    ],
    invalid: [
        { code: 'items.length < 0;', errors: [{ messageId: 'comparison' }] },
        { code: 'items.length >= 0;', errors: [{ messageId: 'comparison' }] },
    ],
});

buildTypedRuleTester().run('no-impossible-collection-size', plugin.rules['no-impossible-collection-size'], {
    valid: ['declare const box: { size: number }; const isEmpty = box.size < 0;'],
    invalid: [
        {
            code: 'declare const names: Set<string>; const isEmpty = names.size < 0;',
            errors: [{ messageId: 'comparison' }],
        },
    ],
});
