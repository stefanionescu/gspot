import { preferNativeLodash } from '#eslint-plugin/rules/utilities/prefer-native-lodash.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('prefer-native-lodash', preferNativeLodash, {
    valid: [
        'import _ from "./utilities";\n_.isArray(value);',
        'import _ from "lodash";\n_(values).keys();',
        'import _ from "lodash";\n_.map(values, read);',
        'import _ from "lodash";\n_.map([1]);',
        'import _ from "lodash";\nconst id = "id";\n_.map([1], id);',
        'import _ from "lodash";\n_.includes("text", /t/u);',
        'import _ from "lodash";\n_.includes(values, 1);',
        'import _ from "lodash";\n_.includes();',
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
            errors: [
                { messageId: 'direct', data: { alternative: 'Array.isArray()', method: 'isArray', library: 'lodash' } },
            ],
        },
        {
            code: 'import keys from "lodash/keys";\nkeys(value);',
            errors: [
                {
                    messageId: 'cautious',
                    data: {
                        alternative: 'Object.keys()',
                        method: 'keys',
                        library: 'lodash',
                        reason: 'the library treats nullish values differently',
                    },
                },
            ],
        },
        {
            code: 'require("lodash").isInteger(value);',
            errors: [
                {
                    messageId: 'direct',
                    data: { alternative: 'Number.isInteger()', method: 'isInteger', library: 'lodash' },
                },
            ],
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
            [
                '_.map([1, 2], double);',
                'map',
                'Array.prototype.map()',
                'the library also accepts objects and nullish values',
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
    ],
});

buildRuleTester({ languageOptions: { ecmaVersion: 7 } }).run('prefer-native-lodash in ES2016', preferNativeLodash, {
    valid: ['import _ from "lodash";\n_.values(value);'],
    invalid: [],
});

buildTypedRuleTester().run('prefer-native-lodash with types', preferNativeLodash, {
    valid: [
        'import _ from "lodash";\ndeclare const value: Record<string, number>;\n_.map(value, (entry) => entry);',
        'import _ from "lodash";\ndeclare const value: string[] | string;\n_.includes(value, "t");',
    ],
    invalid: [
        {
            code: 'import _ from "lodash";\ndeclare const value: string;\n_.contains(value, "t");',
            errors: [
                {
                    messageId: 'cautious',
                    data: {
                        alternative: 'String.prototype.includes()',
                        method: 'contains',
                        reason: 'the library also accepts arrays, objects, and nullish values',
                        library: 'lodash',
                    },
                },
            ],
        },
        {
            code: 'import _ from "lodash";\ndeclare const pair: [number, number];\n_.map(pair, (value) => value * 2);',
            errors: [
                {
                    messageId: 'cautious',
                    data: {
                        alternative: 'Array.prototype.map()',
                        method: 'map',
                        library: 'lodash',
                        reason: 'the library also accepts objects and nullish values',
                    },
                },
            ],
        },
    ],
});
