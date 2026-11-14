import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noCypressThenAssertions } from '#eslint-plugin/rules/assertions/no-cypress-then-assertions.ts';

buildRuleTester().run('no-cypress-then-assertions', noCypressThenAssertions, {
    valid: [
        'cy.get("li").then(($items) => { expect($items).to.have.length(3); });',
        ...[
            'cy.get("@items").then(($items) => { expect($items).to.have.length(3); });',
            'cy.get("li").then(($items) => { save($items); });',
            'cy.get("li").then(($items) => { expect(total).to.equal(3); });',
            'cy.get("li").then(($items) => { expect($items.length).to.equal(3); });',
            'cy.get("li").then(async ($items) => { expect($items).to.exist; });',
            'cy.get("li").then(($items) => { let size = 1; expect($items).to.exist; });',
            'cy.request("/").then((response) => { expect(response).to.exist; });',
            'cy.get(selector).then(($items) => { expect($items).to.exist; });',
            'const cy = load();\ncy.get("li").then(($items) => { expect($items).to.exist; });',
            'cy.get("li").then(($items) => { expect($items.text().split(",")).to.have.length(3); });',
            'cy.get("li").then(($items) => { expect($items).to.equal(`${total}`); });',
            'cy.get("li").then(($items) => { const size = load(); expect($items).to.exist; });',
            'cy.get("li").then(($items) => { if (ready) expect($items).to.exist; });',
            'cy.get("li").then(({ length }) => { expect(length).to.equal(3); });',
            'cy.get("input").then(($input) => { expect($input.val()).to.equal("a"); });',
        ].map((code) => ({ code, filename: '/repo/cypress/e2e/cart.cy.ts' })),
    ],
    invalid: [
        {
            code: 'cy.get("li").then(($items) => { expect($items).to.have.length(3); });',
            filename: '/repo/cypress/e2e/cart.cy.ts',
            errors: [
                {
                    messageId: 'retry',
                    line: 1,
                    column: 14,
                    suggestions: [
                        {
                            messageId: 'should',
                            output: 'cy.get("li").should(($items) => { expect($items).to.have.length(3); });',
                        },
                    ],
                },
            ],
        },
        ...[
            'cy.get(".total").find("span").then(function ($total) { const text = $total.text().trim(); expect(text).to.equal(`${3}`); });',
            'cy.get(`.row`).first().then(($row) => { assert.equal($row.text(), "Total"); });',
            'cy.contains("Total").then(($row) => { const limits = { low: 1 }; expect($row).to.exist; expect(limits.low).to.equal(1); });',
        ].map((code) => ({
            code,
            filename: '/repo/cypress/e2e/cart.cy.ts',
            errors: [
                {
                    messageId: 'retry' as const,
                    suggestions: [{ messageId: 'should' as const, output: code.replace('.then(', '.should(') }],
                },
            ],
        })),
    ],
});
