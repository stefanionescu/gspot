import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noPublicTemporaryPath } from '#eslint-plugin/rules/security/no-public-temporary-path.ts';

buildRuleTester().run('no-public-temporary-path', noPublicTemporaryPath, {
    valid: [
        'const path = "/tmp";',
        'const path = `/tmp/file`;',
        String.raw`const path = "C:\\private\\Temp\\file";`,
        String.raw`const path = "C:\\Temporary\\file";`,
        String.raw`const path = "C:\\\\Temp\\file";`,
        'process.env.HOME;',
        'process.env["TMPDIR"];',
        'process["env"].TMPDIR;',
        'other.env.TMPDIR;',
        'process.TMPDIR;',
    ],
    invalid: [
        ...['tmp/file'].map((path) => ({
            code: `const path = "/${path}";`,
            errors: [{ messageId: 'directory' as const }],
        })),
        ...[
            String.raw`const path = "C:\\Temp\\file";`,
            String.raw`const path = "D:\\TMP";`,
            String.raw`const path = "C:\\Windows\\Temp\\file";`,
            String.raw`const path = "\Temp\file";`,
            'process.env.TMPDIR;',
        ].map((code) => ({ code, errors: [{ messageId: 'directory' as const }] })),
    ],
});
