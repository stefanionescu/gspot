import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { tableHeaderReference } from '#eslint-plugin/rules/accessibility/table-header-reference.ts';

buildRuleTester().run('table-header-reference', tableHeaderReference, {
    valid: [
        '<table><tr><th id="a">A</th><th id="b">B</th></tr><tr><td colSpan="2" headers="a b">1</td></tr></table>;',
        '<table><tr><th id="year">2025</th><td headers="year">12</td></tr></table>;',
    ],
    invalid: [
        {
            code: 'const a = <table><tr><th id="name">Name</th><th id="age">Age</th></tr><tr><td headers="name">Ada</td><td headers="name">36</td></tr><tr><td headers="email">x</td></tr></table>;',
            errors: [
                { messageId: 'otherHeader', data: { id: 'name' } },
                { messageId: 'unknownHeader', data: { id: 'email' } },
            ],
        },
    ],
});
