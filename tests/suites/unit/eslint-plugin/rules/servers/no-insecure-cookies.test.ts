import { noInsecureCookies } from '#eslint-plugin/rules/servers/no-insecure-cookies.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-insecure-cookies', noInsecureCookies, {
    valid: [
        'import session from "cookie-session"; session({ secure: true, httpOnly: true });',
        'import session from "cookie-session"; session({});',
        'import session from "express-session"; session({ secure: false, httpOnly: false });',
        'import csrf from "csurf"; csrf({ cookie: false });',
        'import csrf from "csurf"; csrf({ cookie: {} });',
        'import session from "other"; session({ secure: false, httpOnly: false });',
        'import session from "cookie-session"; function configure(session) { session({ secure: false }); }',
        'import session from "cookie-session"; const options = { secure: false }; session({ ...options, secure: true });',
        'import session from "cookie-session"; const options = { ...options }; session(options);',
        'import session from "cookie-session"; let options = { secure: false }; options = other; session(options);',
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
            'import csrf from "csurf"; csrf({ cookie: { secure: false, httpOnly: false } });',
            'import Cookies from "cookies"; const cookies = new Cookies(req, res); cookies.set("key", "value", { secure: false, httpOnly: false });',
        ].map((code) => ({ code, errors: [{ messageId: 'flag' as const }, { messageId: 'flag' as const }] })),
        ...[
            'const Cookies = require("cookies"); new Cookies(req, res).set("key", "value", { httpOnly: false });',
            'import session from "cookie-session"; const disabled = false; const options = { secure: disabled }; session({ secure: true, ...options });',
            'import session = require("cookie-session"); const configure = session; configure({ secure: false });',
        ].map((code) => ({ code, errors: [{ messageId: 'flag' as const }] })),
    ],
});
