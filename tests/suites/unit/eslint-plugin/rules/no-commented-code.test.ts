import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-commented-code', plugin.rules['no-commented-code'], {
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
    ],
});
