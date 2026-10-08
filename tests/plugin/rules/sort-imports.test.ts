import plugin from '#plugin/rules/public.ts';
import { createRuleTester } from '#tests/harness/rule-tester.ts';

createRuleTester().run('sort-imports', plugin.rules['sort-imports'], {
    valid: [
        "import 'long-side-effect';\nimport 'a';",
        "import { long } from 'long';\nimport 'effect';\nimport a from 'a';",

        "import a from 'a';\nimport { bb } from 'bb';\nimport { ccc } from 'ccc';",
        "import a from 'a';\n\nimport {\n    long,\n    longer,\n} from 'multi';",
        "import a from 'a';",
        "import { a, bb, ccc } from 'x';",
        "import a, { b, cc } from 'x';",
        "import { a, type Bb } from 'x';",
        "import {\n    a,\n    bb,\n    ccc,\n} from 'x';",
        "import { z } from 'z';\nimport { yy } from 'yy';\n// comment for x\nimport { xxx } from 'xxx';",
    ],
    invalid: [
        {
            code: "import { bb, a } from 'x';",
            output: "import { a, bb } from 'x';",
            errors: [{ messageId: 'names' }],
        },
        {
            code: "import a, { cc, b } from 'x';",
            output: "import a, { b, cc } from 'x';",
            errors: [{ messageId: 'names' }],
        },
        {
            code: "import {\n    ccc,\n    a,\n    bb,\n} from 'x';",
            output: "import {\n    a,\n    bb,\n    ccc,\n} from 'x';",
            errors: [{ messageId: 'names' }],
        },
        {
            // A comment above a name moves with the name, so a directive keeps covering the line it names.
            code: "import {\n    bb,\n    // kept with a\n    a,\n} from 'x';",
            output: "import {\n    // kept with a\n    a,\n    bb,\n} from 'x';",
            errors: [{ messageId: 'names' }],
        },
        {
            code: "// The complete\n// file header.\nimport { bbb } from 'bbb';\nimport a from 'a';",
            output: "// The complete\n// file header.\nimport a from 'a';\nimport { bbb } from 'bbb';",
            errors: [{ messageId: 'layout' }],
        },

        {
            code: "import { ccc } from 'ccc';\nimport a from 'a';",
            output: "import a from 'a';\nimport { ccc } from 'ccc';",
            errors: [{ messageId: 'layout' }],
        },
        {
            code: "import {\n    long,\n    longer,\n} from 'multi';\nimport a from 'a';",
            output: "import a from 'a';\n\nimport {\n    long,\n    longer,\n} from 'multi';",
            errors: [{ messageId: 'layout' }],
        },
        {
            code: "import { bb } from 'bb';\nimport { aa } from 'aa';",
            output: "import { aa } from 'aa';\nimport { bb } from 'bb';",
            errors: [{ messageId: 'layout' }],
        },
        {
            code: "import { z } from 'z';\n// keep me with b\nimport { bbb } from 'bbb';\nimport a from 'a';",
            output: "import a from 'a';\nimport { z } from 'z';\n// keep me with b\nimport { bbb } from 'bbb';",
            errors: [{ messageId: 'layout' }],
        },
        {
            // A comment that opens the file is its header, not a note on the import under it.
            code: "// The file header stays above the block.\nimport { bbb } from 'bbb';\nimport a from 'a';",
            output: "// The file header stays above the block.\nimport a from 'a';\nimport { bbb } from 'bbb';",
            errors: [{ messageId: 'layout' }],
        },
    ],
});

createRuleTester('/repo', { sourceType: 'commonjs' }).run('sort-imports CommonJS', plugin.rules['sort-imports'], {
    valid: [
        {
            code: "require('long-side-effect');\nrequire('a');",
        },
        {
            code: "const a = require('a');\nconst bb = require('bb');",
        },
    ],
    invalid: [],
});
