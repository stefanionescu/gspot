import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('unverified-hostname', plugin.rules['unverified-hostname'], {
    valid: [
        "import tls from 'tls';\ntls.connect(443, 'example.com', { checkServerIdentity: (host, cert) => tls.checkServerIdentity(host, cert) });",
        "import https from 'https';\nhttps.request({ checkServerIdentity: () => { return new Error('mismatch'); } });",
    ],
    invalid: [
        {
            code: "import https from 'https';\nimport tls from 'tls';\nhttps.request({ host: 'x', rejectUnauthorized: false });\nhttps.request({ checkServerIdentity: function() { return undefined; } });\nhttps.request({ checkServerIdentity: () => { if (a) { return true; } } });\nhttps.request({ checkServerIdentity: () => { if (a) { return new Error('x'); } } });\nhttps.request({ checkServerIdentity: () => undefined });\ntls.connect(443, 'h', { checkServerIdentity: function(host, cert) { const f = () => { return new Error(); }; } });\nhttps.request({ checkServerIdentity: () => {} });",
            errors: [
                { messageId: 'unverified', line: 3 },
                { messageId: 'unverified', line: 5 },
                { messageId: 'unverified', line: 8 },
                { messageId: 'unverified', line: 9 },
            ],
        },
    ],
});
