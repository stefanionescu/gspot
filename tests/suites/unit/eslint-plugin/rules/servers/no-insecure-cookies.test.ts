import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noInsecureCookies } from '#eslint-plugin/rules/servers/no-insecure-cookies.ts';

buildRuleTester().run('no-insecure-cookies', noInsecureCookies, {
    valid: [
        'import session from "cookie-session"; session({ secure: true, httpOnly: true });',
        'import session from "express-session"; session({ secure: false, httpOnly: false });',
        'import csrf from "csurf"; csrf({ cookie: false });',
        'import session from "other"; session({ secure: false, httpOnly: false });',
        'import session from "cookie-session"; const options = { secure: false }; session({ ...options, secure: true });',
        'import session from "cookie-session"; const options = { ...options }; session(options);',
        'import Cookies from "cookies"; const headers = new Headers(); headers.set("key", "value", { secure: false });',
    ],
    invalid: [
        {
            code: 'import session from "cookie-session"; session({ secure: false, httpOnly: false });',
            errors: [
                { messageId: 'flag', data: { flag: 'secure' } },
                { messageId: 'flag', data: { flag: 'httpOnly' } },
            ],
        },
        ...[
            'import session from "express-session"; const flags = { secure: false, httpOnly: false }; session({ cookie: flags });',
            'const { default: csrf } = require("csurf"); const enabled = true; csrf({ cookie: enabled });',
            'import Cookies from "cookies"; const cookies = new Cookies(req, res); cookies.set("key", "value", { secure: false, httpOnly: false });',
        ].map((code) => ({ code, errors: [{ messageId: 'flag' as const }, { messageId: 'flag' as const }] })),
        {
            code: 'import session from "cookie-session"; const disabled = false; const options = { secure: disabled }; session({ secure: true, ...options });',
            errors: [{ messageId: 'flag', data: { flag: 'secure' } }],
        },
    ],
});
