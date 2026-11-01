import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-commented-code', plugin.rules['no-commented-code'], {
    valid: [
        '// Read the user before sending a response.',
        '// }',
        '// Example: const user = readUser();',
        '// For example, call readUser();',
        '// Examples:\n// const user = readUser();',
        '// Call readUser() before sending a response.',
        '// https://example.com/path',
        '/* eslint no-console: "error" */',
        '/** Example: const user = readUser(); */',
        '// TODO: replace readUser() with the cache.',
        '/* Copyright 2026 Example */',
    ],
    invalid: [
        { code: '// const delimiter = "{";', errors: [{ messageId: 'code' }] },
        { code: '// eslintConfig = config;', errors: [{ messageId: 'code' }] },
        { code: '// TODO = read();', errors: [{ messageId: 'code' }] },
        { code: '// const user = {', errors: [{ messageId: 'code' }] },
        { code: '// const handler = () => {', errors: [{ messageId: 'code' }] },
        { code: '// class User {', errors: [{ messageId: 'code' }] },
        { code: '// if (ready()) {', errors: [{ messageId: 'code' }] },
        { code: '// onClick={handleClick} className="button"', errors: [{ messageId: 'code' }] },
        { code: '// <Button />;', errors: [{ messageId: 'code' }] },
        { code: '// const user = readUser();', errors: [{ messageId: 'code' }] },
        { code: '/* sendResponse(user); */', errors: [{ messageId: 'code' }] },
        { code: '// if (ready) {\n//   sendResponse(user);\n// }', errors: [{ messageId: 'code' }] },
        { code: '// const user = {\n// name: "Example"\n// };', errors: [{ messageId: 'code' }] },
        { code: '// user.name = name;', errors: [{ messageId: 'code' }] },
        { code: '// if (ready) {', errors: [{ messageId: 'code' }] },
        { code: '// Previous implementation:\n// sendResponse(user);', errors: [{ messageId: 'code' }] },
    ],
});
