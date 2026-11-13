import { tableHeader } from '#eslint-plugin/rules/accessibility/table-header.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('table-header', tableHeader, {
    valid: [
        'const b = <table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>;',
        'const d = <table role="presentation"><tr><td>A</td></tr></table>;',
        'const e = <table>{rows}</table>;',
        'const f = <table><Row /></table>;',
        'const h = <table {...props} />;',
        'const j = <table><tr><th rowSpan={2}>A</th><td>1</td></tr><tr><td>2</td></tr></table>;',
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
            code: 'const table = <table><tr><td>A</td><td>B</td></tr></table>;',
            errors: [{ messageId: 'missingHeader' }],
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
