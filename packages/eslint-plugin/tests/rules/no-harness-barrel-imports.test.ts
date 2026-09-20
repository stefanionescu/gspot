import { tester } from '#plugin-tests/harness/tester.ts';
import { noHarnessBarrelImports } from '#plugin/rules/no-harness-barrel-imports.ts';

const barrels = ['@tests/harness', '@tests/harness/index.js'];

tester().run('no-harness-barrel-imports', noHarnessBarrelImports, {
    valid: [
        {
            code: "import { a } from '@tests/harness/a.js';",
            filename: '/repo/tests/harness/b.ts',
            options: [{ barrels }],
        },
        { code: "import { a } from '@tests/harness';", filename: '/repo/tests/unit/b.test.ts', options: [{ barrels }] },
    ],
    invalid: [
        {
            code: "import { a } from '@tests/harness';",
            filename: '/repo/tests/harness/b.ts',
            options: [{ barrels }],
            errors: [{ messageId: 'barrel', data: { source: '@tests/harness' } }],
        },
        {
            code: "import { a } from '@tests/harness/index.js';",
            filename: '/repo/tests/harness/nested/b.ts',
            options: [{ barrels }],
            errors: [{ messageId: 'barrel' }],
        },
    ],
});
