import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('encryption-secure-mode', plugin.rules['encryption-secure-mode'], {
    valid: [
        "import crypto from 'crypto';\ncrypto.createCipheriv('aes-256-gcm', key, iv);",
        "import crypto from 'crypto';\ncrypto.createCipheriv(algorithm, key, iv);",
    ],
    invalid: [
        {
            code: "import * as crypto from 'crypto';\ncrypto.createCipheriv('aes-128-cbc', key, iv);\ncrypto.createCipheriv('aes-128-ecb', key, iv);\ncrypto.createCipheriv('AES128', key, iv);\ncrypto.createCipheriv('aes-256-gcm', key, iv);\ncrypto.createCipheriv('des-ede3', key, iv);\ncrypto.createCipheriv('DESX', key, iv);",
            errors: [
                { messageId: 'insecure', line: 2 },
                { messageId: 'insecure', line: 3 },
                { messageId: 'insecure', line: 4 },
                { messageId: 'insecure', line: 6 },
                { messageId: 'insecure', line: 7 },
            ],
        },
    ],
});
