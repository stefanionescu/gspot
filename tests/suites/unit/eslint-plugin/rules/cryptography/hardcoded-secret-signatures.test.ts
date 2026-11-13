import { hardcodedSecretSignatures } from '#eslint-plugin/rules/cryptography/hardcoded-secret-signatures.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('hardcoded-secret-signatures', hardcodedSecretSignatures, {
    valid: [
        "import jwt from 'jsonwebtoken';\njwt.sign(claims, process.env.JWT_SECRET);",
        "import crypto from 'crypto';\ncrypto.createHmac('sha256', 'changeme-in-production');",
        "import crypto from 'crypto';\ncrypto.createHmac('sha256', 'abc');",
        "import jwt from 'jsonwebtoken';\njwt.sign(claims);",
    ],
    invalid: [
        {
            code: "const jwt = require('jsonwebtoken');\nconst crypto = require('crypto');\nconst session = require('express-session');\njwt.sign(payload, 'secret-key');\napp.use(session({ secret: 'keyboard-cat-1' }));\nconst cookieSession = require('cookie-session');\ncookieSession({ keys: ['rotate-me-1', k] });",
            errors: [
                { messageId: 'hardcoded', line: 4 },
                { messageId: 'hardcoded', line: 5 },
                { messageId: 'hardcoded', line: 7 },
            ],
        },
    ],
});
