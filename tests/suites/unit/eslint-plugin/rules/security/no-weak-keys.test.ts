import { noWeakKeys } from '#eslint-plugin/rules/security/no-weak-keys.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-weak-keys', noWeakKeys, {
    valid: [
        "crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });",
        "crypto.generateKeyPairSync('rsa', options);",
    ],
    invalid: [
        {
            code: "const crypto = require('crypto');\ncrypto.generateKeyPairSync('rsa', { modulusLength: 1024 });\ncrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });\nconst opts = { namedCurve: 'secp112r1' };\ncrypto.generateKeyPairSync('ec', opts);",
            errors: [
                { messageId: 'shortKey', line: 2 },
                { messageId: 'weakCurve', line: 4, data: { curve: 'secp112r1' } },
            ],
        },
        {
            code: "crypto.generateKeyPairSync('dsa', { modulusLength: 2048, divisorLength: 160 });",
            errors: [{ messageId: 'shortKey', data: { option: 'divisorLength', minimum: '224', algorithm: 'dsa' } }],
        },
    ],
});
