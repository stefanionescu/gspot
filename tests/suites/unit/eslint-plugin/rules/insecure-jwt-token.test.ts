import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('insecure-jwt-token', plugin.rules['insecure-jwt-token'], {
    valid: [
        "import jwt from 'jsonwebtoken';\njwt.sign(claims, key, { algorithm: 'RS256' });\njwt.verify(token, key, { algorithms: ['RS256'] });",
        "import jwt from 'jsonwebtoken';\njwt.verify(token, key);",
    ],
    invalid: [
        {
            code: "const jwt = require('jsonwebtoken');\njwt.sign(payload, key, { algorithm: 'none' });\njwt.sign(payload, key, { algorithm: 'RS256' });\njwt.verify(token, key, { algorithms: ['none', 'RS256'] });\njwt.verify(token, null, {});\njwt.verify(token, key, {});\njwt.verify(token, null, { algorithms: ['RS256'] });\nconst o = { algorithm: 'none' };\njwt.sign(payload, key, o);",
            errors: [
                { messageId: 'unsignedSign', line: 2 },
                { messageId: 'unsignedVerify', line: 4 },
                { messageId: 'unsignedVerify', line: 5 },
                { messageId: 'unsignedSign', line: 9 },
            ],
        },
    ],
});
