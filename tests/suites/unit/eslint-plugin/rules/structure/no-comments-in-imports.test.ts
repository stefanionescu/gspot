import { expect, test } from 'bun:test';
import { Linter } from 'eslint';

import plugin from '#eslint-plugin/plugin.ts';
import { noCommentsInImports } from '#eslint-plugin/rules/structure/no-comments-in-imports.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

test.each(['class Sample {}', 'export class Sample {}', 'export default class Sample {}'])(
    'the default JavaScript parser preserves declaration comments and fixes import headers before %s',
    (declaration) => {
        const linter = new Linter({ configType: 'flat' });
        const config: object = { plugins: { gspot: plugin }, rules: { 'gspot/no-comments-in-imports': 'error' } };
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

buildRuleTester().run('no-comments-in-imports', noCommentsInImports, {
    valid: [
        "import { a } from './a';\n// @ts-expect-error The declaration is incomplete.\nimport { b } from './b';",
        "import { a } from './a';\n/* global process */\nimport { b } from '../b';",
        "import { a } from './a';\n/* @ts-expect-error The declaration is incomplete. */\nimport { b } from './b';",
        "import { a } from './a';\n\n// Explains the complete\n// declaration below.\nexport const b = a;",

        "// The file header.\nimport { a } from './a';\n\nexport const b = a;",
        "import { a } from './a';\n\n// Explains b.\nexport const b = a;",
        "import { a } from './a';\n// @ts-expect-error\nconsole.log(a);",
        "import { a } from './a';\n\n/**\n * Doc for b.\n */\nexport const b = a;",
        "import { a } from './a';\n\n// TYPES\n\n/** Doc for b. */\nexport const b = a;",
        "import { a } from './a';\n\n// Explains the overload\n// that follows.\n\n/**\n * Doc for b.\n */\nexport function b(value) { return a(value); }",
        {
            code: "import { a } from './a';\n\n/** Documents the required callback. */\n// eslint-enable no-unused-vars\nexport function callback(value) { return a; }",
        },
        "import { a } from './a';\n\n/** Documents the external value. */\n// @ts-expect-error External declaration is incomplete.\nexport const b = a;",
        "import { Injectable } from './a';\n\n/** Builds greetings. */\n@Injectable()\nexport class Greeter {}",

        "import { a } from './a';",
        "import { a } from './a';\n\nconst value = 1;\n// A note between two blocks is not inside either.\nimport { b } from './b';",
    ],
    invalid: (
        [
            [
                "import { a } from './a';\n// Explains the complete\n// import below.\nimport { c } from './c';\nexport const b = a + c;",
                "// Explains the complete\n// import below.\nimport { a } from './a';\nimport { c } from './c';\nexport const b = a + c;",
                undefined,
            ],
            [
                "import { a } from './a'; // trailing\nexport const b = a;",
                "// trailing\nimport { a } from './a';\nexport const b = a;",
                undefined,
            ],
            [
                "import { a } from './a';\n// the b helper\nimport { b } from './b';",
                "// the b helper\nimport { a } from './a';\nimport { b } from './b';",
                2,
            ],
            [
                "import { a } from './a'; // trailing\nimport { b } from './b';",
                "// trailing\nimport { a } from './a';\nimport { b } from './b';",
                1,
            ],
            [
                "import { a } from './a';\nimport { b } from './b'; // last line",
                "// last line\nimport { a } from './a';\nimport { b } from './b';",
                2,
            ],
            [
                "import { a } from './a';\n/* block */\nimport { b } from './b';",
                "/* block */\nimport { a } from './a';\nimport { b } from './b';",
                2,
            ],
            [
                "import {\n    a, // inside the braces\n} from './a';\nimport { b } from './b';",
                "// inside the braces\nimport {\n    a,\n} from './a';\nimport { b } from './b';",
                2,
            ],
            [
                "import { a } from './a';\n// one\n// two\nimport { b } from './b';",
                "// one\n// two\nimport { a } from './a';\nimport { b } from './b';",
                2,
            ],
        ] as const
    ).map(([code, output, line]) => ({
        code,
        output,
        errors: [{ messageId: 'comment' as const, ...(line !== undefined && { line }) }],
    })),
});

buildRuleTester({ languageOptions: { sourceType: 'commonjs' } }).run(
    'no-comments-in-imports CommonJS',
    noCommentsInImports,
    {
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
                errors: [{ messageId: 'comment', line: 2 }],
            },
        ],
    },
);

buildRuleTester().run('no-comments-in-imports regressions', noCommentsInImports, {
    valid: [],
    invalid: [
        {
            code: "import a from './a';\n// one\nimport b from './b';\n// two\nimport c from './c';\n",
            name: 'two misplaced comments in one block report twice',
            errors: [{ messageId: 'comment' }, { messageId: 'comment' }],
            output: [
                "// one\nimport a from './a';\nimport b from './b';\n// two\nimport c from './c';\n",
                "// one\n// two\nimport a from './a';\nimport b from './b';\nimport c from './c';\n",
            ],
        },
        {
            code: "import a from './a';\n// note\nimport b = require('./b');\n",
            name: 'a comment before an import-equals require in the block reports',
            errors: [{ messageId: 'comment' }],
            output: "// note\nimport a from './a';\nimport b = require('./b');\n",
        },
        {
            code: "import a from './a';\n// eslint rules are strict here\nimport b from './b';\n",
            name: 'a prose comment that starts with the word eslint reports',
            errors: [{ messageId: 'comment' }],
            output: "// eslint rules are strict here\nimport a from './a';\nimport b from './b';\n",
        },
        {
            code: "import { a } from './a';\n\n// The complete\n// file header.\n\n\nexport const b = a;",
            name: 'a comment after the imports that leads nothing reports without a fix',
            errors: [{ messageId: 'comment', line: 3 }],
            output: null,
        },
        {
            code: "import { a } from './a';\n/* header */\n\n\nexport const b = a;",
            name: 'a block comment after the imports that leads nothing reports without a fix',
            errors: [{ messageId: 'comment', line: 2 }],
            output: null,
        },
        {
            code: "import './a';\n//# sourceMappingURL=entry.js.map\n",
            name: 'a comment after the imports of an imports-only file stays where it is',
            errors: [{ messageId: 'comment', line: 2 }],
            output: null,
        },
    ],
});

test.each(['/* eslint-env node */', '// eslint-disable-next-line no-console'])(
    'the comment rule permits the directive %s',
    (directive) => {
        const linter = new Linter({ configType: 'flat' });
        const config: object = {
            plugins: { gspot: plugin },
            rules: { 'gspot/no-comments-in-imports': 'error' },
        };
        const messages = linter.verify(`import a from './a';\n${directive}\nimport b from './b';`, config, {
            allowInlineConfig: false,
        });
        expect(messages).toStrictEqual([]);
    },
);
