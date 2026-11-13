import { noPublicFilePermissions } from '#eslint-plugin/rules/security/no-public-file-permissions.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-public-file-permissions', noPublicFilePermissions, {
    valid: [
        "import fs from 'fs';\nfs.chmodSync('/tmp/report', config.mode);",
        "import fs from 'fs';\nfs.chmodSync('/tmp/report', base | 0o700);",
        "import fs from 'fs';\nfs.chmodSync('7za', 0o700);",
    ],
    invalid: [
        { code: "import process from 'process';\nprocess.umask(0o000);", errors: [{ messageId: 'permissive' }] },
        { code: 'await handle.chmod(0o777);', errors: [{ messageId: 'permissive' }] },
        {
            code: "const fs = require('fs');\nfs.chmodSync('/tmp/a', 0o777);\nfs.chmod('/tmp/a', '777', cb);\nfs.chmodSync('/tmp/a', fs.constants.S_IRWXU | fs.constants.S_IRWXO);\nfs.chmodSync('/tmp/a', fs.constants.S_IRWXU | fs.constants.S_IRWXG);\nconst mode = 0o776;\nfs.promises.chmod('/a', mode);",
            errors: [
                { messageId: 'permissive', line: 2 },
                { messageId: 'permissive', line: 3 },
                { messageId: 'permissive', line: 4 },
                { messageId: 'permissive', line: 7 },
            ],
        },
    ],
});
