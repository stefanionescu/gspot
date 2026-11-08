import * as parser from '@typescript-eslint/parser';

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
    ],
    invalid: [
        { code: '// const delimiter = "{";', errors: [{ messageId: 'code' }] },
        { code: '// const user = {', errors: [{ messageId: 'code' }] },
        { code: '// onClick={handleClick} className="button"', errors: [{ messageId: 'code' }] },
        { code: '// {...props}', errors: [{ messageId: 'code' }] },
        { code: '/* sendResponse(user); */', errors: [{ messageId: 'code' }] },
        { code: '// if (ready) {\n//   sendResponse(user);\n// }', errors: [{ messageId: 'code' }] },
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
    ],
});
