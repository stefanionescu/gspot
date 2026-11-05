import { join } from 'node:path';

import { noTestRetries } from '#eslint-plugin/rules/testing/no-test-retries.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ jest: { devDependencies: { jest: '30.0.0' } }, plain: {} });

buildRuleTester({ root }).run('no-test-retries', noTestRetries, {
    valid: [
        { code: 'jest.retryTimes(3);', filename: join(root, 'plain/a.test.ts') },
        { code: 'const jest = other;\njest.retryTimes(3);', filename: join(root, 'jest/a.test.ts') },
        { code: 'it("adds", function () { this.retries(2); });', filename: join(root, 'plain/b.test.ts') },
        { code: 'this.retries(2);', filename: join(root, 'plain/c.test.ts') },
    ],
    invalid: [
        { code: 'jest.retryTimes(3);', filename: join(root, 'jest/a.test.ts'), errors: [{ messageId: 'retry' }] },
        {
            code: 'import { jest } from "@jest/globals";\njest.retryTimes(3, { logErrorsBeforeRetry: true });',
            filename: join(root, 'plain/a.test.ts'),
            errors: [{ messageId: 'retry', line: 2 }],
        },
        {
            code: 'describe("cart", function () { this.retries(2); it("adds", run); });',
            filename: join(root, 'plain/b.test.ts'),
            errors: [{ messageId: 'retry', column: 32 }],
        },
        {
            code: 'context.skip("cart", function () { it("adds", function () { this.retries(1); }); });',
            filename: join(root, 'plain/c.test.ts'),
            errors: [{ messageId: 'retry' }],
        },
    ],
});
