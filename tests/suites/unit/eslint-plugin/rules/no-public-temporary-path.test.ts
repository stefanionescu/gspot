import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-public-temporary-path', plugin.rules['no-public-temporary-path'], {
    valid: [
        'const path = "/tmp";',
        'const path = "/home/private/tmp/file";',
        'const path = "relative/tmp/file";',
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
        ...[
            'tmp/file',
            'var/tmp/file',
            'usr/tmp/file',
            'dev/shm/file',
            'dev/mqueue/file',
            'run/lock/file',
            'var/run/lock/file',
            'Library/Caches/file',
            'Users/Shared/file',
            'private/tmp/file',
            'private/var/tmp/file',
            'TMP/file',
        ].map((path) => ({ code: `const path = "/${path}";`, errors: [{ messageId: 'directory' as const }] })),
        ...[
            String.raw`const path = "C:\\Temp\\file";`,
            String.raw`const path = "D:\\TMP";`,
            String.raw`const path = "C:\\Windows\\Temp\\file";`,
            String.raw`const path = "\Temp\file";`,
            'process.env.TMPDIR;',
            'process.env.TMP;',
            'process.env.TEMPDIR;',
            'process.env.TEMP;',
            'process[env][TMPDIR];',
            'function read(process) { return process.env.TMP; }',
        ].map((code) => ({ code, errors: [{ messageId: 'directory' as const }] })),
    ],
});
