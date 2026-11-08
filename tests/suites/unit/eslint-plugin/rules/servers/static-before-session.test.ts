import { staticBeforeSession } from '#eslint-plugin/rules/servers/static-before-session.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('static-before-session', staticBeforeSession, {
    valid: [
        "import express from 'express';\nimport session from 'express-session';\nconst app = express();\napp.use(express.static('public'));\napp.use(session({ secret }));",
    ],
    invalid: [
        {
            code: "const express = require('express');\nconst session = require('express-session');\nconst app = express();\napp.use(session({ secret }));\napp.use(express.static('public'));\nmodule.exports = function (app) {\n  app.use(express.static('b'));\n  app.use(require('cookie-session')({}));\n  app.use(express.static('c'));\n};",
            errors: [
                { messageId: 'staticAfterSession', line: 5 },
                { messageId: 'staticAfterSession', line: 9 },
            ],
        },
    ],
});
