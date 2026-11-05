import { noHardcodedIp } from '#eslint-plugin/rules/networks/no-hardcoded-ip.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-hardcoded-ip', noHardcodedIp, {
    valid: ["const host = '127.0.0.1';\nconst documentation = '192.0.2.10';\nconst version = '1.2.3';"],
    invalid: [
        {
            code: "const a = '192.168.0.1';\nconst b = '127.0.0.1';\nconst c = '10.0.0.0/8';\nconst d = '2001:db8::1';\nconst e = '::1';\nconst f = '0x7f.0.0.01';\nconst g = '0300.0250.0.01';\nconst h = 'fe80::1ff:fe23:4567:890a';\nconst i = '1.2.3';\nconst j = '203.0.113.5';\nconst k = '::ffff:0:127.0.0.1';\nconst l = '255.255.255.255';\nconst m = '8.8.8.8/32';",
            errors: [
                { messageId: 'hardcoded', line: 1 },
                { messageId: 'hardcoded', line: 3 },
                { messageId: 'hardcoded', line: 7 },
                { messageId: 'hardcoded', line: 8 },
                { messageId: 'hardcoded', line: 13 },
            ],
        },
    ],
});
