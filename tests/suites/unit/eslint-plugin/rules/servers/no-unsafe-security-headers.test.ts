import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noUnsafeSecurityHeaders } from '#eslint-plugin/rules/servers/no-unsafe-security-headers.ts';

buildRuleTester().run('no-unsafe-security-headers', noUnsafeSecurityHeaders, {
    valid: [
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet());',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: ["no-referrer", "same-origin"] }));',
        'import express from "other"; import helmet from "helmet"; const app = express(); app.use(helmet({ noSniff: false }));',
        'import express from "express"; import helmet from "other"; const app = express(); app.use(helmet({ noSniff: false }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); const stack = [stack]; app.use(stack);',
        'import helmet from "helmet"; function configure(server) { server.use(helmet({ noSniff: false })); }',
        'import helmet from "helmet"; import app from "./app"; app.use(helmet({ noSniff: false }));',
        'import helmet from "helmet"; app.use(helmet({ noSniff: false }));',
    ],
    invalid: [
        {
            code: 'import helmet from "helmet"; function configure(app) { app.use(helmet({ noSniff: false })); }',
            errors: [{ messageId: 'header', data: { option: 'noSniff' } }],
        },
        {
            code: 'const express = require("express"); const { default: helmet } = require("helmet"); const app = express(); const disabled = false; const options = { noSniff: disabled }; const stack = [helmet(options)]; app.use(...stack);',
            errors: [{ messageId: 'header', data: { option: 'noSniff' } }],
        },
        {
            code: 'import express from "express"; import hsts from "hsts"; const app = express(); app.use(hsts({ maxAge: 15551999 }));',
            errors: [{ messageId: 'header', data: { option: 'maxAge' } }],
        },
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: ["same-origin", "unsafe-url"] }));',
            errors: [{ messageId: 'header', data: { option: 'policy' } }],
        },
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); const stack = [[helmet({ noSniff: false })]]; app.use(stack);',
            errors: [{ messageId: 'header', data: { option: 'noSniff' } }],
        },
        {
            code: 'import express from "express"; import { hsts } from "helmet"; const app = express(); const age = 100; app.use(hsts({ maxAge: age, includeSubDomains: false }));',
            errors: [
                { messageId: 'header', data: { option: 'maxAge' } },
                { messageId: 'header', data: { option: 'includeSubDomains' } },
            ],
        },
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: "" }), helmet.referrerPolicy({ policy: "no-referrer-when-downgrade" }));',
            errors: [
                { messageId: 'header', data: { option: 'policy' } },
                { messageId: 'header', data: { option: 'policy' } },
            ],
        },
    ],
});
