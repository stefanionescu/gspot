import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('unverified-hostname', plugin.rules['unverified-hostname'], {
    valid: [
        "import tls from 'tls';\ntls.connect(443, 'example.com', { checkServerIdentity: (host, cert) => tls.checkServerIdentity(host, cert) });",
        "import https from 'https';\nhttps.request({ checkServerIdentity: () => { return new Error('mismatch'); } });",
        "import https from 'https';\nhttps.request({ checkServerIdentity: () => { return true; } });",
        "import https from 'https';\nhttps.request({ checkServerIdentity: () => new Error('mismatch') });",
        "import https from 'https';\nhttps.request({ host: 'x', rejectUnauthorized: false });",
    ],
    invalid: [
        {
            code: "import https from 'https';\nimport tls from 'tls';\nhttps.request({ checkServerIdentity: function() { return undefined; } });\nhttps.request({ checkServerIdentity: () => { if (a) { return true; } } });\nhttps.request({ checkServerIdentity: () => { if (a) { return new Error('x'); } } });\nhttps.request({ checkServerIdentity: () => undefined });\ntls.connect(443, 'h', { checkServerIdentity: function(host, cert) { const f = () => { return new Error(); }; } });\nhttps.request({ checkServerIdentity: () => {} });\nhttps.request({ checkServerIdentity: () => { if (a) { return null; } return; } });\nhttps.request({ checkServerIdentity: () => false });",
            errors: [
                { messageId: 'unverified', line: 3 },
                { messageId: 'unverified', line: 6 },
                { messageId: 'unverified', line: 7 },
                { messageId: 'unverified', line: 8 },
                { messageId: 'unverified', line: 9 },
                { messageId: 'unverified', line: 10 },
            ],
        },
    ],
});
