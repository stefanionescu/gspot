import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { encryptionSecureMode } from '#eslint-plugin/rules/cryptography/encryption-secure-mode.ts';

buildRuleTester().run('encryption-secure-mode', encryptionSecureMode, {
    valid: [
        "import crypto from 'crypto';\ncrypto.createCipheriv('aes-256-gcm', key, iv);",
        "import crypto from 'crypto';\ncrypto.createCipheriv(algorithm, key, iv);",
    ],
    invalid: [
        {
            code: "import * as crypto from 'crypto';\ncrypto.createCipheriv('aes-128-cbc', key, iv);\ncrypto.createCipheriv('AES128', key, iv);",
            errors: [
                { messageId: 'insecure', line: 2 },
                { messageId: 'insecure', line: 3 },
            ],
        },
    ],
});
