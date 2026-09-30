import { tester } from '#tests/support/plugin/tester.ts';
import { noImportComments } from '#plugin/rules/no-import-comments.ts';

tester().run('no-import-comments', noImportComments, {
    valid: [
        "// The file header.\nimport { a } from './a';\nimport { b } from './b';\n\nexport const c = a + b;",
        "import { a } from './a';\nimport { b } from './b';\n\n// Explains c.\nexport const c = a + b;",
        "import { a } from './a';\n/* global process */\nimport { b } from '../b';",
        "import { a } from './a';\n// @ts-expect-error The declaration is incomplete.\nimport { b } from './b';",
        "import { a } from './a';",
        "import { a } from './a';\n\nconst value = 1;\n// A note between two blocks is not inside either.\nimport { b } from './b';",
        {
            code: "const a = require('./a');\nconst b = require('./b');\n// Explains c.\nmodule.exports = a + b;",
            options: [{ allowRequire: true }],
        },
    ],
    invalid: [
        {
            code: "import { a } from './a';\n// the b helper\nimport { b } from './b';",
            output: "// the b helper\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'comment', line: 2 }],
        },
        {
            code: "import { a } from './a'; // trailing\nimport { b } from './b';",
            output: "// trailing\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'comment', line: 1 }],
        },
        {
            code: "import { a } from './a';\nimport { b } from './b'; // last line",
            output: "// last line\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'comment', line: 2 }],
        },
        {
            code: "import { a } from './a';\n/* block */\nimport { b } from './b';",
            output: "/* block */\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'comment', line: 2 }],
        },
        {
            code: "import {\n    a, // inside the braces\n} from './a';\nimport { b } from './b';",
            output: "// inside the braces\nimport {\n    a,\n} from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'comment', line: 2 }],
        },
        {
            code: "import { a } from './a';\n// one\n// two\nimport { b } from './b';",
            output: "// one\n// two\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'comment', line: 2 }],
        },
        {
            code: "const a = require('./a');\n// the b helper\nconst b = require('./b');",
            output: "// the b helper\nconst a = require('./a');\nconst b = require('./b');",
            options: [{ allowRequire: true }],
            errors: [{ messageId: 'comment', line: 2 }],
        },
    ],
});
