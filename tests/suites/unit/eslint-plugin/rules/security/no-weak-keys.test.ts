import { noWeakKeys } from '#eslint-plugin/rules/security/no-weak-keys.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-weak-keys', noWeakKeys, {
    valid: [
        "import crypto from 'crypto';\ncrypto.generateKeyPairSync('rsa', { modulusLength: 4096 });",
        "crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });",
        "crypto.generateKeyPairSync('rsa', options);",
    ],
    invalid: [
        {
            code: "const crypto = require('crypto');\ncrypto.generateKeyPairSync('rsa', { modulusLength: 1024 });\ncrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });\ncrypto.generateKeyPair('dsa', { modulusLength: 2048, divisorLength: 160 }, cb);\nconst opts = { namedCurve: 'secp112r1' };\ncrypto.generateKeyPairSync('ec', opts);\ncrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });\ngenerateKeyPairSync('rsa', { modulusLength: 512 });",
            errors: [
                { messageId: 'shortKey', line: 2 },
                { messageId: 'shortKey', line: 4 },
                { messageId: 'weakCurve', line: 5 },
            ],
        },
    ],
});
