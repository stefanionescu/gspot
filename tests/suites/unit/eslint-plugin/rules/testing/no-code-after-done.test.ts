import { noCodeAfterDone } from '#eslint-plugin/rules/testing/no-code-after-done.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-code-after-done', noCodeAfterDone, {
    valid: [
        'it("saves", (done) => { save(); check(); done(); });',
        'it("saves", (done) => { if (failed) { done(error); return; } done(); });',
        'it("saves", (done) => { save(done); check(); });',
        'it("saves", (done) => { done(); const value = 1; });',
        'other("saves", (done) => { done(); check(); });',
        'it("saves", () => { done(); check(); });',
        'it("saves", (done) => { switch (mode) { case 1: done(); break; case 2: other(); } });',
    ],
    invalid: [
        {
            code: 'it("saves", (done) => { save(); done(); check(); });',
            errors: [{ messageId: 'afterDone', column: 41 }],
        },
        {
            code: 'specify.only("saves", function (finish) { if (ready) finish(); check(); });',
            errors: [{ messageId: 'afterDone', column: 64 }],
        },
        {
            code: 'it("saves", (done) => { switch (mode) { case 1: done(); check(); break; } });',
            errors: [{ messageId: 'afterDone', column: 57 }],
        },
    ],
});
