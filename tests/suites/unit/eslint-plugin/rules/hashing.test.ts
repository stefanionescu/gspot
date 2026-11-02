import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('hashing', plugin.rules['hashing'], {
    valid: [
        "import { type createHash } from 'crypto';\ncreateHash('md5');",
        "const createHash = require(name).createHash;\ncreateHash('md5');",
        "const [createHash] = require('crypto');\ncreateHash('md5');",
        "import crypto from 'crypto';\ncrypto[load()]('md5');",

        "import crypto from 'crypto';\ncrypto.createHash('sha256').update(text).digest('hex');",
        "import crypto from 'crypto';\nconst key = crypto.createHash('md5').update(text).digest('hex').substring(0, 12);",
        "import crypto from 'crypto';\nconst key = crypto.createHash('md5').update(text).digest('hex').slice(0, length);",
        "import crypto from 'crypto';\ncrypto.createHash(algorithm);",
    ],
    invalid: [
        {
            code: "import { default as crypto } from 'crypto';\ncrypto.createHash('md5');",
            errors: [{ messageId: 'weak' }],
        },

        {
            code: "import crypto from 'crypto';\ncrypto.createHash('md5').update(x).digest('hex');\ncrypto.createHash('sha256');\ncrypto.createHash('SHA1');\nconst id = crypto.createHash('md5').update(x).digest('hex').slice(0, 8);\nconst full = crypto.createHash('md5').update(x).digest('hex').slice(0);\nconst d = crypto.createHash('md5').update(x).digest('hex');\nuse(d.substring(0, 8));\nconst e = crypto.createHash('sha1').update(x).digest('hex');\nuse(e);\nasync function f() {\n  await crypto.subtle.digest('SHA-1', buf);\n  const short = (await crypto.subtle.digest('SHA-1', buf)).slice(0, 4);\n  crypto.subtle.digest('SHA-1', buf).then((h) => h.slice(0, 2));\n  const g = crypto.subtle.digest('sha-256', buf);\n}",
            errors: [
                { messageId: 'weak', line: 2 },
                { messageId: 'weak', line: 4 },
                { messageId: 'weak', line: 6 },
                { messageId: 'weak', line: 9 },
                { messageId: 'weak', line: 12 },
            ],
        },
        {
            code: "import crypto from 'crypto';\nconst copy = crypto.createHash('md5').update(text).digest('hex').slice();",
            errors: [{ messageId: 'weak', line: 2 }],
        },
        {
            code: "import crypto from 'crypto';\nconst name = crypto.createHash('md5').algorithm;",
            errors: [{ messageId: 'weak', line: 2 }],
        },
        {
            code: 'import { "createHash" as digest } from "node:crypto";\ndigest("md5");',
            errors: [{ messageId: 'weak' }],
        },
        {
            code: 'import crypto from "node:crypto";\nconst tagged = crypto`x`;\ntagged.createHash("md5");',
            errors: [{ messageId: 'weak' }],
        },
    ],
});
