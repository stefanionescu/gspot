import { preferNativeLodash } from '#eslint-plugin/rules/utilities/prefer-native-lodash.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

const rule = preferNativeLodash;

buildRuleTester().run('prefer-native-lodash', rule, {
    valid: [
        'import _ from "./utilities";\n_.isArray(value);',
        'import _ from "lodash";\n_(values).keys();',
        'import _ from "lodash";\n_.map(values, read);',
        'import _ from "lodash";\n_.map([1], "id");',
        'import _ from "lodash";\n_.map([1]);',
        'import _ from "lodash";\nconst id = "id";\n_.map([1], id);',
        'import _ from "lodash";\n_.includes("text", /t/u);',
        'import _ from "lodash";\n_.includes(values, 1);',
    ],
    invalid: [
        {
            code: 'import _ from "lodash";\n_.isArray(value);',
            errors: [
                {
                    messageId: 'direct',
                    data: { alternative: 'Array.isArray()', method: 'isArray', library: 'lodash' },
                    line: 2,
                    column: 3,
                },
            ],
        },
        {
            code: 'import { keys } from "lodash-es";\nkeys(value);',
            errors: [
                {
                    messageId: 'cautious',
                    data: {
                        alternative: 'Object.keys()',
                        method: 'keys',
                        library: 'lodash-es',
                        reason: 'the library treats nullish values differently',
                    },
                    line: 2,
                    column: 1,
                },
            ],
        },
        {
            code: 'const _ = require("underscore");\n_.uniq(values);',
            errors: [
                {
                    messageId: 'example',
                    data: {
                        alternative: 'Set',
                        method: 'uniq',
                        library: 'underscore.js',
                        example: '`[...new Set(values)]`',
                        reason: 'the library treats nullish values differently',
                    },
                },
            ],
        },
        {
            code: 'import isArray from "lodash.isarray";\nisArray(value);',
            errors: [{ messageId: 'direct' }],
        },
        {
            code: 'import keys from "lodash/keys";\nkeys(value);',
            errors: [{ messageId: 'cautious' }],
        },
        {
            code: 'require("lodash").isInteger(value);',
            errors: [{ messageId: 'direct' }],
        },
        ...[
            [
                '_.includes([1], 1);',
                'includes',
                'Array.prototype.includes()',
                'the library also accepts strings, objects, and nullish values',
            ],
            [
                '_.includes(`text`, "t");',
                'includes',
                'String.prototype.includes()',
                'the library also accepts arrays, objects, and nullish values',
            ],
        ].map(([call = '', method = '', alternative = '', reason = '']) => ({
            code: `import _ from "lodash";\n${call}`,
            errors: [
                {
                    messageId: 'cautious' as const,
                    data: { alternative, method, reason, library: 'lodash' },
                },
            ],
        })),
        { code: 'import _ from "lodash";\n_.includes("text");', errors: [{ messageId: 'cautious' }] },
    ],
});

buildRuleTester({ languageOptions: { ecmaVersion: 7 } }).run('prefer-native-lodash in ES2016', rule, {
    valid: ['import _ from "lodash";\n_.values(value);'],
    invalid: [],
});

buildRuleTester({ languageOptions: { ecmaVersion: 2018 } }).run('prefer-native-lodash in ES2018', rule, {
    valid: [],
    invalid: [{ code: 'import _ from "lodash";\n_.values(value);', errors: [{ messageId: 'cautious' }] }],
});

buildTypedRuleTester().run('prefer-native-lodash with types', rule, {
    valid: [
        'import _ from "lodash";\ndeclare const value: Record<string, number>;\n_.map(value, (entry) => entry);',
        'import _ from "lodash";\ndeclare const value: string[] | string;\n_.includes(value, "t");',
    ],
    invalid: [
        [
            'declare const value: string;\n_.contains(value, "t");',
            'contains',
            'String.prototype.includes()',
            'the library also accepts arrays, objects, and nullish values',
        ],
    ].map(([body = '', method = '', alternative = '', reason = '']) => ({
        code: `import _ from "lodash";\n${body}`,
        errors: [
            {
                messageId: 'cautious' as const,
                data: { alternative, method, reason, library: 'lodash' },
            },
        ],
    })),
});
