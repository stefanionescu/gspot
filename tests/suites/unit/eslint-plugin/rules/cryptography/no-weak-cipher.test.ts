import { noWeakCipher } from '#eslint-plugin/rules/cryptography/no-weak-cipher.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-weak-cipher', noWeakCipher, {
    valid: [
        "import crypto from 'crypto';\ncrypto.createCipheriv('aes-256-gcm', key, iv);",
        "cipher.createCipheriv('des', key, iv);",
    ],
    invalid: [
        {
            code: "import crypto from 'crypto';\ncrypto.createCipheriv('des-ede3-cbc', key, iv);\nconst algo = 'rc4';\ncrypto.createCipheriv(algo, key, iv);\ncrypto.createCipheriv(other, key, iv);\ncrypto.createCipheriv('BF-CBC', key, iv);",
            errors: [
                { messageId: 'weak', line: 2 },
                { messageId: 'weak', line: 4 },
                { messageId: 'weak', line: 6 },
            ],
        },
    ],
});
