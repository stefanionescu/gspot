import { unverifiedCertificate } from '#eslint-plugin/rules/networks/unverified-certificate.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('unverified-certificate', unverifiedCertificate, {
    valid: [
        "import https from 'https';\nhttps.request({ host: 'example.com', ca: authority });",
        'client.request({ rejectUnauthorized: false });',
    ],
    invalid: [
        {
            code: "import https from 'https';\nimport tls from 'tls';\nconst request = require('request');\nhttps.request({ host: 'x', rejectUnauthorized: false });\nconst options = { rejectUnauthorized: false };\nhttps.request(options, cb);\ntls.connect(443, 'x', { rejectUnauthorized: false });\nhttps.request({ rejectUnauthorized: true });",
            errors: [
                { messageId: 'unverified', line: 4 },
                { messageId: 'unverified', line: 6 },
                { messageId: 'unverified', line: 7 },
            ],
        },
    ],
});
