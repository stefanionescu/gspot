import { tester } from '#tests/support/plugin/tester.ts';
import { headerCommentsBeforeImports } from '#plugin/rules/header-comments-before-imports.ts';

tester().run('header-comments-before-imports', headerCommentsBeforeImports, {
    valid: [
        "// The file header.\nimport { a } from './a';\n\nexport const b = a;",
        "import { a } from './a';\n\n// Explains b.\nexport const b = a;",
        "import { a } from './a'; // trailing\nexport const b = a;",
        "import { a } from './a';\n// @ts-expect-error\nconsole.log(a);",
        "import { a } from './a';\n\n/**\n * Doc for b.\n */\nexport const b = a;",
        {
            code: "import { a } from './a';\n\n/** Documents the required callback. */\n// eslint-enable no-unused-vars\nexport function callback(value) { return a; }",
        },
        "import { a } from './a';\n\n/** Documents the external value. */\n// @ts-expect-error External declaration is incomplete.\nexport const b = a;",
        // A decorator above export belongs to the class, so the doc comment above it leads the class.
        "import { Injectable } from './a';\n\n/** Builds greetings. */\n@Injectable()\nexport class Greeter {}",
        "import { a } from './a';\n// leading for import\nimport { c } from './c';\nexport const b = a + c;",
        {
            code: "const a = require('./a');\n\n// Explains b.\nmodule.exports = a;",
            options: [{ allowRequire: true }],
        },
    ],
    invalid: [
        {
            code: "import { a } from './a';\n\n// The file header.\n\n\nexport const b = a;",
            output: "// The file header.\n\nimport { a } from './a';\n\nexport const b = a;",
            errors: [{ messageId: 'headerFirst' }],
        },
        {
            code: "import { a } from './a';\n/* header */\n\n\nexport const b = a;",
            output: "/* header */\n\nimport { a } from './a';\nexport const b = a;",
            errors: [{ messageId: 'headerFirst' }],
        },
    ],
});
