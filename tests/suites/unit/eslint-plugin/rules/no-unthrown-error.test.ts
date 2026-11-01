import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unthrown-error', plugin.rules['no-unthrown-error'], {
    valid: [
        'throw new Error("Invalid value");',
        'const failure = new TypeError("Invalid value");',
        'function fail() { return new Error("Invalid value"); }',
        'send(new Error("Invalid value"));',
        'new Clock();',
        'new ErrorHandler();',
        'new errors["TypeError"]();',
        'Error("Invalid value");',
    ],
    invalid: [
        { code: 'new Error("Invalid value");', errors: [{ messageId: 'error' }] },
        { code: 'new TypeError("Invalid value");', errors: [{ messageId: 'error' }] },
        { code: 'new CustomException();', errors: [{ messageId: 'error' }] },
        { code: 'new errors.TypeError();', errors: [{ messageId: 'error' }] },
        { code: 'new (Error)();', errors: [{ messageId: 'error' }] },
    ],
});
