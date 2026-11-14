import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noDetachedDocComments } from '#eslint-plugin/rules/comments/no-detached-doc-comments.ts';

buildRuleTester().run('no-detached-doc-comments', noDetachedDocComments, {
    valid: [
        '/** Doubles a number. */\nfunction twice(value) { return value * 2; }',
        '// Doubles numbers.\n\nfunction twice(value) { return value * 2; }',
        '/* A plain block comment. */\n\nfunction twice(value) { return value * 2; }',
        "/** The file header. */\n\nimport { a } from './a';",
        '/** @file Doubles numbers. */\n\nexport function twice(value) { return value * 2; }',
        '/** @typedef {{ value: number }} Operand */\n\nexport function twice(value) { return value * 2; }',
        '/** Explains the call. */\n\ntwice(2);',
        '/** Doubles a number. */\n\n// A note about the function.\nfunction twice(value) { return value * 2; }',
        'const first = 1; /** A trailing note. */\n\nconst second = 2;',
    ],
    invalid: [
        {
            code: '/** Doubles a number. */\n\nfunction twice(value) { return value * 2; }',
            name: 'a doc comment, an empty line, and a function report once',
            errors: [{ messageId: 'detached', line: 1 }],
            output: '/** Doubles a number. */\nfunction twice(value) { return value * 2; }',
        },
        {
            code: '/** Doubles a number. */\n \n\nexport const twice = (value) => value * 2;',
            name: 'a line that holds only a space counts as blank',
            errors: [{ messageId: 'detached', line: 1 }],
            output: '/** Doubles a number. */\nexport const twice = (value) => value * 2;',
        },
        {
            code: 'class Counter {\n    /** Adds one. */\n\n    increment() {}\n}',
            name: 'a class member keeps its indentation',
            errors: [{ messageId: 'detached', line: 2 }],
            output: 'class Counter {\n    /** Adds one. */\n    increment() {}\n}',
        },
        {
            code: '/** Builds greetings. */\n\n@Injectable()\nclass Greeter {}',
            name: 'a decorated class reports',
            errors: [{ messageId: 'detached', line: 1 }],
            output: '/** Builds greetings. */\n@Injectable()\nclass Greeter {}',
        },
        {
            code: '/** The shape of an operand. */\n\ntype Operand = { value: number };',
            name: 'a type alias reports',
            errors: [{ messageId: 'detached', line: 1 }],
            output: '/** The shape of an operand. */\ntype Operand = { value: number };',
        },
    ],
});

test('one fix run removes an unused disable directive and joins the doc comment to its function', () => {
    const linter = new Linter({ configType: 'flat' });
    const config: object = {
        plugins: { gspot: plugin },
        linterOptions: { reportUnusedDisableDirectives: 'error' },
        rules: { 'gspot/no-detached-doc-comments': 'error', 'no-console': 'error' },
    };
    const source =
        '/** Doubles a number. */\n// eslint-disable-next-line no-console\nexport function twice(value) {\n    return value * 2;\n}\n';
    const { output, messages } = linter.verifyAndFix(source, config);
    expect({ output, messages }).toStrictEqual({
        output: '/** Doubles a number. */\nexport function twice(value) {\n    return value * 2;\n}\n',
        messages: [],
    });
});
