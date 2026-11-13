import { noHardcodedIp } from '#eslint-plugin/rules/networks/no-hardcoded-ip.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-hardcoded-ip', noHardcodedIp, {
    valid: ["const host = '127.0.0.1';\nconst version = '1.2.3';", 'const port = 8080;'],
    invalid: [
        {
            code: "const a = '192.168.0.1';\nconst c = '10.0.0.0/8';\nconst e = '::1';\nconst f = '0x7f.0.0.01';\nconst g = '0300.0250.0.01';\nconst h = 'fe80::1ff:fe23:4567:890a';\nconst k = '::ffff:0:127.0.0.1';",
            errors: [
                { messageId: 'hardcoded', line: 1 },
                { messageId: 'hardcoded', line: 2 },
                { messageId: 'hardcoded', line: 5 },
                { messageId: 'hardcoded', line: 6 },
            ],
        },
    ],
});
