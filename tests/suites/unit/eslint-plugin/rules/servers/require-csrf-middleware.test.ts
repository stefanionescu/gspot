import { requireCsrfMiddleware } from '#eslint-plugin/rules/servers/require-csrf-middleware.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('require-csrf-middleware', requireCsrfMiddleware, {
    valid: [
        "import csrf from 'csurf';\nimport express from 'express';\nconst app = express();\napp.use(csrf());\napp.post('/transfer', handler);",
        "import express from 'express';\nconst app = express();\napp.post('/transfer', handler);",
        "import csrf from 'csurf';\ncsrf({ ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] });",
    ],
    invalid: [
        {
            code: "const express = require('express');\nconst csrf = require('csurf');\nconst app = express();\nconst csrfProtection = csrf({ cookie: true });\napp.post('/a', handler);\napp.post('/b', csrfProtection, handler);\ncsrf({ ignoreMethods: ['GET', 'POST'] });",
            errors: [
                { messageId: 'unprotectedRoute', line: 5 },
                { messageId: 'ignoredMethod', line: 7, column: 31 },
            ],
        },
        {
            code: "import csrf from 'csurf';\nimport express from 'express';\nconst app = express();\napp.put('/x', h);\napp.get('/y', h);",
            errors: [{ messageId: 'unprotectedRoute', line: 4 }],
        },
        {
            code: "import csrf from 'csurf';\nimport express from 'express';\nconst app = express();\nconst stack = [stack];\napp.use(stack);\napp.post('/x', h);",
            errors: [{ messageId: 'unprotectedRoute', line: 6 }],
        },
    ],
});
