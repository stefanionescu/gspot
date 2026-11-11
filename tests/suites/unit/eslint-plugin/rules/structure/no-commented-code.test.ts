import { noCommentedCode } from '#eslint-plugin/rules/structure/no-commented-code.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-commented-code', noCommentedCode, {
    valid: [
        '// Read the user before sending a response.',
        '// }',
        '// Examples:\n// const user = readUser();',
        '// Call readUser() before sending a response.',
        '/* eslint no-console: "error" */',
        '// TODO: replace readUser() with the cache.',
        {
            name: 'the script parser of an Astro component decides what parses as code',
            code: '// sendResponse(user);',
            languageOptions: { parserOptions: { parser: { parse: () => ({ body: [] }) } } },
        },
        {
            name: 'a script parser of a Vue component decides what parses as code',
            code: '// sendResponse(user);',
            languageOptions: { parserOptions: { parser: { ts: { parse: () => ({ body: [] }) } } } },
        },
    ],
    invalid: [
        { code: '// const delimiter = "{";', errors: [{ messageId: 'code' }] },
        { code: '// const user = {', errors: [{ messageId: 'code' }] },
        { code: '// onClick={handleClick} className="button"', errors: [{ messageId: 'code' }] },
        { code: '// {...props}', errors: [{ messageId: 'code' }] },
        { code: '/* sendResponse(user); */', errors: [{ messageId: 'code' }] },
        { code: '// if (ready) {\n//   sendResponse(user);\n// }', errors: [{ messageId: 'code' }] },
        { code: '// sendResponse(user); }', errors: [{ messageId: 'code' }] },
    ],
});
