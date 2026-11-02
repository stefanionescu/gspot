import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-code-after-done', plugin.rules['no-code-after-done'], {
    valid: [
        'it("saves", (done) => { save(); check(); done(); });',
        'it("saves", (done) => { if (failed) { done(error); return; } done(); });',
        'it("saves", (done) => { save(done); check(); });',
        'it("saves", (done) => { done(); const value = 1; });',
        'other("saves", (done) => { done(); check(); });',
        'it("saves", () => { done(); check(); });',
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
    ],
});
