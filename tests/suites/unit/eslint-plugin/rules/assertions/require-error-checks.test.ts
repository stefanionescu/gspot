import { requireErrorChecks } from '#eslint-plugin/rules/assertions/require-error-checks.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('require-error-checks', requireErrorChecks, {
    valid: [
        'it("fails", () => { expect(run).to.throw(RangeError); });',
        'it("fails", () => { expect(run).to.not.throw(); });',
        'it("fails", () => { expect(run).to.throw(Error, "negative"); });',
        'test("fails", () => { expect(run).to.throw(); });',
        { code: 'it("fails", () => { expect(run).to[mode].throw(); });', name: 'a computed word may be not' },
        { code: 'it("fails", () => { expect().to.throw(); });', name: 'no value to call' },
        { code: 'it("fails", () => { expect(...runs).to.throw(); });', name: 'a spread value' },
        'it("fails", (done) => { try { run(); } catch (error) { done(error); } });',
        'it("fails", () => { try { run(); } catch (error) { log(); } });',
    ],
    invalid: [
        {
            code: 'it("fails", () => { expect(run).to.throw(); });',
            errors: [{ messageId: 'errorType', column: 36 }],
        },
        {
            code: 'describe("cart", () => { run.should.throw(Error); });',
            errors: [{ messageId: 'errorType' }],
        },
        {
            code: 'it("fails", (done) => { try { run(); } catch (error) { done(); } });',
            errors: [{ messageId: 'ignoredError', column: 47 }],
        },
    ],
});
