import { noRenamedImports } from '#eslint-plugin/rules/structure/no-renamed-imports.ts';
import { buildRuleTester, writePackageFolders } from '#tests/setup/eslint/rule-tester.ts';

const root = writePackageFolders({
    '.': { dependencies: { '@acme/shared': 'workspace:*', '@acme/published': '^1.0.0' } },
});
const filename = `${root}/source.ts`;

buildRuleTester({ root }).run('no-renamed-imports', noRenamedImports, {
    valid: [
        "import { stringify as stringifyToml } from '@decimalturn/toml-patch';",
        {
            code: "import { RULES } from './rules.ts';\nimport { RULES as NAMING_RULES } from '#cli/config/naming.ts';",
            name: 'another import binds the bare name',
        },
        {
            code: "import { parse as parseRow } from './rows.ts';\nfunction parse() {}",
            name: 'a declaration of the file binds the bare name',
        },
        {
            code: "import { read as readRow } from './rows.ts';\nexport const count = (read: number) => read + readRow();",
            name: 'a parameter of the file binds the bare name',
        },
        "import { RULES } from '#cli/config/naming.ts';",
        "import { default as rules } from './rules.ts';",
        "import { 'naming-rules' as rules } from './rules.ts';",
        { code: "import { build as buildShared } from '@acme/published/build';", filename },
    ],
    invalid: [
        {
            code: "import { RULES as NAMING_RULES } from '#cli/config/naming.ts';",
            errors: [{ messageId: 'renamed', column: 10 }],
        },
        { code: "import { parse as parseRow } from '../rows.ts';", errors: [{ messageId: 'renamed' }] },
        { code: "import type { Row as TableRow } from './rows.ts';", errors: [{ messageId: 'renamed' }] },
        {
            code: "import { one as first, two } from './rows.ts';",
            errors: [{ messageId: 'renamed', column: 10 }],
        },
        {
            code: "import { build as buildShared } from '@acme/shared/build';",
            name: 'a workspace package is a module of the repository',
            filename,
            errors: [{ messageId: 'renamed' }],
        },
    ],
});
