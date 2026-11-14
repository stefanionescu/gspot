import { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noCommentedCode } from '#eslint-plugin/rules/comments/no-commented-code.ts';

buildRuleTester().run('no-commented-code', noCommentedCode, {
    valid: [
        '// Read the user before sending a response.',
        '// }',
        '// Examples:\n// const user = readUser();',
        '// Call readUser() before sending a response.',
        '// TODO: readUser();',
        {
            name: 'the script parser of an Astro component decides what parses as code',
            code: '// sendResponse(user);',
            languageOptions: { parserOptions: { parser: { parse: () => ({ body: [] }) } } },
        },
        {
            name: 'a script parser of a Vue component decides what parses as code',
            code: '// sendResponse(user);',
            languageOptions: { parserOptions: { parser: { ts: { parseForESLint: () => ({ ast: { body: [] } }) } } } },
        },
    ],
    invalid: [
        { code: '// const delimiter = "{";', errors: [{ messageId: 'code' }] },
        { code: '// const user = {', errors: [{ messageId: 'code' }] },
        { code: '// onClick={handleClick} className="button"', errors: [{ messageId: 'code' }] },
        { code: '// {...props}', errors: [{ messageId: 'code' }] },
        { code: '/* sendResponse(user); */', errors: [{ messageId: 'code' }] },
        {
            code: '// if (ready) {\n//   sendResponse(user);\n// }',
            errors: [{ messageId: 'code', line: 1, endLine: 3 }],
        },
        { code: '// sendResponse(user); }', errors: [{ messageId: 'code' }] },
        { code: '// Read the user first.\n// sendResponse(user);', errors: [{ messageId: 'code', line: 2 }] },
        { code: '// try {', errors: [{ messageId: 'code' }] },
    ],
});

test('an error of the script parser that is no parse error stops the lint run', () => {
    const linter = new Linter({ configType: 'flat' });
    const config: object = {
        plugins: { gspot: plugin },
        rules: { 'gspot/no-commented-code': 'error' },
        languageOptions: {
            parserOptions: {
                parser: {
                    parse: () => {
                        throw new TypeError('Broken parser');
                    },
                },
            },
        },
    };
    expect(() => linter.verify('// run();', config)).toThrow('Broken parser');
});
