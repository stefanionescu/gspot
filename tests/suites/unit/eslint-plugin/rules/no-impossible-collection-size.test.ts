import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-impossible-collection-size', plugin.rules['no-impossible-collection-size'], {
    valid: [
        'items.length === 0;',
        'items.length > 0;',
        'items.size <= 0;',
        'items.count < 0;',
        'items.length < 1;',
        '0 > items.length;',
        'items["length"] < 0;',
        'items.length < zero;',
    ],
    invalid: [
        { code: 'items.length < 0;', errors: [{ messageId: 'comparison' }] },
        { code: 'items.length >= 0;', errors: [{ messageId: 'comparison' }] },
        { code: 'items.size < 0;', errors: [{ messageId: 'comparison' }] },
        { code: 'items.size >= 0;', errors: [{ messageId: 'comparison' }] },
        { code: 'items[length] < 0;', errors: [{ messageId: 'comparison' }] },
        { code: 'class Items { ready() { return this.length >= 0; } }', errors: [{ messageId: 'comparison' }] },
    ],
});
