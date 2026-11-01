import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('csrf', plugin.rules['csrf'], {
    valid: [
        "import csrf from 'csurf';\nimport express from 'express';\nconst app = express();\napp.use(csrf());\napp.post('/transfer', handler);",
        "import express from 'express';\nconst app = express();\napp.post('/transfer', handler);",
    ],
    invalid: [
        {
            code: "const express = require('express');\nconst csrf = require('csurf');\nconst app = express();\nconst csrfProtection = csrf({ cookie: true });\napp.post('/a', handler);\napp.post('/b', csrfProtection, handler);\ncsrf({ ignoreMethods: ['GET', 'POST'] });\napp.use(csrf());\napp.post('/c', handler);",
            errors: [
                { messageId: 'unprotectedRoute', line: 5 },
                { messageId: 'ignoredMethod', line: 7 },
            ],
        },
        {
            code: "import csrf from 'csurf';\nimport express from 'express';\nconst app = express();\napp.put('/x', h);\napp.get('/y', h);",
            errors: [{ messageId: 'unprotectedRoute', line: 4 }],
        },
    ],
});
