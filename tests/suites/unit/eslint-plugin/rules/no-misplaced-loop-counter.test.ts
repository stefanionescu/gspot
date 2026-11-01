import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-misplaced-loop-counter', plugin.rules['no-misplaced-loop-counter'], {
    valid: [
        'for (let index = 0; index < items.length; index++) {}',
        'for (let row = 0, column = 0; row < 9; column++, row++) {}',
        'for (let node = head; node.value < 3; node.value++) {}',
        'for (let row = 0; row < 9; [column, row] = [1, row + 1]) {}',
        'for (const node = head; node.ready; ) {}',
    ],
    invalid: [
        {
            code: 'for (let row = 0; row < rows; column++) {}',
            errors: [{ messageId: 'misplaced', data: { tested: 'row, rows', updated: 'column' } }],
        },
        { code: 'for (let node = head; node.next; iterator.next()) {}', errors: [{ messageId: 'misplaced' }] },
        { code: 'for (; isReady(); index++) {}', errors: [{ messageId: 'misplaced' }] },
    ],
});
