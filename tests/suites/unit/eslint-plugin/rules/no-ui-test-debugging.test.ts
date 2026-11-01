import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-ui-test-debugging', plugin.rules['no-ui-test-debugging'], {
    valid: [
        { code: 'cy.pause();', filename: 'page.ts' },
        { code: 'cy.get("button").click();', filename: 'page.cy.ts' },
        { code: 'logger.debug("value");', filename: 'page.test.ts' },
        { code: 'import { screen } from "./screen";\nscreen.debug();', filename: 'page.test.ts' },
    ],
    invalid: [
        { code: 'cy.pause();', filename: 'page.cy.ts', output: '', errors: [{ messageId: 'debug' }] },
        {
            code: 'cy.get("button").debug().click();',
            filename: 'page.cy.ts',
            output: 'cy.get("button").click();',
            errors: [{ messageId: 'debug' }],
        },
        { code: 'await page.pause();', filename: '__tests__/page.ts', output: '', errors: [{ messageId: 'debug' }] },
        {
            code: 'import { screen, prettyDOM } from "@testing-library/react";\nscreen.debug();\nprettyDOM(view);',
            filename: 'page.test.tsx',
            output: 'import { screen, prettyDOM } from "@testing-library/react";\n\n',
            errors: [
                { messageId: 'debug', line: 2 },
                { messageId: 'debug', line: 3 },
            ],
        },
        {
            code: 'import { render } from "@testing-library/react";\nconst { debug } = render(view);\ndebug();',
            filename: 'page.spec.jsx',
            output: 'import { render } from "@testing-library/react";\nconst { debug } = render(view);\n',
            errors: [{ messageId: 'debug', line: 3 }],
        },
    ],
});
