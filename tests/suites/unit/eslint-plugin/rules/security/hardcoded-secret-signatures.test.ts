import { hardcodedSecretSignatures } from '#eslint-plugin/rules/security/hardcoded-secret-signatures.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('hardcoded-secret-signatures', hardcodedSecretSignatures, {
    valid: [
        "import jwt from 'jsonwebtoken';\njwt.sign(claims, process.env.JWT_SECRET);",
        "import crypto from 'crypto';\ncrypto.createHmac('sha256', 'changeme-in-production');",
        "import crypto from 'crypto';\ncrypto.createHmac('sha256', 'abc');",
    ],
    invalid: [
        {
            code: "const jwt = require('jsonwebtoken');\nconst crypto = require('crypto');\nconst session = require('express-session');\njwt.sign(payload, 'secret-key');\nconst secret = 's3cr3t';\ncrypto.createHmac('sha256', secret);\napp.use(session({ secret: 'keyboard-cat-1' }));\nconst mysql = require('mysql');\nmysql.createConnection({ password: 'hunter22' });\nconst cookieSession = require('cookie-session');\ncookieSession({ keys: ['rotate-me-1', k] });",
            errors: [
                { messageId: 'hardcoded', line: 4 },
                { messageId: 'hardcoded', line: 6 },
                { messageId: 'hardcoded', line: 7 },
                { messageId: 'hardcoded', line: 9 },
                { messageId: 'hardcoded', line: 11 },
            ],
        },
    ],
});
