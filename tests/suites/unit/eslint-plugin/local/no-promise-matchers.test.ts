import { createRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noPromiseMatchers } from '#eslint-plugin-local/no-promise-matchers.ts';

createRuleTester().run('no-promise-matchers', noPromiseMatchers, {
    valid: [
        'expect(await captureRejection(run())).toMatchObject({ code: "settings" });',
        'expect(value).toStrictEqual({ rejects: true });',
        'assert.rejects(run());',
    ],
    invalid: [
        { code: 'expect(run()).rejects.toThrow("failed");', errors: [{ messageId: 'promise' }] },
        { code: 'await expect(run()).resolves.toBe(1);', errors: [{ messageId: 'promise' }] },
    ],
});
