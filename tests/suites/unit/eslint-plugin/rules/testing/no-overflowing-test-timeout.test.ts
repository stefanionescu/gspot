import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noOverflowingTestTimeout } from '#eslint-plugin/rules/testing/no-overflowing-test-timeout.ts';

buildRuleTester().run('no-overflowing-test-timeout', noOverflowingTestTimeout, {
    valid: [
        'describe("cart", function () { this.timeout(3000000000); });',
        'import { expect } from "chai";\ndescribe("cart", function () { this.timeout(0); });',
        'import { expect } from "chai";\nthis.timeout(3000000000);',
        'import { expect } from "chai";\ntest("cart", function () { this.timeout(3000000000); });',
    ],
    invalid: [
        {
            code: 'import { expect } from "chai";\ndescribe("cart", function () { this.timeout(3000000000); });',
            errors: [{ messageId: 'overflow', line: 2, column: 45 }],
        },
        {
            code: 'import { expect } from "chai";\nconst limit = 2147483648;\nit.only("adds", function () { this.timeout(limit); });',
            errors: [{ messageId: 'overflow', line: 3 }],
        },
        {
            code: 'import { expect } from "chai";\nbeforeEach(function () { this.timeout(1e10); });',
            errors: [{ messageId: 'overflow' }],
        },
    ],
});
