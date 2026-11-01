import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unsafe-security-headers', plugin.rules['no-unsafe-security-headers'], {
    valid: [
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet());',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet({ contentSecurityPolicy: true, noSniff: true, referrerPolicy: true, hsts: true }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: ["no-referrer", "same-origin"] }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); function configure(app) { app.use(helmet({ noSniff: false })); }',
        'import express from "other"; import helmet from "helmet"; const app = express(); app.use(helmet({ noSniff: false }));',
        'import express from "express"; import helmet from "other"; const app = express(); app.use(helmet({ noSniff: false }));',
        'import helmet from "helmet"; function configure(app) { app.use(helmet({ noSniff: false })); }',
        'import express from "express"; import helmet from "helmet"; const app = express(); const options = { noSniff: false }; app.use(helmet({ ...options, noSniff: true }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); const stack = [stack]; app.use(stack);',
        'import express from "express"; import helmet from "helmet"; const app = express(); const options = { ...options }; app.use(helmet(options));',
        'import express from "express"; import helmet from "helmet"; const app = express(); let options = { noSniff: false }; options = safe; app.use(helmet(options));',
    ],
    invalid: [
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet({ contentSecurityPolicy: false, noSniff: false, referrerPolicy: false, hsts: false }));',
            errors: [
                { messageId: 'header' },
                { messageId: 'header' },
                { messageId: 'header' },
                { messageId: 'header' },
            ],
        },
        {
            code: 'const express = require("express"); const { default: helmet } = require("helmet"); const app = express(); const disabled = false; const options = { noSniff: disabled }; const stack = [helmet(options)]; app.use(...stack);',
            errors: [{ messageId: 'header' }],
        },
        {
            code: 'import express from "express"; import { hsts } from "helmet"; const app = express(); const age = 100; app.use(hsts({ maxAge: age, includeSubDomains: false }));',
            errors: [{ messageId: 'header' }, { messageId: 'header' }],
        },
        {
            code: 'import express from "express"; import hsts from "hsts"; const app = express(); app.use(hsts({ maxAge: 15551999 }));',
            errors: [{ messageId: 'header' }],
        },
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: ["same-origin", "unsafe-url"] }));',
            errors: [{ messageId: 'header' }],
        },
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: "" }), helmet.referrerPolicy({ policy: "no-referrer-when-downgrade" }));',
            errors: [{ messageId: 'header' }, { messageId: 'header' }],
        },
        {
            code: 'const helmet = require("helmet"); module.exports = function(app) { app.use(helmet({ noSniff: false })); };',
            errors: [{ messageId: 'header' }],
        },
        {
            code: 'const helmet = require("helmet"); module.exports.configure = (app) => { app.use(helmet({ hsts: false })); };',
            errors: [{ messageId: 'header' }],
        },
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); const options = { noSniff: false }; app.use(helmet({ noSniff: true, ...options }));',
            errors: [{ messageId: 'header' }],
        },
        {
            code: 'import express = require("express"); import helmet = require("helmet"); const app = express(); const stack = [[helmet({ noSniff: false })]]; app.use(stack);',
            errors: [{ messageId: 'header' }],
        },
    ],
});
