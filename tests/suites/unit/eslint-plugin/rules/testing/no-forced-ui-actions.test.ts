import { join } from 'node:path';

import { noForcedUiActions } from '#eslint-plugin/rules/testing/no-forced-ui-actions.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({ cypress: { devDependencies: { cypress: '15.0.0' } }, plain: {} });

buildRuleTester({ root }).run('no-forced-ui-actions', noForcedUiActions, {
    valid: [
        { code: 'cy.get("button").click({ force: true });', filename: join(root, 'plain/a.cy.ts') },
        { code: 'cy.get("input").type({ force: true });', filename: join(root, 'cypress/b.cy.ts'), name: 'no text' },
        { code: 'cy.get("button").click({ force: false });', filename: join(root, 'cypress/c.cy.ts') },
        { code: 'other.click({ force: true });', filename: join(root, 'cypress/d.cy.ts') },
        {
            code: 'import { test } from "@playwright/test";\npage.click("button", { force: true });',
            filename: join(root, 'plain/b.spec.ts'),
        },
    ],
    invalid: [
        {
            code: 'const options = { force: true };\ncy.get("input").type("name", options);',
            filename: join(root, 'cypress/b.cy.ts'),
            errors: [{ messageId: 'force', line: 1 }],
        },
        {
            code: 'import { test } from "@playwright/test";\nawait page.getByRole("button").click({ force: true });',
            filename: join(root, 'plain/a.spec.ts'),
            errors: [{ messageId: 'force', line: 2 }],
        },
        {
            code: 'import { test } from "@playwright/test";\nconst field = page.locator("#name");\nawait field.fill("Ann", { force: true });',
            filename: join(root, 'plain/c.spec.ts'),
            errors: [{ messageId: 'force', line: 3 }],
        },
    ],
});
