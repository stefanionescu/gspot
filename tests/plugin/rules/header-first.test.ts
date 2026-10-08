import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#plugin/rules/public.ts';
import { createRuleTester } from '#tests/harness/rule-tester.ts';

test.each(['class Sample {}', 'export class Sample {}', 'export default class Sample {}'])(
    'the default JavaScript parser preserves declaration comments and fixes import headers before %s',
    (declaration) => {
        const linter = new Linter({ configType: 'flat' });
        const config: object = { plugins: { gspot: plugin }, rules: { 'gspot/header-first': 'error' } };
        const valid = `import './first.js';\n// Explains the class.\n${declaration}`;
        const messages = linter.verify(valid, config);
        const fixed = linter.verifyAndFix(
            `import './first.js';\n// The file header.\nimport './second.js';\n${declaration}`,
            config,
        );
        expect(messages).toStrictEqual([]);
        expect(fixed).toStrictEqual({
            fixed: true,
            messages: [],
            output: `// The file header.\nimport './first.js';\nimport './second.js';\n${declaration}`,
        });
    },
);

createRuleTester().run('header-first', plugin.rules['header-first'], {
    valid: [
        "import { a } from './a';\n\n// Explains the complete\n// declaration below.\nexport const b = a;",

        "// The file header.\nimport { a } from './a';\n\nexport const b = a;",
        "import { a } from './a';\n\n// Explains b.\nexport const b = a;",
        "import { a } from './a';\n// @ts-expect-error\nconsole.log(a);",
        "import { a } from './a';\n\n/**\n * Doc for b.\n */\nexport const b = a;",
        {
            code: "import { a } from './a';\n\n/** Documents the required callback. */\n// eslint-enable no-unused-vars\nexport function callback(value) { return a; }",
        },
        "import { a } from './a';\n\n/** Documents the external value. */\n// @ts-expect-error External declaration is incomplete.\nexport const b = a;",
        // A decorator above export belongs to the class, so the doc comment above it leads the class.
        "import { Injectable } from './a';\n\n/** Builds greetings. */\n@Injectable()\nexport class Greeter {}",

        "// The file header.\nimport { a } from './a';\nimport { b } from './b';\n\nexport const c = a + b;",
        "import { a } from './a';\nimport { b } from './b';\n\n// Explains c.\nexport const c = a + b;",
        "import { a } from './a';\n/* global process */\nimport { b } from '../b';",
        "import { a } from './a';\n// @ts-expect-error The declaration is incomplete.\nimport { b } from './b';",
        "import { a } from './a';",
        "import { a } from './a';\n\nconst value = 1;\n// A note between two blocks is not inside either.\nimport { b } from './b';",
    ],
    invalid: [
        {
            code: "import { a } from './a';\n// Explains the complete\n// import below.\nimport { c } from './c';\nexport const b = a + c;",
            output: "// Explains the complete\n// import below.\nimport { a } from './a';\nimport { c } from './c';\nexport const b = a + c;",
            errors: [{ messageId: 'headerFirst' }],
        },
        {
            code: "import { a } from './a'; // trailing\nexport const b = a;",
            output: "// trailing\nimport { a } from './a';\nexport const b = a;",
            errors: [{ messageId: 'headerFirst' }],
        },
        {
            code: "import { a } from './a';\n\n// The complete\n// file header.\n\n\nexport const b = a;",
            output: "// The complete\n// file header.\n\nimport { a } from './a';\n\nexport const b = a;",
            errors: [{ messageId: 'headerFirst' }],
        },

        {
            code: "import { a } from './a';\n/* header */\n\n\nexport const b = a;",
            output: "/* header */\n\nimport { a } from './a';\nexport const b = a;",
            errors: [{ messageId: 'headerFirst' }],
        },
        {
            code: "import { a } from './a';\n// the b helper\nimport { b } from './b';",
            output: "// the b helper\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'headerFirst', line: 2 }],
        },
        {
            code: "import { a } from './a'; // trailing\nimport { b } from './b';",
            output: "// trailing\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'headerFirst', line: 1 }],
        },
        {
            code: "import { a } from './a';\nimport { b } from './b'; // last line",
            output: "// last line\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'headerFirst', line: 2 }],
        },
        {
            code: "import { a } from './a';\n/* block */\nimport { b } from './b';",
            output: "/* block */\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'headerFirst', line: 2 }],
        },
        {
            code: "import {\n    a, // inside the braces\n} from './a';\nimport { b } from './b';",
            output: "// inside the braces\nimport {\n    a,\n} from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'headerFirst', line: 2 }],
        },
        {
            code: "import { a } from './a';\n// one\n// two\nimport { b } from './b';",
            output: "// one\n// two\nimport { a } from './a';\nimport { b } from './b';",
            errors: [{ messageId: 'headerFirst', line: 2 }],
        },
    ],
});

createRuleTester('/repo', { sourceType: 'commonjs' }).run('header-first CommonJS', plugin.rules['header-first'], {
    valid: [
        {
            code: "const a = require('./a');\n\n// Explains b.\nmodule.exports = a;",
        },
        {
            code: "const a = require('./a');\nconst b = require('./b');\n// Explains c.\nmodule.exports = a + b;",
        },
    ],
    invalid: [
        {
            code: "const a = require('./a');\n// the b helper\nconst b = require('./b');",
            output: "// the b helper\nconst a = require('./a');\nconst b = require('./b');",
            errors: [{ messageId: 'headerFirst', line: 2 }],
        },
    ],
});
