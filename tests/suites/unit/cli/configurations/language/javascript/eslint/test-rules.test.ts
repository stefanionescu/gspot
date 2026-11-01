import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test.each([...LEVELS])('%s runs the gspot test rules on every test file', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module","devDependencies":{"mocha":"11.0.0","chai":"5.0.0"}}',
        'cart.test.js': '',
        'empty.test.js': '',
        'helpers.js': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['cart.test.js', 'empty.test.js', 'helpers.js'];
    const rules = [
        'gspot/no-exclusive-tests',
        'gspot/no-unexplained-test-skips',
        'gspot/no-empty-test-titles',
        'gspot/no-duplicate-test-titles',
        'gspot/test-hooks-first',
        'gspot/no-async-suite-callbacks',
        'gspot/no-code-after-done',
        'gspot/no-incomplete-assertions',
        'gspot/no-inverted-assertions',
        'gspot/no-self-comparing-assertions',
        'gspot/no-uncertain-chai-assertions',
        'gspot/require-error-checks',
        'gspot/no-empty-test-file',
    ];
    await createFileTree(sandbox.path, {
        'cart.test.js':
            'import { expect, assert } from "chai";\ndescribe.only("cart", async () => {\n    it("adds", () => { assert.equal(3, total); });\n    it("adds", () => { expect(total); });\n    it.skip("", () => { expect(total).to.equal(total); });\n    it("saves", (done) => { done(); check(); });\n    it("fails", () => { expect(run).to.not.throw(TypeError); expect(run).to.throw(); });\n    beforeEach(reset);\n});\n',
        'empty.test.js': 'export const value = 1;\n',
        'helpers.js': 'export const value = 1;\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: 'cart.test.js', rule: 'gspot/no-async-suite-callbacks', line: 2 },
        { file: 'cart.test.js', rule: 'gspot/no-exclusive-tests', line: 2 },
        { file: 'cart.test.js', rule: 'gspot/no-inverted-assertions', line: 3 },
        { file: 'cart.test.js', rule: 'gspot/no-duplicate-test-titles', line: 4 },
        { file: 'cart.test.js', rule: 'gspot/no-incomplete-assertions', line: 4 },
        { file: 'cart.test.js', rule: 'gspot/no-self-comparing-assertions', line: 5 },
        { file: 'cart.test.js', rule: 'gspot/no-unexplained-test-skips', line: 5 },
        { file: 'cart.test.js', rule: 'gspot/no-code-after-done', line: 6 },
        { file: 'cart.test.js', rule: 'gspot/no-uncertain-chai-assertions', line: 7 },
        { file: 'cart.test.js', rule: 'gspot/require-error-checks', line: 7 },
        ...(level === 'all' ? [{ file: 'cart.test.js', rule: 'gspot/test-hooks-first', line: 8 }] : []),
        { file: 'empty.test.js', rule: 'gspot/no-empty-test-file', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        'cart.test.js':
            'import { expect, assert } from "chai";\ndescribe("cart", () => {\n    beforeEach(reset);\n    it("adds", () => { assert.equal(total, 3); });\n    it("adds more", () => { expect(total).to.equal(4); });\n    // Waits for the tax table.\n    it.skip("taxes", () => { expect(total).to.equal(5); });\n    it("saves", (done) => { check(); done(); });\n    it("fails", () => { expect(run).to.not.throw(); expect(run).to.throw(RangeError); });\n});\n',
        'empty.test.js': 'it("adds", () => { expect(1).to.equal(1); });\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each([...LEVELS])('%s runs the gspot assertion rules', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level }),
        'package.json': '{"private":true,"type":"module","devDependencies":{"vitest":"4.0.0"}}',
        'cart.test.js': '',
        'list.cy.js': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['cart.test.js', 'list.cy.js'];
    const rules = [
        'gspot/no-misplaced-assertions',
        'gspot/no-constant-assertions',
        'gspot/prefer-matcher-assertions',
        'gspot/valid-throw-assertions',
        'gspot/require-test-assertions',
        'gspot/no-cypress-then-assertions',
    ];
    await createFileTree(sandbox.path, {
        'cart.test.js': [
            'import { expect } from "vitest";',
            'describe("cart", () => {',
            '    expect(total).toBe(1);',
            '    it("adds", () => { expect(true).toBe(true); });',
            '    it("sizes", () => { expect(rows.length).toBe(2); });',
            '    it("loads", () => { expect(async () => load()).toThrow(); });',
            '    it("saves", () => { save(); });',
            '});',
        ].join('\n'),
        'list.cy.js': 'cy.get("li").then(($rows) => { expect($rows).to.exist; });\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: 'cart.test.js', rule: 'gspot/no-misplaced-assertions', line: 3 },
        { file: 'cart.test.js', rule: 'gspot/no-constant-assertions', line: 4 },
        ...(level === 'all' ? [{ file: 'cart.test.js', rule: 'gspot/prefer-matcher-assertions', line: 5 }] : []),
        { file: 'cart.test.js', rule: 'gspot/valid-throw-assertions', line: 6 },
        { file: 'cart.test.js', rule: 'gspot/require-test-assertions', line: 7 },
        { file: 'list.cy.js', rule: 'gspot/no-cypress-then-assertions', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        'cart.test.js': [
            'import { expect } from "vitest";',
            'describe("cart", () => {',
            '    it("totals", () => { expect(total).toBe(1); });',
            '    it("adds", () => { expect(add(1, 2)).toBe(3); });',
            '    it("sizes", () => { expect(rows).toHaveLength(2); });',
            '    it("loads", async () => { await expect(load()).rejects.toThrow(); });',
            '});',
        ].join('\n'),
        'list.cy.js': 'cy.get("li").should(($rows) => { expect($rows).to.exist; });\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});
