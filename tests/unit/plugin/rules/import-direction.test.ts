import { tester } from '#tests/support/plugin/tester.ts';
import { importDirection } from '#plugin/rules/import-direction.ts';

const aliases = { '@/': 'src/', '@tests/': 'tests/', '@config/': 'config/', '@app-types/': 'types/' };

tester().run('import-direction', importDirection, {
    valid: [
        { code: "import type { A } from './a';", filename: '/repo/types/b.ts', options: [{ aliases }] },
        { code: "import { type A } from '@/turn/build';", filename: '/repo/types/b.ts', options: [{ aliases }] },
        { code: "import { a } from '@/turn/build';", filename: '/repo/src/other.ts', options: [{ aliases }] },
        { code: "import { a } from '@/turn/index';", filename: '/repo/tests/unit/a.test.ts', options: [{ aliases }] },
        { code: "import { a } from '@/turn/contracts';", filename: '/repo/tests/harness/a.ts', options: [{ aliases }] },
        {
            code: "import type { A } from '@/turn/internal';",
            filename: '/repo/tests/unit/a.test.ts',
            options: [{ aliases }],
        },
        { code: "import { a } from '@app-types/a';", filename: '/repo/config/a.ts', options: [{ aliases }] },
        { code: "import { a } from 'package';", filename: '/repo/config/a.ts', options: [{ aliases }] },
        {
            code: "import { a } from '../src/turn/build';",
            filename: '/repo/api/tests/unit/a.test.ts',
            options: [{ aliases, scope: 'api', contracts: ['build'] }],
        },
    ],
    invalid: [
        {
            code: "import { a } from '@/turn/build';",
            filename: '/repo/types/b.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'typesOnlyTypes', data: { source: '@/turn/build', role: 'runtime' } }],
        },
        {
            code: "import { helper } from '@tests/harness/helper';",
            filename: '/repo/src/turn/build.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'runtimeToTests' }],
        },
        {
            code: "import { internal } from '@/turn/internal';",
            filename: '/repo/tests/unit/a.test.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'testsToInternals' }],
        },
        {
            code: "import { internal } from '../../src/turn/internal';",
            filename: '/repo/tests/harness/a.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'testsToInternals' }],
        },
        {
            code: "import { app } from '@/app/create';",
            filename: '/repo/config/a.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'configToRuntime' }],
        },
        {
            code: "import { app } from '@/app/create';",
            filename: '/repo/src/env/a.ts',
            options: [{ aliases }],
            errors: [{ messageId: 'configToRuntime' }],
        },
    ],
});
