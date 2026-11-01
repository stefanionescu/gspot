import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-identical-functions', plugin.rules['no-identical-functions'], {
    valid: [
        'function first() {\n    a();\n    b();\n}\nfunction second() {\n    a();\n    b();\n}',
        'function first() {\n    a();\n    b();\n    c();\n}\nfunction second() {\n    a();\n    b();\n    d();\n}',
        'run(() => {\n    a();\n    b();\n    c();\n});\nrun(() => {\n    a();\n    b();\n    c();\n});',
        {
            code: 'function first() {\n    a();\n    b();\n    c();\n}\nfunction second() {\n    a();\n    b();\n    c();\n}',
            options: [{ minLines: 4 }],
        },
    ],
    invalid: [
        {
            code: 'function first() {\n    a();\n    b();\n    c();\n}\nfunction second() {\n    a();\n    b();\n    c();\n}',
            errors: [{ messageId: 'identical', data: { line: 1 }, line: 6 }],
        },
        {
            code: 'const first = () => {\n    a();\n    b();\n    c();\n};\nclass Shape {\n    second() {\n        a();\n        b();\n        c();\n    }\n}',
            errors: [{ messageId: 'identical', data: { line: 1 }, line: 7 }],
        },
        {
            code: 'function first() {\n    a();\n    b();\n}\nconst second = function () {\n    a();\n    b();\n};',
            options: [{ minLines: 2 }],
            errors: [{ messageId: 'identical', data: { line: 1 }, line: 5 }],
        },
    ],
});
