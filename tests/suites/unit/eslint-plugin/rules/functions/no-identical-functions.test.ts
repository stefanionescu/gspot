import { noIdenticalFunctions } from '#eslint-plugin/rules/functions/no-identical-functions.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-identical-functions', noIdenticalFunctions, {
    valid: [
        'function first() {\n    a();\n    b();\n}\nfunction second() {\n    a();\n    b();\n}',
        'function first() {\n    a();\n    b();\n    c();\n}\nfunction second() {\n    a();\n    b();\n    d();\n}',
        'run(() => {\n    a();\n    b();\n    c();\n});\nrun(() => {\n    a();\n    b();\n    c();\n});',
    ],
    invalid: [
        {
            code: 'function first() {\n    a();\n    b();\n    c();\n}\nfunction second() {\n    a();\n    b();\n    c();\n}',
            errors: [{ messageId: 'identical', data: { line: 1 }, line: 6 }],
        },
        {
            code: 'function first() {\n    a();\n    b();\n}\nconst second = function () {\n    a();\n    b();\n};',
            options: [{ minLines: 2 }],
            errors: [{ messageId: 'identical', data: { line: 1 }, line: 5 }],
        },
        {
            code: 'class Store {\n    first() {\n        a();\n        b();\n        c();\n    }\n    second() {\n        a();\n        b();\n        c();\n    }\n}',
            errors: [{ messageId: 'identical', data: { line: 2 } }],
        },
        {
            code: 'const a = () => run(\n  1,\n  2,\n);\nconst b = () => run(\n  1,\n  2,\n);',
            errors: [{ messageId: 'identical' }],
        },
    ],
});
