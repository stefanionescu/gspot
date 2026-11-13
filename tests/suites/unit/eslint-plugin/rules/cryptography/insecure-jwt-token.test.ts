import { insecureJwtToken } from '#eslint-plugin/rules/cryptography/insecure-jwt-token.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('insecure-jwt-token', insecureJwtToken, {
    valid: [
        "import jwt from 'jsonwebtoken';\njwt.sign(claims, key, { algorithm: 'RS256' });",
        "import jwt from 'jsonwebtoken';\njwt.verify(token, key);",
        "import jose from 'jose';\njose.sign(payload, key, { algorithm: 'none' });",
    ],
    invalid: [
        {
            code: "const jwt = require('jsonwebtoken');\njwt.sign(payload, key, { algorithm: 'none' });\njwt.verify(token, key, { algorithms: ['none', 'RS256'] });\njwt.verify(token, null, {});\njwt.verify(token, key, {});\njwt.verify(token, null, { algorithms: ['RS256'] });\nconst o = { algorithm: 'none' };\njwt.sign(payload, key, o);",
            errors: [
                { messageId: 'unsignedSign', line: 2 },
                { messageId: 'unsignedVerify', line: 3 },
                { messageId: 'unsignedVerify', line: 4 },
                { messageId: 'unsignedSign', line: 8 },
            ],
        },
    ],
});
