import { tableHeaderReference } from '#eslint-plugin/rules/accessibility/table-header-reference.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('table-header-reference', tableHeaderReference, {
    valid: [
        '<table><tr><th id="a">A</th><th id="b">B</th></tr><tr><td colSpan="2" headers="a b">1</td></tr></table>;',
        '<table>{rows}</table>;',
        '<table></table>;',
        'const table = <table><tr><th id="name">Name</th></tr><tr><td headers="name">Ada</td></tr></table>;',
    ],
    invalid: [
        {
            code: 'const a = <table><tr><th id="name">Name</th><th id="age">Age</th></tr><tr><td headers="name">Ada</td><td headers="name">36</td></tr><tr><td headers="email">x</td><td headers="age">1</td></tr></table>;\nconst b = <table><tr><th id="h" colSpan={2}>H</th></tr><tr><td headers="h">1</td><td headers="h">2</td></tr></table>;',
            errors: [
                { messageId: 'otherHeader', line: 1 },
                { messageId: 'unknownHeader', line: 1 },
            ],
        },
    ],
});
