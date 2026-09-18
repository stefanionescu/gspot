import { tester } from '#plugin-tests/harness/tester.ts';
import { noTrivialFiles } from '#plugin/rules/no-trivial-files.ts';

tester().run('no-trivial-files', noTrivialFiles, {
    valid: [
        { code: "import { a } from './a';\nexport const b = a + 1;", filename: '/repo/src/b.ts' },
        {
            code: "import { start } from './start';\nstart();\nexport function stop() {}",
            filename: '/repo/src/main.ts',
        },
        { code: "import { start } from './start';\nstart();", filename: '/repo/src/index.ts' },
        {
            code: "// This file was automatically generated\nimport { start } from './start';\nstart();",
            filename: '/repo/src/generated.ts',
        },
        { code: "import { app } from './app';\napp.use(() => 1);", filename: '/repo/src/wire.ts' },
        { code: 'const x = 1;', filename: '/repo/src/x.ts' },
    ],
    invalid: [
        {
            code: "import { start } from './start';\nstart();",
            filename: '/repo/src/main.ts',
            errors: [{ messageId: 'trivial' }],
        },
        {
            code: "import { server } from './server';\nawait server.listen(3000);\nserver.log();",
            filename: '/repo/src/boot.ts',
            errors: [{ messageId: 'trivial' }, { messageId: 'trivial' }],
        },
        {
            code: "const { run } = require('./run');\nrun();",
            filename: '/repo/scripts/go.js',
            errors: [{ messageId: 'trivial' }],
        },
    ],
});
