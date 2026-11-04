import * as parser from '@typescript-eslint/parser';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noCommentedCode } from '#eslint-plugin/rules/structure/no-commented-code.ts';

buildRuleTester().run('no-commented-code', noCommentedCode, {
    valid: [
        '// Read the user before sending a response.',
        '// }',
        '// Example: const user = readUser();',
        '// Examples:\n// const user = readUser();',
        '// Call readUser() before sending a response.',
        '/* eslint no-console: "error" */',
        '// TODO: replace readUser() with the cache.',
        '/* Copyright 2026 Example */',
        '// We return early here because the list is empty',
        '// Dynamic import keeps the start fast',
    ],
    invalid: [
        { code: '// const delimiter = "{";', errors: [{ messageId: 'code' }] },
        { code: '// const user = {', errors: [{ messageId: 'code' }] },
        { code: '// onClick={handleClick} className="button"', errors: [{ messageId: 'code' }] },
        { code: '// {...props}', errors: [{ messageId: 'code' }] },
        { code: '/* sendResponse(user); */', errors: [{ messageId: 'code' }] },
        { code: '// if (ready) {\n//   sendResponse(user);\n// }', errors: [{ messageId: 'code' }] },
        { code: '// Previous implementation:\n// sendResponse(user);', errors: [{ messageId: 'code' }] },
        { code: '// sendResponse(user); }', errors: [{ messageId: 'code' }] },
        {
            name: 'parses with the script parser of an Astro component',
            code: '// sendResponse(user);',
            languageOptions: { parserOptions: { parser: { parse: parser.parse } } },
            errors: [{ messageId: 'code' }],
        },
        {
            name: 'parses with the script parsers of a Vue component',
            code: '// sendResponse(user);',
            languageOptions: { parserOptions: { parser: { ts: parser } } },
            errors: [{ messageId: 'code' }],
        },
        {
            name: 'parses with a language parser that has only parse',
            code: '// const a = 1;\nrun();',
            languageOptions: { parser: { parse: parser.parse } },
            errors: [{ messageId: 'code' }],
        },
        {
            name: 'parses with a parser module in the parser options',
            code: '// const a = 1;\nrun();',
            languageOptions: { parserOptions: { parser } },
            errors: [{ messageId: 'code' }],
        },
    ],
});
