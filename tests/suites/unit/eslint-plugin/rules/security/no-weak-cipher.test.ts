import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noWeakCipher } from '#eslint-plugin/rules/security/no-weak-cipher.ts';

buildRuleTester().run('no-weak-cipher', noWeakCipher, {
    valid: [
        "import crypto from 'crypto';\ncrypto.createCipheriv('aes-256-gcm', key, iv);",
        "cipher.createCipheriv('des', key, iv);",
    ],
    invalid: [
        {
            code: "import crypto from 'crypto';\ncrypto.createCipheriv('des-ede3-cbc', key, iv);\ncrypto.createCipheriv('aes-256-gcm', key, iv);\nconst algo = 'rc4';\ncrypto.createCipheriv(algo, key, iv);\ncrypto.createCipheriv(other, key, iv);",
            errors: [
                { messageId: 'weak', line: 2 },
                { messageId: 'weak', line: 5 },
            ],
        },
        {
            code: "const { createCipheriv } = require('node:crypto');\ncreateCipheriv('BF-CBC', k, i);\nconst c = require('crypto');\nc.createCipheriv('blowfish', k, i);\nfoo.createCipheriv('des', k, i);",
            errors: [
                { messageId: 'weak', line: 2 },
                { messageId: 'weak', line: 4 },
            ],
        },
    ],
});
