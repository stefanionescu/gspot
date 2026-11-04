import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noFixedTestWaits } from '#eslint-plugin/rules/testing/no-fixed-test-waits.ts';

buildRuleTester().run('no-fixed-test-waits', noFixedTestWaits, {
    valid: [
        { filename: 'page.ts', code: 'page.waitForTimeout(1000); cy.wait(1000);' },
        { filename: 'page.test.ts', code: 'cy.wait("@request");' },
        { filename: 'page.test.ts', code: 'cy.wait(["@first", "@second"]);' },
        { filename: 'page.test.ts', code: 'cy.wait();' },
        { filename: 'page.test.ts', code: 'other.wait(1000); other.waitForTimeout(1000);' },
        { filename: 'page.test.ts', code: 'page["waitForTimeout"](1000); cy["wait"](1000);' },
        { filename: 'page.test.ts', code: 'cy.wait(delay());' },
        { filename: 'page.test.ts', code: 'let delay = 1000; delay = other; cy.wait(delay);' },
        { filename: 'page.test.ts', code: 'cy.wait(~1000);' },
        { filename: 'page.test.ts', code: 'cy.wait(1000);', settings: { testFileExtensions: ['js'] } },
    ],
    invalid: [
        { filename: 'page.test.ts', code: 'cy.wait(1000);', errors: [{ messageId: 'wait' }] },
        { filename: 'page.spec.js', code: 'cy.wait(-1000);', errors: [{ messageId: 'wait' }] },
        { filename: 'page.cy.mjs', code: 'cy.wait(+1000);', errors: [{ messageId: 'wait' }] },
        { filename: 'page.e2e.cts', code: 'page.waitForTimeout(delay);', errors: [{ messageId: 'wait' }] },
        { filename: 'page.mock.tsx', code: 'page.waitForTimeout();', errors: [{ messageId: 'wait' }] },
        { filename: '__tests__/page.ts', code: 'page.waitForTimeout(1000);', errors: [{ messageId: 'wait' }] },
        {
            filename: '__mocks__/page.ts',
            code: 'cy.get("button").click().wait(1000);',
            errors: [{ messageId: 'wait' }],
        },
        { filename: 'page.test.ts', code: 'const delay = 1000; cy.wait(delay);', errors: [{ messageId: 'wait' }] },
        {
            filename: 'page.test.ts',
            code: 'let delay; delay = -1000; cy.wait(delay);',
            errors: [{ messageId: 'wait' }],
        },
        { filename: 'page.test.ts', code: 'cy?.get("button").wait(1000);', errors: [{ messageId: 'wait' }] },
        {
            filename: 'page.test.custom',
            code: 'cy.wait(1000);',
            settings: { testFileExtensions: ['.custom'] },
            errors: [{ messageId: 'wait' }],
        },
        {
            filename: 'page.test.component.ts',
            code: 'cy.wait(1000);',
            settings: { testFileExtensions: ['component.ts'] },
            errors: [{ messageId: 'wait' }],
        },
    ],
});
