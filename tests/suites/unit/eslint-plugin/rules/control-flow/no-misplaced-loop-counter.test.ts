import { noMisplacedLoopCounter } from '#eslint-plugin/rules/control-flow/no-misplaced-loop-counter.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-misplaced-loop-counter', noMisplacedLoopCounter, {
    valid: [
        'for (let index = 0; index < items.length; index++) {}',
        'for (let row = 0; row < 9; [column, row] = [1, row + 1]) {}',
        'for (const node = head; node.ready; ) {}',
        'for (let { value, done } = it.next(); !done; ({ value, done } = it.next())) use(value);',
        'for (let i = 1; true; ++i) { if (done(i)) break; }',
        'for (let round = 0; queue.length > 0; round++) { queue.shift(); }',
        'for (let round = 0; this.queue.length > 0; round++) { this.queue.shift(); }',
    ],
    invalid: [
        {
            code: 'for (let row = 0; row < rows; column++) {}',
            errors: [{ messageId: 'misplaced', data: { tested: 'row, rows', updated: 'column' } }],
        },
        {
            code: 'for (let node = head; node.next; iterator.next()) {}',
            errors: [{ messageId: 'misplaced', data: { tested: 'node.next, node', updated: 'iterator' } }],
        },
    ],
});
