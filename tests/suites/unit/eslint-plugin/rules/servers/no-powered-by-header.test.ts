import { noPoweredByHeader } from '#eslint-plugin/rules/servers/no-powered-by-header.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-powered-by-header', noPoweredByHeader, {
    valid: [
        'const { Router } = require("express"); const router = Router();',
        'import express from "express"; import helmet from "helmet"; const middleware = [helmet()]; const app = express(); app.use(...middleware);',
        'import express from "other"; const app = express();',
        'import express from "express"; const app = express(); app.disable("x-powered-by");',
        'import express from "express"; const app = express(); app.set("X-Powered-By", false);',
        'import express from "express"; import helmet from "helmet"; const app = express(); app.use(helmet());',
        'import express from "express"; const app = express(); configure(app);',
        'import express from "express"; function build() { const app = express(); return app; }',
    ],
    invalid: [
        'import express from "express"; function configure() { app.disable("x-powered-by"); } const app = express(); configure();',
        'import express = require("express"); const app = express();',
        'const express = require("express"); const app = express();',
        'import express from "express"; const app = express(); const copy = app;',
        'import express from "express"; const app = express(); app.use(logger);',
        'import express from "express"; const app = express(); app.set("x-powered-by", true);',
        'import express from "express"; const app = express(); app.disable("other");',
        'import express from "express"; const first = express(); first.disable("x-powered-by"); const second = express();',
    ].map((code) => ({ code, errors: [{ messageId: 'header' as const }] })),
});
