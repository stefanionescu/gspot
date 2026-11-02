import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unsafe-security-headers', plugin.rules['no-unsafe-security-headers'], {
    valid: [
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet());',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet({ contentSecurityPolicy: true, noSniff: true, referrerPolicy: true, hsts: true }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: ["no-referrer", "same-origin"] }));',
        'import express from "other"; import helmet from "helmet"; const app = express(); app.use(helmet({ noSniff: false }));',
        'import express from "express"; import helmet from "other"; const app = express(); app.use(helmet({ noSniff: false }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); const options = { noSniff: false }; app.use(helmet({ ...options, noSniff: true }));',
        'import express from "express"; import helmet from "helmet"; const app = express(); const stack = [stack]; app.use(stack);',
        'import express from "express"; import helmet from "helmet"; const app = express(); const options = { ...options }; app.use(helmet(options));',
        'import express from "express"; import helmet from "helmet"; const app = express(); let options = { noSniff: false }; options = safe; app.use(helmet(options));',
        'import helmet from "helmet"; function configure(app) { app.use(helmet()); }',
        'import helmet from "helmet"; function configure(server) { server.use(helmet({ noSniff: false })); }',
        'import helmet from "helmet"; import app from "./app"; app.use(helmet({ noSniff: false }));',
        'import helmet from "helmet"; app.use(helmet({ noSniff: false }));',
        'import express from "express"; const app = express(); app.use((request, response, next) => next());',
    ],
    invalid: [
        ...[
            'import helmet from "helmet"; function configure(app) { app.use(helmet({ noSniff: false })); }',
            'const express = require("express"); const { default: helmet } = require("helmet"); const app = express(); const disabled = false; const options = { noSniff: disabled }; const stack = [helmet(options)]; app.use(...stack);',
            'import express from "express"; import hsts from "hsts"; const app = express(); app.use(hsts({ maxAge: 15551999 }));',
            'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: ["same-origin", "unsafe-url"] }));',
            'const helmet = require("helmet"); module.exports = function(app) { app.use(helmet({ noSniff: false })); };',
            'import express from "express"; import helmet from "helmet"; const app = express(); const options = { noSniff: false }; app.use(helmet({ noSniff: true, ...options }));',
            'import express = require("express"); import helmet = require("helmet"); const app = express(); const stack = [[helmet({ noSniff: false })]]; app.use(stack);',
        ].map((code) => ({ code, errors: [{ messageId: 'header' as const }] })),
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
            code: 'import express from "express"; import { hsts } from "helmet"; const app = express(); const age = 100; app.use(hsts({ maxAge: age, includeSubDomains: false }));',
            errors: [{ messageId: 'header' }, { messageId: 'header' }],
        },
        {
            code: 'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet.referrerPolicy({ policy: "" }), helmet.referrerPolicy({ policy: "no-referrer-when-downgrade" }));',
            errors: [{ messageId: 'header' }, { messageId: 'header' }],
        },
    ],
});
