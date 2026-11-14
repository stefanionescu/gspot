import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { requireTestAssertions } from '#eslint-plugin/rules/assertions/require-test-assertions.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    cypress: { devDependencies: { cypress: '15.0.0' } },
    jest: { devDependencies: { jest: '30.0.0' } },
    typed: { devDependencies: { mocha: '11.0.0' } },
});
writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({
        compilerOptions: { strict: true, module: 'esnext', moduleResolution: 'bundler' },
        include: ['typed/*.ts'],
    }),
);
writeFileSync(
    join(root, 'typed/helpers.ts'),
    'import { expect } from "chai";\nexport function checkTotal(value: number) { expect(value).to.equal(3); }\n',
);
writeFileSync(join(root, 'typed/plain.ts'), 'export function run() { return 1; }\n');
mkdirSync(join(root, 'typed/node_modules/@angular/common/http/testing'), { recursive: true });
writeFileSync(
    join(root, 'typed/node_modules/@angular/common/http/testing/index.d.ts'),
    'export declare class HttpTestingController { expectOne(url: string): unknown; flush(): void; }\n',
);
writeFileSync(join(root, 'typed/a.test.ts'), '');

buildRuleTester({ root }).run('require-test-assertions', requireTestAssertions, {
    valid: [
        'it("adds", () => { run(); });',
        'import { expect } from "chai";\nit("adds", () => { expect(add(1, 2)).to.equal(3); });',
        'import chai from "chai";\nit("reads", () => { value.should.be.true; });',
        'import chai from "chai";\nit("reads", () => { value.should.have.lengthOf(2); });',
        'import { it } from "mocha";\nimport assert from "node:assert";\nit("adds", () => { assert.equal(add(1, 2), 3); });',
        'import { expect } from "chai";\nfunction check(value) { expect(value).to.equal(1); }\nit("adds", () => { check(run()); });',
        'import { expect } from "chai";\nconst check = (value) => expect(value).to.equal(1);\nit("adds", () => check(run()));',
        'import { expect } from "chai";\nit("loads", (done) => { load().then(() => {}, done); });',
        'import { expect } from "chai";\nit("loads", (done) => { stream.subscribe({ error: done }); });',
        'import { it, expect } from "vitest";\nit("adds", () => { expect(add(1, 2)).toBe(3); });',
        'import { it } from "mocha";\nimport request from "supertest";\nit("serves", () => request(app).get("/").expect(200));',
        'import test from "node:test";\nimport assert from "node:assert";\ntest("adds", (t) => { t.assert.ok(add(1, 2)); });',
        'import { expect } from "chai";\ndescribe("cart", () => { run(); });',
        'import { expect } from "chai";\ntest.step("pays", () => { run(); });',
        { code: 'it("shows", () => { cy.get("a").should("be.visible"); });', filename: join(root, 'cypress/a.cy.ts') },
        { code: 'test("adds", () => { expect(add(1, 2)).toBe(3); });', filename: join(root, 'jest/a.test.ts') },
    ],
    invalid: [
        {
            code: 'import { expect } from "chai";\nit("adds", () => { add(1, 2); });',
            errors: [{ messageId: 'missing', line: 2, column: 1 }],
        },
        {
            code: 'import { expect } from "chai";\nit.only("adds", function () { run(); });',
            errors: [{ messageId: 'missing', line: 2, column: 1 }],
        },
        ...[
            'import chai from "chai";\nit("reads", () => { value.should.be; });',
            'import chai from "chai";\nit("reads", () => { value.should(); });',
            'import test from "node:test";\nimport assert from "node:assert";\ntest("adds", (done, t) => { t.assert.ok(add(1, 2)); });',
            'import { expect } from "chai";\nit("loads", (done) => { run(); done(); });',
            'import { expect } from "chai";\nfunction check(value) { log(value); }\nit("adds", () => { check(run()); });',
            'import { test, expect } from "vitest";\ntest("adds", () => { expect.assertions(1); });',
            'import { expect } from "chai";\nit.concurrent("adds", () => { add(1, 2); });',
            'import { expect } from "chai";\ntest.each([1])("adds %i", (value) => { add(value); });',
            'import { test as base } from "@playwright/test";\nconst test = base.extend({});\ntest("opens", async ({ page }) => { await page.goto("/"); });',
        ].map((code) => ({ code, errors: [{ messageId: 'missing' as const }] })),
        {
            code: 'it("shows", () => { cy.get("a").click(); });',
            filename: join(root, 'cypress/a.cy.ts'),
            errors: [{ messageId: 'missing' }],
        },
    ],
});

buildRuleTester({
    root,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } },
}).run('require-test-assertions with types', requireTestAssertions, {
    valid: [
        {
            code: 'import { expect } from "chai";\nimport { checkTotal } from "./helpers";\nit("adds", () => { checkTotal(3); });',
            filename: join(root, 'typed/a.test.ts'),
        },
        {
            code: 'import { HttpTestingController } from "@angular/common/http/testing";\ndeclare const http: HttpTestingController;\nit("loads", () => { http.expectOne("/cart"); });',
            filename: join(root, 'typed/a.test.ts'),
        },
    ],
    invalid: [
        'import { expect } from "chai";\nimport { run } from "./plain";\nit("adds", () => { run(); });',
        'import { HttpTestingController } from "@angular/common/http/testing";\ndeclare const http: HttpTestingController;\nit("loads", () => { http.flush(); });',
        'import { expect } from "chai";\nit("logs", () => { console.assert(ready); });',
    ].map((code) => ({ code, filename: join(root, 'typed/a.test.ts'), errors: [{ messageId: 'missing' as const }] })),
});
