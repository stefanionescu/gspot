import { tableHeader } from '#eslint-plugin/rules/accessibility/table-header.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('table-header', tableHeader, {
    valid: [
        'const table = <table><tr><th>Name</th></tr><tr><td>Ada</td></tr></table>;',
        'const table = <Layout.Table><tr><td>A</td></tr></Layout.Table>;',
        'const table = <svg:table><tr><td>A</td></tr></svg:table>;',
        'const table = <table aria-hidden><tr><td>A</td></tr></table>;',
        'const table = <table><tr><th rowSpan="0">A</th><td>1</td></tr><tr><td>2</td></tr></table>;',
        'const table = <table><tr><td rowSpan={span}>A</td></tr></table>;',
        'const table = <table><tr>{cells}</tr></table>;',
        'const table = <table><tr><><td>A</td></></tr></table>;',
    ],
    invalid: [
        {
            code: 'const a = <table><tr><td>A</td><td>B</td></tr></table>;\nconst b = <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>;\nconst c = <table><tr><th>A</th><td>1</td></tr><tr><th>B</th><td>2</td></tr></table>;\nconst d = <table role="presentation"><tr><td>A</td></tr></table>;\nconst e = <table>{rows}</table>;\nconst f = <table><Row /></table>;\nconst g = <table aria-hidden="true"><tr><td>A</td></tr></table>;\nconst h = <table {...props} />;\nconst i = <table></table>;\nconst j = <table><tr><th rowSpan={2}>A</th><td>1</td></tr><tr><td>2</td></tr></table>;\nconst k = <table><tr><th colSpan="2">A</th></tr><tr><td>1</td><td>2</td></tr></table>;',
            errors: [
                { messageId: 'missingHeader', line: 1 },
                { messageId: 'missingHeader', line: 9 },
            ],
        },
        {
            name: 'reads a table written over several lines, past captions, comments, and fragments',
            code: 'const table = <table>\n    <caption>Sales</caption>\n    {/* rows */}\n    <>\n        <tr>\n            {/* cells */}\n            <td>A</td>\n        </tr>\n    </>\n</table>;',
            errors: [{ messageId: 'missingHeader', line: 1 }],
        },
        {
            name: 'stops at a row without cells',
            code: 'const table = <table><tr></tr></table>;',
            errors: [{ messageId: 'missingHeader', line: 1 }],
        },
    ],
});
