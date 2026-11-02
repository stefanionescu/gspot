import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-misplaced-loop-counter', plugin.rules['no-misplaced-loop-counter'], {
    valid: [
        'for (let index = 0; index < items.length; index++) {}',
        'for (let row = 0, column = 0; row < 9; column++, row++) {}',
        'for (let row = 0; row < 9; [column, row] = [1, row + 1]) {}',
        'for (const node = head; node.ready; ) {}',
        'for (let { value, done } = it.next(); !done; ({ value, done } = it.next())) use(value);',
        'for (; delta > 455; k += 36) { delta = Math.floor(delta / 35); }',
        'for (let i = 1; true; ++i) { if (done(i)) break; }',
        'for (let round = 0; queue.length > 0; round++) { queue.shift(); }',
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
