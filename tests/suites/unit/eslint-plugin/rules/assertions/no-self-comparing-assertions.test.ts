import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noSelfComparingAssertions } from '#eslint-plugin/rules/assertions/no-self-comparing-assertions.ts';

buildRuleTester().run('no-self-comparing-assertions', noSelfComparingAssertions, {
    valid: [
        'expect(total).to.equal(total);',
        'import { expect } from "chai";\nexpect(total).to.equal(3);',
        'import { expect } from "chai";\nexpect(1).to.equal(1);',
        'import { expect } from "chai";\nother(total).to.equal(total);',
        'import { expect } from "chai";\ncart.add(item, item);',
    ],
    invalid: [
        {
            code: 'import { expect } from "chai";\nexpect(total).to.equal(total);',
            errors: [{ messageId: 'duplicate', line: 2, column: 8 }],
        },
        {
            code: 'import { assert } from "chai";\nassert.deepEqual(cart.items, cart.items);',
            errors: [{ messageId: 'duplicate', line: 2, column: 18 }],
        },
        {
            code: 'import "chai";\ntotal.should.equal(total);',
            errors: [{ messageId: 'duplicate', line: 2, column: 1 }],
        },
    ],
});
